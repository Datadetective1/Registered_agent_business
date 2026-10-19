import Link from "next/link";
import { DocumentVisibilityToggle, SearchForm } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Table, Td, Th } from "@/components/ui/table";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { listAllDocuments } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Documents" };

export default async function AdminDocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const rows = await listAllDocuments(q);
  return (
    <div className="space-y-5">
      <PageHeader title="Documents" description="To upload a document, open the customer's entity or order." />
      <SearchForm action="/admin/documents" q={q} placeholder="Title, business or customer email" />
      {rows.length === 0 ? (
        <EmptyState title="No documents" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Document</Th>
              <Th>Business</Th>
              <Th>Source</Th>
              <Th>Added</Th>
              <Th>Customer viewed</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ document: d, customer, entity }) => (
              <tr key={d.id}>
                <Td>
                  <a href={`/api/documents/${d.id}/download`} className="font-medium text-brand hover:underline">
                    {d.title}
                  </a>
                  <span className="block text-xs text-muted">{DOCUMENT_TYPE_LABEL[d.type]}</span>
                  {d.visibility === "internal" ? <Badge className="mt-1">Internal only</Badge> : null}
                </Td>
                <Td>
                  {entity ? (
                    <Link href={`/admin/entities/${entity.id}`} className="hover:underline">
                      {entity.legalName}
                    </Link>
                  ) : (
                    <Link href={`/admin/customers/${customer.id}`} className="hover:underline">
                      {customer.email}
                    </Link>
                  )}
                </Td>
                <Td>{d.source}</Td>
                <Td className="whitespace-nowrap">{formatDateTime(d.createdAt)}</Td>
                <Td>{d.customerViewedAt ? formatDateTime(d.customerViewedAt) : <span className="text-muted">Not yet</span>}</Td>
                <Td>
                  <DocumentVisibilityToggle id={d.id} visibility={d.visibility} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
