import { STATE_CODES } from "@/config/states";
import type { FieldErrors } from "./forms";
import { ENTITY_TYPE_LABEL } from "./labels";

/**
 * Step-by-step checkout (Company → Contact → Account → Payment).
 *
 * These validators run in the browser for instant, field-level feedback on each step,
 * and again on the server before an order is created. Messages are written for
 * customers: say what to do, not what went wrong technically.
 */

export type CheckoutProduct = "registered_agent" | "llc_formation" | "business_address";

export const CHECKOUT_STEPS = ["company", "contact", "account", "payment"] as const;
export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];
export const STEP_LABEL: Record<CheckoutStep, string> = { company: "Company", contact: "Contact", account: "Account", payment: "Payment" };

export const COUNTRIES = ["United States", "Canada", "Mexico", "United Kingdom", "Other"] as const;

export type CompanyData = {
  /** "new", or the id of one of the customer's existing businesses. */
  business: string;
  situation: "" | "existing" | "forming";
  legalName: string;
  entityType: string;
  jurisdiction: string;
  formationDate: string;
  formationDateUnknown: boolean;
};

export type FormationData = { llcName: string; raChoice: "ours" | "own" };

export type ContactData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  countryOther: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

export type WizardData = {
  company: CompanyData;
  formation: FormationData;
  contact: ContactData;
  acceptTerms: boolean;
};

export function emptyWizardData(defaults: { jurisdiction?: string; llcName?: string } = {}): WizardData {
  return {
    company: {
      business: "new",
      situation: "",
      legalName: "",
      entityType: "llc",
      jurisdiction: defaults.jurisdiction ?? "TX",
      formationDate: "",
      formationDateUnknown: false,
    },
    formation: { llcName: defaults.llcName ?? "", raChoice: "ours" },
    contact: { firstName: "", lastName: "", email: "", phone: "", country: "United States", countryOther: "", line1: "", line2: "", city: "", state: "TX", postalCode: "" },
    acceptTerms: false,
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ZIP = /^\d{5}(-\d{4})?$/;
const tooLong = (v: string, max: number) => v.trim().length > max;

export function isUsCountry(country: string) {
  return country === "United States";
}

export function validateCompany(c: CompanyData, opts: { availableStates: string[]; today?: Date }): FieldErrors {
  const e: FieldErrors = {};
  if (c.business !== "new") return e; // an existing business on file was selected
  if (!c.situation) e.situation = "Tell us whether your business already exists";
  if (!c.legalName.trim()) e.legalName = c.situation === "forming" ? "Enter the name you plan to use for your company" : "Enter the legal name of your company";
  else if (tooLong(c.legalName, 200)) e.legalName = "That name is too long";
  if (!Object.hasOwn(ENTITY_TYPE_LABEL, c.entityType)) e.entityType = "Choose your company's entity type";
  if (!opts.availableStates.includes(c.jurisdiction)) {
    e.jurisdiction = STATE_CODES.includes(c.jurisdiction) ? "We don't offer service in that state yet" : "Choose the state where your company is registered";
  }
  if (c.situation === "existing" && !c.formationDateUnknown && c.formationDate) {
    const d = new Date(`${c.formationDate}T12:00:00Z`);
    const today = opts.today ?? new Date();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.formationDate) || Number.isNaN(d.getTime())) e.formationDate = "Enter a valid date, or tick “I don't know”";
    else if (d > today) e.formationDate = "The formation date can't be in the future";
  }
  return e;
}

export function validateFormation(f: FormationData): FieldErrors {
  const e: FieldErrors = {};
  if (!f.llcName.trim()) e.llcName = "Enter the name you'd like for your LLC";
  else if (tooLong(f.llcName, 150)) e.llcName = "That name is too long";
  if (f.raChoice !== "ours" && f.raChoice !== "own") e.raChoice = "Choose a registered agent option";
  return e;
}

export function validateContact(c: ContactData): FieldErrors {
  const e: FieldErrors = {};
  const us = isUsCountry(c.country);
  if (!c.firstName.trim()) e.firstName = "Enter your first name";
  else if (tooLong(c.firstName, 60)) e.firstName = "That's too long";
  if (!c.lastName.trim()) e.lastName = "Enter your last name";
  else if (tooLong(c.lastName, 60)) e.lastName = "That's too long";
  if (!EMAIL.test(c.email.trim())) e.email = "Enter a valid email address, like name@example.com";
  const digits = c.phone.replace(/\D/g, "");
  if (!c.phone.trim()) e.phone = "Enter your phone number";
  else if (us ? !(digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))) : digits.length < 7 || digits.length > 15) {
    e.phone = us ? "Enter a 10-digit phone number" : "Enter a valid phone number, including the country code";
  }
  if (!(COUNTRIES as readonly string[]).includes(c.country)) e.country = "Choose your country";
  if (c.country === "Other" && !c.countryOther.trim()) e.countryOther = "Enter your country";
  if (!c.line1.trim()) e.line1 = "Enter your street address";
  else if (tooLong(c.line1, 200)) e.line1 = "That's too long";
  if (tooLong(c.line2, 200)) e.line2 = "That's too long";
  if (!c.city.trim()) e.city = "Enter your city";
  if (us) {
    if (!STATE_CODES.includes(c.state)) e.state = "Choose your state";
    if (!ZIP.test(c.postalCode.trim())) e.postalCode = "Enter a valid ZIP code, like 78701";
  } else if (tooLong(c.postalCode, 20)) e.postalCode = "That's too long";
  return e;
}

export function validateAccount(a: { email: string; password: string }): FieldErrors {
  const e: FieldErrors = {};
  if (!EMAIL.test(a.email.trim())) e.email = "Enter a valid email address, like name@example.com";
  const local = a.email.trim().toLowerCase().split("@")[0] ?? "";
  if (a.password.length < 10) e.password = "Use at least 10 characters for your password";
  else if (a.password.length > 128) e.password = "That password is too long";
  else if (local.length >= 3 && a.password.toLowerCase().includes(local)) e.password = "Choose a password that doesn't contain your email";
  return e;
}

/** Country as stored on addresses (free text for "Other"). */
export function contactCountry(c: ContactData): string {
  return c.country === "Other" ? c.countryOther.trim() : c.country;
}
