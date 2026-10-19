import Link from "next/link";
import { notFound } from "next/navigation";
import { closeRequestAction } from "@/app/admin/actions";
import { DocumentsTable } from "@/components/account/documents-table";
import { OrderStatusBadge, ServiceStatusBadge } from "@/components/account/status";
import { EntrySheet, type EntrySheetData } from "@/components/admin/entry-sheet";
import { AdminUploadForm, NoteForm, StatusChangeForm } from "@/components/admin/forms";
import { AuditList, DocumentVisibilityToggle, NotesList, stripeDashboardUrl } from "@/components/admin/shared";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList, PageHeader } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { stateName } from "@/config/states";
import { ENTITY_STATUS_LABEL } from "@/lib/labels";
import { flattenToFormValues } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { ORDER_TRANSITIONS, ORDER_TYPE_LABEL } from "@/lib/order-status";
import { formatDateTime, orderNumberLabel } from "@/lib/utils";
import { getAdminOrder } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Order" };

/** "principalAddress.postalCode" → "Principal address › Postal code"; "governingPersons.0.name" → "Governing persons › #1 › Name". */
function humanizeKey(key: string): string {
  return key
    .split(".")
    .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : part.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(/ (\w)/g, (_, c: string) => ` ${c.toLowerCase()}`)))
    .join(" › ");
}

