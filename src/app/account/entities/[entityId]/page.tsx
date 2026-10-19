import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentsTable } from "@/components/account/documents-table";
import { AutoRenewForm, UploadDocumentForm } from "@/components/account/forms";
import { OrderStatusBadge, ServiceStatusBadge } from "@/components/account/status";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { DescriptionList, PageHeader } from "@/components/ui/layout";
import { stateName } from "@/config/states";
import type { Address } from "@/db/schema";
import { ENTITY_STATUS_LABEL, ENTITY_TYPE_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";
import { formatDate, orderNumberLabel } from "@/lib/utils";
import { requireCustomer } from "@/server/auth/guards";
import { getCustomerEntity } from "@/server/customer";
import { listCustomerDocuments } from "@/server/documents";

const fmtAddress = (a: Address | null) => (a ? [a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`].filter(Boolean).join(", ") : null);

export default async function EntityPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  const session = await requireCustomer(`/account/entities/${entityId}`);
  const data = await getCustomerEntity(session.customer.id, entityId);
  if (!data) notFound();
  const { entity, principal, mailing, services, orders } = data;
  const docs = await listCustomerDocuments(session.customer.id, { entityId: entity.id });
  const ra = services.find((s) => s.service.kind === "registered_agent" && s.es.status !== "cancelled" && s.es.status !== "expired");

  return (
    <div className="space-y-6">
      <PageHeader title={entity.legalName} description={`${ENTITY_TYPE_LABEL[entity.entityType]} · ${stateName(entity.jurisdiction)}`} />

      {ra ? (
        ra.es.status === "pending" ? (
          <Alert tone="info" title="Registered agent service is being set up">
            We&apos;ll show your registered agent name and address here as soon as setup is complete, and email you.
          </Alert>
        ) : ra.es.details?.agentName ? (
          <Card className="border-accent/30">
            <CardHeader title="Your registered agent details" description="Use exactly these details when listing your registered agent with the state." />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted">Registered agent name</p>
                  <p className="font-medium">{ra.es.details.agentName}</p>
                </div>
                <CopyButton value={ra.es.details.agentName} />
              </div>
              {ra.es.details.agentAddress ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted">Registered office address</p>
                    <p className="font-medium">{ra.es.details.agentAddress}</p>
                  </div>
                  <CopyButton value={ra.es.details.agentAddress} />
                </div>
              ) : null}
              <p className="text-sm text-muted">
                This address is for service of process and state correspondence only. Please don&apos;t use it as a mailing address.
              </p>
            </CardBody>
          </Card>
        ) : null
      ) : null}

      <Card>
        <CardHeader title="Services" />
        <CardBody className="divide-y divide-line py-0">
          {services.length === 0 ? <p className="py-4 text-sm text-muted">No services.</p> : null}
          {services.map(({ es, service, subscription }) => (
            <div key={es.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
              <div>
                <p className="font-medium">{service.name}</p>
                {subscription && es.status !== "cancelled" ? (
                  <p className="text-sm text-muted">
                    {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} {formatDate(subscription.currentPeriodEnd)} · {formatMoney(subscription.priceCents)}/
                    {subscription.interval}
                  </p>
                ) : es.status === "cancelled" ? (
                  <p className="text-sm text-muted">Ended {formatDate(es.endsAt)}</p>
                ) : null}
                {subscription && ["active", "trialing", "past_due"].includes(subscription.status) ? (
                  <div className="mt-2">
                    <AutoRenewForm subscriptionId={subscription.id} autoRenew={!subscription.cancelAtPeriodEnd} endLabel={formatDate(subscription.currentPeriodEnd)} />
                  </div>
                ) : null}
              </div>
              <ServiceStatusBadge status={es.status} />
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Business information" />
          <CardBody>
            <DescriptionList
              items={[
                ["Status", ENTITY_STATUS_LABEL[entity.status]],
                ["SOS file number", entity.sosFileNumber ?? "—"],
                ["Formation date", formatDate(entity.formationDate)],
                ["Principal office", fmtAddress(principal) ?? "—"],
                ["Mailing address", fmtAddress(mailing) ?? "—"],
                ["Notification contact", entity.contactName ? `${entity.contactName} · ${entity.contactEmail ?? ""}` : "—"],
              ]}
            />
            <p className="mt-3 text-sm text-muted">
              Need to change something?{" "}
              <Link href="/account/support" className="text-brand hover:underline">
                Contact support
              </Link>
              .
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Orders" />
          <CardBody>
            {orders.length === 0 ? (
              <p className="text-sm text-muted">No orders.</p>
            ) : (
              <ul className="divide-y divide-line">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={`/account/orders/${o.id}`} className="hover:text-brand">
                      {orderNumberLabel(o.number)} · {ORDER_TYPE_LABEL[o.type]}
                    </Link>
                    <OrderStatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="font-sans text-base font-semibold">Documents</h2>
        {docs.length ? <DocumentsTable docs={docs} /> : <p className="text-sm text-muted">Legal and state documents for this business will appear here.</p>}
      </section>
      <Card>
        <CardHeader title="Upload a document" description="Send us a document related to this business." />
        <CardBody>
          <UploadDocumentForm entities={[{ id: entity.id, name: entity.legalName }]} defaultEntityId={entity.id} />
        </CardBody>
      </Card>
    </div>
  );
}
