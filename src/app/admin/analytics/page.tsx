import { FilterTabs } from "@/components/admin/shared";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { Table, Td, Th } from "@/components/ui/table";
import { FUNNEL_EVENTS, funnelCounts, topSources } from "@/server/analytics";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Analytics" };

const LABELS: Record<(typeof FUNNEL_EVENTS)[number], string> = {
  landing_page: "Visits (landing page)",
  pricing_viewed: "Pricing viewed",
  account_created: "Accounts created",
  checkout_started: "Checkouts started",
  formation_started: "Formation checkouts started",
  checkout_completed: "Checkouts completed (paid)",
  registered_agent_purchased: "Registered agent purchased",
};

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin();
  const { days = "30" } = await searchParams;
  const d = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const [counts, sources] = await Promise.all([funnelCounts(d), topSources(d)]);
  const max = Math.max(1, ...Object.values(counts).map((n) => n ?? 0));
  return (
    <div className="space-y-5">
      <PageHeader title="Funnel analytics" description="Cookieless, anonymous counts. No personal data is collected." />
      <FilterTabs base="/admin/analytics" param="days" current={String(d)} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
      <Card>
        <CardHeader title={`Funnel: last ${d} days`} />
        <CardBody className="space-y-3">
          {FUNNEL_EVENTS.map((e) => {
            const n = counts[e] ?? 0;
            return (
              <div key={e}>
                <div className="flex justify-between text-sm">
                  <span>{LABELS[e]}</span>
                  <span className="font-medium tabular-nums">{n}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-sand">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${(n / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Top sources (landing pages)" />
        <CardBody>
          {sources.length === 0 ? (
            <p className="text-sm text-muted">No data yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th className="text-right">Visits</Th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source}>
                    <Td>{s.source}</Td>
                    <Td className="text-right tabular-nums">{s.count}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
