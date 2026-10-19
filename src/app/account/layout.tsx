import type { Metadata } from "next";
import { AppShell } from "@/components/account/app-shell";
import { requireCustomer } from "@/server/auth/guards";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };

const NAV = [
  { href: "/account", label: "Overview", exact: true },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/documents", label: "Documents" },
  { href: "/account/billing", label: "Billing" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/support", label: "Support" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [session, s] = await Promise.all([requireCustomer("/account"), getSettings()]);
  return (
    <AppShell brand={s.brand} nav={NAV} userLabel={session.user.email}>
      {children}
    </AppShell>
  );
}
