import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  addresses,
  customers,
  entities,
  entityServices,
  orderItems,
  orders,
  payments,
  providerOrders,
  services,
  subscriptions,
  type Customer,
  type Order,
} from "@/db/schema";
import { fullLlcName, type AddressInput, type BusinessAddressIntake, type LlcFormationIntake, type RegisteredAgentIntake } from "@/lib/intake";
import { track } from "./analytics";
import { audit, type Actor } from "./audit";
import { notifyAdmins, sendEmail } from "./notifications/send";
import { orderProductName, type CheckoutData } from "./orders";
import type { PaymentConfirmation } from "./payments/types";
import { getProvider } from "./providers";
import { businessAddressInput, changeOfAgentInput, formationInput, registeredAgentInput } from "./providers/payloads";
import type { ProviderOperation, ProviderSubmission } from "./providers/types";

/* -------------------------------------------------------------------------- */
/*  Payment confirmation                                                      */
/* -------------------------------------------------------------------------- */

export type ConfirmResult = "confirmed" | "already_processed" | "not_found" | "amount_mismatch";

function addInterval(from: Date, billing: "annual" | "monthly"): Date {
  const d = new Date(from);
  if (billing === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/**
 * Mark an order paid and provision its records. Idempotent: called by the Stripe
 * webhook, the checkout success page (fallback) and the simulated gateway. The
 * order row is locked and only a `new` order transitions, so it runs exactly once.
 */
export async function confirmOrderPayment(c: PaymentConfirmation, actor: Actor): Promise<ConfirmResult> {
  const outcome = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, c.orderId)).for("update").limit(1);
    if (!order) return { result: "not_found" as const };
    if (order.status !== "new") return { result: "already_processed" as const };
    if (c.amountTotalCents !== order.totalCents) {
      await audit(
        {
          actor,
          action: "order.payment_amount_mismatch",
          targetType: "order",
          targetId: order.id,
          orderId: order.id,
          customerId: order.customerId,
          metadata: { expected: order.totalCents, received: c.amountTotalCents, session: c.stripeCheckoutSessionId },
        },
        tx,
      );
      return { result: "amount_mismatch" as const, order };
    }

    const now = new Date();
    const checkout = order.checkoutData as CheckoutData;

    // 1. Entity: existing (chosen at checkout) or created now from checkout answers.
    let entityId = order.entityId;
    if (!entityId) {
      const isFormation = order.type === "llc_formation";
      const [entity] = await tx
        .insert(entities)
        .values({
          customerId: order.customerId,
          legalName: isFormation ? (checkout.llcName ?? "New Texas LLC") : (checkout.entity?.legalName ?? "New business"),
          entityType: isFormation ? "llc" : (checkout.entity?.entityType ?? "other"),
          jurisdiction: isFormation ? "TX" : (checkout.entity?.jurisdiction ?? "TX"),
          status: isFormation ? "pending_formation" : checkout.situation === "forming" ? "pending_formation" : "unknown",
          formationDate: isFormation ? null : (checkout.entity?.formationDate ?? null),
        })
        .returning();
      entityId = entity.id;
    }

    // 2. Order → payment_confirmed.
    const [paid] = await tx
      .update(orders)
      .set({
        status: "payment_confirmed",
        entityId,
        paidAt: now,
        gateway: c.gateway,
        stripeCheckoutSessionId: c.stripeCheckoutSessionId ?? order.stripeCheckoutSessionId,
        stripePaymentIntentId: c.stripePaymentIntentId ?? null,
        stripeSubscriptionId: c.subscription?.stripeSubscriptionId ?? null,
      })
      .where(eq(orders.id, order.id))
      .returning();

    if (c.stripeCustomerId) {
      await tx.update(customers).set({ stripeCustomerId: c.stripeCustomerId }).where(eq(customers.id, order.customerId));
    }

    // 3. Subscriptions and service instances.
    const items = await tx
      .select({ item: orderItems, service: services })
      .from(orderItems)
      .innerJoin(services, eq(services.id, orderItems.serviceId))
      .where(and(eq(orderItems.orderId, order.id), eq(orderItems.kind, "service")));

    let firstSubscriptionId: string | null = null;
    for (const { item, service } of items) {
      let subscriptionId: string | null = null;
      if (item.billing !== "one_time") {
        const start = c.subscription?.currentPeriodStart ?? now;
        const [sub] = await tx
          .insert(subscriptions)
          .values({
            customerId: order.customerId,
            entityId,
            serviceId: service.id,
            orderId: order.id,
            gateway: c.gateway,
            stripeSubscriptionId: c.subscription?.stripeSubscriptionId ?? null,
            status: c.subscription?.status ?? "active",
            priceCents: item.unitAmountCents,
            interval: item.billing === "monthly" ? "month" : "year",
            currentPeriodStart: start,
            currentPeriodEnd: c.subscription?.currentPeriodEnd ?? addInterval(start, item.billing),
            cancelAtPeriodEnd: c.subscription?.cancelAtPeriodEnd ?? false,
          })
          .returning({ id: subscriptions.id });
        subscriptionId = sub.id;
        firstSubscriptionId ??= sub.id;
      }
      await tx.insert(entityServices).values({
        customerId: order.customerId,
        entityId,
        serviceId: service.id,
        orderId: order.id,
        subscriptionId,
        status: "pending",
      });
    }

    // 4. Payment record (the customer's receipt/invoice line).
    const paymentValues = {
      customerId: order.customerId,
      orderId: order.id,
      subscriptionId: firstSubscriptionId,
      gateway: c.gateway,
      stripeInvoiceId: c.stripeInvoiceId ?? null,
      stripePaymentIntentId: c.stripePaymentIntentId ?? null,
      amountCents: c.amountTotalCents,
      currency: c.currency,
      status: "succeeded" as const,
      description: `Order #${order.number}: ${orderProductName(order.type)}`,
      receiptUrl: c.receiptUrl ?? null,
      invoiceUrl: c.invoiceUrl ?? null,
      invoicePdfUrl: c.invoicePdfUrl ?? null,
      paidAt: now,
    };
    if (c.stripeInvoiceId) {
      await tx.insert(payments).values(paymentValues).onConflictDoUpdate({ target: payments.stripeInvoiceId, set: paymentValues });
    } else {
      await tx.insert(payments).values(paymentValues);
    }

    await audit(
      {
        actor,
        action: "order.payment_confirmed",
        targetType: "order",
        targetId: order.id,
        orderId: order.id,
        customerId: order.customerId,
        metadata: { amount: c.amountTotalCents, gateway: c.gateway, session: c.stripeCheckoutSessionId ?? null },
      },
      tx,
    );
    return { result: "confirmed" as const, order: paid, hasRegisteredAgent: items.some((i) => i.service.kind === "registered_agent") };
  });

  if (outcome.result === "amount_mismatch") {
    await notifyAdmins(
      "admin_payment_failed",
      {
        customerName: "Order " + outcome.order.number,
        customerId: outcome.order.customerId,
        description: `Payment amount mismatch on order #${outcome.order.number}. Review in Stripe before fulfilling.`,
        amountCents: c.amountTotalCents,
      },
      { orderId: outcome.order.id, customerId: outcome.order.customerId },
    );
  }
  if (outcome.result !== "confirmed") return outcome.result;

  // Side effects after commit: notifications and analytics never roll back a payment.
  const order = outcome.order;
  const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  await sendEmail({
    template: "order_confirmation",
    to: customer.email,
    customerId: customer.id,
    orderId: order.id,
    entityId: order.entityId,
    data: {
      firstName: customer.firstName,
      orderNumber: order.number,
      orderId: order.id,
      productName: orderProductName(order.type),
      items: items.map((i) => ({ description: i.description, totalCents: i.totalCents })),
      totalCents: order.totalCents,
      needsOnboarding: true,
    },
  });
  await notifyAdmins(
    "admin_new_order",
    {
      orderNumber: order.number,
      orderId: order.id,
      productName: orderProductName(order.type),
      customerName: `${customer.firstName} ${customer.lastName}`,
      totalCents: order.totalCents,
    },
    { orderId: order.id, customerId: customer.id },
  );
  await track("checkout_completed", {}, { orderType: order.type });
  if (outcome.hasRegisteredAgent) await track("registered_agent_purchased", {}, { orderType: order.type });
  return "confirmed";
}

