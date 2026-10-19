import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { entityServices, notifications, orders, payments, subscriptions, webhookEvents } from "@/db/schema";
import { createPendingOrder, quoteOrder } from "@/server/orders";
import { handleStripeEvent, verifyStripeEvent, type StripeDeps } from "@/server/payments/webhooks";
import { getStripe } from "@/server/payments/stripe";
import { resetDb } from "../helpers/db";
import { makeCustomer, seedCatalog } from "../helpers/fixtures";

const NOW = Math.floor(Date.now() / 1000);
const YEAR = 365 * 86400;

function stripeSub(id: string, overrides: Partial<Stripe.Subscription> = {}, period = { start: NOW, end: NOW + YEAR }) {
  return {
    id,
    object: "subscription",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ended_at: null,
    items: { data: [{ current_period_start: period.start, current_period_end: period.end }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function event<T>(id: string, type: string, object: T): Stripe.Event {
  return { id, type, object: "event", data: { object } } as unknown as Stripe.Event;
}

let subState: Stripe.Subscription;
const deps: StripeDeps = {
  retrieveSession: async () => {
    throw new Error("set per test");
  },
  retrieveSubscription: async () => subState,
  invoiceForPaymentIntent: async () => "in_renewal_1",
};

async function paidRaOrder() {
  const { customer } = await makeCustomer();
  const quote = await quoteOrder("registered_agent");
  const order = await createPendingOrder({
    customerId: customer.id,
    type: "registered_agent",
    entityId: null,
    checkoutData: { entity: { legalName: "Webhook Co LLC", entityType: "llc", jurisdiction: "TX" } },
    quote,
    termsVersion: "t",
  });
  subState = stripeSub("sub_123");
  const session = {
    id: "cs_test_1",
    object: "checkout.session",
    status: "complete",
    payment_status: "paid",
    mode: "subscription",
    amount_total: 9900,
    currency: "usd",
    customer: "cus_123",
    client_reference_id: order.id,
    metadata: { order_id: order.id },
    payment_intent: null,
    invoice: { id: "in_first", hosted_invoice_url: "https://invoice.example/first", invoice_pdf: "https://invoice.example/first.pdf" },
    subscription: subState,
  } as unknown as Stripe.Checkout.Session;
  const localDeps = { ...deps, retrieveSession: async () => session };
  return { customer, order, localDeps };
}

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy_for_signature_checks";
});
afterAll(() => {
  delete process.env.STRIPE_SECRET_KEY;
});
beforeEach(async () => {
  await resetDb();
  await seedCatalog();
});

describe("signature verification", () => {
  it("accepts a correctly signed payload and rejects tampering", () => {
    const payload = JSON.stringify({ id: "evt_sig", object: "event", type: "ping", data: { object: {} } });
    const header = getStripe().webhooks.generateTestHeaderString({ payload, secret: "whsec_test" });
    expect(verifyStripeEvent(payload, header, "whsec_test").id).toBe("evt_sig");
    expect(() => verifyStripeEvent(payload.replace("ping", "pong"), header, "whsec_test")).toThrow();
    expect(() => verifyStripeEvent(payload, null, "whsec_test")).toThrow();
  });
});

describe("checkout.session.completed", () => {
  it("confirms the order once and ignores duplicate deliveries", async () => {
    const { order, localDeps } = await paidRaOrder();
    const evt = event("evt_checkout_1", "checkout.session.completed", { id: "cs_test_1" });
    expect(await handleStripeEvent(evt, localDeps)).toBe("processed");
    expect(await handleStripeEvent(evt, localDeps)).toBe("duplicate");

    const [o] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(o.status).toBe("payment_confirmed");
    expect(o.stripeSubscriptionId).toBe("sub_123");
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orderId, order.id));
    expect(sub.stripeSubscriptionId).toBe("sub_123");
    expect(sub.currentPeriodEnd!.getTime()).toBe((NOW + YEAR) * 1000);
    const [pay] = await db.select().from(payments).where(eq(payments.orderId, order.id));
    expect(pay.stripeInvoiceId).toBe("in_first");
    expect(pay.invoiceUrl).toBe("https://invoice.example/first");
    const [we] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, "evt_checkout_1"));
    expect(we.processedAt).toBeTruthy();
  });
});

