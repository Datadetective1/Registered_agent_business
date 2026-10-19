"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { echoValues, email, parseForm, text, type FormState } from "@/lib/forms";
import { safeReturnTo } from "@/lib/utils";
import { track } from "@/server/analytics";
import { authenticate, registerCustomer, requestPasswordReset, resetPasswordWithToken } from "@/server/auth/accounts";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/server/auth/password";
import { clearSessionCookie, getCurrentSession, invalidateSession, requestMeta, startSession } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { rateLimitAll, tooManyAttemptsMessage } from "@/server/rate-limit";

const password = () =>
  z
    .string({ error: "Password is required" })
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, "Password is too long");

/* --------------------------------- sign in -------------------------------- */

const signInSchema = z.object({ email: email(), password: z.string().min(1, "Password is required").max(PASSWORD_MAX) });

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(signInSchema, formData);
  if (!parsed.ok) return { errors: parsed.errors, values: echoValues(formData) };
  const meta = await requestMeta();
  const limit = await rateLimitAll([
    [`login:ip:${meta.ip ?? "unknown"}`, 20, 900],
    [`login:email:${parsed.data.email}`, 8, 900],
  ]);
  if (!limit.ok) return { message: tooManyAttemptsMessage(limit.retryAfterSeconds), values: echoValues(formData) };

  const user = await authenticate(parsed.data.email, parsed.data.password, meta);
  if (!user) return { message: "Email or password is incorrect.", values: { email: parsed.data.email } };

  await startSession(user);
  redirect(user.role === "admin" ? "/admin" : safeReturnTo(formData.get("returnTo")));
}

/* ----------------------------- create account ----------------------------- */

const signUpSchema = z
  .object({
    firstName: text(60, "First name"),
    lastName: text(60, "Last name"),
    email: email(),
    password: password(),
  })
  .refine((v) => !v.password.toLowerCase().includes(v.email.split("@")[0]), {
    path: ["password"],
    message: "Choose a password that doesn't contain your email",
  });

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(signUpSchema, formData);
  if (!parsed.ok) return { errors: parsed.errors, values: echoValues(formData) };
  const meta = await requestMeta();
  const limit = await rateLimitAll([[`signup:ip:${meta.ip ?? "unknown"}`, 10, 3600]]);
  if (!limit.ok) return { message: tooManyAttemptsMessage(limit.retryAfterSeconds), values: echoValues(formData) };

  const result = await registerCustomer(parsed.data, meta);
  if (!result.ok) {
    return {
      errors: { email: "An account with this email already exists. Please sign in instead." },
      values: echoValues(formData),
    };
  }
  await track("account_created", { path: String(formData.get("returnTo") ?? "") });
  await startSession(result.user);
  redirect(safeReturnTo(formData.get("returnTo")));
}

/* ----------------------------- password reset ----------------------------- */

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(z.object({ email: email() }), formData);
  if (!parsed.ok) return { errors: parsed.errors, values: echoValues(formData) };
  const meta = await requestMeta();
  const limit = await rateLimitAll([
    [`reset:ip:${meta.ip ?? "unknown"}`, 10, 3600],
    [`reset:email:${parsed.data.email}`, 3, 3600],
  ]);
  if (limit.ok) await requestPasswordReset(parsed.data.email, meta);
  // Same response either way, so we never reveal whether an account exists.
  return { ok: true, message: "If an account exists for that email, we've sent a link to reset your password. It expires in 1 hour." };
}

const resetSchema = z
  .object({ token: z.string().min(10).max(100), password: password(), confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(resetSchema, formData);
  if (!parsed.ok) return { errors: parsed.errors };
  const meta = await requestMeta();
  const limit = await rateLimitAll([[`reset-confirm:ip:${meta.ip ?? "unknown"}`, 10, 3600]]);
  if (!limit.ok) return { message: tooManyAttemptsMessage(limit.retryAfterSeconds) };
  const ok = await resetPasswordWithToken(parsed.data.token, parsed.data.password, meta);
  if (!ok) return { message: "This reset link is invalid or has expired. Please request a new one." };
  redirect("/sign-in?reset=1");
}

/* --------------------------------- sign out -------------------------------- */

export async function signOutAction() {
  const session = await getCurrentSession();
  if (session) {
    await invalidateSession(session.sessionId);
    await audit({ actor: { type: session.user.role, userId: session.user.id }, action: "auth.logout", targetType: "user", targetId: session.user.id });
  }
  await clearSessionCookie();
  redirect("/");
}
