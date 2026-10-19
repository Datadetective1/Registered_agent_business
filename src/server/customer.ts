import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  addresses,
  customers,
  entities,
  entityServices,
  informationRequests,
  notifications,
  orderItems,
  orders,
  payments,
  services,
  subscriptions,
  supportRequests,
  type Customer,
} from "@/db/schema";
import { audit, type Actor } from "./audit";
import { createDocument } from "./documents";
import { notifyAdmins, sendEmail } from "./notifications/send";
import { gatewayFor } from "./payments/gateway";

/*
 * Every function here is scoped by customerId. Never query customer data
 * without that filter: it's what keeps one customer out of another's records.
 */

const UUID = /^[0-9a-f-]{36}$/i;

export class CustomerActionError extends Error {}

/* ---------------------------------- reads --------------------------------- */

export async function listEntitiesWithServices(customerId: string) {
  const ents = await db.select().from(entities).where(eq(entities.customerId, customerId)).orderBy(entities.legalName);
  if (!ents.length) return [];
  const svc = await db
    .select({ es: entityServices, service: services, subscription: subscriptions })
    .from(entityServices)
    .innerJoin(services, eq(services.id, entityServices.serviceId))
    .leftJoin(subscriptions, eq(subscriptions.id, entityServices.subscriptionId))
    .where(eq(entityServices.customerId, customerId))
    .orderBy(desc(entityServices.createdAt));
  return ents.map((entity) => ({ entity, services: svc.filter((s) => s.es.entityId === entity.id) }));
}

export async function getCustomerEntity(customerId: string, entityId: string) {
  if (!UUID.test(entityId)) return null;
  const [entity] = await db
    .select()
    .from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.customerId, customerId)))
    .limit(1);
  if (!entity) return null;
  const addrIds = [entity.principalAddressId, entity.mailingAddressId].filter((x): x is string => Boolean(x));
  const addrs = addrIds.length ? await db.select().from(addresses).where(inArray(addresses.id, addrIds)) : [];
  const svc = await db
    .select({ es: entityServices, service: services, subscription: subscriptions })
    .from(entityServices)
    .innerJoin(services, eq(services.id, entityServices.serviceId))
    .leftJoin(subscriptions, eq(subscriptions.id, entityServices.subscriptionId))
    .where(and(eq(entityServices.entityId, entity.id), eq(entityServices.customerId, customerId)));
  const entityOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.entityId, entity.id), eq(orders.customerId, customerId)))
    .orderBy(desc(orders.createdAt));
  return {
    entity,
    principal: addrs.find((a) => a.id === entity.principalAddressId) ?? null,
    mailing: addrs.find((a) => a.id === entity.mailingAddressId) ?? null,
    services: svc,
    orders: entityOrders.filter((o) => o.status !== "new"),
  };
}

export async function getCustomerOrderDetail(customerId: string, orderId: string) {
  if (!UUID.test(orderId)) return null;
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
    .limit(1);
  if (!order) return null;
  const [items, [entity], requests, orderPayments] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    order.entityId ? db.select().from(entities).where(eq(entities.id, order.entityId)).limit(1) : Promise.resolve([undefined]),
    db.select().from(informationRequests).where(eq(informationRequests.orderId, order.id)).orderBy(desc(informationRequests.createdAt)),
    db.select().from(payments).where(and(eq(payments.orderId, order.id), eq(payments.customerId, customerId))),
  ]);
  return { order, items, entity: entity ?? null, requests, payments: orderPayments };
}

export async function listCustomerSubscriptions(customerId: string) {
  return db
    .select({ subscription: subscriptions, entity: entities, service: services })
    .from(subscriptions)
    .innerJoin(entities, eq(entities.id, subscriptions.entityId))
    .innerJoin(services, eq(services.id, subscriptions.serviceId))
    .where(eq(subscriptions.customerId, customerId))
    .orderBy(subscriptions.currentPeriodEnd);
}

export async function listCustomerPayments(customerId: string) {
  return db.select().from(payments).where(eq(payments.customerId, customerId)).orderBy(desc(payments.createdAt));
}

