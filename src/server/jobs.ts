import "server-only";
import { and, eq, gt, inArray, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, entities, services, subscriptions, userTokens } from "@/db/schema";
import { audit, SYSTEM } from "./audit";
import { deleteExpiredSessions } from "./auth/session";
import { sendEmail } from "./notifications/send";
import { deleteExpiredRateLimits } from "./rate-limit";
import { getSettings } from "./settings";

const DAY = 86_400_000;

/**
 * Send renewal reminders N days before each renewal (Admin → Settings, default 30 and 7).
 * Each threshold is sent at most once per renewal period, keyed "YYYY-MM-DD:N" in
 * subscriptions.reminders_sent. If the job misses a day, the most urgent pending
 * reminder is sent once rather than several in a row.
 */
export async function sendRenewalReminders(now = new Date()) {
  const thresholds = [...(await getSettings()).operations.renewalReminderDays].sort((a, b) => b - a);
  if (!thresholds.length) return 0;
  const horizon = new Date(now.getTime() + (thresholds[0] + 1) * DAY);
  const due = await db
    .select({ subscription: subscriptions, entity: entities, customer: customers, service: services })
    .from(subscriptions)
    .innerJoin(entities, eq(entities.id, subscriptions.entityId))
    .innerJoin(customers, eq(customers.id, subscriptions.customerId))
    .innerJoin(services, eq(services.id, subscriptions.serviceId))
    .where(and(inArray(subscriptions.status, ["active", "trialing", "past_due"]), gt(subscriptions.currentPeriodEnd, now), lte(subscriptions.currentPeriodEnd, horizon)));

  let sent = 0;
  for (const { subscription: sub, entity, customer, service } of due) {
    const end = sub.currentPeriodEnd as Date;
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / DAY);
    const periodKey = end.toISOString().slice(0, 10);
    const pending = thresholds.filter((d) => daysLeft <= d && !sub.remindersSent.includes(`${periodKey}:${d}`));
    if (!pending.length) continue;
    const keys = pending.map((d) => `${periodKey}:${d}`);
    // Claim the reminder atomically so concurrent runs can't double-send.
    const claimed = await db
      .update(subscriptions)
      .set({ remindersSent: sql`${subscriptions.remindersSent} || ${JSON.stringify(keys)}::jsonb` })
      .where(and(eq(subscriptions.id, sub.id), sql`NOT (${subscriptions.remindersSent} @> ${JSON.stringify([keys[keys.length - 1]])}::jsonb)`))
      .returning({ id: subscriptions.id });
    if (!claimed.length) continue;
    await sendEmail({
      template: "renewal_reminder",
      to: customer.email,
      customerId: customer.id,
      entityId: entity.id,
      data: {
        firstName: customer.firstName,
        entityName: entity.legalName,
        serviceName: service.name,
        renewalDate: end,
        amountCents: sub.priceCents,
        daysBefore: Math.min(...pending),
        autoRenew: !sub.cancelAtPeriodEnd,
      },
    });
    sent++;
  }
  return sent;
}

export async function cleanupExpired(now = new Date()) {
  await deleteExpiredSessions();
  await deleteExpiredRateLimits();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  await db.delete(userTokens).where(or(lt(userTokens.expiresAt, weekAgo), and(isNotNull(userTokens.usedAt), lt(userTokens.usedAt, weekAgo))));
}

/** Everything that should run once a day. Safe to run more often. */
export async function runDailyJobs(now = new Date()) {
  const reminders = await sendRenewalReminders(now);
  await cleanupExpired(now);
  await audit({ actor: SYSTEM, action: "jobs.daily", metadata: { reminders } });
  return { reminders };
}