export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  await requireAdmin();
  const { orderId } = await params;
  const d = await getAdminOrder(orderId);
  if (!d) notFound();
  const { order, customer, entity } = d;
  const openProvider = d.provider.find((p) => ["pending_manual", "submitted", "processing"].includes(p.status)) ?? d.provider[0];
  const sheet = ((openProvider?.payload as { sheet?: EntrySheetData })?.sheet ?? []) as EntrySheetData;
  const instructions = (openProvider?.payload as { instructions?: string })?.instructions;
  const needsAgentDetails = d.services.some((s) => s.service.kind === "registered_agent" && s.es.status === "pending");
  const intakeRows = order.intake ? Object.entries(flattenToFormValues(order.intake)).sort(([a], [b]) => a.localeCompare(b)) : [];
  const payment = d.payments[0];

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted">
        <Link href="/admin/orders" className="hover:text-ink">
          Orders
        </Link>{" "}
        / {orderNumberLabel(order.number)}
      </nav>
      <PageHeader
        title={`Order ${orderNumberLabel(order.number)}`}
        description={`${ORDER_TYPE_LABEL[order.type]} · ${formatMoney(order.totalCents)} · paid ${formatDateTime(order.paidAt)}`}
        actions={<OrderStatusBadge status={order.status} audience="admin" />}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Provider entry sheet"
              description={openProvider ? `Provider: ${openProvider.provider} · status: ${openProvider.status.replace("_", " ")}${openProvider.externalReference ? ` · ref ${openProvider.externalReference}` : ""}` : undefined}
            />
            <CardBody>
              {!openProvider ? (
                <Alert tone="info">The customer hasn&apos;t completed onboarding yet, so there&apos;s nothing to place with the provider.</Alert>
              ) : (
                <div className="space-y-4">
                  {instructions ? <p className="text-sm text-muted">{instructions}</p> : null}
                  <EntrySheet sheet={sheet} />
                </div>
              )}
            </CardBody>
          </Card>

          {d.requests.length ? (
            <Card>
              <CardHeader title="Information requests" />
              <CardBody className="space-y-4">
                {d.requests.map((r) => (
                  <div key={r.id} className="rounded-md border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted">Requested {formatDateTime(r.createdAt)}</p>
                      <Badge tone={r.status === "open" ? "warning" : r.status === "responded" ? "info" : "neutral"}>{r.status}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[15px]">{r.message}</p>
                    {r.customerResponse || r.respondedAt ? (
                      <div className="mt-3 rounded bg-sand p-2 text-sm">
                        <p className="font-medium">Customer replied {formatDateTime(r.respondedAt)}</p>
                        {r.customerResponse ? <p className="mt-1 whitespace-pre-wrap">{r.customerResponse}</p> : null}
                        <p className="mt-1 text-xs text-muted">Any files are listed under Documents.</p>
                      </div>
                    ) : null}
                    {r.status !== "closed" ? (
                      <form action={closeRequestAction.bind(null, r.id, order.id)} className="mt-3">
                        <SubmitButton variant="secondary" size="sm" pendingLabel="Closing…">
                          Mark resolved
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Customer's answers" description={order.intakeSubmittedAt ? `Submitted ${formatDateTime(order.intakeSubmittedAt)}` : "Not submitted yet"} />
            <CardBody>
              {intakeRows.length ? (
                <DescriptionList items={intakeRows.map(([k, v]) => [<span key={k} className="break-words">{humanizeKey(k)}</span>, v === "on" ? "Yes" : v])} />
              ) : (
                <p className="text-sm text-muted">No onboarding answers yet. Checkout answers: {JSON.stringify(order.checkoutData)}</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Documents" description="Customer-visible documents appear in their account immediately." />
            <CardBody className="space-y-5">
              {d.docs.length ? (
                <DocumentsTable docs={d.docs} showVisibility renderActions={(doc) => <DocumentVisibilityToggle id={doc.id} visibility={doc.visibility} />} />
              ) : (
                <p className="text-sm text-muted">No documents yet.</p>
              )}
              <div className="border-t border-line pt-5">
                <AdminUploadForm target={{ customerId: customer.id, entityId: entity?.id ?? null, orderId: order.id }} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Internal notes" />
            <CardBody className="space-y-4">
              <NotesList notes={d.notes} />
              <NoteForm target={{ orderId: order.id, customerId: customer.id }} />
            </CardBody>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Audit trail" />
              <CardBody>
                <AuditList events={d.audits} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Emails" />
              <CardBody>
                {d.mails.length === 0 ? (
                  <p className="text-sm text-muted">None.</p>
                ) : (
                  <ul className="space-y-2">
                    {d.mails.map((m) => (
                      <li key={m.id} className="text-sm">
                        <Link href={`/admin/notifications/${m.id}`} className="text-brand hover:underline">
                          {m.subject}
                        </Link>
                        <span className="block text-xs text-muted">
                          {m.toAddress} · {m.status} · {formatDateTime(m.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        <aside className="space-y-6">
          <Card className="border-brand/30">
            <CardHeader title="Update status" />
            <CardBody>
              <StatusChangeForm
                orderId={order.id}
                allowed={ORDER_TRANSITIONS[order.status].filter((s) => s !== "payment_confirmed")}
                needsAgentDetails={needsAgentDetails}
                hasPendingProviderOrder={openProvider?.status === "pending_manual"}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Customer" />
            <CardBody className="space-y-1 text-[15px]">
              <Link href={`/admin/customers/${customer.id}`} className="font-medium text-brand hover:underline">
                {customer.firstName} {customer.lastName}
              </Link>
              <p>{customer.email}</p>
              <p>{customer.phone ?? "No phone"}</p>
              <p className="text-xs text-muted">Login: {d.user.email}</p>
            </CardBody>
          </Card>
          {entity ? (
            <Card>
              <CardHeader title="Business" />
              <CardBody className="space-y-1 text-[15px]">
                <Link href={`/admin/entities/${entity.id}`} className="font-medium text-brand hover:underline">
                  {entity.legalName}
                </Link>
                <p>
                  {stateName(entity.jurisdiction)} · {ENTITY_STATUS_LABEL[entity.status]}
                </p>
                {entity.sosFileNumber ? <p>SOS #{entity.sosFileNumber}</p> : null}
                <div className="space-y-2 pt-2">
                  {d.services.map(({ es, service, subscription }) => (
                    <div key={es.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>{service.name}</span>
                      <span className="flex items-center gap-1">
                        {subscription?.stripeSubscriptionId ? (
                          <a href={stripeDashboardUrl("subscriptions", subscription.stripeSubscriptionId)} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                            Stripe
                          </a>
                        ) : null}
                        <ServiceStatusBadge status={es.status} />
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Payment" />
            <CardBody className="space-y-2 text-[15px]">
              {d.items.map((i) => (
                <div key={i.id} className="flex justify-between gap-3 text-sm">
                  <span>{i.description}</span>
                  <span className="tabular-nums">{formatMoney(i.totalCents)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(order.totalCents)}</span>
              </div>
              <p className="text-sm text-muted">Gateway: {order.gateway ?? "—"}</p>
              {payment ? <p className="text-sm text-muted">Payment status: {payment.status.replace("_", " ")}</p> : null}
              {order.stripePaymentIntentId ? (
                <a className="text-sm text-brand hover:underline" href={stripeDashboardUrl("payments", order.stripePaymentIntentId)} target="_blank" rel="noopener noreferrer">
                  View payment in Stripe
                </a>
              ) : null}
              {payment?.stripeInvoiceId ? (
                <a className="block text-sm text-brand hover:underline" href={stripeDashboardUrl("invoices", payment.stripeInvoiceId)} target="_blank" rel="noopener noreferrer">
                  View invoice in Stripe
                </a>
              ) : null}
              <p className="text-xs text-muted">Terms accepted {formatDateTime(order.termsAcceptedAt)} (version {order.termsVersion})</p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