/* -------------------------------------------------------------------------- */
/*  Onboarding (intake)                                                       */
/* -------------------------------------------------------------------------- */

export class IntakeError extends Error {}

const OPERATION: Record<Order["type"], ProviderOperation> = {
  registered_agent: "registered_agent",
  llc_formation: "formation",
  business_address: "business_address",
};

/** One open provider order per operation: refresh it on resubmission, otherwise create it. Returns the open one, if any. */
async function upsertProviderOrder(
  tx: Tx,
  p: { orderId: string; entityId: string; providerId: string; operation: ProviderOperation; submission: ProviderSubmission; payload: Record<string, unknown> },
) {
  const [open] = await tx
    .select()
    .from(providerOrders)
    .where(
      and(
        eq(providerOrders.orderId, p.orderId),
        eq(providerOrders.operation, p.operation),
        inArray(providerOrders.status, ["pending_manual", "submitted", "processing"]),
      ),
    )
    .limit(1);
  if (open) {
    await tx.update(providerOrders).set({ payload: p.payload, lastSyncedAt: new Date() }).where(eq(providerOrders.id, open.id));
  } else {
    await tx.insert(providerOrders).values({
      orderId: p.orderId,
      entityId: p.entityId,
      provider: p.providerId,
      operation: p.operation,
      status: p.submission.status,
      externalReference: p.submission.externalReference,
      payload: p.payload,
      response: p.submission.raw ?? {},
      submittedAt: p.submission.status === "submitted" ? new Date() : null,
    });
  }
  return open;
}

