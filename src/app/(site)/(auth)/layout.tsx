import type { Metadata } from "next";
import { Container } from "@/components/ui/layout";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container className="max-w-md py-12 sm:py-16">
      <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">{children}</div>
    </Container>
  );
}
