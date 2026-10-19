import Link from "next/link";
import { SearchForm } from "@/components/admin/shared";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Table, Td, Th } from "@/components/ui/table";
import { stateName } from "@/config/states";
import { ENTITY_STATUS_LABEL, ENTITY_TYPE_LABEL } from "@/lib/labels";
import { listEntities } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Entities" };

export default async function EntitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const rows = await listEntities(q);
  return (
    <div className="space-y-5">
      <PageHeader title="Companies & entities" />
      <SearchForm action="/admin/entities" q={q} placeholder="Legal name or SOS file number" />
      {rows.length === 0 ? (
        <EmptyState title="No entities found" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Entity</Th>
              <Th>Type</Th>
              <Th>State</Th>
              <Th>Status</Th>
              <Th>Customer</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entity, customer }) => (
              <tr key={entity.id}>
                <Td>
                  <Link href={`/admin/entities/${entity.id}`} className="font-medium text-brand hover:underline">
                    {entity.legalName}
                  </Link>
                  {entity.sosFileNumber ? <span className="block text-xs text-muted">SOS #{entity.sosFileNumber}</span> : null}
                </Td>
                <Td>{ENTITY_TYPE_LABEL[entity.entityType]}</Td>
                <Td>{stateName(entity.jurisdiction)}</Td>
                <Td>{ENTITY_STATUS_LABEL[entity.status]}</Td>
                <Td>
                  <Link href={`/admin/customers/${customer.id}`} className="hover:underline">
                    {customer.firstName} {customer.lastName}
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
