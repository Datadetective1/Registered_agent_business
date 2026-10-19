"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { SERVICE_CODES } from "@/config/catalog";
import { echoValues, mustAccept, parseForm, text, type FormState } from "@/lib/forms";
import { newEntityCheckoutSchema } from "@/lib/intake";
import { customerOrNull } from "@/server/auth/guards";
import { createCheckoutForOrder, startCheckout } from "@/server/checkout";
import { isProduction, paymentsMode } from "@/server/env";
import { confirmOrderPayment } from "@/server/fulfillment";
import { getCustomerOrder, OrderError, type CheckoutData } from "@/server/orders";
import { rateLimit, tooManyAttemptsMessage } from "@/server/rate-limit";
import { getServiceByCode, serviceAvailableStates } from "@/server/settings";

const SIGN_IN_FIRST: FormState = { message: "Please sign in to continue." };

async function guard(formData: FormData) {
  const session = await customerOrNull();
  if (!session) return { error: SIGN_IN_FIRST };
  const limit = await rateLimit(`checkout:customer:${session.customer.id}`, 20, 3600);
  if (!limit.ok) return { error: { message: tooManyAttemptsMessage(limit.retryAfterSeconds), values: echoValues(formData) } };
  return { session };
}

function attributionFrom(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const v = formData.get(key);
    if (typeof v === "string" && v) out[key] = v.slice(0, 100);
  }
  return out;
}

/** Shared by registered agent and business address: pick an existing business or enter a new one. */
async function parseBusinessChoice(formData: FormData, allowedStates: string[] | null) {
  const choice = String(formData.get("business") ?? "new");
  if (choice !== "new") {
    if (!/^[0-9a-f-]{36}$/i.test(choice)) return { errors: { business: "Choose a business" } };
    return { entityId: choice, checkoutData: {} as CheckoutData };
  }
  const parsed = parseForm(z.object({ entity: newEntityCheckoutSchema }), formData);
  if (!parsed.ok) return { errors: parsed.errors };
  if (allowedStates && !allowedStates.includes(parsed.data.entity.jurisdiction)) {
    return { errors: { "entity.jurisdiction": "We don't offer this service in that state yet" } };
  }
  return { entityId: null, checkoutData: { entity: parsed.data.entity } as CheckoutData };
}

async function begin(run: () => Promise<{ url: string }>, formData: FormData): Promise<FormState> {
  let url: string;
  try {
    ({ url } = await run());
  } catch (err) {
    if (err instanceof OrderError) return { message: err.message, values: echoValues(formData) };
    console.error("[checkout] failed to start", err);
    return { message: "We couldn't start checkout. Please try again in a moment.", values: echoValues(formData) };
  }
  redirect(url);
}

const termsSchema = z.object({ acceptTerms: mustAccept("Please accept the terms to continue") });

export async function startRegisteredAgentCheckout(_prev: FormState, formData: FormData): Promise<FormState> {
  const g = await guard(formData);
  if (g.error) return g.error;
  const ra = await getServiceByCode(SERVICE_CODES.registeredAgent);
  const choice = await parseBusinessChoice(formData, serviceAvailableStates(ra));
  const terms = parseForm(termsSchema, formData);
  const errors = { ...(choice.errors ?? {}), ...(terms.ok ? {} : terms.errors) };
  if (Object.keys(errors).length) return { errors, values: echoValues(formData), message: "Please review the highlighted fields." };
  return begin(
    () =>
      startCheckout({
        customer: g.session.customer,
        userId: g.session.user.id,
        type: "registered_agent",
        entityId: choice.entityId ?? null,
        checkoutData: choice.checkoutData ?? {},
        attribution: attributionFrom(formData),
      }),
    formData,
  );
}

export async function startBusinessAddressCheckout(_prev: FormState, formData: FormData): Promise<FormState> {
  const g = await guard(formData);
  if (g.error) return g.error;
  const choice = await parseBusinessChoice(formData, null);
  const terms = parseForm(termsSchema, formData);
  const errors = { ...(choice.errors ?? {}), ...(terms.ok ? {} : terms.errors) };
  if (Object.keys(errors).length) return { errors, values: echoValues(formData), message: "Please review the highlighted fields." };
  return begin(
    () =>
      startCheckout({
        customer: g.session.customer,
        userId: g.session.user.id,
        type: "business_address",
        entityId: choice.entityId ?? null,
        checkoutData: choice.checkoutData ?? {},
        attribution: attributionFrom(formData),
      }),
    formData,
  );
}

const formationCheckoutSchema = z.object({
  llcName: text(150, "LLC name"),
  raChoice: z.enum(["ours", "own"], { error: "Choose a registered agent option" }),
  acceptTerms: mustAccept("Please accept the terms to continue"),
});

export async function startFormationCheckout(_prev: FormState, formData: FormData): Promise<FormState> {
  const g = await guard(formData);
  if (g.error) return g.error;
  const parsed = parseForm(formationCheckoutSchema, formData);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.values, message: "Please review the highlighted fields." };
  return begin(
    () =>
      startCheckout({
        customer: g.session.customer,
        userId: g.session.user.id,
        type: "llc_formation",
        entityId: null,
        checkoutData: { llcName: parsed.data.llcName, raChoice: parsed.data.raChoice },
        attribution: attributionFrom(formData),
      }),
    formData,
  );
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
