import Link from "next/link";
import { SearchForm } from "@/components/admin/shared";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { listCustomers } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const rows = await listCustomers(q);
  return (
    <div className="space-y-5">
      <PageHeader title="Customers" />
      <SearchForm action="/admin/customers" q={q} placeholder="Name, email or company" />
      {rows.length === 0 ? (
        <EmptyState title="No customers found" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Email</Th>
              <Th>Businesses</Th>
              <Th>Orders</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ customer, email, entityCount, orderCount }) => (
              <tr key={customer.id}>
                <Td>
                  <Link href={`/admin/customers/${customer.id}`} className="font-medium text-brand hover:underline">
                    {customer.firstName} {customer.lastName}
                  </Link>
                  {customer.companyName ? <span className="block text-xs text-muted">{customer.companyName}</span> : null}
                </Td>
                <Td>{email}</Td>
                <Td>{entityCount}</Td>
                <Td>{orderCount}</Td>
                <Td>{formatDate(customer.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
