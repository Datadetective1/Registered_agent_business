import { catalogDefaults } from "@/config/catalog";
import { db } from "@/db";
import { customers, services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { registerCustomer, upsertAdmin } from "@/server/auth/accounts";
import { invalidateSettingsCache } from "@/server/settings";

export async function seedCatalog(overrides: Partial<Record<string, Partial<(typeof catalogDefaults)[number]>>> = {}) {
  for (const s of catalogDefaults) {
    const o = { ...s, ...(overrides[s.code] ?? {}) };
    await db.insert(services).values({
      code: o.code,
      name: o.name,
      kind: o.kind,
      billing: o.billing,
      priceCents: o.priceCents,
      governmentFeeCents: o.governmentFeeCents,
      governmentFeeLabel: o.governmentFeeLabel,
      jurisdiction: o.jurisdiction,
      isActive: o.isActive,
      sortOrder: o.sortOrder,
      shortDescription: o.shortDescription,
      features: o.features,
      config: o.config,
    });
  }
  invalidateSettingsCache();
}

let n = 0;
export async function makeCustomer(email = `c${++n}-${Date.now()}@example.com`) {
  const r = await registerCustomer({ email, password: "a-long-password", firstName: "Test", lastName: `Customer${n}`, phone: "5125550100" });
  if (!r.ok) throw new Error("could not create customer");
  const [customer] = await db.select().from(customers).where(eq(customers.userId, r.user.id));
  return { user: r.user, customer };
}

export async function makeAdmin(email = "admin@example.com") {
  const id = await upsertAdmin(email, "an-admin-password");
  return { id, actor: { type: "admin" as const, userId: id } };
}

export function raIntakeFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    "entity.legalName": "Lone Star Widgets LLC",
    "entity.entityType": "llc",
    "entity.jurisdiction": "TX",
    "entity.sosFileNumber": "0801234567",
    "principalAddress.line1": "100 Congress Ave",
    "principalAddress.city": "Austin",
    "principalAddress.state": "TX",
    "principalAddress.postalCode": "78701",
    mailingSameAsPrincipal: "on",
    "contact.name": "Jane Doe",
    "contact.email": "jane@example.com",
    "contact.phone": "(512) 555-0100",
    "appointment.type": "change_from_existing",
    "appointment.currentAgentName": "Old Agent Co",
    attestAuthorized: "on",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}
