import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { LEGAL_DOCS } from "@/config/legal";
import { siteDefaults } from "@/config/site";
import { ORDER_STATUS, ORDER_TYPE_LABEL } from "@/lib/order-status";
import { formatDate, formatDateTime, orderNumberLabel } from "@/lib/utils";
import { dashboardData } from "@/server/admin/queries";
import { appUrl, emailTransportName, paymentsMode, stripeIsTestMode } from "@/server/env";
import { getSettings } from "@/server/settings";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Dashboard" };

async function launchChecklist() {
  const s = await getSettings();
  const mode = paymentsMode();
  const unreviewed = LEGAL_DOCS.filter((d) => !s.legal.reviewed[d.slug]).length;
  return [
    {
      label: "Payments",
      ok: false,
      detail: mode === "stripe" ? (stripeIsTestMode() ? "Stripe TEST mode: no real charges" : "Stripe LIVE mode") : mode === "simulated" ? "Simulated (development only)" : "Disabled",
      tone: mode === "stripe" && !stripeIsTestMode() ? ("danger" as const) : ("info" as const),
    },
    { label: "Email", ok: false, detail: emailTransportName() === "log" ? "Log only: emails are recorded in the outbox, not sent" : "Sending via Resend", tone: "info" as const },
    { label: "Brand name", ok: s.brand.name !== siteDefaults.brand.name, detail: s.brand.name, tone: "warning" as const },
    { label: "Support email", ok: !s.contact.supportEmail.endsWith("@example.com"), detail: s.contact.supportEmail, tone: "warning" as const },
    { label: "Legal documents", ok: unreviewed === 0, detail: unreviewed ? `${unreviewed} of ${LEGAL_DOCS.length} need attorney review` : "All reviewed", tone: "warning" as const },
    { label: "Site URL", ok: !appUrl().includes("localhost"), detail: appUrl(), tone: "warning" as const },
  ];
}

export default async function AdminDashboard() {
  await requireAdmin();
  const [d, checklist] = await Promise.all([dashboardData(), launchChecklist()]);
  const tiles: Array<{ status: keyof typeof ORDER_STATUS; hint: string }> = [
    { status: "ready_for_fulfillment", hint: "Place with provider" },
    { status: "information_needed", hint: "Waiting on customer" },
    { status: "payment_confirmed", hint: "Awaiting onboarding" },
    { status: "submitted_to_provider", hint: "With provider" },
    { status: "processing", hint: "In progress" },
    { status: "completed", hint: "Done" },
  ];
  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Work queue for manual fulfillment." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <Link key={t.status} href={`/admin/orders?status=${t.status}`} className="rounded-lg border border-line bg-surface p-4 hover:border-line-strong">
            <p className="text-2xl font-semibold tabular-nums">{d.byStatus[t.status] ?? 0}</p>
            <p className="mt-1 text-sm font-medium">{ORDER_STATUS[t.status].label}</p>
            <p className="text-xs text-muted">{t.hint}</p>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title="Ready for fulfillment" description="Oldest first. Open an order to see the provider entry sheet." />
        <CardBody>
          {d.ready.length === 0 ? (
            <p className="text-sm text-muted">Nothing waiting. 🎉</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.ready.map(({ order, customer, entity }) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium text-brand hover:underline">
                    {orderNumberLabel(order.number)} · {ORDER_TYPE_LABEL[order.type]}
                  </Link>
                  <span className="text-sm text-muted">
                    {entity?.legalName ?? "—"} · {customer.firstName} {customer.lastName} · info received {formatDateTime(order.intakeSubmittedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Customer responses to review" />
          <CardBody>
            {d.responded.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.responded.map(({ request, order }) => (
                  <li key={request.id} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={`/admin/orders/${order.id}`} className="text-brand hover:underline">
                      {orderNumberLabel(order.number)}
                    </Link>
                    <span className="text-sm text-muted">responded {formatDateTime(request.respondedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Paid, but onboarding not completed (3+ days)" description="Consider a friendly nudge." />
          <CardBody>
            {d.awaitingInfo.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.awaitingInfo.map(({ order, customer }) => (
                  <li key={order.id} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={`/admin/orders/${order.id}`} className="text-brand hover:underline">
                      {orderNumberLabel(order.number)}
                    </Link>
                    <span className="text-sm text-muted">
                      {customer.email} · paid {formatDate(order.paidAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Renewals in the next 30 days" action={<Link href="/admin/subscriptions?filter=upcoming" className="text-sm text-brand hover:underline">All</Link>} />
          <CardBody>
            {d.renewals.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.renewals.map(({ subscription, entity }) => (
                  <li key={subscription.id} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={`/admin/entities/${entity.id}`} className="text-brand hover:underline">
                      {entity.legalName}
                    </Link>
                    <span className="flex items-center gap-2 text-sm text-muted">
                      {formatDate(subscription.currentPeriodEnd)}
                      {subscription.cancelAtPeriodEnd ? <Badge tone="warning">Ending</Badge> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Needs attention" />
          <CardBody className="space-y-4">
            <div>
              <p className="text-sm font-medium">Failed renewals</p>
              {d.pastDue.length === 0 ? (
                <p className="text-sm text-muted">None.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {d.pastDue.map(({ subscription, customer, entity }) => (
                    <li key={subscription.id} className="text-sm">
                      <Link href={`/admin/customers/${customer.id}`} className="text-brand hover:underline">
                        {entity.legalName}
                      </Link>{" "}
                      <Badge tone="danger">{subscription.status.replace("_", " ")}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">Open support requests</p>
              {d.support.length === 0 ? (
                <p className="text-sm text-muted">None.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {d.support.map((r) => (
                    <li key={r.id} className="text-sm">
                      <Link href={`/admin/support/${r.id}`} className="text-brand hover:underline">
                        {r.subject}
                      </Link>{" "}
                      <span className="text-muted">· {r.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Launch readiness" description="Items to resolve before accepting live customers." />
        <CardBody>
          <ul className="divide-y divide-line">
            {checklist.map((c) => (
              <li key={c.label} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm font-medium">{c.label}</span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  {c.detail}
                  <Badge tone={c.ok ? "success" : c.tone}>{c.ok ? "OK" : "Review"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
