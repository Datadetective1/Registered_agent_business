"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { echoValues, email, optionalPhone, optionalText, parseForm, text, type FormState } from "@/lib/forms";
import { buildLlcFormationIntakeSchema, businessAddressIntakeSchema, registeredAgentIntakeSchema } from "@/lib/intake";
import { actorFrom } from "@/server/audit";
import { changePassword } from "@/server/auth/accounts";
import { customerOrNull } from "@/server/auth/guards";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/server/auth/password";
import { CustomerActionError, getCustomerEntity, respondToInformationRequest, setSubscriptionAutoRenew, updateCustomerProfile } from "@/server/customer";
import { createDocument, UploadError } from "@/server/documents";
import { appUrl } from "@/server/env";
import { IntakeError, submitOrderIntake, type IntakeData } from "@/server/fulfillment";
import { getCustomerOrder, type CheckoutData } from "@/server/orders";
import { getGateway } from "@/server/payments/gateway";
import { rateLimit, tooManyAttemptsMessage } from "@/server/rate-limit";
import { createSupportRequest, supportRequestSchema } from "@/server/support";

const NOT_SIGNED_IN: FormState = { message: "Your session has expired. Please sign in again." };

function filesFrom(formData: FormData, field = "files"): File[] {
  return formData.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
}

/* -------------------------------- onboarding ------------------------------- */

export async function submitIntakeAction(orderId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customerOrNull();
  if (!session) return NOT_SIGNED_IN;
  const order = await getCustomerOrder(session.customer.id, orderId);
  if (!order) return { message: "Order not found." };

  let intake: IntakeData;
  if (order.type === "registered_agent") {
    const r = parseForm(registeredAgentIntakeSchema, formData);
    if (!r.ok) return { errors: r.errors, values: r.values, message: "Please review the highlighted fields." };
    intake = { type: "registered_agent", data: r.data };
  } else if (order.type === "llc_formation") {
    const own = (order.checkoutData as CheckoutData).raChoice === "own";
    const r = parseForm(buildLlcFormationIntakeSchema({ ownRegisteredAgent: own }), formData);
    if (!r.ok) return { errors: r.errors, values: r.values, message: "Please review the highlighted fields." };
    intake = { type: "llc_formation", data: r.data };
  } else {
    const r = parseForm(businessAddressIntakeSchema, formData);
    if (!r.ok) return { errors: r.errors, values: r.values, message: "Please review the highlighted fields." };
    intake = { type: "business_address", data: r.data };
  }

  try {
    await submitOrderIntake(session.customer, order.id, intake, actorFrom(session));
  } catch (err) {
    if (err instanceof IntakeError) return { message: err.message, values: echoValues(formData) };
    throw err;
  }
  redirect(`/account/orders/${order.id}?submitted=1`);
}

/* --------------------------- information requests -------------------------- */

export async function respondToRequestAction(requestId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customerOrNull();
  if (!session) return NOT_SIGNED_IN;
  const limit = await rateLimit(`respond:${session.customer.id}`, 20, 3600);
  if (!limit.ok) return { message: tooManyAttemptsMessage(limit.retryAfterSeconds) };
  const response = String(formData.get("response") ?? "").slice(0, 5000);
  const files = filesFrom(formData);
  if (files.length > 5) return { message: "Attach up to 5 files at a time." };
  try {
    await respondToInformationRequest(session.customer, requestId, response, files, { ...actorFrom(session), userId: session.user.id });
  } catch (err) {
    if (err instanceof CustomerActionError || err instanceof UploadError) return { message: err.message, values: { response } };
    throw err;
  }
  revalidatePath("/account", "layout");
  return { ok: true, message: "Thanks, we've received your response." };
}

/* --------------------------------- documents ------------------------------- */

export async function uploadDocumentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customerOrNull();
  if (!session) return NOT_SIGNED_IN;
  const limit = await rateLimit(`upload:${session.customer.id}`, 30, 3600);
  if (!limit.ok) return { message: tooManyAttemptsMessage(limit.retryAfterSeconds) };
  const entityId = String(formData.get("entityId") ?? "");
  if (entityId && !(await getCustomerEntity(session.customer.id, entityId))) return { message: "Business not found." };
  const [file] = filesFrom(formData, "file");
  if (!file) return { errors: { file: "Choose a file to upload." } };
  try {
    await createDocument(
      {
        customerId: session.customer.id,
        entityId: entityId || null,
        type: "customer_upload",
        title: String(formData.get("title") ?? "").slice(0, 200),
        file,
        source: "customer",
        visibility: "customer",
        uploadedByUserId: session.user.id,
      },
      actorFrom(session),
    );
  } catch (err) {
    if (err instanceof UploadError) return { errors: { file: err.message } };
    throw err;
  }
  revalidatePath("/account", "layout");
  return { ok: true, message: "Document uploaded." };
}

