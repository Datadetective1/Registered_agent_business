import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { Container } from "@/components/ui/layout";
import { LockIcon } from "@/components/ui/icons";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OrderLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Logo name={s.brand.name} monogram={s.brand.monogram} logoUrl={s.brand.logoUrl} />
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <LockIcon size={16} /> Secure checkout
          </p>
        </Container>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-muted">
          <p>
            Questions? <a className="underline" href={`mailto:${s.contact.supportEmail}`}>{s.contact.supportEmail}</a>
          </p>
          <nav className="flex gap-4" aria-label="Legal">
            <Link href="/legal/terms" className="hover:text-ink">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/legal/refund-policy" className="hover:text-ink">Refunds</Link>
          </nav>
        </Container>
      </footer>
    </div>
  );
}
