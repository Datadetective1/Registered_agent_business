import type { ReactNode } from "react";
import { signOutAction } from "@/app/(site)/(auth)/actions";
import { Logo } from "@/components/site/logo";
import { Container } from "@/components/ui/layout";
import { NavLink } from "./nav-link";

/** Shared shell for the customer account and the admin dashboard. */
export function AppShell({
  brand,
  nav,
  userLabel,
  badge,
  children,
}: {
  brand: { name: string; monogram: string; logoUrl?: string };
  nav: Array<{ href: string; label: string; exact?: boolean }>;
  userLabel: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <Container className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo name={brand.name} monogram={brand.monogram} logoUrl={brand.logoUrl} />
            {badge}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[220px] truncate text-sm text-muted sm:inline">{userLabel}</span>
            <form action={signOutAction}>
              <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-sand">
                Sign out
              </button>
            </form>
          </div>
        </Container>
      </header>
      <Container className="flex-1 py-6 lg:grid lg:grid-cols-[200px_1fr] lg:gap-10 lg:py-10">
        <nav aria-label="Account" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 pb-3 lg:mx-0 lg:mb-0 lg:border-0 lg:px-0 lg:pb-0">
          <ul className="flex gap-1 lg:flex-col">
            {nav.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} exact={item.exact}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" className="min-w-0">
          {children}
        </main>
      </Container>
    </div>
  );
}
