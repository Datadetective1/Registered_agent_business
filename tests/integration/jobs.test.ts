import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { notifications, subscriptions } from "@/db/schema";
import { SYSTEM } from "@/server/audit";
import { confirmOrderPayment } from "@/server/fulfillment";
import { sendRenewalReminders } from "@/server/jobs";
import { createPendingOrder, quoteOrder } from "@/server/orders";
import { resetDb } from "../helpers/db";
import { makeCustomer, seedCatalog } from "../helpers/fixtures";

const DAY = 86_400_000;

async function subscriptionEndingIn(days: number, extra: Partial<typeof subscriptions.$inferInsert> = {}) {
  const { customer } = await makeCustomer();
  const quote = await quoteOrder("registered_agent");
  const order = await createPendingOrder({ customerId: customer.id, type: "registered_agent", entityId: null, checkoutData: { entity: { legalName: "Reminder Co LLC", entityType: "llc", jurisdiction: "TX" } }, quote, termsVersion: "t" });
  await confirmOrderPayment({ orderId: order.id, gateway: "simulated", amountTotalCents: 9900, currency: "usd" }, SYSTEM);
  const end = new Date(Date.now() + days * DAY - 60_000);
  await db.update(subscriptions).set({ currentPeriodEnd: end, ...extra }).where(eq(subscriptions.orderId, order.id));
  return customer;
}

const reminderCount = async () => (await db.select().from(notifications).where(eq(notifications.template, "renewal_reminder"))).length;

beforeEach(async () => {
  await resetDb();
  await seedCatalog();
});

describe("renewal reminders", () => {
  it("sends the 30-day and 7-day reminders once each", async () => {
    await subscriptionEndingIn(30);
    expect(await sendRenewalReminders()).toBe(1);
    expect(await sendRenewalReminders()).toBe(0); // idempotent
    expect(await reminderCount()).toBe(1);

    // Seven days before the same renewal date.
    const [sub] = await db.select().from(subscriptions);
    const later = new Date(sub.currentPeriodEnd!.getTime() - 7 * DAY + 60_000);
    expect(await sendRenewalReminders(later)).toBe(1);
    expect(await sendRenewalReminders(later)).toBe(0);
    expect(await reminderCount()).toBe(2);
  });

  it("sends a single reminder when the job missed earlier thresholds", async () => {
    await subscriptionEndingIn(5);
    expect(await sendRenewalReminders()).toBe(1);
    expect(await sendRenewalReminders()).toBe(0);
    const [sub] = await db.select().from(subscriptions);
    expect(sub.remindersSent).toHaveLength(2);
  });

  it("skips cancelled subscriptions and words ending services correctly", async () => {
    await subscriptionEndingIn(7, { status: "canceled" });
    expect(await sendRenewalReminders()).toBe(0);
    await subscriptionEndingIn(7, { cancelAtPeriodEnd: true });
    expect(await sendRenewalReminders()).toBe(1);
    const [mail] = await db.select().from(notifications).where(eq(notifications.template, "renewal_reminder"));
    expect(mail.subject).toMatch(/ends on/);
    expect(mail.bodyText).toMatch(/appoint a new registered agent/);
  });

  it("doesn't remind far from the renewal date", async () => {
    await subscriptionEndingIn(200);
    expect(await sendRenewalReminders()).toBe(0);
  });
});