/* ---------------------------------- billing -------------------------------- */

export async function setAutoRenewAction(subscriptionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customerOrNull();
  if (!session) return NOT_SIGNED_IN;
  const autoRenew = formData.get("autoRenew") === "on";
  if (!autoRenew && formData.get("confirm") !== "on") {
    return { errors: { confirm: "Please confirm you understand what happens when service ends." } };
  }
  try {
    await setSubscriptionAutoRenew(session.customer, subscriptionId, autoRenew, actorFrom(session));
  } catch (err) {
    if (err instanceof CustomerActionError) return { message: err.message };
    console.error("[billing] auto-renew change failed", err);
    return { message: "We couldn't update your renewal setting. Please try again or contact support." };
  }
  revalidatePath("/account", "layout");
  return { ok: true, message: autoRenew ? "Auto-renewal is on." : "Auto-renewal is off. Your service continues until the end of the current term." };
}

export async function openBillingPortalAction(): Promise<void> {
  const session = await customerOrNull();
  if (!session) redirect("/sign-in?returnTo=/account/billing");
  const gateway = getGateway();
  let url: string | null = null;
  try {
    url = gateway ? await gateway.billingPortalUrl(session.customer, `${appUrl()}/account/billing`) : null;
  } catch (err) {
    console.error("[billing] portal failed", err);
  }
  redirect(url ?? "/account/billing?portal=unavailable");
}

/* ---------------------------------- profile -------------------------------- */

const profileSchema = z.object({
  firstName: text(60, "First name"),
  lastName: text(60, "Last name"),
  email: email(),
  phone: optionalPhone(),
  companyName: optionalText(150),
});

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customerOrNull();
  if (!session) return NOT_SIGNED_IN;
  const r = parseForm(profileSchema, formData);
  if (!r.ok) return { errors: r.errors, values: r.values };
  await updateCustomerProfile(session.customer, r.data, actorFrom(session));
  revalidatePath("/account", "layout");
  return { ok: true, message: "Your contact details were saved." };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(PASSWORD_MAX),
    newPassword: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`).max(PASSWORD_MAX),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customerOrNull();
  if (!session) return NOT_SIGNED_IN;
  const limit = await rateLimit(`password-change:${session.user.id}`, 10, 3600);
  if (!limit.ok) return { message: tooManyAttemptsMessage(limit.retryAfterSeconds) };
  const r = parseForm(passwordSchema, formData);
  if (!r.ok) return { errors: r.errors };
  const ok = await changePassword({ ...actorFrom(session), userId: session.user.id }, session.sessionId, r.data.currentPassword, r.data.newPassword);
  if (!ok) return { errors: { currentPassword: "Current password is incorrect." } };
  return { ok: true, message: "Password changed. Other devices have been signed out." };
}

/* ---------------------------------- support -------------------------------- */

export async function submitSupportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await customerOrNull();
  if (!session) return NOT_SIGNED_IN;
  const limit = await rateLimit(`support:${session.customer.id}`, 10, 3600);
  if (!limit.ok) return { message: tooManyAttemptsMessage(limit.retryAfterSeconds) };
  const c = session.customer;
  formData.set("name", `${c.firstName} ${c.lastName}`);
  formData.set("email", c.email);
  const r = parseForm(supportRequestSchema, formData);
  if (!r.ok) return { errors: r.errors, values: r.values };
  // Only link orders/entities the customer owns.
  const orderId = r.data.orderId && (await getCustomerOrder(c.id, r.data.orderId)) ? r.data.orderId : undefined;
  const entityId = r.data.entityId && (await getCustomerEntity(c.id, r.data.entityId)) ? r.data.entityId : undefined;
  await createSupportRequest({ ...r.data, orderId, entityId }, { customerId: c.id, source: "account", actor: actorFrom(session) });
  revalidatePath("/account/support");
  return { ok: true, message: "Message sent. We'll reply by email, usually within one business day." };
}
