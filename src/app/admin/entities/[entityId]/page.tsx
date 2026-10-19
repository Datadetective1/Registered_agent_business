import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentsTable } from "@/components/account/documents-table";
import { OrderStatusBadge, ServiceStatusBadge } from "@/components/account/status";
import { ActivateServiceForm, AdminUploadForm, EntityEditForm, NoteForm } from "@/components/admin/forms";
import { DocumentVisibilityToggle, NotesList } from "@/components/admin/shared";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList, PageHeader } from "@/components/ui/layout";
import { stateName } from "@/config/states";
import type { Address } from "@/db/schema";
import { ENTITY_TYPE_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";
import { formatDate, orderNumberLabel } from "@/lib/utils";
import { getAdminEntity } from "@/server/admin/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata = { title: "Entity" };

const fmt = (a: Address | null) => (a ? [a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`].filter(Boolean).join(", ") : "—");

export default async function AdminEntityPage({ params }: { params: Promise<{ entityId: string }> }) {
  await requireAdmin();
  const { entityId } = await params;
  const d = await getAdminEntity(entityId);
  if (!d) notFound();
  const { entity, customer } = d;
  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted">
        <Link href="/admin/entities" className="hover:text-ink">
          Entities
        </Link>{" "}
        / {entity.legalName}
      </nav>
      <PageHeader
        title={entity.legalName}
        description={
          <>
            {ENTITY_TYPE_LABEL[entity.entityType]} · {stateName(entity.jurisdiction)} · owned by{" "}
            <Link href={`/admin/customers/${customer.id}`} className="text-brand hover:underline">
              {customer.firstName} {customer.lastName}
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader title="Services" description="Record the registered agent details assigned by the provider to activate RA service." />
        <CardBody className="divide-y divide-line py-0">
          {d.services.length === 0 ? <p className="py-4 text-sm text-muted">None.</p> : null}
          {d.services.map(({ es, service, subscription }) => (
            <div key={es.id} className="grid gap-4 py-4 lg:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{service.name}</p>
                  <ServiceStatusBadge status={es.status} />
                </div>
                {subscription ? (
                  <p className="text-sm text-muted">
                    {subscription.status} · {subscription.cancelAtPeriodEnd ? "ends" : "renews"} {formatDate(subscription.currentPeriodEnd)} · {formatMoney(subscription.priceCents)}/{subscription.interval}
                  </p>
                ) : null}
                {es.details?.agentName ? (
                  <p className="text-sm">
                    Agent: {es.details.agentName}
                    <br />
                    {es.details.agentAddress}
                  </p>
                ) : null}
                {es.activatedAt ? <p className="text-xs text-muted">Activated {formatDate(es.activatedAt)}</p> : null}
              </div>
              {es.status === "pending" || (service.kind === "registered_agent" && es.status === "active") ? (
                <ActivateServiceForm entityServiceId={es.id} isRegisteredAgent={service.kind === "registered_agent"} defaults={{ agentName: es.details?.agentName, agentAddress: es.details?.agentAddress }} />
              ) : null}
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Record" />
          <CardBody>
            <EntityEditForm
              entityId={entity.id}
              defaults={{ legalName: entity.legalName, status: entity.status, sosFileNumber: entity.sosFileNumber ?? "", formationDate: entity.formationDate ?? "" }}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <DescriptionList
              items={[
                ["Principal office", fmt(d.principal)],
                ["Mailing address", fmt(d.mailing)],
                ["Notification contact", entity.contactName ? `${entity.contactName}, ${entity.contactEmail ?? ""}, ${entity.contactPhone ?? ""}` : "—"],
                ["Created", formatDate(entity.createdAt)],
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Documents" description="Upload service of process or state mail here. Customers are emailed immediately when you tick notify." />
        <CardBody className="space-y-5">
          {d.documents.length ? (
            <DocumentsTable docs={d.documents} showVisibility renderActions={(doc) => <DocumentVisibilityToggle id={doc.id} visibility={doc.visibility} />} />
          ) : (
            <p className="text-sm text-muted">None.</p>
          )}
          <div className="border-t border-line pt-5">
            <AdminUploadForm target={{ customerId: customer.id, entityId: entity.id }} defaultType="service_of_process" />
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Orders" />
          <CardBody>
            <ul className="divide-y divide-line">
              {d.orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/admin/orders/${o.id}`} className="text-brand hover:underline">
                    {orderNumberLabel(o.number)} · {ORDER_TYPE_LABEL[o.type]}
                  </Link>
                  <OrderStatusBadge status={o.status} audience="admin" />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Internal notes" />
          <CardBody className="space-y-4">
            <NotesList notes={d.notes} />
            <NoteForm target={{ entityId: entity.id, customerId: customer.id }} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
