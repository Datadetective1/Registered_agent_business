import Link from "next/link";
import { ServiceForm } from "@/components/admin/forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { centsToDollarInput } from "@/lib/money";
import { getAllServices, serviceAvailableStates } from "@/server/settings";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Services & pricing" };

export default async function ServicesSettingsPage() {
  await requireAdmin();
  const services = await getAllServices();
  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted">
        <Link href="/admin/settings" className="hover:text-ink">
          Settings
        </Link>{" "}
        / Services & pricing
      </nav>
      <PageHeader title="Services & pricing" description="Price changes apply to new orders immediately. Existing subscriptions renew at the price they were purchased at." />
      {services.map((s) => (
        <Card key={s.id}>
          <CardHeader title={s.name} description={<span className="font-mono text-xs">{s.code}</span>} action={<Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Available" : "Not available"}</Badge>} />
          <CardBody>
            <ServiceForm
              serviceId={s.id}
              kind={s.kind}
              values={{
                name: s.name,
                shortDescription: s.shortDescription,
                price: centsToDollarInput(s.priceCents),
                governmentFee: centsToDollarInput(s.governmentFeeCents),
                governmentFeeLabel: s.governmentFeeLabel ?? "",
                billing: s.billing,
                isActive: s.isActive,
                features: s.features.join("\n"),
                availableStates: serviceAvailableStates(s).join(", "),
              }}
            />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
