import type { Metadata } from "next";
import { AppShell } from "@/components/account/app-shell";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/server/auth/guards";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/entities", label: "Entities" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/notifications", label: "Email outbox" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, s] = await Promise.all([requireAdmin(), getSettings()]);
  return (
    <AppShell brand={s.brand} nav={NAV} userLabel={session.user.email} badge={<Badge tone="info">Admin</Badge>}>
      {children}
    </AppShell>
  );
}
