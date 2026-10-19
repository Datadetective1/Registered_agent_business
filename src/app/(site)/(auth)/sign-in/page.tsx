import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/auth-forms";
import { Alert } from "@/components/ui/alert";
import { safeReturnTo } from "@/lib/utils";
import { getOptionalSession } from "@/server/auth/guards";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; reset?: string }> }) {
  const { returnTo, reset } = await searchParams;
  const session = await getOptionalSession();
  if (session) redirect(session.user.role === "admin" ? "/admin" : safeReturnTo(returnTo));
  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-[15px] text-muted">Access your businesses, orders and documents.</p>
      {reset ? (
        <Alert tone="success" className="mt-6" role="status">
          Your password was updated. Please sign in.
        </Alert>
      ) : null}
      <div className="mt-6">
        <SignInForm returnTo={safeReturnTo(returnTo)} />
      </div>
      <p className="mt-6 border-t border-line pt-5 text-sm text-muted">
        New here?{" "}
        <Link href={`/create-account${returnTo ? `?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}` : ""}`} className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
