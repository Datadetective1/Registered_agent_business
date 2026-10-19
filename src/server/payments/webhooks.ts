import "server-only";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, entities, entityServices, payments, subscriptions, webhookEvents, type Subscription } from "@/db/schema";
import { audit, STRIPE } from "@/server/audit";
import { confirmOrderPayment } from "@/server/fulfillment";
import { notifyAdmins, sendEmail } from "@/server/notifications/send";
import { CHECKOUT_EXPAND, confirmationFromSession, getStripe, subscriptionSyncFromStripe } from "./stripe";
import type { SubscriptionSync } from "./types";

/** Stripe calls the handler needs; injectable for tests. */
export type StripeDeps = {
  retrieveSession(id: string): Promise<Stripe.Checkout.Session>;
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  invoiceForPaymentIntent(paymentIntentId: string): Promise<string | null>;
};

export const liveStripeDeps: StripeDeps = {
  retrieveSession: (id) => getStripe().checkout.sessions.retrieve(id, { expand: CHECKOUT_EXPAND }),
  retrieveSubscription: (id) => getStripe().subscriptions.retrieve(id),
  async invoiceForPaymentIntent(pi) {
    const list = await getStripe().invoicePayments.list({ payment: { type: "payment_intent", payment_intent: pi }, limit: 1 });
    const inv = list.data[0]?.invoice;
    return inv ? (typeof inv === "string" ? inv : inv.id) : null;
  },
};

const idOf = (v: string | { id: string } | null | undefined) => (v ? (typeof v === "string" ? v : v.id) : null);

/**
 * Process a verified Stripe event exactly once. Events already processed are
 * skipped; failed events are retried by Stripe and re-processed (all handlers
 * are idempotent).
 */
export async function handleStripeEvent(event: Stripe.Event, deps: StripeDeps = liveStripeDeps): Promise<"processed" | "duplicate"> {
  const inserted = await db.insert(webhookEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning();
  if (!inserted.length) {
    const [existing] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, event.id)).limit(1);
    if (existing?.processedAt) return "duplicate";
  }
  try {
    await dispatch(event, deps);
    await db.update(webhookEvents).set({ processedAt: new Date(), error: null }).where(eq(webhookEvents.id, event.id));
    return "processed";
  } catch (err) {
    await db
      .update(webhookEvents)
      .set({ error: err instanceof Error ? err.message.slice(0, 1000) : String(err) })
      .where(eq(webhookEvents.id, event.id));
    throw err;
  }
}

async function dispatch(event: Stripe.Event, deps: StripeDeps) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = await deps.retrieveSession(event.data.object.id);
      const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
      const confirmation = confirmationFromSession(session);
      if (paid && confirmation) await confirmOrderPayment(confirmation, STRIPE);
      return;
    }
    case "invoice.paid":
      return onInvoicePaid(event.data.object, deps);
    case "invoice.payment_failed":
      return onInvoiceFailed(event.data.object, deps);
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscription(subscriptionSyncFromStripe(event.data.object), event.type === "customer.subscription.deleted");
    case "charge.refunded":
      return onChargeRefunded(event.data.object, deps);
    default:
      return; // Not used; acknowledged so Stripe stops retrying.
  }
}

/* --------------------------------- helpers -------------------------------- */

async function findSubscription(stripeSubscriptionId: string | null): Promise<Subscription | undefined> {
  if (!stripeSubscriptionId) return undefined;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId)).limit(1);
  return sub;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription);
}

/** Apply Stripe's subscription state to our records and the linked service instances. */
export async function syncSubscription(sync: SubscriptionSync, deleted = false) {
  const sub = await findSubscription(sync.stripeSubscriptionId);
  if (!sub) return;
  const status = deleted ? "canceled" : sync.status;
  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({
        status,
        currentPeriodStart: sync.currentPeriodStart ?? sub.currentPeriodStart,
        currentPeriodEnd: sync.currentPeriodEnd ?? sub.currentPeriodEnd,
        cancelAtPeriodEnd: sync.cancelAtPeriodEnd,
        canceledAt: sync.canceledAt,
        endedAt: sync.endedAt ?? (deleted ? new Date() : null),
      })
      .where(eq(subscriptions.id, sub.id));

    const linked = await tx.select().from(entityServices).where(eq(entityServices.subscriptionId, sub.id));
    for (const es of linked) {
      let next = es.status;
      if (status === "canceled" || status === "incomplete_expired") next = "cancelled";
      else if (sync.cancelAtPeriodEnd && es.status === "active") next = "cancellation_scheduled";
      else if (!sync.cancelAtPeriodEnd && es.status === "cancellation_scheduled") next = "active";
      if (next !== es.status) {
        await tx
          .update(entityServices)
          .set({ status: next, endsAt: next === "cancelled" ? (sync.endedAt ?? new Date()) : next === "cancellation_scheduled" ? sync.currentPeriodEnd : null })
          .where(eq(entityServices.id, es.id));
      }
    }
    await audit(
      { actor: STRIPE, action: deleted ? "subscription.ended" : "subscription.synced", targetType: "subscription", targetId: sub.id, customerId: sub.customerId, metadata: { status, cancelAtPeriodEnd: sync.cancelAtPeriodEnd } },
      tx,
    );
  });

  if (deleted) {
    const [row] = await db
      .select({ entity: entities, customer: customers })
      .from(entities)
      .innerJoin(customers, eq(customers.id, entities.customerId))
      .where(eq(entities.id, sub.entityId))
      .limit(1);
    if (row) {
      await notifyAdmins(
        "admin_subscription_ended",
        { entityName: row.entity.legalName, entityId: row.entity.id, customerName: `${row.customer.firstName} ${row.customer.lastName}` },
        { customerId: row.customer.id, entityId: row.entity.id },
      );
    }
  }
}

