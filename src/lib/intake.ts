import { z } from "zod";
import { STATE_CODES } from "@/config/states";
import { checkbox, email, mustAccept, optionalText, phone, text } from "./forms";

/* ---------------------------------- shared ---------------------------------- */

const PO_BOX = /\b(p\.?\s*o\.?\s*box|post\s+office\s+box)\b/i;

export const addressSchema = z.object({
  line1: text(200, "Street address"),
  line2: optionalText(200),
  city: text(100, "City"),
  state: z.enum(STATE_CODES, { error: "Choose a state" }),
  postalCode: z
    .string({ error: "ZIP code is required" })
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code"),
});
export type AddressInput = z.infer<typeof addressSchema>;

/** A physical Texas street address (registered office rules: no P.O. boxes). */
export const texasStreetAddressSchema = addressSchema
  .refine((a) => a.state === "TX", { path: ["state"], message: "The registered office must be in Texas" })
  .refine((a) => !PO_BOX.test(`${a.line1} ${a.line2 ?? ""}`), {
    path: ["line1"],
    message: "A P.O. box can't be used for a registered office",
  });

export const contactSchema = z.object({
  name: text(120, "Contact name"),
  email: email(),
  phone: phone(),
});

export const ENTITY_TYPES = ["llc", "corporation", "nonprofit", "lp", "llp", "pllc", "other"] as const;

/* ---------------------------- pre-checkout (all) ---------------------------- */

export const newEntityCheckoutSchema = z.object({
  legalName: text(200, "Business name"),
  entityType: z.enum(ENTITY_TYPES, { error: "Choose an entity type" }),
  jurisdiction: z.enum(STATE_CODES, { error: "Choose a state" }),
});

/* ------------------------ registered agent onboarding ----------------------- */

export const APPOINTMENT_TYPES = {
  change_from_existing: "My business already exists and currently has a different registered agent",
  newly_formed: "My business already exists and does not yet have a registered agent on file",
  not_yet_formed: "I am forming the business myself and will list you as registered agent",
} as const;

export const registeredAgentIntakeSchema = z
  .object({
    entity: z.object({
      legalName: text(200, "Legal business name"),
      entityType: z.enum(ENTITY_TYPES, { error: "Choose an entity type" }),
      jurisdiction: z.enum(STATE_CODES, { error: "Choose a state" }),
      sosFileNumber: optionalText(50),
      formationDate: optionalText(10).refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use the date picker"),
    }),
    principalAddress: addressSchema,
    mailingSameAsPrincipal: checkbox(),
    mailingAddress: z.unknown().optional(),
    contact: contactSchema,
    appointment: z.object({
      type: z.enum(Object.keys(APPOINTMENT_TYPES) as [keyof typeof APPOINTMENT_TYPES], {
        error: "Tell us about your current registered agent",
      }),
      currentAgentName: optionalText(200),
    }),
    attestAuthorized: mustAccept("Please confirm you are authorized to appoint a registered agent for this business"),
  })
  .transform((v, ctx) => {
    let mailingAddress: AddressInput | undefined;
    if (!v.mailingSameAsPrincipal) {
      const parsed = addressSchema.safeParse(v.mailingAddress ?? {});
      if (!parsed.success) {
        for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, path: ["mailingAddress", ...issue.path] });
        return z.NEVER;
      }
      mailingAddress = parsed.data;
    }
    return { ...v, mailingAddress };
  });
export type RegisteredAgentIntake = z.infer<typeof registeredAgentIntakeSchema>;

/* -------------------------- Texas LLC formation ---------------------------- */

export const LLC_DESIGNATORS = ["LLC", "L.L.C.", "Limited Liability Company", "Ltd. Co."] as const;
const DESIGNATOR_SUFFIX = /\b(llc|l\.\s?l\.\s?c\.?|limited liability company|ltd\.?\s?co\.?|l\.?c\.?|limited company)\s*$/i;

const personSchema = z.object({ name: text(120, "Name"), address: addressSchema });

export function buildLlcFormationIntakeSchema(opts: { ownRegisteredAgent: boolean; today?: Date }) {
  const today = opts.today ?? new Date();
  return z
    .object({
      company: z.object({
        name: text(150, "LLC name").refine((v) => !DESIGNATOR_SUFFIX.test(v), "Leave off the ending (LLC, L.L.C., etc.) — choose it below"),
        designator: z.enum(LLC_DESIGNATORS, { error: "Choose an ending for the name" }),
        alternateName: optionalText(150),
      }),
      management: z.enum(["member_managed", "manager_managed"], { error: "Choose how the LLC will be managed" }),
      governingPersons: z
        .array(personSchema, { error: "Add at least one member or manager" })
        .min(1, "Add at least one member or manager")
        .max(6, "Up to 6 can be listed here; contact us for more"),
      organizer: personSchema,
      businessAddress: addressSchema,
      ownAgent: z.unknown().optional(),
      purpose: z.object({
        type: z.enum(["general", "specific"]),
        text: optionalText(500),
      }),
      effective: z.object({
        type: z.enum(["upon_filing", "specific_date"]),
        date: optionalText(10),
      }),
      contact: contactSchema,
      attestAccurate: mustAccept("Please confirm the information is accurate"),
      attestAuthorized: mustAccept("Please confirm you are authorized to form this company"),
    })
    .transform((v, ctx) => {
      if (v.purpose.type === "specific" && !v.purpose.text) {
        ctx.addIssue({ code: "custom", path: ["purpose", "text"], message: "Describe the specific purpose" });
      }
      if (v.effective.type === "specific_date") {
        const d = v.effective.date ? new Date(`${v.effective.date}T12:00:00Z`) : null;
        const max = new Date(today.getTime() + 90 * 86_400_000);
        if (!d || Number.isNaN(d.getTime()) || d < today || d > max) {
          ctx.addIssue({
            code: "custom",
            path: ["effective", "date"],
            message: "Choose a date within the next 90 days",
          });
        }
      }
      let ownAgent: { name: string; address: AddressInput; consent: true } | undefined;
      if (opts.ownRegisteredAgent) {
        const parsed = z
          .object({
            name: text(150, "Registered agent name"),
            address: texasStreetAddressSchema,
            consent: mustAccept("Confirm the registered agent has consented to serve"),
          })
          .safeParse(v.ownAgent ?? {});
        if (!parsed.success) {
          for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, path: ["ownAgent", ...issue.path] });
          return z.NEVER;
        }
        ownAgent = parsed.data;
      }
      return { ...v, ownAgent };
    });
}
export type LlcFormationIntake = z.infer<ReturnType<typeof buildLlcFormationIntakeSchema>>;

export function fullLlcName(company: { name: string; designator: string }): string {
  return `${company.name.trim()} ${company.designator}`;
}

/* ------------------------- business address service ------------------------ */

export const businessAddressIntakeSchema = z.object({
  businessName: text(200, "Business name"),
  contact: contactSchema,
  notes: optionalText(1000),
  acknowledgeVerification: mustAccept(
    "Please acknowledge that identity verification may be required before mail service begins",
  ),
});
export type BusinessAddressIntake = z.infer<typeof businessAddressIntakeSchema>;
