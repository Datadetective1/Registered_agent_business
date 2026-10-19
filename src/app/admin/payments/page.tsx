import Link from "next/link";
import { FilterTabs, stripeDashboardUrl } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Table, Td, Th } from "@/components/ui/table";
import { PAYMENT_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { listPayments } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "all" } = await searchParams;
  const rows = await listPayments(status);
  return (
    <div className="space-y-5">
      <PageHeader title="Payments" description="Refunds are issued in the Stripe dashboard and synced here automatically." />
      <FilterTabs
        base="/admin/payments"
        param="status"
        current={status}
        options={[{ value: "all", label: "All" }, ...Object.entries(PAYMENT_STATUS).map(([value, m]) => ({ value, label: m.label }))]}
      />
      {rows.length === 0 ? (
        <EmptyState title="No payments" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Customer</Th>
              <Th>Description</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th>Links</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ payment: p, customer }) => (
              <tr key={p.id}>
                <Td className="whitespace-nowrap">{formatDateTime(p.paidAt ?? p.createdAt)}</Td>
                <Td>
                  <Link href={`/admin/customers/${customer.id}`} className="hover:underline">
                    {customer.firstName} {customer.lastName}
                  </Link>
                </Td>
                <Td>
                  {p.orderId ? (
                    <Link href={`/admin/orders/${p.orderId}`} className="text-brand hover:underline">
                      {p.description}
                    </Link>
                  ) : (
                    p.description
                  )}
                  {p.failureMessage ? <span className="block text-xs text-danger-fg">{p.failureMessage}</span> : null}
                </Td>
                <Td className="tabular-nums">
                  {formatMoney(p.amountCents)}
                  {p.amountRefundedCents ? <span className="block text-xs text-muted">refunded {formatMoney(p.amountRefundedCents)}</span> : null}
                </Td>
                <Td>
                  <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                </Td>
                <Td className="space-x-2 whitespace-nowrap text-sm">
                  {p.stripePaymentIntentId ? <a className="text-brand hover:underline" href={stripeDashboardUrl("payments", p.stripePaymentIntentId)} target="_blank" rel="noopener noreferrer">Payment</a> : null}
                  {p.stripeInvoiceId ? <a className="text-brand hover:underline" href={stripeDashboardUrl("invoices", p.stripeInvoiceId)} target="_blank" rel="noopener noreferrer">Invoice</a> : null}
                  {!p.stripePaymentIntentId && !p.stripeInvoiceId ? <span className="text-muted">{p.gateway}</span> : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
