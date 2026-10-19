import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { MenuIcon } from "@/components/ui/icons";
import { getOptionalSession } from "@/server/auth/guards";
import { getSettings } from "@/server/settings";
import { Logo } from "./logo";

const NAV = [
  { href: "/registered-agent", label: "Registered Agent" },
  { href: "/start-an-llc-texas", label: "Texas LLC" },
  { href: "/business-address", label: "Business Address" },
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How It Works" },
];

export async function SiteHeader() {
  const [s, session] = await Promise.all([getSettings(), getOptionalSession()]);
  const accountHref = session?.user.role === "admin" ? "/admin" : "/account";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo name={s.brand.name} monogram={s.brand.monogram} logoUrl={s.brand.logoUrl} />

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="rounded-md px-3 py-2 text-[15px] text-ink/80 hover:bg-sand hover:text-ink">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {session ? (
            <ButtonLink href={accountHref} variant="secondary">
              {session.user.role === "admin" ? "Admin" : "My account"}
            </ButtonLink>
          ) : (
            <>
              <Link href="/sign-in" className="rounded-md px-3 py-2 text-[15px] text-ink/80 hover:bg-sand hover:text-ink">
                Sign in
              </Link>
              <ButtonLink href="/order/registered-agent">Get started</ButtonLink>
            </>
          )}
        </div>

        {/* Mobile menu: native <details>, works without JavaScript. */}
        <details className="group relative lg:hidden">
          <summary className="inline-flex size-10 cursor-pointer items-center justify-center rounded-md border border-line text-ink" aria-label="Open menu">
            <MenuIcon />
          </summary>
          <div className="absolute right-0 top-12 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-2 shadow-lg">
            <nav aria-label="Mobile">
              <ul>
                {NAV.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="block rounded-md px-3 py-2.5 text-[15px] text-ink hover:bg-sand">
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li className="my-2 border-t border-line" />
                {session ? (
                  <li>
                    <Link href={accountHref} className="block rounded-md px-3 py-2.5 text-[15px] font-medium text-brand hover:bg-sand">
                      {session.user.role === "admin" ? "Admin dashboard" : "My account"}
                    </Link>
                  </li>
                ) : (
                  <>
                    <li>
                      <Link href="/sign-in" className="block rounded-md px-3 py-2.5 text-[15px] text-ink hover:bg-sand">
                        Sign in
                      </Link>
                    </li>
                    <li className="p-1">
                      <ButtonLink href="/order/registered-agent" className="w-full">
                        Get started
                      </ButtonLink>
                    </li>
                  </>
                )}
              </ul>
            </nav>
          </div>
        </details>
      </Container>
    </header>
  );
}
