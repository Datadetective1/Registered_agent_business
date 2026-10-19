import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditEvents, entities, entityServices, notifications, orders, payments, providerOrders, subscriptions } from "@/db/schema";
import { parseForm } from "@/lib/forms";
import { registeredAgentIntakeSchema } from "@/lib/intake";
import { SYSTEM } from "@/server/audit";
import { confirmOrderPayment, IntakeError, submitOrderIntake } from "@/server/fulfillment";
import { createPendingOrder, OrderError, quoteOrder } from "@/server/orders";
import { resetDb } from "../helpers/db";
import { makeCustomer, raIntakeFormData, seedCatalog } from "../helpers/fixtures";

beforeEach(async () => {
  await resetDb();
  await seedCatalog();
});

async function newRaOrder(customerId: string, entityId: string | null = null) {
  const quote = await quoteOrder("registered_agent");
  return createPendingOrder({
    customerId,
    type: "registered_agent",
    entityId,
    checkoutData: entityId ? {} : { entity: { legalName: "Lone Star Widgets LLC", entityType: "llc", jurisdiction: "TX" } },
    quote,
    termsVersion: "test",
  });
}

describe("quotes", () => {
  it("prices registered agent from the catalog", async () => {
    const q = await quoteOrder("registered_agent");
    expect(q.totalCents).toBe(9900);
    expect(q.lines[0].billing).toBe("annual");
  });
  it("separates formation service fee and state fee; RA add-on optional", async () => {
    const own = await quoteOrder("llc_formation", { raChoice: "own" });
    expect(own.lines.map((l) => l.kind)).toEqual(["service", "government_fee"]);
    expect(own.governmentFeesCents).toBe(30000);
    expect(own.totalCents).toBe(4900 + 30000);
    const ours = await quoteOrder("llc_formation", { raChoice: "ours" });
    expect(ours.totalCents).toBe(4900 + 30000 + 9900);
  });
  it("refuses inactive services", async () => {
    await expect(quoteOrder("business_address")).rejects.toBeInstanceOf(OrderError);
  });
});

describe("payment confirmation", () => {
  it("provisions entity, subscription, service, payment and notifications exactly once", async () => {
    const { customer } = await makeCustomer();
    const order = await newRaOrder(customer.id);
    const confirmation = { orderId: order.id, gateway: "simulated" as const, amountTotalCents: 9900, currency: "usd" };

    expect(await confirmOrderPayment(confirmation, SYSTEM)).toBe("confirmed");
    expect(await confirmOrderPayment(confirmation, SYSTEM)).toBe("already_processed");

    const [o] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(o.status).toBe("payment_confirmed");
    expect(o.entityId).toBeTruthy();
    const [entity] = await db.select().from(entities).where(eq(entities.id, o.entityId!));
    expect(entity.legalName).toBe("Lone Star Widgets LLC");
    expect(entity.customerId).toBe(customer.id);

    const subs = await db.select().from(subscriptions).where(eq(subscriptions.orderId, order.id));
    expect(subs).toHaveLength(1);
    expect(subs[0].status).toBe("active");
    const days = (subs[0].currentPeriodEnd!.getTime() - subs[0].currentPeriodStart!.getTime()) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(365);

    const svc = await db.select().from(entityServices).where(eq(entityServices.orderId, order.id));
    expect(svc).toHaveLength(1);
    expect(svc[0].status).toBe("pending");
    expect(await db.select().from(payments).where(eq(payments.orderId, order.id))).toHaveLength(1);

    const mails = await db.select().from(notifications);
    expect(mails.map((m) => m.template).sort()).toEqual(["admin_new_order", "order_confirmation", "welcome"]);
    expect(mails.every((m) => m.status === "logged")).toBe(true);
    const audits = await db.select().from(auditEvents).where(eq(auditEvents.action, "order.payment_confirmed"));
    expect(audits).toHaveLength(1);
  });

  it("does not confirm when the paid amount doesn't match", async () => {
    const { customer } = await makeCustomer();
    const order = await newRaOrder(customer.id);
    expect(await confirmOrderPayment({ orderId: order.id, gateway: "simulated", amountTotalCents: 100, currency: "usd" }, SYSTEM)).toBe("amount_mismatch");
    const [o] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(o.status).toBe("new");
  });

  it("formation with our RA creates a pending-formation LLC and an RA subscription", async () => {
    const { customer } = await makeCustomer();
    const quote = await quoteOrder("llc_formation", { raChoice: "ours" });
    const order = await createPendingOrder({ customerId: customer.id, type: "llc_formation", entityId: null, checkoutData: { raChoice: "ours", llcName: "Lone Star Bakery LLC" }, quote, termsVersion: "t" });
    expect(await confirmOrderPayment({ orderId: order.id, gateway: "simulated", amountTotalCents: quote.totalCents, currency: "usd" }, SYSTEM)).toBe("confirmed");
    const [o] = await db.select().from(orders).where(eq(orders.id, order.id));
    const [entity] = await db.select().from(entities).where(eq(entities.id, o.entityId!));
    expect(entity.status).toBe("pending_formation");
    expect(await db.select().from(subscriptions).where(eq(subscriptions.orderId, order.id))).toHaveLength(1);
    expect(await db.select().from(entityServices).where(eq(entityServices.orderId, order.id))).toHaveLength(2);
  });
});

