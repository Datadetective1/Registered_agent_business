import Link from "next/link";
import { SubscriptionStatusBadge } from "@/components/account/status";
import { FilterTabs, stripeDashboardUrl } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Table, Td, Th } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { daysUntil, formatDate } from "@/lib/utils";
import { listSubscriptions } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Subscriptions" };

const FILTERS = [
  { value: "upcoming", label: "Renewing in 60 days" },
  { value: "cancelling", label: "Auto-renew off" },
  { value: "past_due", label: "Past due" },
  { value: "all", label: "All" },
] as const;

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin();
  const { filter = "upcoming" } = await searchParams;
  const f = (FILTERS.find((x) => x.value === filter)?.value ?? "upcoming") as (typeof FILTERS)[number]["value"];
  const rows = await listSubscriptions(f);
  return (
    <div className="space-y-5">
      <PageHeader title="Subscriptions & renewals" />
      <FilterTabs base="/admin/subscriptions" param="filter" current={f} options={FILTERS.map((x) => ({ value: x.value, label: x.label }))} />
      {rows.length === 0 ? (
        <EmptyState title="Nothing here" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Entity</Th>
              <Th>Service</Th>
              <Th>Renewal date</Th>
              <Th>Price</Th>
              <Th>Status</Th>
              <Th>Gateway</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ subscription: s, entity, customer, service }) => {
              const days = daysUntil(s.currentPeriodEnd);
              return (
                <tr key={s.id}>
                  <Td>
                    <Link href={`/admin/entities/${entity.id}`} className="font-medium text-brand hover:underline">
                      {entity.legalName}
                    </Link>
                    <span className="block text-xs text-muted">{customer.email}</span>
                  </Td>
                  <Td>{service.name}</Td>
                  <Td>
                    {formatDate(s.currentPeriodEnd)}
                    {days !== null && days >= 0 ? <span className="block text-xs text-muted">in {days} days</span> : null}
                  </Td>
                  <Td className="tabular-nums">
                    {formatMoney(s.priceCents)}/{s.interval}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <SubscriptionStatusBadge status={s.status} />
                      {s.cancelAtPeriodEnd ? <Badge tone="warning">Auto-renew off</Badge> : null}
                    </div>
                  </Td>
                  <Td>
                    {s.stripeSubscriptionId ? (
                      <a href={stripeDashboardUrl("subscriptions", s.stripeSubscriptionId)} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        Stripe
                      </a>
                    ) : (
                      s.gateway
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
