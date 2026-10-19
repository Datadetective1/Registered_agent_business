import Link from "next/link";
import { OrderStatusBadge } from "@/components/account/status";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Table, Td, Th } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";
import { formatDate, orderNumberLabel } from "@/lib/utils";
import { requireCustomer } from "@/server/auth/guards";
import { listCustomerOrders } from "@/server/orders";

export default async function OrdersPage() {
  const session = await requireCustomer("/account/orders");
  const orders = await listCustomerOrders(session.customer.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Orders" />
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Business</Th>
              <Th>Date</Th>
              <Th>Total</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map(({ order, entity }) => (
              <tr key={order.id}>
                <Td>
                  <Link href={`/account/orders/${order.id}`} className="font-medium text-brand hover:underline">
                    {orderNumberLabel(order.number)}
                  </Link>
                  <span className="block text-xs text-muted">{ORDER_TYPE_LABEL[order.type]}</span>
                </Td>
                <Td>{entity?.legalName ?? "—"}</Td>
                <Td>{formatDate(order.paidAt ?? order.createdAt)}</Td>
                <Td className="tabular-nums">{formatMoney(order.totalCents)}</Td>
                <Td>
                  <OrderStatusBadge status={order.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