async function saveAddress(tx: Tx, customerId: string, existingId: string | null, a: AddressInput): Promise<string> {
  const values = { line1: a.line1, line2: a.line2 ?? null, city: a.city, state: a.state, postalCode: a.postalCode };
  if (existingId) {
    const [row] = await tx
      .update(addresses)
      .set(values)
      .where(and(eq(addresses.id, existingId), eq(addresses.customerId, customerId)))
      .returning({ id: addresses.id });
    if (row) return row.id;
  }
  const [row] = await tx.insert(addresses).values({ customerId, ...values }).returning({ id: addresses.id });
  return row.id;
}

export type IntakeData =
  | { type: "registered_agent"; data: RegisteredAgentIntake }
  | { type: "llc_formation"; data: LlcFormationIntake }
  | { type: "business_address"; data: BusinessAddressIntake };

/** Statuses in which the customer may (re)submit onboarding information (locked once submitted to the provider). */
export const INTAKE_EDITABLE: Order["status"][] = ["payment_confirmed", "information_needed", "ready_for_fulfillment"];

/**
 * "Save and finish later": keep unvalidated onboarding answers (flat form values) on
 * the order. They're only ever shown back to the same customer in the form.
 */
export async function saveIntakeDraft(customerId: string, orderId: string, values: Record<string, string>) {
  const draft: Record<string, string> = {};
  for (const [k, v] of Object.entries(values).slice(0, 200)) {
    if (k.length <= 100 && /^[a-zA-Z0-9_.]+$/.test(k)) draft[k] = v.slice(0, 2000);
  }
  const [row] = await db
    .update(orders)
    .set({ intakeDraft: draft })
    .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId), inArray(orders.status, INTAKE_EDITABLE)))
    .returning({ id: orders.id });
  if (!row) throw new IntakeError("This order can no longer be edited.");
}

/**
 * Save onboarding answers, update the entity, hand the order to the fulfillment
 * provider and move it to `ready_for_fulfillment`.
 */