describe("ownership", () => {
  it("rejects ordering for another customer's entity", async () => {
    const a = await makeCustomer();
    const b = await makeCustomer();
    const order = await newRaOrder(a.customer.id);
    await confirmOrderPayment({ orderId: order.id, gateway: "simulated", amountTotalCents: 9900, currency: "usd" }, SYSTEM);
    const [o] = await db.select().from(orders).where(eq(orders.id, order.id));
    await expect(newRaOrder(b.customer.id, o.entityId)).rejects.toBeInstanceOf(OrderError);
  });
});

describe("onboarding intake", () => {
  it("updates the entity, creates a manual provider order and queues for fulfillment", async () => {
    const { customer } = await makeCustomer();
    const order = await newRaOrder(customer.id);
    await confirmOrderPayment({ orderId: order.id, gateway: "simulated", amountTotalCents: 9900, currency: "usd" }, SYSTEM);
    const parsed = parseForm(registeredAgentIntakeSchema, raIntakeFormData({ "entity.legalName": "Lone Star Widgets, LLC" }));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

    const updated = await submitOrderIntake(customer, order.id, { type: "registered_agent", data: parsed.data }, { type: "customer", userId: customer.userId });
    expect(updated.status).toBe("ready_for_fulfillment");
    const [entity] = await db.select().from(entities).where(eq(entities.id, updated.entityId!));
    expect(entity.legalName).toBe("Lone Star Widgets, LLC");
    expect(entity.sosFileNumber).toBe("0801234567");
    expect(entity.principalAddressId).toBeTruthy();

    const [po] = await db.select().from(providerOrders).where(eq(providerOrders.orderId, order.id));
    expect(po.provider).toBe("manual");
    expect(po.status).toBe("pending_manual");
    const sheet = (po.payload as { sheet: Array<{ title: string; fields: Array<{ label: string; value: string }> }> }).sheet;
    expect(sheet.flatMap((s) => s.fields).find((f) => f.label === "Legal name")?.value).toBe("Lone Star Widgets, LLC");

    // Resubmitting refreshes the same provider order rather than creating another.
    await submitOrderIntake(customer, order.id, { type: "registered_agent", data: parsed.data }, { type: "customer", userId: customer.userId });
    expect(await db.select().from(providerOrders).where(eq(providerOrders.orderId, order.id))).toHaveLength(1);
  });

  it("refuses intake from a different customer and before payment", async () => {
    const a = await makeCustomer();
    const b = await makeCustomer();
    const order = await newRaOrder(a.customer.id);
    const parsed = parseForm(registeredAgentIntakeSchema, raIntakeFormData());
    if (!parsed.ok) throw new Error("bad fixture");
    await expect(submitOrderIntake(a.customer, order.id, { type: "registered_agent", data: parsed.data }, SYSTEM)).rejects.toBeInstanceOf(IntakeError);
    await confirmOrderPayment({ orderId: order.id, gateway: "simulated", amountTotalCents: 9900, currency: "usd" }, SYSTEM);
    await expect(submitOrderIntake(b.customer, order.id, { type: "registered_agent", data: parsed.data }, SYSTEM)).rejects.toBeInstanceOf(IntakeError);
    const [o] = await db.select().from(orders).where(and(eq(orders.id, order.id)));
    expect(o.intake).toBeNull();
  });
});