describe("renewals", () => {
  async function setup() {
    const ctx = await paidRaOrder();
    await handleStripeEvent(event("evt_c", "checkout.session.completed", { id: "cs_test_1" }), ctx.localDeps);
    await db.update(entityServices).set({ status: "active" });
    return ctx;
  }
  const invoice = (id: string, extra: Record<string, unknown> = {}) =>
    ({
      id,
      object: "invoice",
      billing_reason: "subscription_cycle",
      amount_paid: 9900,
      amount_due: 9900,
      attempt_count: 1,
      currency: "usd",
      hosted_invoice_url: `https://invoice.example/${id}`,
      invoice_pdf: null,
      parent: { type: "subscription_details", subscription_details: { subscription: "sub_123" } },
      ...extra,
    }) as unknown as Stripe.Invoice;

  it("records a successful renewal, extends the period and notifies once", async () => {
    await setup();
    subState = stripeSub("sub_123", {}, { start: NOW + YEAR, end: NOW + 2 * YEAR });
    await handleStripeEvent(event("evt_paid_1", "invoice.paid", invoice("in_renewal_1")), deps);
    await handleStripeEvent(event("evt_paid_2", "invoice.paid", invoice("in_renewal_1")), deps); // distinct event, same invoice
    const renewal = await db.select().from(payments).where(eq(payments.stripeInvoiceId, "in_renewal_1"));
    expect(renewal).toHaveLength(1);
    expect(renewal[0].status).toBe("succeeded");
    const [sub] = await db.select().from(subscriptions);
    expect(sub.currentPeriodEnd!.getTime()).toBe((NOW + 2 * YEAR) * 1000);
    expect(await db.select().from(notifications).where(eq(notifications.template, "payment_succeeded"))).toHaveLength(1);
  });

  it("records failed renewals, marks past due and emails on the first failure only", async () => {
    await setup();
    subState = stripeSub("sub_123", { status: "past_due" } as Partial<Stripe.Subscription>);
    await handleStripeEvent(event("evt_fail_1", "invoice.payment_failed", invoice("in_fail")), deps);
    await handleStripeEvent(event("evt_fail_2", "invoice.payment_failed", invoice("in_fail", { attempt_count: 2 })), deps);
    const [pay] = await db.select().from(payments).where(eq(payments.stripeInvoiceId, "in_fail"));
    expect(pay.status).toBe("failed");
    const [sub] = await db.select().from(subscriptions);
    expect(sub.status).toBe("past_due");
    expect(await db.select().from(notifications).where(eq(notifications.template, "payment_failed"))).toHaveLength(1);
    expect(await db.select().from(notifications).where(eq(notifications.template, "admin_payment_failed"))).toHaveLength(1);
  });

  it("ignores the initial subscription invoice (recorded by checkout)", async () => {
    await setup();
    await handleStripeEvent(event("evt_first", "invoice.paid", invoice("in_first", { billing_reason: "subscription_create" })), deps);
    expect(await db.select().from(payments)).toHaveLength(1);
  });
});

describe("subscription lifecycle", () => {
  it("schedules cancellation, resumes, and ends service", async () => {
    const { localDeps } = await paidRaOrder();
    await handleStripeEvent(event("evt_c", "checkout.session.completed", { id: "cs_test_1" }), localDeps);
    await db.update(entityServices).set({ status: "active" });

    await handleStripeEvent(event("evt_u1", "customer.subscription.updated", stripeSub("sub_123", { cancel_at_period_end: true })), deps);
    expect((await db.select().from(entityServices))[0].status).toBe("cancellation_scheduled");
    expect((await db.select().from(subscriptions))[0].cancelAtPeriodEnd).toBe(true);

    await handleStripeEvent(event("evt_u2", "customer.subscription.updated", stripeSub("sub_123")), deps);
    expect((await db.select().from(entityServices))[0].status).toBe("active");

    await handleStripeEvent(event("evt_d", "customer.subscription.deleted", stripeSub("sub_123", { status: "canceled", ended_at: NOW } as Partial<Stripe.Subscription>)), deps);
    expect((await db.select().from(entityServices))[0].status).toBe("cancelled");
    expect((await db.select().from(subscriptions))[0].status).toBe("canceled");
    expect(await db.select().from(notifications).where(eq(notifications.template, "admin_subscription_ended"))).toHaveLength(1);
  });
});

describe("refunds", () => {
  it("maps a refunded charge to the subscription invoice payment", async () => {
    const { localDeps } = await paidRaOrder();
    await handleStripeEvent(event("evt_c", "checkout.session.completed", { id: "cs_test_1" }), localDeps);
    await db.update(payments).set({ stripeInvoiceId: "in_renewal_1" });
    await handleStripeEvent(event("evt_r", "charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount: 9900, amount_refunded: 9900 }), deps);
    const [pay] = await db.select().from(payments);
    expect(pay.status).toBe("refunded");
    expect(pay.amountRefundedCents).toBe(9900);
  });
});
