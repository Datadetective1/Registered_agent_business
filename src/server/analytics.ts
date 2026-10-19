import "server-only";
import { and, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";

/** Funnel events. Keep this list short and meaningful. */
export const FUNNEL_EVENTS = [
  "landing_page",
  "homepage_viewed",
  "registered_agent_page_viewed",
  "formation_page_viewed",
  "pricing_viewed",
  "checkout_started",
  "checkout_contact_step",
  "checkout_account_step",
  "checkout_payment_step",
  "account_created",
  "payment_started",
  "checkout_completed",
  "registered_agent_purchased",
  "onboarding_completed",
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Events the browser may report (the rest are recorded server-side only). */
export const CLIENT_EVENTS: FunnelEvent[] = [
  "landing_page",
  "homepage_viewed",
  "registered_agent_page_viewed",
  "formation_page_viewed",
  "pricing_viewed",
  "checkout_started",
  "checkout_contact_step",
  "checkout_account_step",
  "checkout_payment_step",
];

export type TrackContext = { path?: string | null; referrer?: string | null; search?: string | null };

function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host.slice(0, 200) || null;
  } catch {
    return null;
  }
}

function utm(search: string | null | undefined) {
  const p = new URLSearchParams(search ?? "");
  const clip = (v: string | null) => (v ? v.slice(0, 100) : null);
  return { utmSource: clip(p.get("utm_source")), utmMedium: clip(p.get("utm_medium")), utmCampaign: clip(p.get("utm_campaign")) };
}

/** Record an anonymous event. Never pass personal data in metadata. Never throws. */
export async function track(name: FunnelEvent, ctx: TrackContext = {}, metadata: Record<string, string | number | boolean> = {}) {
  try {
    await db.insert(analyticsEvents).values({
      name,
      path: ctx.path?.slice(0, 300) ?? null,
      referrerHost: referrerHost(ctx.referrer),
      ...utm(ctx.search),
      metadata,
    });
  } catch (err) {
    console.error("[analytics] failed", err);
  }
}

export async function funnelCounts(days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({ name: analyticsEvents.name, count: sql<number>`count(*)::int` })
    .from(analyticsEvents)
    .where(and(gte(analyticsEvents.createdAt, since)))
    .groupBy(analyticsEvents.name);
  return Object.fromEntries(rows.map((r) => [r.name, r.count])) as Partial<Record<FunnelEvent, number>>;
}

export async function topSources(days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  return db
    .select({
      source: sql<string>`coalesce(${analyticsEvents.utmSource}, ${analyticsEvents.referrerHost}, '(direct)')`,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(and(gte(analyticsEvents.createdAt, since), sql`${analyticsEvents.name} = 'landing_page'`))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`)
    .limit(10);
}
