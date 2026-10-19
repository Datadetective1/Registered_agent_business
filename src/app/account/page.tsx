import Link from "next/link";
import { ServiceStatusBadge, OrderStatusBadge } from "@/components/account/status";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { stateName } from "@/config/states";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";
import { formatDate, orderNumberLabel } from "@/lib/utils";
import { requireCustomer } from "@/server/auth/guards";
import { customerActionItems, listCustomerNotifications, listEntitiesWithServices } from "@/server/customer";
import { listCustomerOrders } from "@/server/orders";

export default async function AccountOverviewPage() {
  const session = await requireCustomer("/account");
  const c = session.customer;
  const [actions, entities, orders, notices] = await Promise.all([
    customerActionItems(c.id),
    listEntitiesWithServices(c.id),
    listCustomerOrders(c.id),
    listCustomerNotifications(c.id, 5),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title={`Welcome, ${c.firstName}`} description="Your businesses, services and orders in one place." />

      {actions.onboarding.length || actions.requests.length || actions.pastDue.length ? (
        <section aria-labelledby="todo" className="space-y-3">
          <h2 id="todo" className="font-sans text-base font-semibold">
            Action needed
          </h2>
          {actions.onboarding.map((o) => (
            <Alert key={o.id} tone="warning" title={`Tell us about your business (order ${orderNumberLabel(o.number)})`}>
              It takes about five minutes, and we can&apos;t start your {ORDER_TYPE_LABEL[o.type]} order until we have it.{" "}
              <Link className="font-medium underline" href={`/account/orders/${o.id}/onboarding`}>
                Continue to business details
              </Link>
            </Alert>
          ))}
          {actions.requests.map(({ request, order }) => (
            <Alert key={request.id} tone="warning" title={`We need more information for order ${orderNumberLabel(order.number)}`}>
              <Link className="font-medium underline" href={`/account/orders/${order.id}#requests`}>
                View request and respond
              </Link>
            </Alert>
          ))}
          {actions.pastDue.map(({ subscription, entity }) => (
            <Alert key={subscription.id} tone="danger" title={`Payment needed for ${entity.legalName}`}>
              Your last renewal payment didn&apos;t go through.{" "}
              <Link className="font-medium underline" href="/account/billing">
                Update payment method
              </Link>
            </Alert>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="businesses" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="businesses" className="font-sans text-base font-semibold">
            Your businesses
          </h2>
          {entities.length ? (
            <ButtonLink href="/order/registered-agent" variant="secondary" size="sm">
              Add a business
            </ButtonLink>
          ) : null}
        </div>
        {entities.length === 0 ? (
          <EmptyState
            title="No businesses yet"
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <ButtonLink href="/order/registered-agent">Get registered agent service</ButtonLink>
                <ButtonLink href="/order/llc-formation" variant="secondary">
                  Start a Texas LLC
                </ButtonLink>
              </div>
            }
          >
            When you order a service, your business will appear here.
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {entities.map(({ entity, services }) => (
              <Card key={entity.id}>
                <CardBody className="space-y-3">
                  <div>
                    <Link href={`/account/entities/${entity.id}`} className="font-sans text-lg font-semibold text-ink hover:text-brand">
                      {entity.legalName}
                    </Link>
                    <p className="text-sm text-muted">{stateName(entity.jurisdiction)}</p>
                  </div>
                  <ul className="space-y-2">
                    {services.map(({ es, service, subscription }) => (
                      <li key={es.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>{service.name}</span>
                        <span className="flex items-center gap-2">
                          {subscription?.currentPeriodEnd && es.status !== "cancelled" ? (
                            <span className="text-muted">
                              {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} {formatDate(subscription.currentPeriodEnd)}
                            </span>
                          ) : null}
                          <ServiceStatusBadge status={es.status} />
                        </span>
                      </li>
                    ))}
                    {services.length === 0 ? <li className="text-sm text-muted">No active services</li> : null}
                  </ul>
                  <Link href={`/account/entities/${entity.id}`} className="inline-block text-sm font-medium text-brand hover:underline">
                    View details and documents
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent orders" action={<Link href="/account/orders" className="text-sm text-brand hover:underline">All orders</Link>} />
          <CardBody>
            {orders.length === 0 ? (
              <p className="text-sm text-muted">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {orders.slice(0, 5).map(({ order, entity }) => (
                  <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <Link href={`/account/orders/${order.id}`} className="text-[15px] hover:text-brand">
                      {orderNumberLabel(order.number)} · {ORDER_TYPE_LABEL[order.type]}
                      {entity ? <span className="block text-sm text-muted">{entity.legalName}</span> : null}
                    </Link>
                    <OrderStatusBadge status={order.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recent notifications" />
          <CardBody>
            {notices.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {notices.map((n) => (
                  <li key={n.id} className="py-2.5 text-[15px]">
                    {n.subject}
                    <span className="block text-xs text-muted">{formatDate(n.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