export async function listCustomerNotifications(customerId: string, limit = 10) {
  return db
    .select({ id: notifications.id, subject: notifications.subject, createdAt: notifications.createdAt, template: notifications.template })
    .from(notifications)
    .where(and(eq(notifications.customerId, customerId), eq(notifications.isInternal, false)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function listCustomerSupportRequests(customerId: string) {
  return db.select().from(supportRequests).where(eq(supportRequests.customerId, customerId)).orderBy(desc(supportRequests.createdAt));
}

/** Things the customer needs to do, shown at the top of the dashboard. */
export async function customerActionItems(customerId: string) {
  const [onboarding, requests, pastDue] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(and(eq(orders.customerId, customerId), eq(orders.status, "payment_confirmed"), isNull(orders.intakeSubmittedAt))),
    db
      .select({ request: informationRequests, order: orders })
      .from(informationRequests)
      .innerJoin(orders, eq(orders.id, informationRequests.orderId))
      .where(and(eq(informationRequests.customerId, customerId), eq(informationRequests.status, "open"))),
    db
      .select({ subscription: subscriptions, entity: entities })
      .from(subscriptions)
      .innerJoin(entities, eq(entities.id, subscriptions.entityId))
      .where(and(eq(subscriptions.customerId, customerId), inArray(subscriptions.status, ["past_due", "unpaid"]))),
  ]);
  return { onboarding, requests, pastDue };
}

/* --------------------------------- writes --------------------------------- */

export async function respondToInformationRequest(
  customer: Customer,
  requestId: string,
  response: string,
  files: File[],
  actor: Actor & { userId: string },
) {
  if (!UUID.test(requestId)) throw new CustomerActionError("Request not found.");
  const [row] = await db
    .select({ request: informationRequests, order: orders })
    .from(informationRequests)
    .innerJoin(orders, eq(orders.id, informationRequests.orderId))
    .where(and(eq(informationRequests.id, requestId), eq(informationRequests.customerId, customer.id)))
    .limit(1);
  if (!row) throw new CustomerActionError("Request not found.");
  if (row.request.status !== "open") throw new CustomerActionError("This request has already been answered.");
  if (!response.trim() && files.length === 0) throw new CustomerActionError("Add a reply or attach a document.");

  for (const file of files) {
    await createDocument(
      {
        customerId: customer.id,
        entityId: row.order.entityId,
        orderId: row.order.id,
        informationRequestId: row.request.id,
        type: "customer_upload",
        file,
        source: "customer",
        visibility: "customer",
        uploadedByUserId: actor.userId,
      },
      actor,
    );
  }
  await db
    .update(informationRequests)
    .set({ status: "responded", customerResponse: response.trim() || null, respondedAt: new Date() })
    .where(eq(informationRequests.id, row.request.id));
  await audit({ actor, action: "info_request.responded", targetType: "information_request", targetId: row.request.id, orderId: row.order.id, customerId: customer.id, metadata: { files: files.length } });
  await notifyAdmins(
    "admin_customer_responded",
    { orderNumber: row.order.number, orderId: row.order.id, customerName: `${customer.firstName} ${customer.lastName}` },
    { orderId: row.order.id, customerId: customer.id },
  );
}

/** Turn auto-renewal on or off for one of the customer's subscriptions. */
export async function setSubscriptionAutoRenew(customer: Customer, subscriptionId: string, autoRenew: boolean, actor: Actor) {
  if (!UUID.test(subscriptionId)) throw new CustomerActionError("Subscription not found.");
  const [row] = await db
    .select({ subscription: subscriptions, entity: entities, service: services })
    .from(subscriptions)
    .innerJoin(entities, eq(entities.id, subscriptions.entityId))
    .innerJoin(services, eq(services.id, subscriptions.serviceId))
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.customerId, customer.id)))
    .limit(1);
  if (!row) throw new CustomerActionError("Subscription not found.");
  const sub = row.subscription;
  if (!["active", "trialing", "past_due"].includes(sub.status)) throw new CustomerActionError("This subscription can't be changed.");
  if (sub.cancelAtPeriodEnd === !autoRenew) return; // already in the requested state

  const sync = await gatewayFor(sub.gateway).setAutoRenew(sub, autoRenew);
  const periodEnd = sync?.currentPeriodEnd ?? sub.currentPeriodEnd;
  await db.transaction(async (tx) => {
    await tx
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: !autoRenew, canceledAt: autoRenew ? null : new Date(), currentPeriodEnd: periodEnd })
      .where(eq(subscriptions.id, sub.id));
    const linked = await tx.select().from(entityServices).where(eq(entityServices.subscriptionId, sub.id));
    for (const es of linked) {
      if (!autoRenew && es.status === "active") {
        await tx.update(entityServices).set({ status: "cancellation_scheduled", endsAt: periodEnd }).where(eq(entityServices.id, es.id));
      } else if (autoRenew && es.status === "cancellation_scheduled") {
        await tx.update(entityServices).set({ status: "active", endsAt: null }).where(eq(entityServices.id, es.id));
      }
    }
    await audit(
      { actor, action: autoRenew ? "subscription.auto_renew_enabled" : "subscription.auto_renew_disabled", targetType: "subscription", targetId: sub.id, customerId: customer.id },
      tx,
    );
  });

  if (!autoRenew) {
    await sendEmail({
      template: "renewal_cancelled",
      to: customer.email,
      customerId: customer.id,
      entityId: row.entity.id,
      data: { firstName: customer.firstName, entityName: row.entity.legalName, serviceName: row.service.name, endDate: periodEnd },
    });
    await notifyAdmins(
      "admin_renewal_cancelled",
      { entityName: row.entity.legalName, entityId: row.entity.id, customerName: `${customer.firstName} ${customer.lastName}`, endDate: periodEnd },
      { customerId: customer.id, entityId: row.entity.id },
    );
  }
}

export async function updateCustomerProfile(
  customer: Customer,
  data: { firstName: string; lastName: string; email: string; phone?: string; companyName?: string },
  actor: Actor,
) {
  await db
    .update(customers)
    .set({ firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone ?? null, companyName: data.companyName ?? null })
    .where(eq(customers.id, customer.id));
  await audit({ actor, action: "customer.profile_updated", targetType: "customer", targetId: customer.id, customerId: customer.id, metadata: { fields: Object.keys(data) } });
}
