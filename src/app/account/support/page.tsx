import { SupportForm } from "@/components/account/forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { orderNumberLabel, formatDate } from "@/lib/utils";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";
import { requireCustomer } from "@/server/auth/guards";
import { listCustomerSupportRequests, listEntitiesWithServices } from "@/server/customer";
import { listCustomerOrders } from "@/server/orders";
import { getSettings } from "@/server/settings";

export default async function SupportPage() {
  const session = await requireCustomer("/account/support");
  const [requests, orders, entities, s] = await Promise.all([
    listCustomerSupportRequests(session.customer.id),
    listCustomerOrders(session.customer.id),
    listEntitiesWithServices(session.customer.id),
    getSettings(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Support" description={`We reply by email, usually within one business day. You can also email ${s.contact.supportEmail}.`} />
      <Card>
        <CardHeader title="Send us a message" />
        <CardBody>
          <SupportForm
            orders={orders.map(({ order }) => ({ id: order.id, label: `${orderNumberLabel(order.number)} · ${ORDER_TYPE_LABEL[order.type]}` }))}
            entities={entities.map((e) => ({ id: e.entity.id, name: e.entity.legalName }))}
          />
        </CardBody>
      </Card>
      {requests.length ? (
        <section className="space-y-3">
          <h2 className="font-sans text-base font-semibold">Your messages</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  {r.subject}
                  <span className="block text-xs text-muted">{formatDate(r.createdAt)}</span>
                </span>
                <Badge tone={r.status === "closed" ? "neutral" : "info"}>{r.status === "closed" ? "Closed" : "Open"}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
