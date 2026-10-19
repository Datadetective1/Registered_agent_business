"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { SERVICE_CODES } from "@/config/catalog";
import { STATE_CODES } from "@/config/states";
import {
  contactCountry,
  validateAccount,
  validateCompany,
  validateContact,
  validateFormation,
  type CheckoutProduct,
  type CheckoutStep,
  type ContactData,
} from "@/lib/checkout";
import type { FieldErrors } from "@/lib/forms";
import type { EntityType } from "@/db/schema";
import { track } from "@/server/analytics";
import { authenticate, normalizeEmail, registerCustomer } from "@/server/auth/accounts";
import { customerOrNull } from "@/server/auth/guards";
import { getCurrentSession, requestMeta, startSession } from "@/server/auth/session";
import { createCheckoutForOrder, startCheckout } from "@/server/checkout";
import { saveCheckoutContact } from "@/server/customer";
import { isProduction, paymentsMode } from "@/server/env";
import { confirmOrderPayment } from "@/server/fulfillment";
import { getCustomerOrder, OrderError, type CheckoutData } from "@/server/orders";
import { rateLimit, rateLimitAll, tooManyAttemptsMessage } from "@/server/rate-limit";
import { getServiceByCode, serviceAvailableStates } from "@/server/settings";

/*
 * Server side of the step-by-step checkout (components/checkout/wizard.tsx).
 * Every answer is re-validated here with the same validators the browser uses.
 */

export type CheckoutActionResult =
  | { ok: true; url?: string }
  | { ok: false; step?: CheckoutStep; errors?: FieldErrors; message?: string; code?: "email_taken" | "sign_in_failed" };

const str = (max = 300) => z.string().max(max).default("");

const contactShape = z.object({
  firstName: str(),
  lastName: str(),
  email: str(),
  phone: str(),
  country: str(),
  countryOther: str(),
  line1: str(),
  line2: str(),
  city: str(),
  state: str(),
  postalCode: str(),
});

const payloadSchema = z.object({
  product: z.enum(["registered_agent", "llc_formation", "business_address"]),
  data: z.object({
    company: z.object({
      business: str(40),
      situation: z.enum(["", "existing", "forming"]).default(""),
      legalName: str(),
      entityType: str(20),
      jurisdiction: str(2),
      formationDate: str(10),
      formationDateUnknown: z.boolean().default(false),
    }),
    formation: z.object({ llcName: str(), raChoice: z.enum(["ours", "own"]).catch("ours") }),
    contact: contactShape,
    acceptTerms: z.boolean().default(false),
  }),
  attribution: z.record(z.string(), z.string().max(100)).optional(),
});

const UUID = /^[0-9a-f-]{36}$/i;
const FAILED: CheckoutActionResult = { ok: false, message: "Something went wrong. Please try again in a moment." };

function pickAttribution(raw: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) if (raw?.[key]) out[key] = raw[key].slice(0, 100);
  return out;
}

/** States a business may be registered in for this product (registered agent coverage is configurable). */
async function availableStatesFor(product: CheckoutProduct): Promise<string[]> {
  if (product !== "registered_agent") return [...STATE_CODES];
  return serviceAvailableStates(await getServiceByCode(SERVICE_CODES.registeredAgent));
}

/* ----------------------------- account (step 3) ---------------------------- */

const accountSchema = z.object({ email: str(), password: z.string().max(200).default(""), contact: contactShape });

/** Create the customer's account during checkout and sign them in. */
export async function createCheckoutAccountAction(input: unknown): Promise<CheckoutActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return FAILED;
  const { email, password, contact } = parsed.data;
  if (await getCurrentSession()) return { ok: true };

  const contactErrors = validateContact(contact as ContactData);
  if (Object.keys(contactErrors).length) return { ok: false, step: "contact", errors: contactErrors };
  const accountErrors = validateAccount({ email, password });
  if (Object.keys(accountErrors).length) return { ok: false, step: "account", errors: accountErrors };

  const meta = await requestMeta();
  const limit = await rateLimitAll([[`signup:ip:${meta.ip ?? "unknown"}`, 10, 3600]]);
  if (!limit.ok) return { ok: false, step: "account", message: tooManyAttemptsMessage(limit.retryAfterSeconds) };

  const result = await registerCustomer(
    { email, password, firstName: contact.firstName.trim(), lastName: contact.lastName.trim(), phone: contact.phone.trim() },
    meta,
  );
  if (!result.ok) {
    return {
      ok: false,
      step: "account",
      code: "email_taken",
      errors: { email: "There's already an account with this email. Enter its password below to sign in and continue." },
    };
  }
  await startSession(result.user);
  await track("account_created", { path: "/order" });
  const session = await customerOrNull();
  if (session) await saveCheckoutContact(session.customer, { ...contact, email: contact.email || email, country: contactCountry(contact as ContactData) }, { type: "customer", userId: session.user.id });
  return { ok: true };
}

const signInSchema = z.object({ email: str(), password: z.string().max(200).default("") });

