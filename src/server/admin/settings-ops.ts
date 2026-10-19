import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { STATE_CODES } from "@/config/states";
import { db } from "@/db";
import { services } from "@/db/schema";
import { audit, type Actor } from "@/server/audit";
import { invalidateSettingsCache, saveSiteOverride } from "@/server/settings";

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #0F2B46");
const str = (max = 200) => z.string().trim().max(max);

export const siteSettingsSchema = z.object({
  brand: z.object({
    name: str(80).min(1, "Company name is required"),
    legalName: str(150).min(1, "Legal entity name is required"),
    tagline: str(200),
    logoUrl: str(500).refine((v) => v === "" || v.startsWith("/") || v.startsWith("https://"), "Use a path like /brand/logo.svg or an https:// URL"),
    monogram: str(3).min(1, "1–3 characters"),
  }),
  contact: z.object({
    supportEmail: z.email({ error: "Enter a valid email" }),
    supportPhone: str(30),
    supportHours: str(100),
    address: z.object({ line1: str(), line2: str(), city: str(100), state: str(2), postalCode: str(10) }),
  }),
  colors: z.object({ primary: hex, primaryHover: hex, accent: hex }),
  social: z.object({ linkedin: str(300), x: str(300), facebook: str(300) }),
  operations: z.object({
    adminNotificationEmail: z.email({ error: "Enter a valid email" }),
    renewalReminderDays: z
      .string()
      .transform((v) => v.split(",").map((d) => Number(d.trim())).filter((n) => Number.isInteger(n) && n > 0 && n <= 120))
      .pipe(z.array(z.number()).min(1, "Enter at least one day count, e.g. 30, 7")),
    fulfillmentProvider: z.enum(["manual"]),
  }),
  analytics: z.object({
    plausibleDomain: str(200).regex(/^[a-z0-9.-]*$/i, "Enter a domain like example.com"),
    plausibleScriptUrl: str(300).refine((v) => v.startsWith("https://"), "Must be an https:// URL"),
  }),
  legal: z.object({
    reviewed: z.record(z.string(), z.preprocess((v) => v === "on" || v === true, z.boolean())),
    termsVersion: str(40).min(1),
  }),
});

export async function saveSiteSettings(values: z.infer<typeof siteSettingsSchema>, actor: Actor & { userId: string }) {
  await saveSiteOverride(values as unknown as Record<string, unknown>, actor.userId);
  await audit({ actor, action: "settings.updated", targetType: "settings", targetId: "site" });
}

export const serviceSchema = z.object({
  name: str(120).min(1, "Name is required"),
  shortDescription: str(500),
  priceCents: z.number().int().min(0),
  governmentFeeCents: z.number().int().min(0),
  governmentFeeLabel: str(120),
  billing: z.enum(["one_time", "annual", "monthly"]),
  isActive: z.boolean(),
  features: z.array(z.string().trim().min(1).max(200)).max(15),
  availableStates: z.array(z.enum(STATE_CODES)).optional(),
});

export async function saveService(serviceId: string, data: z.infer<typeof serviceSchema>, actor: Actor & { userId: string }) {
  const [before] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (!before) throw new Error("Service not found");
  // Billing type changes would break the checkout/subscription model for registered agent and formation.
  const billing = before.kind === "business_address" ? data.billing : before.billing;
  const config = { ...(before.config as Record<string, unknown>) };
  if (before.kind === "registered_agent" && data.availableStates) config.availableStates = data.availableStates;
  await db
    .update(services)
    .set({
      name: data.name,
      shortDescription: data.shortDescription,
      priceCents: data.priceCents,
      governmentFeeCents: data.governmentFeeCents,
      governmentFeeLabel: data.governmentFeeLabel || null,
      billing,
      isActive: data.isActive,
      features: data.features,
      config,
    })
    .where(eq(services.id, serviceId));
  invalidateSettingsCache();
  await audit({
    actor,
    action: "service.updated",
    targetType: "service",
    targetId: serviceId,
    metadata: {
      code: before.code,
      priceCents: { from: before.priceCents, to: data.priceCents },
      governmentFeeCents: { from: before.governmentFeeCents, to: data.governmentFeeCents },
      isActive: { from: before.isActive, to: data.isActive },
    },
  });
}
