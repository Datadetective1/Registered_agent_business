import Link from "next/link";
import { notFound } from "next/navigation";
import { closeRequestAction } from "@/app/admin/actions";
import { DocumentsTable } from "@/components/account/documents-table";
import { OrderStatusBadge, ServiceStatusBadge } from "@/components/account/status";
import { EntrySheet, type EntrySheetData } from "@/components/admin/entry-sheet";
import { AdminUploadForm, NoteForm, OrderQuickActions, ProviderOrderForm } from "@/components/admin/forms";
import { AuditList, DocumentVisibilityToggle, NotesList, stripeDashboardUrl } from "@/components/admin/shared";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList, PageHeader } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { stateName } from "@/config/states";
import { ENTITY_STATUS_LABEL, ENTITY_TYPE_LABEL } from "@/lib/labels";
import { flattenToFormValues } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS, ORDER_TRANSITIONS, ORDER_TYPE_LABEL, canTransition } from "@/lib/order-status";
import { formatDateTime, orderNumberLabel } from "@/lib/utils";
import { getAdminOrder } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";
import { paymentsMode, stripeIsTestMode } from "@/server/env";
import type { CheckoutData } from "@/server/orders";
import type { OrderStatus } from "@/db/schema";

export const metadata = { title: "Order" };

/** "principalAddress.postalCode" → "Principal address › Postal code"; "governingPersons.0.name" → "Governing persons › #1 › Name". */
function humanizeKey(key: string): string {
  return key
    .split(".")
    .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : part.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(/ (\w)/g, (_, c: string) => ` ${c.toLowerCase()}`)))
    .join(" › ");
}

