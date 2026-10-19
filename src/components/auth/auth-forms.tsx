"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "@/app/(site)/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/forms";

export function SignInForm({ returnTo, idPrefix = "" }: { returnTo?: string; idPrefix?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signInAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      ) : null}
      <input type="hidden" name="returnTo" value={returnTo ?? ""} />
      <TextField id={`${idPrefix}signin-email`} name="email" label="Email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={e.email} />
      <TextField id={`${idPrefix}signin-password`} name="password" label="Password" type="password" autoComplete="current-password" required error={e.password} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
        <Link href="/forgot-password" className="text-sm text-brand hover:underline">
          Forgot your password?
        </Link>
      </div>
    </form>
  );
}

export function SignUpForm({ returnTo, idPrefix = "" }: { returnTo?: string; idPrefix?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signUpAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? (
        <Alert tone="danger" role="alert">
          {state.message}
        </Alert>
      ) : null}
      <input type="hidden" name="returnTo" value={returnTo ?? ""} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id={`${idPrefix}signup-first`} name="firstName" label="First name" autoComplete="given-name" required defaultValue={v.firstName} error={e.firstName} />
        <TextField id={`${idPrefix}signup-last`} name="lastName" label="Last name" autoComplete="family-name" required defaultValue={v.lastName} error={e.lastName} />
      </div>
      <TextField id={`${idPrefix}signup-email`} name="email" label="Email" type="email" autoComplete="email" required defaultValue={v.email} error={e.email} />
      <TextField
        id={`${idPrefix}signup-password`}
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters. A short phrase is easy to remember and hard to guess."
        error={e.password}
      />
      <p className="text-sm text-muted">
        By creating an account, you agree to our{" "}
        <Link href="/legal/terms" className="text-brand underline underline-offset-2" target="_blank">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="text-brand underline underline-offset-2" target="_blank">
          Privacy Policy
        </Link>
        .
      </p>
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(forgotPasswordAction, {});
  if (state.ok)
    return (
      <Alert tone="success" title="Check your email" role="status">
        {state.message}
      </Alert>
    );
  return (
    <form action={action} className="space-y-5" noValidate>
      <TextField name="email" label="Email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.errors?.email} />
      <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? (
        <Alert tone="danger" role="alert">
          {state.message}{" "}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
        </Alert>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <TextField name="password" label="New password" type="password" autoComplete="new-password" required minLength={10} error={e.password} hint="At least 10 characters." />
      <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required error={e.confirmPassword} />
      <SubmitButton pendingLabel="Saving…">Set new password</SubmitButton>
    </form>
  );
}
