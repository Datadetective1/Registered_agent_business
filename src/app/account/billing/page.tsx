import { openBillingPortalAction } from "@/app/account/actions";
import { AutoRenewForm } from "@/components/account/forms";
import { SubscriptionStatusBadge } from "@/components/account/status";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, Td, Th } from "@/components/ui/table";
import { PAYMENT_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { requireCustomer } from "@/server/auth/guards";
import { listCustomerPayments, listCustomerSubscriptions } from "@/server/customer";
import { paymentsMode } from "@/server/env";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ portal?: string }> }) {
  const [{ portal }, session] = await Promise.all([searchParams, requireCustomer("/account/billing")]);
  const [subs, payments] = await Promise.all([listCustomerSubscriptions(session.customer.id), listCustomerPayments(session.customer.id)]);
  const portalAvailable = paymentsMode() === "stripe" && Boolean(session.customer.stripeCustomerId);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Payment method, renewals, invoices and receipts." />
      {portal === "unavailable" ? (
        <Alert tone="warning">The billing portal isn&apos;t available right now. Please contact support to update your payment method.</Alert>
      ) : null}

      <Card>
        <CardHeader title="Payment method" description="Update your card or download invoices on our payment provider's secure page." />
        <CardBody>
          {portalAvailable ? (
            <form action={openBillingPortalAction}>
              <SubmitButton variant="secondary" pendingLabel="Opening…">
                Manage payment method
              </SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-muted">
              {paymentsMode() === "simulated"
                ? "Simulated payments are active (development), so there's no saved card to manage."
                : "Your payment method is saved at checkout. Contact support if you need to update it."}
            </p>
          )}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <h2 className="font-sans text-base font-semibold">Renewals</h2>
        {subs.length === 0 ? (
          <EmptyState title="No renewing services" />
        ) : (
          <div className="space-y-3">
            {subs.map(({ subscription: sub, entity, service }) => (
              <Card key={sub.id}>
                <CardBody className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {service.name} · {entity.legalName}
                    </p>
                    <p className="text-sm text-muted">
                      {formatMoney(sub.priceCents)}/{sub.interval} ·{" "}
                      {sub.status === "canceled" ? `Ended ${formatDate(sub.endedAt ?? sub.currentPeriodEnd)}` : `${sub.cancelAtPeriodEnd ? "Ends" : "Renews"} ${formatDate(sub.currentPeriodEnd)}`}
                    </p>
                    {["active", "trialing", "past_due"].includes(sub.status) ? (
                      <div className="mt-2">
                        <AutoRenewForm subscriptionId={sub.id} autoRenew={!sub.cancelAtPeriodEnd} endLabel={formatDate(sub.currentPeriodEnd)} />
                      </div>
                    ) : null}
                  </div>
                  <SubscriptionStatusBadge status={sub.status} />
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-sans text-base font-semibold">Invoices and receipts</h2>
        {payments.length === 0 ? (
          <EmptyState title="No payments yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th className="text-right">Documents</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <Td>{formatDate(p.paidAt ?? p.createdAt)}</Td>
                  <Td>{p.description}</Td>
                  <Td className="tabular-nums">{formatMoney(p.amountCents, p.currency)}</Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-3 text-sm">
                      {p.receiptUrl ? <a className="text-brand hover:underline" href={p.receiptUrl} target="_blank" rel="noopener noreferrer">Receipt</a> : null}
                      {p.invoiceUrl ? <a className="text-brand hover:underline" href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">Invoice</a> : null}
                      {p.invoicePdfUrl ? <a className="text-brand hover:underline" href={p.invoicePdfUrl} target="_blank" rel="noopener noreferrer">PDF</a> : null}
                      {!p.receiptUrl && !p.invoiceUrl ? <span className="text-muted">—</span> : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
