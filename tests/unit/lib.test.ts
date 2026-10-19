import { describe, expect, it } from "vitest";
import { formatMoney, parseDollarsToCents } from "@/lib/money";
import { canTransition, ORDER_TRANSITIONS } from "@/lib/order-status";
import { formDataToObject, parseForm } from "@/lib/forms";
import { buildLlcFormationIntakeSchema, registeredAgentIntakeSchema } from "@/lib/intake";
import { safeReturnTo } from "@/lib/utils";
import { mergeSettings } from "@/server/settings";
import { siteDefaults } from "@/config/site";

describe("money", () => {
  it("formats whole and fractional dollars", () => {
    expect(formatMoney(9900)).toBe("$99");
    expect(formatMoney(4950)).toBe("$49.50");
    expect(formatMoney(30000)).toBe("$300");
  });
  it("parses admin dollar input", () => {
    expect(parseDollarsToCents("99")).toBe(9900);
    expect(parseDollarsToCents("$1,299.5")).toBe(129950);
    expect(parseDollarsToCents("12.345")).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
  });
});

describe("order status machine", () => {
  it("allows the manual fulfillment path", () => {
    const path = ["new", "payment_confirmed", "ready_for_fulfillment", "submitted_to_provider", "processing", "completed"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it("blocks skipping payment and reopening refunds", () => {
    expect(canTransition("new", "completed")).toBe(false);
    expect(canTransition("refunded", "processing")).toBe(false);
    expect(ORDER_TRANSITIONS.refunded).toEqual([]);
  });
});

describe("formDataToObject", () => {
  it("builds nested objects and arrays and ignores prototype keys", () => {
    const fd = new FormData();
    fd.set("entity.legalName", "Acme");
    fd.set("people.0.name", "A");
    fd.set("people.1.name", "B");
    fd.set("__proto__.polluted", "x");
    const obj = formDataToObject(fd) as { entity: { legalName: string }; people: { name: string }[] };
    expect(obj.entity.legalName).toBe("Acme");
    expect(obj.people.map((p) => p.name)).toEqual(["A", "B"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

function raForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    "entity.legalName": "Lone Star Widgets LLC",
    "entity.entityType": "llc",
    "entity.jurisdiction": "TX",
    "principalAddress.line1": "100 Congress Ave",
    "principalAddress.city": "Austin",
    "principalAddress.state": "TX",
    "principalAddress.postalCode": "78701",
    mailingSameAsPrincipal: "on",
    "contact.name": "Jane Doe",
    "contact.email": "JANE@example.com",
    "contact.phone": "(512) 555-0100",
    "appointment.type": "change_from_existing",
    attestAuthorized: "on",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

describe("registered agent intake", () => {
  it("accepts a valid submission and normalizes email", () => {
    const r = parseForm(registeredAgentIntakeSchema, raForm());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.contact.email).toBe("jane@example.com");
      expect(r.data.mailingAddress).toBeUndefined();
    }
  });
  it("requires mailing address when not same as principal", () => {
    const fd = raForm();
    fd.delete("mailingSameAsPrincipal");
    const r = parseForm(registeredAgentIntakeSchema, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).some((k) => k.startsWith("mailingAddress."))).toBe(true);
  });
  it("requires the authorization attestation", () => {
    const fd = raForm();
    fd.delete("attestAuthorized");
    const r = parseForm(registeredAgentIntakeSchema, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.attestAuthorized).toBeTruthy();
  });
});

function llcForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const addr = (p: string) => ({
    [`${p}.line1`]: "100 Congress Ave",
    [`${p}.city`]: "Austin",
    [`${p}.state`]: "TX",
    [`${p}.postalCode`]: "78701",
  });
  const base: Record<string, string> = {
    "company.name": "Lone Star Bakery",
    "company.designator": "LLC",
    management: "member_managed",
    "governingPersons.0.name": "Jane Doe",
    ...addr("governingPersons.0.address"),
    "organizer.name": "Jane Doe",
    ...addr("organizer.address"),
    ...addr("businessAddress"),
    "purpose.type": "general",
    "effective.type": "upon_filing",
    "contact.name": "Jane Doe",
    "contact.email": "jane@example.com",
    "contact.phone": "5125550100",
    attestAccurate: "on",
    attestAuthorized: "on",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

describe("Texas LLC intake", () => {
  it("accepts a valid submission using our registered agent", () => {
    const r = parseForm(buildLlcFormationIntakeSchema({ ownRegisteredAgent: false }), llcForm());
    expect(r.ok).toBe(true);
  });
  it("rejects a name that already includes the designator", () => {
    const r = parseForm(buildLlcFormationIntakeSchema({ ownRegisteredAgent: false }), llcForm({ "company.name": "Lone Star Bakery LLC" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["company.name"]).toMatch(/Leave off/);
  });
  it("requires a Texas street address (no PO box) for the customer's own agent", () => {
    const schema = buildLlcFormationIntakeSchema({ ownRegisteredAgent: true });
    const r = parseForm(
      schema,
      llcForm({
        "ownAgent.name": "John Agent",
        "ownAgent.address.line1": "PO Box 123",
        "ownAgent.address.city": "Dallas",
        "ownAgent.address.state": "OK",
        "ownAgent.address.postalCode": "75201",
        "ownAgent.consent": "on",
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors["ownAgent.address.state"] ?? r.errors["ownAgent.address.line1"]).toBeTruthy();
    }
  });
  it("limits delayed effective dates to 90 days", () => {
    const today = new Date("2026-10-19T12:00:00Z");
    const schema = buildLlcFormationIntakeSchema({ ownRegisteredAgent: false, today });
    const r = parseForm(schema, llcForm({ "effective.type": "specific_date", "effective.date": "2027-03-01" }));
    expect(r.ok).toBe(false);
  });
});

describe("safeReturnTo", () => {
  it("only allows same-site relative paths", () => {
    expect(safeReturnTo("/account/orders")).toBe("/account/orders");
    expect(safeReturnTo("https://evil.example")).toBe("/account");
    expect(safeReturnTo("//evil.example")).toBe("/account");
    expect(safeReturnTo("/\\evil.example")).toBe("/account");
  });
});

describe("settings merge", () => {
  it("applies valid overrides and ignores unknown or mistyped keys", () => {
    const merged = mergeSettings(siteDefaults, {
      brand: { name: "Acme Agent", monogram: 5, unknown: "x" },
      colors: { primary: "#000000" },
      nope: true,
      legal: { reviewed: { terms: true } },
    });
    expect(merged.brand.name).toBe("Acme Agent");
    expect(merged.brand.monogram).toBe(siteDefaults.brand.monogram);
    expect((merged.brand as Record<string, unknown>).unknown).toBeUndefined();
    expect(merged.colors.primary).toBe("#000000");
    expect(merged.colors.accent).toBe(siteDefaults.colors.accent);
    expect(merged.legal.reviewed.terms).toBe(true);
    expect(merged.legal.reviewed.privacy).toBe(false);
  });
});

import { clientIpFrom } from "@/server/client-ip";
describe("client IP", () => {
  it("uses the proxy-appended (rightmost) X-Forwarded-For entry, not the spoofable left one", () => {
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(clientIpFrom(h)).toBe("203.0.113.9");
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
    expect(clientIpFrom(new Headers())).toBeNull();
  });
});
