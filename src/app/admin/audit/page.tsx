import { AuditList, SearchForm } from "@/components/admin/shared";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { listAudit } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const events = await listAudit({ action: q });
  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" description="Most recent 300 events. Filter by action, e.g. auth.login_failed, order.status_changed, document.downloaded." />
      <SearchForm action="/admin/audit" q={q} placeholder="Action contains…" />
      <Card>
        <CardBody>
          <AuditList events={events} />
        </CardBody>
      </Card>
    </div>
  );
}
