import Link from "next/link";
import { SearchForm } from "@/components/admin/shared";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { listNotifications } from "@/server/admin/queries";
import { emailTransportName } from "@/server/env";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Email outbox" };

export default async function OutboxPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const rows = await listNotifications(q);
  return (
    <div className="space-y-5">
      <PageHeader title="Email outbox" description="Every email the system generates, with a preview." />
      {emailTransportName() === "log" ? (
        <Alert tone="info" title="Email sending is off">
          EMAIL_TRANSPORT=log: emails are recorded here but not delivered. Enable a provider only when production email is approved.
        </Alert>
      ) : null}
      <SearchForm action="/admin/notifications" q={q} placeholder="Recipient, subject or template" />
      {rows.length === 0 ? (
        <EmptyState title="No emails yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Subject</Th>
              <Th>To</Th>
              <Th>Template</Th>
              <Th>Created</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id}>
                <Td>
                  <Link href={`/admin/notifications/${n.id}`} className="font-medium text-brand hover:underline">
                    {n.subject}
                  </Link>
                  {n.isInternal ? <Badge className="ml-2">Internal</Badge> : null}
                </Td>
                <Td>{n.toAddress}</Td>
                <Td className="font-mono text-xs">{n.template}</Td>
                <Td className="whitespace-nowrap">{formatDateTime(n.createdAt)}</Td>
                <Td>
                  <Badge tone={n.status === "sent" ? "success" : n.status === "failed" ? "danger" : "neutral"}>{n.status}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
