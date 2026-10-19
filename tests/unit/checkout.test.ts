import { describe, expect, it } from "vitest";
import { emptyWizardData, validateAccount, validateCompany, validateContact, validateFormation } from "@/lib/checkout";

const STATES = ["TX", "FL"];
const today = new Date("2026-10-19T12:00:00Z");

function company(patch: Partial<ReturnType<typeof emptyWizardData>["company"]> = {}) {
  return { ...emptyWizardData().company, situation: "existing" as const, legalName: "Lone Star Widgets LLC", ...patch };
}

function contact(patch: Partial<ReturnType<typeof emptyWizardData>["contact"]> = {}) {
  return {
    ...emptyWizardData().contact,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "(512) 555-0100",
    line1: "100 Congress Ave",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    ...patch,
  };
}

describe("checkout step 1: company", () => {
  it("accepts a complete existing business, with or without a formation date", () => {
    expect(validateCompany(company(), { availableStates: STATES, today })).toEqual({});
    expect(validateCompany(company({ formationDate: "2020-05-01" }), { availableStates: STATES, today })).toEqual({});
    expect(validateCompany(company({ formationDate: "2099-01-01", formationDateUnknown: true }), { availableStates: STATES, today })).toEqual({});
  });
  it("explains what's missing in plain words", () => {
    const e = validateCompany({ ...emptyWizardData().company }, { availableStates: STATES, today });
    expect(e.situation).toBe("Tell us whether your business already exists");
    expect(e.legalName).toBe("Enter the legal name of your company");
    expect(validateCompany(company({ situation: "forming", legalName: "" }), { availableStates: STATES, today }).legalName).toMatch(/plan to use/);
  });
  it("rejects future formation dates and states we don't serve", () => {
    expect(validateCompany(company({ formationDate: "2099-01-01" }), { availableStates: STATES, today }).formationDate).toMatch(/future/);
    expect(validateCompany(company({ jurisdiction: "OH" }), { availableStates: STATES, today }).jurisdiction).toBe("We don't offer service in that state yet");
    expect(validateCompany(company({ entityType: "sole_prop" }), { availableStates: STATES, today }).entityType).toBeDefined();
  });
  it("skips the questions when an existing business on file was chosen", () => {
    expect(validateCompany({ ...emptyWizardData().company, business: "6f1c2a8e-0000-4000-8000-000000000000" }, { availableStates: STATES, today })).toEqual({});
  });
  it("formation needs a name and a registered agent choice", () => {
    expect(validateFormation({ llcName: "", raChoice: "ours" }).llcName).toBeDefined();
    expect(validateFormation({ llcName: "Bluebonnet Bakery", raChoice: "own" })).toEqual({});
  });
});

describe("checkout step 2: contact", () => {
  it("accepts a US contact", () => {
    expect(validateContact(contact())).toEqual({});
    expect(validateContact(contact({ phone: "+1 512 555 0100", postalCode: "78701-1234" }))).toEqual({});
  });
  it("validates ZIP, phone and email with helpful messages", () => {
    const e = validateContact(contact({ postalCode: "7870", phone: "555-0100", email: "ada@" }));
    expect(e.postalCode).toBe("Enter a valid ZIP code, like 78701");
    expect(e.phone).toBe("Enter a 10-digit phone number");
    expect(e.email).toMatch(/valid email/);
  });
  it("accepts international addresses without a US state or ZIP", () => {
    expect(validateContact(contact({ country: "United Kingdom", state: "", postalCode: "SW1A 2AA", phone: "+44 20 7946 0958" }))).toEqual({});
    expect(validateContact(contact({ country: "Other", countryOther: "" })).countryOther).toBe("Enter your country");
  });
});

describe("checkout step 3: account", () => {
  it("requires a 10+ character password that doesn't contain the email", () => {
    expect(validateAccount({ email: "ada@example.com", password: "short" }).password).toMatch(/10 characters/);
    expect(validateAccount({ email: "ada.lovelace@example.com", password: "ada.lovelace2026!" }).password).toMatch(/email/);
    expect(validateAccount({ email: "ada@example.com", password: "correct horse battery" })).toEqual({});
  });
});
