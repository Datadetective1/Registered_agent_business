import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, type Customer, type OrderItem, type SubscriptionStatus } from "@/db/schema";
import { appUrl, stripeIsTestMode, stripeKeyAllowed } from "@/server/env";
import { getSettingValue, setSettingValue } from "@/server/settings";
import type { PaymentGateway } from "./gateway";
import type { PaymentConfirmation, SubscriptionSync } from "./types";

let client: Stripe | null = null;

/** Stripe client. Refuses live keys unless STRIPE_ALLOW_LIVE=true (see env.ts). */
export function getStripe(): Stripe {
  if (!stripeKeyAllowed()) {
    throw new Error("Stripe is not configured (or a live key was provided without STRIPE_ALLOW_LIVE=true).");
  }
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    maxNetworkRetries: 2,
    appInfo: { name: "business-agent" },
  });
  return client;
}

async function ensureStripeCustomer(stripe: Stripe, customer: Customer): Promise<string> {
  if (customer.stripeCustomerId) return customer.stripeCustomerId;
  const created = await stripe.customers.create(
    {
      email: customer.email,
      name: `${customer.firstName} ${customer.lastName}`,
      phone: customer.phone ?? undefined,
      metadata: { customer_id: customer.id },
    },
    { idempotencyKey: `customer-${customer.id}` },
  );
  await db.update(customers).set({ stripeCustomerId: created.id }).where(eq(customers.id, customer.id));
  return created.id;
}

/**
 * One Stripe Product per catalog line (e.g. "registered_agent:service"), cached in
 * settings separately for test and live mode (IDs differ between modes).
 */
async function ensureProduct(stripe: Stripe, key: string, name: string): Promise<string> {
  const mode = stripeIsTestMode() ? "test" : "live";
  const store = (await getSettingValue<Record<string, Record<string, string>>>("stripe_products")) ?? {};
  const existing = store[mode]?.[key];
  if (existing) return existing;
  const product = await stripe.products.create({ name, metadata: { app_key: key } }, { idempotencyKey: `product-${mode}-${key}` });
  await setSettingValue("stripe_products", { ...store, [mode]: { ...(store[mode] ?? {}), [key]: product.id } });
  return product.id;
}

const KNOWN_STATUSES: SubscriptionStatus[] = ["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"];

export function subscriptionSyncFromStripe(sub: Stripe.Subscription): SubscriptionSync {
  const item = sub.items?.data?.[0];
  const ts = (n: number | null | undefined) => (n ? new Date(n * 1000) : null);
  return {
    stripeSubscriptionId: sub.id,
    // Unknown future statuses are treated as "incomplete" so they never read as active.
    status: KNOWN_STATUSES.includes(sub.status as SubscriptionStatus) ? (sub.status as SubscriptionStatus) : "incomplete",
    currentPeriodStart: ts(item?.current_period_start),
    currentPeriodEnd: ts(item?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end || Boolean(sub.cancel_at),
    canceledAt: ts(sub.canceled_at),
    endedAt: ts(sub.ended_at),
  };
}

const idOf = (v: string | { id: string } | null | undefined) => (v ? (typeof v === "string" ? v : v.id) : null);

/** Normalize an (expanded) Checkout Session into a PaymentConfirmation. */
export function confirmationFromSession(session: Stripe.Checkout.Session): PaymentConfirmation | null {
  const orderId = session.metadata?.order_id ?? session.client_reference_id;
  if (!orderId) return null;
  const invoice = session.invoice && typeof session.invoice !== "string" ? session.invoice : null;
  const pi = session.payment_intent && typeof session.payment_intent !== "string" ? session.payment_intent : null;
  const charge = pi?.latest_charge && typeof pi.latest_charge !== "string" ? pi.latest_charge : null;
  const sub = session.subscription && typeof session.subscription !== "string" ? session.subscription : null;
  return {
    orderId,
    gateway: "stripe",
    amountTotalCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    stripeCheckoutSessionId: session.id,
    stripeCustomerId: idOf(session.customer),
    stripePaymentIntentId: idOf(session.payment_intent),
    stripeInvoiceId: idOf(session.invoice),
    receiptUrl: charge?.receipt_url ?? null,
    invoiceUrl: invoice?.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice?.invoice_pdf ?? null,
    subscription: sub ? subscriptionSyncFromStripe(sub) : null,
  };
}

export const CHECKOUT_EXPAND = ["subscription", "invoice", "payment_intent.latest_charge"];

/** Retrieve a session with everything confirmOrderPayment needs. */
export async function retrieveCheckout(sessionId: string): Promise<{ paid: boolean; confirmation: PaymentConfirmation | null }> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: CHECKOUT_EXPAND });
  const paid = session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
  return { paid, confirmation: confirmationFromSession(session) };
}

function productKey(item: OrderItem): string {
  return `${item.serviceId}:${item.kind}`;
}

export const stripeGateway: PaymentGateway = {
  name: "stripe",

  async createCheckout({ order, items, customer }) {
    const stripe = getStripe();
    const stripeCustomerId = await ensureStripeCustomer(stripe, customer);
    const recurring = items.some((i) => i.billing !== "one_time");
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    for (const item of items) {
      const product = await ensureProduct(stripe, productKey(item), item.description.replace(/ \(first (year|month)\)$/, ""));
      lineItems.push({
        quantity: item.quantity,
        price_data: {
          currency: order.currency,
          unit_amount: item.unitAmountCents,
          product,
          ...(item.billing === "annual" ? { recurring: { interval: "year" as const } } : {}),
          ...(item.billing === "monthly" ? { recurring: { interval: "month" as const } } : {}),
        },
      });
    }
    const metadata = { order_id: order.id, order_number: String(order.number) };
    const session = await stripe.checkout.sessions.create({
      mode: recurring ? "subscription" : "payment",
      customer: stripeCustomerId,
      client_reference_id: order.id,
      line_items: lineItems,
      metadata,
      billing_address_collection: "auto",
      success_url: `${appUrl()}/order/${order.id}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/order/${order.id}/cancelled`,
      ...(recurring
        ? { subscription_data: { metadata } }
        : {
            // Save the card for future purchases and create an invoice/receipt for one-time payments.
            payment_intent_data: { metadata, setup_future_usage: "off_session" },
            invoice_creation: { enabled: true, invoice_data: { metadata, description: `Order #${order.number}` } },
          }),
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url, sessionId: session.id };
  },

  async billingPortalUrl(customer, returnUrl) {
    if (!customer.stripeCustomerId) return null;
    const portal = await getStripe().billingPortal.sessions.create({ customer: customer.stripeCustomerId, return_url: returnUrl });
    return portal.url;
  },

  async setAutoRenew(sub, autoRenew) {
    if (!sub.stripeSubscriptionId) return null;
    const updated = await getStripe().subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: !autoRenew });
    return subscriptionSyncFromStripe(updated);
  },

  async cancelSubscriptionNow(sub) {
    if (!sub.stripeSubscriptionId) return;
    await getStripe().subscriptions.cancel(sub.stripeSubscriptionId);
  },

  async refundPayment(payment) {
    // Refunds from the admin are limited to test mode until live payments are approved.
    if (!stripeIsTestMode()) throw new Error("Live refunds must be issued in the Stripe dashboard.");
    if (!payment.stripePaymentIntentId) throw new Error("This payment has no Stripe payment reference. Refund it in the Stripe dashboard.");
    await getStripe().refunds.create({ payment_intent: payment.stripePaymentIntentId, metadata: { payment_id: payment.id } });
  },
};