export async function submitOrderIntake(customer: Customer, orderId: string, intake: IntakeData, actor: Actor) {
  const provider = await getProvider();
  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customer.id)))
      .for("update")
      .limit(1);
    if (!order) throw new IntakeError("Order not found.");
    if (order.type !== intake.type) throw new IntakeError("Order type mismatch.");
    if (!INTAKE_EDITABLE.includes(order.status)) throw new IntakeError("This order can no longer be edited. Please contact support.");
    if (!order.entityId) throw new IntakeError("Order has no business attached.");
    const [entity] = await tx.select().from(entities).where(eq(entities.id, order.entityId)).limit(1);

    let submission: ProviderSubmission;
    let payload: Record<string, unknown>;
    if (intake.type === "registered_agent") {
      const d = intake.data;
      const principalId = await saveAddress(tx, customer.id, entity.principalAddressId, d.principalAddress);
      const mailingId = d.mailingAddress
        ? await saveAddress(tx, customer.id, entity.mailingAddressId !== entity.principalAddressId ? entity.mailingAddressId : null, d.mailingAddress)
        : principalId;
      await tx
        .update(entities)
        .set({
          legalName: d.entity.legalName,
          entityType: d.entity.entityType,
          jurisdiction: d.entity.jurisdiction,
          sosFileNumber: d.entity.sosFileNumber ?? null,
          formationDate: d.entity.formationDate ?? null,
          principalAddressId: principalId,
          mailingAddressId: mailingId,
          contactName: d.contact.name,
          contactEmail: d.contact.email,
          contactPhone: d.contact.phone,
        })
        .where(eq(entities.id, entity.id));
      const input = registeredAgentInput(order, customer, d);
      submission = await provider.createRegisteredAgentOrder(input);
      payload = { input, sheet: submission.sheet ?? [], instructions: submission.instructions ?? "" };
    } else if (intake.type === "llc_formation") {
      const d = intake.data;
      const principalId = await saveAddress(tx, customer.id, entity.principalAddressId, d.businessAddress);
      await tx
        .update(entities)
        .set({
          legalName: fullLlcName(d.company),
          principalAddressId: principalId,
          mailingAddressId: principalId,
          contactName: d.contact.name,
          contactEmail: d.contact.email,
          contactPhone: d.contact.phone,
        })
        .where(eq(entities.id, entity.id));
      const input = formationInput(order, customer, d);
      submission = await provider.createFormationOrder(input);
      payload = { input, sheet: submission.sheet ?? [], instructions: submission.instructions ?? "" };
    } else {
      const d = intake.data;
      await tx
        .update(entities)
        .set({ legalName: d.businessName, contactName: d.contact.name, contactEmail: d.contact.email, contactPhone: d.contact.phone })
        .where(eq(entities.id, entity.id));
      const input = businessAddressInput(order, customer, d);
      submission = await provider.createBusinessAddressOrder(input);
      payload = { input, sheet: submission.sheet ?? [], instructions: submission.instructions ?? "" };
    }

    const open = await upsertProviderOrder(tx, { orderId: order.id, entityId: entity.id, providerId: provider.id, operation: OPERATION[order.type], submission, payload });

    // Switching from another registered agent needs a change-of-agent filing: track it separately.
    if (intake.type === "registered_agent") {
      if (intake.data.appointment.type === "change_from_existing") {
        const input = changeOfAgentInput(order, customer, intake.data);
        const change = await provider.createChangeOfAgentOrder(input);
        await upsertProviderOrder(tx, {
          orderId: order.id,
          entityId: entity.id,
          providerId: provider.id,
          operation: "change_of_agent",
          submission: change,
          payload: { input, sheet: change.sheet ?? [], instructions: change.instructions ?? "" },
        });
      } else {
        // The customer changed their answer: drop a change-of-agent task nobody has started.
        await tx
          .update(providerOrders)
          .set({ status: "cancelled" })
          .where(and(eq(providerOrders.orderId, order.id), eq(providerOrders.operation, "change_of_agent"), eq(providerOrders.status, "pending_manual")));
      }
    }

    const nextStatus = open && open.status !== "pending_manual" ? order.status : "ready_for_fulfillment";
    const [updated] = await tx
      .update(orders)
      .set({ intake: intake.data as unknown as Record<string, unknown>, intakeDraft: null, intakeSubmittedAt: new Date(), status: nextStatus })
      .where(eq(orders.id, order.id))
      .returning();
    await audit(
      {
        actor,
        action: order.intakeSubmittedAt ? "order.intake_updated" : "order.intake_submitted",
        targetType: "order",
        targetId: order.id,
        orderId: order.id,
        customerId: customer.id,
        metadata: { from: order.status, to: nextStatus, provider: provider.id },
      },
      tx,
    );
    return { order: updated, firstSubmission: !order.intakeSubmittedAt };
  });

  if (result.firstSubmission) {
    await track("onboarding_completed", {}, { orderType: result.order.type });
    await sendEmail({
      template: "onboarding_received",
      to: customer.email,
      customerId: customer.id,
      orderId: result.order.id,
      data: { firstName: customer.firstName, orderNumber: result.order.number, orderId: result.order.id },
    });
  }
  await notifyAdmins(
    "admin_order_ready",
    { orderNumber: result.order.number, orderId: result.order.id, productName: orderProductName(result.order.type) },
    { orderId: result.order.id, customerId: customer.id },
  );
  return result.order;
}
