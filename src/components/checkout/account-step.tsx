import { SignInForm, SignUpForm } from "@/components/auth/auth-forms";

/** Shown in checkout when the visitor isn't signed in. Both forms return to checkout. */
export function AccountStep({ returnTo }: { returnTo: string }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-sans text-lg font-semibold">Create your account</h2>
        <p className="mt-1 text-sm text-muted">Your account is where you&apos;ll track this order and receive documents.</p>
        <div className="mt-5">
          <SignUpForm returnTo={returnTo} idPrefix="co-" />
        </div>
      </div>
      <details className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <summary className="cursor-pointer font-medium text-brand">Already have an account? Sign in</summary>
        <div className="mt-5">
          <SignInForm returnTo={returnTo} idPrefix="co-" />
        </div>
      </details>
    </div>
  );
}