async function upsertInvoicePayment(invoice: Stripe.Invoice, sub: Subscription, status: "succeeded" | "failed") {
  const [existing] = await db.select().from(payments).where(eq(payments.stripeInvoiceId, invoice.id)).limit(1);
  const values = {
    customerId: sub.customerId,
    subscriptionId: sub.id,
    gateway: "stripe" as const,
    stripeInvoiceId: invoice.id,
    amountCents: status === "succeeded" ? invoice.amount_paid : invoice.amount_due,
    currency: invoice.currency,
    status,
    description: "Registered agent service renewal",
    invoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
    failureMessage: status === "failed" ? "The payment method on file could not be charged." : null,
    paidAt: status === "succeeded" ? new Date() : null,
  };
  if (existing) await db.update(payments).set(values).where(eq(payments.id, existing.id));
  else await db.insert(payments).values(values);
  return existing;
}

async function customerAndEntity(sub: Subscription) {
  const [row] = await db
    .select({ customer: customers, entity: entities })
    .from(customers)
    .innerJoin(entities, eq(entities.id, sub.entityId))
    .where(eq(customers.id, sub.customerId))
    .limit(1);
  return row;
}

async function onInvoicePaid(invoice: Stripe.Invoice, deps: StripeDeps) {
  // The first invoice is recorded by checkout confirmation; only renewals are handled here.
  if (invoice.billing_reason !== "subscription_cycle") return;
  const sub = await findSubscription(invoiceSubscriptionId(invoice));
  if (!sub) return;
  const previous = await upsertInvoicePayment(invoice, sub, "succeeded");
  await syncSubscription(subscriptionSyncFromStripe(await deps.retrieveSubscription(sub.stripeSubscriptionId as string)));
  await audit({ actor: STRIPE, action: "subscription.renewed", targetType: "subscription", targetId: sub.id, customerId: sub.customerId, metadata: { invoice: invoice.id, amount: invoice.amount_paid } });
  if (previous?.status === "succeeded") return; // already notified
  const row = await customerAndEntity(sub);
  if (row) {
    await sendEmail({
      template: "payment_succeeded",
      to: row.customer.email,
      customerId: row.customer.id,
      entityId: row.entity.id,
      data: {
        firstName: row.customer.firstName,
        description: `registered agent service renewal for ${row.entity.legalName}`,
        amountCents: invoice.amount_paid,
        receiptUrl: invoice.hosted_invoice_url ?? null,
      },
    });
  }
}

async function onInvoiceFailed(invoice: Stripe.Invoice, deps: StripeDeps) {
  if (invoice.billing_reason !== "subscription_cycle") return;
  const sub = await findSubscription(invoiceSubscriptionId(invoice));
  if (!sub) return;
  const previous = await upsertInvoicePayment(invoice, sub, "failed");
  await syncSubscription(subscriptionSyncFromStripe(await deps.retrieveSubscription(sub.stripeSubscriptionId as string)));
  await audit({ actor: STRIPE, action: "subscription.payment_failed", targetType: "subscription", targetId: sub.id, customerId: sub.customerId, metadata: { invoice: invoice.id, attempt: invoice.attempt_count } });
  if (previous?.status === "failed") return; // notify on the first failure only; Stripe retries automatically
  const row = await customerAndEntity(sub);
  if (!row) return;
  const description = `registered agent service for ${row.entity.legalName}`;
  await sendEmail({
    template: "payment_failed",
    to: row.customer.email,
    customerId: row.customer.id,
    entityId: row.entity.id,
    data: { firstName: row.customer.firstName, description, amountCents: invoice.amount_due },
  });
  await notifyAdmins(
    "admin_payment_failed",
    { customerName: `${row.customer.firstName} ${row.customer.lastName}`, customerId: row.customer.id, description, amountCents: invoice.amount_due },
    { customerId: row.customer.id, entityId: row.entity.id },
  );
}

async function onChargeRefunded(charge: Stripe.Charge, deps: StripeDeps) {
  const pi = idOf(charge.payment_intent);
  if (!pi) return;
  let [payment] = await db.select().from(payments).where(eq(payments.stripePaymentIntentId, pi)).limit(1);
  if (!payment) {
    const invoiceId = await deps.invoiceForPaymentIntent(pi);
    if (invoiceId) [payment] = await db.select().from(payments).where(eq(payments.stripeInvoiceId, invoiceId)).limit(1);
  }
  if (!payment) return;
  const full = charge.amount_refunded >= charge.amount;
  await db
    .update(payments)
    .set({ amountRefundedCents: charge.amount_refunded, status: full ? "refunded" : "partially_refunded" })
    .where(eq(payments.id, payment.id));
  await audit({
    actor: STRIPE,
    action: "payment.refunded",
    targetType: "payment",
    targetId: payment.id,
    customerId: payment.customerId,
    orderId: payment.orderId,
    metadata: { amountRefunded: charge.amount_refunded, full },
  });
}

/** Verify the Stripe-Signature header. Throws on an invalid signature. */
export function verifyStripeEvent(rawBody: string, signature: string | null, secret: string): Stripe.Event {
  if (!signature) throw new Error("Missing Stripe-Signature header");
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
