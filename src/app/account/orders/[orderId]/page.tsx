import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentsTable } from "@/components/account/documents-table";
import { InfoRequestResponseForm } from "@/components/account/forms";
import { OrderProgress, OrderStatusBadge } from "@/components/account/status";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS, ORDER_TYPE_LABEL } from "@/lib/order-status";
import { formatDate, formatDateTime, orderNumberLabel } from "@/lib/utils";
import { requireCustomer } from "@/server/auth/guards";
import { getCustomerOrderDetail } from "@/server/customer";
import { listCustomerDocuments } from "@/server/documents";
import { INTAKE_EDITABLE } from "@/server/fulfillment";

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const [{ orderId }, { submitted }] = await Promise.all([params, searchParams]);
  const session = await requireCustomer(`/account/orders/${orderId}`);
  const detail = await getCustomerOrderDetail(session.customer.id, orderId);
  if (!detail || detail.order.status === "new") notFound();
  const { order, items, entity, requests, payments } = detail;
  const docs = await listCustomerDocuments(session.customer.id, { orderId: order.id });
  const openRequests = requests.filter((r) => r.status === "open");
  const editable = INTAKE_EDITABLE.includes(order.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${orderNumberLabel(order.number)}`}
        description={`${ORDER_TYPE_LABEL[order.type]}${entity ? ` · ${entity.legalName}` : ""}`}
        actions={<OrderStatusBadge status={order.status} />}
      />
      {submitted ? (
        <Alert tone="success" title="Information received" role="status">
          Thank you. Your order is in our processing queue, and we&apos;ll email you as it moves forward.
        </Alert>
      ) : null}

      <Card>
        <CardBody className="space-y-5 py-6">
          <OrderProgress status={order.status} />
          <p className="text-[15px] text-muted">{ORDER_STATUS[order.status].customerText}</p>
          {order.status === "payment_confirmed" && !order.intakeSubmittedAt ? (
            <ButtonLink href={`/account/orders/${order.id}/onboarding`}>Complete business information</ButtonLink>
          ) : null}
        </CardBody>
      </Card>

      {requests.length ? (
        <section id="requests" className="scroll-mt-6 space-y-4">
          <h2 className="font-sans text-base font-semibold">Requests from our team</h2>
          {requests.map((r) => (
            <Card key={r.id}>
              <CardHeader
                title={`Requested ${formatDate(r.createdAt)}`}
                action={<Badge tone={r.status === "open" ? "warning" : r.status === "responded" ? "info" : "neutral"}>{r.status === "open" ? "Response needed" : r.status === "responded" ? "Responded" : "Closed"}</Badge>}
              />
              <CardBody className="space-y-4">
                <p className="whitespace-pre-wrap text-[15px]">{r.message}</p>
                {r.status === "open" ? (
                  <InfoRequestResponseForm requestId={r.id} />
                ) : r.customerResponse ? (
                  <div className="rounded-md bg-sand p-3 text-sm">
                    <p className="font-medium">Your reply ({formatDateTime(r.respondedAt)})</p>
                    <p className="mt-1 whitespace-pre-wrap">{r.customerResponse}</p>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </section>
      ) : null}
      {openRequests.length === 0 && order.status === "information_needed" ? (
        <Alert tone="warning">We&apos;ve asked for more information by email. Contact support if you need help.</Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Order details" />
          <CardBody>
            <dl className="space-y-2 text-[15px]">
              {items.map((i) => (
                <div key={i.id} className="flex justify-between gap-4">
                  <dt>{i.description}</dt>
                  <dd className="tabular-nums">{formatMoney(i.totalCents)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold">
                <dt>Total paid</dt>
                <dd className="tabular-nums">{formatMoney(order.totalCents)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-muted">Paid {formatDateTime(order.paidAt)}</p>
            {payments.map((p) => {
              const href = p.receiptUrl ?? p.invoiceUrl;
              return href ? (
                <a key={p.id} href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-brand hover:underline">
                  View receipt
                </a>
              ) : null;
            })}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Your information" />
          <CardBody className="space-y-3 text-[15px]">
            {order.intakeSubmittedAt ? (
              <p>Submitted {formatDateTime(order.intakeSubmittedAt)}.</p>
            ) : (
              <p className="text-muted">Not submitted yet.</p>
            )}
            {editable ? (
              <Link href={`/account/orders/${order.id}/onboarding`} className="font-medium text-brand hover:underline">
                {order.intakeSubmittedAt ? "Review or edit your information" : "Complete your information"}
              </Link>
            ) : (
              <p className="text-sm text-muted">Your order has been submitted for processing. To change anything, please contact support.</p>
            )}
            {entity ? (
              <p>
                <Link href={`/account/entities/${entity.id}`} className="text-brand hover:underline">
                  View {entity.legalName}
                </Link>
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="font-sans text-base font-semibold">Documents</h2>
        {docs.length ? <DocumentsTable docs={docs} /> : <p className="text-sm text-muted">Documents for this order will appear here.</p>}
      </section>

      <p className="text-sm text-muted">
        Questions about this order?{" "}
        <Link href="/account/support" className="text-brand hover:underline">
          Contact support
        </Link>
        .
      </p>
    </div>
  );
}
