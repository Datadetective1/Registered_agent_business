import Link from "next/link";
import { FilterTabs } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Table, Td, Th } from "@/components/ui/table";
import { SUPPORT_CATEGORY_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { listSupport } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Support" };

export default async function SupportListPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "open" } = await searchParams;
  const rows = await listSupport(status);
  return (
    <div className="space-y-5">
      <PageHeader title="Support requests" description="Reply by email, then update the status here." />
      <FilterTabs base="/admin/support" param="status" current={status} options={[{ value: "open", label: "Open" }, { value: "pending", label: "Pending" }, { value: "closed", label: "Closed" }, { value: "all", label: "All" }]} />
      {rows.length === 0 ? (
        <EmptyState title="No requests" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Subject</Th>
              <Th>From</Th>
              <Th>Topic</Th>
              <Th>Received</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/admin/support/${r.id}`} className="font-medium text-brand hover:underline">
                    {r.subject}
                  </Link>
                </Td>
                <Td>
                  {r.name}
                  <span className="block text-xs text-muted">{r.email}</span>
                </Td>
                <Td>{SUPPORT_CATEGORY_LABEL[r.category]}</Td>
                <Td className="whitespace-nowrap">{formatDateTime(r.createdAt)}</Td>
                <Td>
                  <Badge tone={r.status === "open" ? "warning" : r.status === "pending" ? "info" : "neutral"}>{r.status}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
