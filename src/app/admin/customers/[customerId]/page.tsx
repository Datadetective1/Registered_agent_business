import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentsTable } from "@/components/account/documents-table";
import { OrderStatusBadge, SubscriptionStatusBadge } from "@/components/account/status";
import { NoteForm } from "@/components/admin/forms";
import { AuditList, DocumentVisibilityToggle, NotesList, stripeDashboardUrl } from "@/components/admin/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList, PageHeader } from "@/components/ui/layout";
import { stateName } from "@/config/states";
import { ENTITY_STATUS_LABEL, PAYMENT_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";
import { formatDate, formatDateTime, orderNumberLabel } from "@/lib/utils";
import { getAdminCustomer } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Customer" };

export default async function AdminCustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  await requireAdmin();
  const { customerId } = await params;
  const d = await getAdminCustomer(customerId);
  if (!d) notFound();
  const c = d.customer;
  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted">
        <Link href="/admin/customers" className="hover:text-ink">
          Customers
        </Link>{" "}
        / {c.firstName} {c.lastName}
      </nav>
      <PageHeader title={`${c.firstName} ${c.lastName}`} description={`Customer since ${formatDate(c.createdAt)}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Contact" />
          <CardBody>
            <DescriptionList
              items={[
                ["Login email", d.user.email],
                ["Contact email", c.email],
                ["Phone", c.phone ?? "—"],
                ["Company", c.companyName ?? "—"],
                ["Last sign-in", formatDateTime(d.user.lastLoginAt)],
                [
                  "Stripe customer",
                  c.stripeCustomerId ? (
                    <a href={stripeDashboardUrl("customers", c.stripeCustomerId)} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                      {c.stripeCustomerId}
                    </a>
                  ) : (
                    "—"
                  ),
                ],
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Businesses" />
          <CardBody>
            {d.entities.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.entities.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/admin/entities/${e.id}`} className="text-brand hover:underline">
                      {e.legalName}
                    </Link>
                    <span className="text-sm text-muted">
                      {stateName(e.jurisdiction)} · {ENTITY_STATUS_LABEL[e.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Orders" />
        <CardBody>
          <ul className="divide-y divide-line">
            {d.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/orders/${o.id}`} className="text-brand hover:underline">
                  {orderNumberLabel(o.number)} · {ORDER_TYPE_LABEL[o.type]}
                </Link>
                <span className="flex items-center gap-2 text-sm text-muted">
                  {formatMoney(o.totalCents)} · {formatDate(o.createdAt)} <OrderStatusBadge status={o.status} audience="admin" />
                </span>
              </li>
            ))}
            {d.orders.length === 0 ? <li className="py-2 text-sm text-muted">None.</li> : null}
          </ul>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Subscriptions" />
          <CardBody>
            {d.subscriptions.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.subscriptions.map(({ subscription: s, entity, service }) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {service.name} · {entity.legalName}
                      <span className="block text-xs text-muted">
                        {s.cancelAtPeriodEnd ? "Ends" : "Renews"} {formatDate(s.currentPeriodEnd)} · {formatMoney(s.priceCents)}/{s.interval} · {s.gateway}
                      </span>
                    </span>
                    <SubscriptionStatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Payments" />
          <CardBody>
            {d.payments.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {p.description}
                      <span className="block text-xs text-muted">{formatDateTime(p.paidAt ?? p.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {formatMoney(p.amountCents)} <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="font-sans text-base font-semibold">Documents</h2>
        {d.documents.length ? (
          <DocumentsTable docs={d.documents} showVisibility renderActions={(doc) => <DocumentVisibilityToggle id={doc.id} visibility={doc.visibility} />} />
        ) : (
          <p className="text-sm text-muted">None.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Internal notes" />
          <CardBody className="space-y-4">
            <NotesList notes={d.notes} />
            <NoteForm target={{ customerId: c.id }} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Activity" />
          <CardBody>
            <AuditList events={d.audits} />
          </CardBody>
        </Card>
      </div>
      {d.support.length ? (
        <Card>
          <CardHeader title="Support requests" />
          <CardBody>
            <ul className="space-y-1">
              {d.support.map((r) => (
                <li key={r.id} className="text-sm">
                  <Link href={`/admin/support/${r.id}`} className="text-brand hover:underline">
                    {r.subject}
                  </Link>{" "}
                  <span className="text-muted">· {r.status} · {formatDate(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