export default async function AdminOrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ updated?: string }> }) {
  await requireAdmin();
  const [{ orderId }, { updated }] = await Promise.all([params, searchParams]);
  const d = await getAdminOrder(orderId);
  if (!d) notFound();
  const { order, customer, entity } = d;
  // Main provider order first, then the change-of-agent filing; cancelled ones last.
  const rank = (p: (typeof d.provider)[number]) => (p.status === "cancelled" ? 2 : p.operation === "change_of_agent" ? 1 : 0);
  const providerRows = [...d.provider].sort((a, b) => rank(a) - rank(b));
  const changeOfAgent = d.provider.find((p) => p.operation === "change_of_agent" && p.status !== "cancelled");
  const needsAgentDetails = d.services.some((s) => s.service.kind === "registered_agent" && s.es.status === "pending");
  const intakeRows = order.intake ? Object.entries(flattenToFormValues(order.intake)).sort(([a], [b]) => a.localeCompare(b)) : [];
  const payment = d.payments[0];
  const checkout = order.checkoutData as CheckoutData;
  const checkoutRows = checkoutAnswerRows(checkout);
  const history = statusHistory(d.audits);
  const paidPayments = d.payments.filter((p) => p.status === "succeeded" || p.status === "partially_refunded");
  const refund =
    canTransition(order.status, "refunded") && paidPayments.length
      ? order.gateway === "simulated"
        ? { available: paymentsMode() === "simulated", note: "Development: marks the simulated payment refunded. No money moves." }
        : stripeIsTestMode()
          ? { available: true, note: "Issues a full refund through Stripe (test mode), then cancels this order's services and auto-renewal." }
          : { available: false, note: "Live refunds are issued in the Stripe dashboard until admin refunds are approved for live mode." }
      : null;

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
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {changeOfAgent ? <Badge tone="warning">Registered agent + change of agent filing</Badge> : null}
            <OrderStatusBadge status={order.status} audience="admin" />
          </span>
        }
      />

      {updated ? (
        <Alert tone="success" role="status">
          {updated === "refunded" ? "Refunded. The order's services and auto-renewal were cancelled." : `Order updated. It's now ${ORDER_STATUS[order.status].label}.`}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {changeOfAgent && changeOfAgent.status !== "completed" ? (
            <Alert tone="warning" title="This order needs registered agent service AND a change-of-agent filing">
              The customer is switching from another registered agent. Set up the service first, then handle the change-of-agent filing
              below. The order can&apos;t be completed until that filing is completed or cancelled.
            </Alert>
          ) : null}

          {providerRows.length === 0 ? (
            <Card>
              <CardHeader title="Provider entry sheet" />
              <CardBody>
                <Alert tone="info">The customer hasn&apos;t completed onboarding yet, so there&apos;s nothing to place with the provider.</Alert>
              </CardBody>
            </Card>
          ) : (
            providerRows.map((po) => {
              const sheet = ((po.payload as { sheet?: EntrySheetData })?.sheet ?? []) as EntrySheetData;
              const instructions = (po.payload as { instructions?: string })?.instructions;
              const isChange = po.operation === "change_of_agent";
              const closed = po.status === "cancelled" || po.status === "completed";
              return (
                <Card key={po.id} className={po.status === "cancelled" ? "opacity-70" : undefined}>
                  <CardHeader
                    title={PROVIDER_OPERATION_LABEL[po.operation] ?? po.operation}
                    description={`Provider: ${po.provider} · ${po.status.replace("_", " ")}${po.externalReference ? ` · ref ${po.externalReference}` : ""}`}
                    action={<Badge tone={po.status === "completed" ? "success" : po.status === "cancelled" ? "neutral" : po.status === "failed" ? "danger" : "warning"}>{po.status.replace("_", " ")}</Badge>}
                  />
                  <CardBody className="space-y-4">
                    {po.status === "cancelled" ? (
                      <p className="text-sm text-muted">Cancelled. Kept for the record.</p>
                    ) : (
                      <>
                        {instructions ? <p className="text-sm text-muted">{instructions}</p> : null}
                        <EntrySheet sheet={sheet} />
                      </>
                    )}
                    {!closed || po.externalReference ? (
                      <div className="border-t border-line pt-4">
                        <ProviderOrderForm providerOrderId={po.id} orderId={order.id} status={po.status} reference={po.externalReference} allowStatus={isChange && !closed} />
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              );
            })
          )}

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
            <CardHeader title="Checkout answers" description="What the customer told us before paying." />
            <CardBody>
              <DescriptionList items={checkoutRows} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Onboarding answers" description={order.intakeSubmittedAt ? `Submitted ${formatDateTime(order.intakeSubmittedAt)}` : order.intakeDraft ? "Started, saved for later" : "Not submitted yet"} />
            <CardBody>
              {intakeRows.length ? (
                <DescriptionList items={intakeRows.map(([k, v]) => [<span key={k} className="break-words">{humanizeKey(k)}</span>, v === "on" ? "Yes" : v])} />
              ) : (
                <p className="text-sm text-muted">No onboarding answers yet.</p>
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
              <CardHeader title="Status history" />
              <CardBody>
                {history.length === 0 ? (
                  <p className="text-sm text-muted">No changes yet.</p>
                ) : (
                  <ol className="space-y-2.5">
                    {history.map((h) => (
                      <li key={h.id} className="text-sm">
                        <span className="font-medium">{h.label}</span>
                        {h.detail ? <span className="text-muted"> · {h.detail}</span> : null}
                        <span className="block text-xs text-muted">
                          {h.actor} · {formatDateTime(h.at)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>
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
            <CardHeader title="Next step" description={ORDER_STATUS[order.status].label} />
            <CardBody>
              <OrderQuickActions
                orderId={order.id}
                allowed={ORDER_TRANSITIONS[order.status].filter((st) => st !== "payment_confirmed" && st !== "refunded")}
                needsAgentDetails={needsAgentDetails}
                hasIntake={Boolean(order.intakeSubmittedAt)}
                refund={refund}
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

const PROVIDER_OPERATION_LABEL: Record<string, string> = {
  registered_agent: "Registered agent service",
  change_of_agent: "Change of registered agent filing",
  formation: "Texas LLC formation",
  business_address: "Business address",
  ein: "EIN",
  update_entity: "Entity update",
  cancel_service: "Cancel service",
};

function checkoutAnswerRows(c: CheckoutData): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (c.situation) rows.push(["Situation", c.situation === "forming" ? "Forming a new business" : "Existing business"]);
  if (c.entity) {
    rows.push(["Company", c.entity.legalName]);
    rows.push(["Entity type", ENTITY_TYPE_LABEL[c.entity.entityType] ?? c.entity.entityType]);
    rows.push(["State", stateName(c.entity.jurisdiction)]);
    if (c.situation !== "forming") rows.push(["Formation date", c.entity.formationDate ?? "Not provided"]);
  }
  if (c.llcName) rows.push(["Desired LLC name", c.llcName]);
  if (c.raChoice) rows.push(["Registered agent", c.raChoice === "ours" ? "Our service (in this order)" : "Customer will name their own"]);
  if (c.contact) {
    const a = c.contact;
    rows.push(["Contact", `${a.firstName} ${a.lastName}`]);
    rows.push(["Email", a.email]);
    rows.push(["Phone", a.phone]);
    rows.push(["Address", [a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`.trim(), a.country].filter(Boolean).join(", ")]);
  }
  if (!rows.length) rows.push(["Business", "Existing business selected from the customer's account"]);
  return rows;
}

type AuditRow = { event: { id: string; action: string; actorType: string; createdAt: Date; metadata: Record<string, unknown> | null }; actor: string | null };

/** Readable, oldest-first status timeline built from the audit log. */
function statusHistory(audits: AuditRow[]) {
  const label = (st: unknown) => (typeof st === "string" && st in ORDER_STATUS ? ORDER_STATUS[st as OrderStatus].label : String(st));
  return audits
    .map(({ event, actor }) => {
      const m = (event.metadata ?? {}) as Record<string, unknown>;
      const base = { id: event.id, at: event.createdAt, actor: actor ?? event.actorType };
      switch (event.action) {
        case "order.checkout_started":
          return { ...base, label: "Checkout started", detail: "" };
        case "order.payment_confirmed":
          return { ...base, label: "Payment confirmed", detail: "" };
        case "order.intake_submitted":
          return { ...base, label: "Customer submitted information", detail: "" };
        case "order.intake_updated":
          return { ...base, label: "Customer updated information", detail: "" };
        case "order.status_changed":
          return { ...base, label: `${label(m.from)} → ${label(m.to)}`, detail: m.externalReference ? `ref ${String(m.externalReference)}` : "" };
        case "provider_order.updated":
          return {
            ...base,
            label: `${PROVIDER_OPERATION_LABEL[String(m.operation)] ?? String(m.operation)}: ${String(m.from).replace("_", " ")} → ${String(m.to).replace("_", " ")}`,
            detail: m.externalReference ? `ref ${String(m.externalReference)}` : "",
          };
        case "payment.refunded":
          return { ...base, label: "Payment refunded", detail: "" };
        default:
          return null;
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .reverse();
}
