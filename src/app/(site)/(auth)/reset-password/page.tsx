import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { Alert } from "@/components/ui/alert";

export const metadata = { title: "Choose a new password", referrer: "no-referrer" as const };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <div className="mt-6">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <Alert tone="danger">
            This link is incomplete.{" "}
            <Link href="/forgot-password" className="underline">
              Request a new reset link
            </Link>
            .
          </Alert>
        )}
      </div>
    </>
  );
}
