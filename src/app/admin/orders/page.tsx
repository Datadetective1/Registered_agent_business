import Link from "next/link";
import { OrderStatusBadge } from "@/components/account/status";
import { Badge } from "@/components/ui/badge";
import { FilterTabs, SearchForm } from "@/components/admin/shared";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Table, Td, Th } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS, ORDER_TYPE_LABEL } from "@/lib/order-status";
import { formatDateTime, orderNumberLabel } from "@/lib/utils";
import { changeOfAgentOrderIds, listOrders } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Orders" };

const FILTERS = ["all", "payment_confirmed", "information_needed", "ready_for_fulfillment", "submitted_to_provider", "processing", "completed", "cancelled", "refunded"] as const;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin();
  const { status = "all", q } = await searchParams;
  const rows = await listOrders({ status, q });
  const switching = await changeOfAgentOrderIds(rows.map((r) => r.order.id));
  return (
    <div className="space-y-5">
      <PageHeader title="Orders" description="Unpaid checkouts (status New) are hidden unless searched by number." />
      <FilterTabs base="/admin/orders" param="status" current={status} options={FILTERS.map((f) => ({ value: f, label: f === "all" ? "All" : ORDER_STATUS[f].label }))} />
      <SearchForm action="/admin/orders" q={q} placeholder="Order #, email, name or business" hidden={{ status }} />
      {rows.length === 0 ? (
        <EmptyState title="No orders match" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Business</Th>
              <Th>Total</Th>
              <Th>Paid</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ order, customer, entity }) => (
              <tr key={order.id}>
                <Td>
                  <Link href={`/admin/orders/${order.id}`} className="font-medium text-brand hover:underline">
                    {orderNumberLabel(order.number)}
                  </Link>
                  <span className="block text-xs text-muted">{ORDER_TYPE_LABEL[order.type]}</span>
                  {switching.has(order.id) ? (
                    <Badge tone="warning" className="mt-1">
                      + Change of agent
                    </Badge>
                  ) : null}
                </Td>
                <Td>
                  <Link href={`/admin/customers/${customer.id}`} className="hover:underline">
                    {customer.firstName} {customer.lastName}
                  </Link>
                  <span className="block text-xs text-muted">{customer.email}</span>
                </Td>
                <Td>{entity?.legalName ?? "—"}</Td>
                <Td className="tabular-nums">{formatMoney(order.totalCents)}</Td>
                <Td className="whitespace-nowrap">{formatDateTime(order.paidAt)}</Td>
                <Td>
                  <OrderStatusBadge status={order.status} audience="admin" />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
