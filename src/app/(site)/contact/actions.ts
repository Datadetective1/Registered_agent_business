"use server";

import { echoValues, parseForm, type FormState } from "@/lib/forms";
import { getOptionalSession } from "@/server/auth/guards";
import { requestMeta } from "@/server/auth/session";
import { rateLimit, tooManyAttemptsMessage } from "@/server/rate-limit";
import { createSupportRequest, supportRequestSchema } from "@/server/support";

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  // Honeypot: real users never see or fill this field.
  if (String(formData.get("website") ?? "").length > 0) {
    return { ok: true, message: "Thanks, your message has been sent." };
  }
  const meta = await requestMeta();
  const limit = await rateLimit(`contact:ip:${meta.ip ?? "unknown"}`, 5, 3600);
  if (!limit.ok) return { message: tooManyAttemptsMessage(limit.retryAfterSeconds), values: echoValues(formData) };

  const parsed = parseForm(supportRequestSchema, formData);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.values, message: "Please correct the highlighted fields." };

  const session = await getOptionalSession();
  const customerId = session?.customer?.id ?? null;
  await createSupportRequest(
    { ...parsed.data, orderId: undefined, entityId: undefined },
    { customerId, source: "contact_form", actor: session ? { type: "customer", userId: session.user.id } : { type: "system" } },
  );
  return { ok: true, message: "Thanks, your message has been sent. We'll reply by email, usually within one business day." };
}