/** Sign in from the account step (for returning customers). */
export async function checkoutSignInAction(input: unknown): Promise<CheckoutActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return FAILED;
  const email = normalizeEmail(parsed.data.email);
  if (!email || !parsed.data.password) {
    return { ok: false, step: "account", errors: { ...(email ? {} : { email: "Enter your email address" }), ...(parsed.data.password ? {} : { password: "Enter your password" }) } };
  }
  const meta = await requestMeta();
  const limit = await rateLimitAll([
    [`login:ip:${meta.ip ?? "unknown"}`, 20, 900],
    [`login:email:${email}`, 8, 900],
  ]);
  if (!limit.ok) return { ok: false, step: "account", message: tooManyAttemptsMessage(limit.retryAfterSeconds) };

  const user = await authenticate(email, parsed.data.password, meta);
  if (!user) return { ok: false, step: "account", code: "sign_in_failed", errors: { password: "That password doesn't match this email. Try again, or reset your password." } };
  if (user.role !== "customer") return { ok: false, step: "account", message: "This is an administrator account. Use a customer account to place an order." };
  await startSession(user);
  return { ok: true };
}

/* ----------------------------- payment (step 4) ---------------------------- */

/** Validate the whole checkout, save contact details and open the payment page. */
export async function submitCheckoutAction(input: unknown): Promise<CheckoutActionResult> {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return FAILED;
  const { product, data } = parsed.data;

  const session = await customerOrNull();
  if (!session) return { ok: false, step: "account", message: "Create your account or sign in to continue." };
  const limit = await rateLimit(`checkout:customer:${session.customer.id}`, 20, 3600);
  if (!limit.ok) return { ok: false, step: "payment", message: tooManyAttemptsMessage(limit.retryAfterSeconds) };

  // Step 1: the business (or, for formation, the new LLC).
  let entityId: string | null = null;
  const checkoutData: CheckoutData = {};
  if (product === "llc_formation") {
    const errors = validateFormation(data.formation);
    if (Object.keys(errors).length) return { ok: false, step: "company", errors };
    checkoutData.llcName = data.formation.llcName.trim();
    checkoutData.raChoice = data.formation.raChoice;
    checkoutData.situation = "forming";
  } else if (data.company.business !== "new") {
    if (!UUID.test(data.company.business)) return { ok: false, step: "company", errors: { business: "Choose a business" } };
    entityId = data.company.business;
    checkoutData.situation = "existing";
  } else {
    // Business address orders don't ask whether the business exists yet.
    const c = product === "business_address" && !data.company.situation ? { ...data.company, situation: "existing" as const } : data.company;
    const errors = validateCompany(c, { availableStates: await availableStatesFor(product) });
    if (Object.keys(errors).length) return { ok: false, step: "company", errors };
    checkoutData.situation = c.situation === "forming" ? "forming" : "existing";
    checkoutData.entity = {
      legalName: c.legalName.trim(),
      entityType: c.entityType as EntityType,
      jurisdiction: c.jurisdiction,
      formationDate: c.situation === "existing" && !c.formationDateUnknown && c.formationDate ? c.formationDate : null,
    };
  }

  // Step 2: contact.
  const contactErrors = validateContact(data.contact as ContactData);
  if (Object.keys(contactErrors).length) return { ok: false, step: "contact", errors: contactErrors };
  const contact = { ...data.contact, country: contactCountry(data.contact as ContactData) };

  // Step 4: terms.
  if (!data.acceptTerms) return { ok: false, step: "payment", errors: { acceptTerms: "Please agree to the terms to continue" } };

  const actor = { type: "customer" as const, userId: session.user.id };
  let url: string;
  try {
    await saveCheckoutContact(session.customer, contact, actor);
    checkoutData.contact = {
      firstName: contact.firstName.trim(),
      lastName: contact.lastName.trim(),
      email: contact.email.trim().toLowerCase(),
      phone: contact.phone.trim(),
      country: contact.country,
      line1: contact.line1.trim(),
      line2: contact.line2.trim() || undefined,
      city: contact.city.trim(),
      state: contact.state.trim(),
      postalCode: contact.postalCode.trim(),
    };
    ({ url } = await startCheckout({
      customer: { ...session.customer, email: checkoutData.contact.email, firstName: checkoutData.contact.firstName, lastName: checkoutData.contact.lastName },
      userId: session.user.id,
      type: product,
      entityId,
      checkoutData,
      attribution: pickAttribution(parsed.data.attribution),
    }));
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, step: "payment", message: err.message };
    console.error("[checkout] failed to start", err);
    return { ok: false, step: "payment", message: "We couldn't open the payment page. Please try again in a moment." };
  }
  return { ok: true, url };
}

/** Retry payment for an unpaid order (e.g. after cancelling or an expired session). */
export async function resumeCheckout(orderId: string): Promise<void> {
  const session = await customerOrNull();
  if (!session) redirect("/sign-in");
  let url: string;
  try {
    url = await createCheckoutForOrder(session.customer, orderId);
  } catch {
    redirect(`/account/orders/${orderId}`);
  }
  redirect(url);
}

/** Development only: completes a simulated checkout via the same code path as Stripe. */
export async function completeSimulatedPayment(orderId: string): Promise<void> {
  if (isProduction() || paymentsMode() !== "simulated") throw new Error("Simulated payments are disabled.");
  const session = await customerOrNull();
  if (!session) redirect("/sign-in");
  const order = await getCustomerOrder(session.customer.id, orderId);
  if (!order) redirect("/account");
  await confirmOrderPayment(
    { orderId: order.id, gateway: "simulated", amountTotalCents: order.totalCents, currency: order.currency },
    { type: "customer", userId: session.user.id },
  );
  redirect(`/order/${order.id}/success`);
}
