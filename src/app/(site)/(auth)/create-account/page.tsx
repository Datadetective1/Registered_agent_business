import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/auth-forms";
import { safeReturnTo } from "@/lib/utils";
import { getOptionalSession } from "@/server/auth/guards";

export const metadata = { title: "Create an account" };

export default async function CreateAccountPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  const session = await getOptionalSession();
  if (session) redirect(safeReturnTo(returnTo));
  return (
    <>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-1 text-[15px] text-muted">Your account is where you&apos;ll track orders and receive documents.</p>
      <div className="mt-6">
        <SignUpForm returnTo={safeReturnTo(returnTo)} />
      </div>
      <p className="mt-6 border-t border-line pt-5 text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/sign-in${returnTo ? `?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}` : ""}`} className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
