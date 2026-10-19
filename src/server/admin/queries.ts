import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  addresses,
  adminNotes,
  auditEvents,
  customers,
  documents,
  entities,
  entityServices,
  informationRequests,
  notifications,
  orderItems,
  orders,
  payments,
  providerOrders,
  services,
  subscriptions,
  supportRequests,
  users,
  type OrderStatus,
} from "@/db/schema";

const UUID = /^[0-9a-f-]{36}$/i;
export const PAGE_SIZE = 50;

function like(q: string) {
  return `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
}

/* -------------------------------- dashboard -------------------------------- */

export async function dashboardData() {
  const in30 = new Date(Date.now() + 30 * 86_400_000);
  const stale = new Date(Date.now() - 3 * 86_400_000);
  const [counts, ready, responded, awaitingInfo, renewals, support, pastDue] = await Promise.all([
    db.select({ status: orders.status, count: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
    db
      .select({ order: orders, customer: customers, entity: entities })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .leftJoin(entities, eq(entities.id, orders.entityId))
      .where(eq(orders.status, "ready_for_fulfillment"))
      .orderBy(asc(orders.intakeSubmittedAt))
      .limit(20),
    db
      .select({ request: informationRequests, order: orders })
      .from(informationRequests)
      .innerJoin(orders, eq(orders.id, informationRequests.orderId))
      .where(eq(informationRequests.status, "responded"))
      .orderBy(asc(informationRequests.respondedAt))
      .limit(20),
    db
      .select({ order: orders, customer: customers })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(and(eq(orders.status, "payment_confirmed"), lte(orders.paidAt, stale)))
      .orderBy(asc(orders.paidAt))
      .limit(20),
    db
      .select({ subscription: subscriptions, entity: entities, customer: customers })
      .from(subscriptions)
      .innerJoin(entities, eq(entities.id, subscriptions.entityId))
      .innerJoin(customers, eq(customers.id, subscriptions.customerId))
      .where(and(inArray(subscriptions.status, ["active", "trialing", "past_due"]), lte(subscriptions.currentPeriodEnd, in30)))
      .orderBy(asc(subscriptions.currentPeriodEnd))
      .limit(20),
    db.select().from(supportRequests).where(eq(supportRequests.status, "open")).orderBy(asc(supportRequests.createdAt)).limit(10),
    db
      .select({ subscription: subscriptions, customer: customers, entity: entities })
      .from(subscriptions)
      .innerJoin(customers, eq(customers.id, subscriptions.customerId))
      .innerJoin(entities, eq(entities.id, subscriptions.entityId))
      .where(inArray(subscriptions.status, ["past_due", "unpaid"]))
      .limit(20),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.count])) as Partial<Record<OrderStatus, number>>;
  return { byStatus, ready, responded, awaitingInfo, renewals, support, pastDue };
}

/* ---------------------------------- orders --------------------------------- */

export async function listOrders(opts: { status?: string; q?: string; page?: number }) {
  const conds: SQL[] = [];
  if (opts.status && opts.status !== "all") conds.push(eq(orders.status, opts.status as OrderStatus));
  else conds.push(sql`${orders.status} <> 'new'`);
  const q = opts.q?.trim();
  if (q) {
    const n = Number(q.replace(/^#/, ""));
    const or_: SQL[] = [ilike(customers.email, like(q)), ilike(entities.legalName, like(q)), ilike(sql`${customers.firstName} || ' ' || ${customers.lastName}`, like(q))];
    if (Number.isInteger(n) && n > 0) or_.push(eq(orders.number, n));
    conds.push(or(...or_)!);
  }
  const page = Math.max(1, opts.page ?? 1);
  return db
    .select({ order: orders, customer: customers, entity: entities })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(entities, eq(entities.id, orders.entityId))
    .where(and(...conds))
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
}

export async function getAdminOrder(orderId: string) {
  if (!UUID.test(orderId)) return null;
  const [row] = await db
    .select({ order: orders, customer: customers, user: { email: users.email, lastLoginAt: users.lastLoginAt } })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .innerJoin(users, eq(users.id, customers.userId))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) return null;
  const { order } = row;
  const [entityRows, items, provider, requests, docs, notes, audits, mails, orderPayments, svc] = await Promise.all([
    order.entityId ? db.select().from(entities).where(eq(entities.id, order.entityId)).limit(1) : Promise.resolve([]),
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(providerOrders).where(eq(providerOrders.orderId, order.id)).orderBy(desc(providerOrders.createdAt)),
    db.select().from(informationRequests).where(eq(informationRequests.orderId, order.id)).orderBy(desc(informationRequests.createdAt)),
    db.select().from(documents).where(eq(documents.orderId, order.id)).orderBy(desc(documents.createdAt)),
    db
      .select({ note: adminNotes, author: users.email })
      .from(adminNotes)
      .leftJoin(users, eq(users.id, adminNotes.authorUserId))
      .where(eq(adminNotes.orderId, order.id))
      .orderBy(desc(adminNotes.createdAt)),
    db
      .select({ event: auditEvents, actor: users.email })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorUserId))
      .where(eq(auditEvents.orderId, order.id))
      .orderBy(desc(auditEvents.createdAt))
      .limit(100),
    db
      .select({ id: notifications.id, template: notifications.template, subject: notifications.subject, toAddress: notifications.toAddress, status: notifications.status, createdAt: notifications.createdAt })
      .from(notifications)
      .where(eq(notifications.orderId, order.id))
      .orderBy(desc(notifications.createdAt)),
    db.select().from(payments).where(eq(payments.orderId, order.id)),
    db
      .select({ es: entityServices, service: services, subscription: subscriptions })
      .from(entityServices)
      .innerJoin(services, eq(services.id, entityServices.serviceId))
      .leftJoin(subscriptions, eq(subscriptions.id, entityServices.subscriptionId))
      .where(eq(entityServices.orderId, order.id)),
  ]);
  const entity = entityRows[0] ?? null;
  const addrIds = entity ? [entity.principalAddressId, entity.mailingAddressId].filter((x): x is string => Boolean(x)) : [];
  const addrs = addrIds.length ? await db.select().from(addresses).where(inArray(addresses.id, addrIds)) : [];
  return {
    ...row,
    entity,
    principal: addrs.find((a) => a.id === entity?.principalAddressId) ?? null,
    items,
    provider,
    requests,
    docs,
    notes,
    audits,
    mails,
    payments: orderPayments,
    services: svc,
  };
}

/* -------------------------------- customers -------------------------------- */

export async function listCustomers(q?: string) {
  const term = q?.trim();
  return db
    .select({
      customer: customers,
      email: users.email,
      entityCount: sql<number>`(select count(*)::int from entities e where e.customer_id = ${customers.id})`,
      orderCount: sql<number>`(select count(*)::int from orders o where o.customer_id = ${customers.id} and o.status <> 'new')`,
    })
    .from(customers)
    .innerJoin(users, eq(users.id, customers.userId))
    .where(term ? or(ilike(users.email, like(term)), ilike(customers.email, like(term)), ilike(sql`${customers.firstName} || ' ' || ${customers.lastName}`, like(term)), ilike(customers.companyName, like(term))) : undefined)
    .orderBy(desc(customers.createdAt))
    .limit(PAGE_SIZE);
}

export async function getAdminCustomer(customerId: string) {
  if (!UUID.test(customerId)) return null;
  const [row] = await db
    .select({ customer: customers, user: users })
    .from(customers)
    .innerJoin(users, eq(users.id, customers.userId))
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!row) return null;
  const [ents, ords, subs, pays, docs, notes, support, audits] = await Promise.all([
    db.select().from(entities).where(eq(entities.customerId, customerId)).orderBy(entities.legalName),
    db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt)),
    db
      .select({ subscription: subscriptions, entity: entities, service: services })
      .from(subscriptions)
      .innerJoin(entities, eq(entities.id, subscriptions.entityId))
      .innerJoin(services, eq(services.id, subscriptions.serviceId))
      .where(eq(subscriptions.customerId, customerId)),
    db.select().from(payments).where(eq(payments.customerId, customerId)).orderBy(desc(payments.createdAt)),
    db.select().from(documents).where(eq(documents.customerId, customerId)).orderBy(desc(documents.createdAt)),
    db
      .select({ note: adminNotes, author: users.email })
      .from(adminNotes)
      .leftJoin(users, eq(users.id, adminNotes.authorUserId))
      .where(eq(adminNotes.customerId, customerId))
      .orderBy(desc(adminNotes.createdAt)),
    db.select().from(supportRequests).where(eq(supportRequests.customerId, customerId)).orderBy(desc(supportRequests.createdAt)),
    db
      .select({ event: auditEvents, actor: users.email })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorUserId))
      .where(eq(auditEvents.customerId, customerId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(100),
  ]);
  return { ...row, entities: ents, orders: ords, subscriptions: subs, payments: pays, documents: docs, notes, support, audits };
}

/* --------------------------------- entities -------------------------------- */

export async function listEntities(q?: string) {
  const term = q?.trim();
  return db
    .select({ entity: entities, customer: customers })
    .from(entities)
    .innerJoin(customers, eq(customers.id, entities.customerId))
    .where(term ? or(ilike(entities.legalName, like(term)), ilike(entities.sosFileNumber, like(term))) : undefined)
    .orderBy(entities.legalName)
    .limit(PAGE_SIZE);
}

export async function getAdminEntity(entityId: string) {
  if (!UUID.test(entityId)) return null;
  const [row] = await db
    .select({ entity: entities, customer: customers })
    .from(entities)
    .innerJoin(customers, eq(customers.id, entities.customerId))
    .where(eq(entities.id, entityId))
    .limit(1);
  if (!row) return null;
  const addrIds = [row.entity.principalAddressId, row.entity.mailingAddressId].filter((x): x is string => Boolean(x));
  const [svc, ords, docs, notes, addrs] = await Promise.all([
    db
      .select({ es: entityServices, service: services, subscription: subscriptions })
      .from(entityServices)
      .innerJoin(services, eq(services.id, entityServices.serviceId))
      .leftJoin(subscriptions, eq(subscriptions.id, entityServices.subscriptionId))
      .where(eq(entityServices.entityId, entityId)),
    db.select().from(orders).where(eq(orders.entityId, entityId)).orderBy(desc(orders.createdAt)),
    db.select().from(documents).where(eq(documents.entityId, entityId)).orderBy(desc(documents.createdAt)),
    db
      .select({ note: adminNotes, author: users.email })
      .from(adminNotes)
      .leftJoin(users, eq(users.id, adminNotes.authorUserId))
      .where(eq(adminNotes.entityId, entityId))
      .orderBy(desc(adminNotes.createdAt)),
    addrIds.length ? db.select().from(addresses).where(inArray(addresses.id, addrIds)) : Promise.resolve([]),
  ]);
  return {
    ...row,
    services: svc,
    orders: ords,
    documents: docs,
    notes,
    principal: addrs.find((a) => a.id === row.entity.principalAddressId) ?? null,
    mailing: addrs.find((a) => a.id === row.entity.mailingAddressId) ?? null,
  };
}

/* ----------------------------- money & services ---------------------------- */

export async function listSubscriptions(filter: "upcoming" | "all" | "past_due" | "cancelling") {
  const conds: SQL[] = [];
  if (filter === "upcoming") conds.push(inArray(subscriptions.status, ["active", "trialing"]), lte(subscriptions.currentPeriodEnd, new Date(Date.now() + 60 * 86_400_000)));
  if (filter === "past_due") conds.push(inArray(subscriptions.status, ["past_due", "unpaid"]));
  if (filter === "cancelling") conds.push(eq(subscriptions.cancelAtPeriodEnd, true), inArray(subscriptions.status, ["active", "trialing", "past_due"]));
  return db
    .select({ subscription: subscriptions, entity: entities, customer: customers, service: services })
    .from(subscriptions)
    .innerJoin(entities, eq(entities.id, subscriptions.entityId))
    .innerJoin(customers, eq(customers.id, subscriptions.customerId))
    .innerJoin(services, eq(services.id, subscriptions.serviceId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(subscriptions.currentPeriodEnd))
    .limit(200);
}

export async function listPayments(status?: string) {
  return db
    .select({ payment: payments, customer: customers })
    .from(payments)
    .innerJoin(customers, eq(customers.id, payments.customerId))
    .where(status && status !== "all" ? eq(payments.status, status as (typeof payments.$inferSelect)["status"]) : undefined)
    .orderBy(desc(payments.createdAt))
    .limit(200);
}

export async function listAllDocuments(q?: string) {
  const term = q?.trim();
  return db
    .select({ document: documents, customer: customers, entity: entities })
    .from(documents)
    .innerJoin(customers, eq(customers.id, documents.customerId))
    .leftJoin(entities, eq(entities.id, documents.entityId))
    .where(term ? or(ilike(documents.title, like(term)), ilike(entities.legalName, like(term)), ilike(customers.email, like(term))) : undefined)
    .orderBy(desc(documents.createdAt))
    .limit(200);
}

/* ------------------------------ support & ops ------------------------------ */

export async function listSupport(status?: string) {
  return db
    .select()
    .from(supportRequests)
    .where(status && status !== "all" ? eq(supportRequests.status, status as "open" | "pending" | "closed") : undefined)
    .orderBy(desc(supportRequests.createdAt))
    .limit(200);
}

export async function getSupport(id: string) {
  if (!UUID.test(id)) return null;
  const [request] = await db.select().from(supportRequests).where(eq(supportRequests.id, id)).limit(1);
  if (!request) return null;
  const notes = await db
    .select({ note: adminNotes, author: users.email })
    .from(adminNotes)
    .leftJoin(users, eq(users.id, adminNotes.authorUserId))
    .where(eq(adminNotes.supportRequestId, id))
    .orderBy(desc(adminNotes.createdAt));
  return { request, notes };
}

export async function listNotifications(q?: string) {
  const term = q?.trim();
  return db
    .select({ id: notifications.id, template: notifications.template, toAddress: notifications.toAddress, subject: notifications.subject, status: notifications.status, transport: notifications.transport, isInternal: notifications.isInternal, createdAt: notifications.createdAt, orderId: notifications.orderId })
    .from(notifications)
    .where(term ? or(ilike(notifications.toAddress, like(term)), ilike(notifications.subject, like(term)), ilike(notifications.template, like(term))) : undefined)
    .orderBy(desc(notifications.createdAt))
    .limit(200);
}

export async function getNotification(id: string) {
  if (!UUID.test(id)) return null;
  const [row] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  return row ?? null;
}

export async function listAudit(opts: { action?: string; since?: Date }) {
  const conds: SQL[] = [];
  if (opts.action) conds.push(ilike(auditEvents.action, like(opts.action)));
  if (opts.since) conds.push(gte(auditEvents.createdAt, opts.since));
  return db
    .select({ event: auditEvents, actor: users.email })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(300);
}

export async function pendingRaActivations() {
  return db
    .select({ es: entityServices, entity: entities })
    .from(entityServices)
    .innerJoin(services, eq(services.id, entityServices.serviceId))
    .innerJoin(entities, eq(entities.id, entityServices.entityId))
    .where(and(eq(services.kind, "registered_agent"), eq(entityServices.status, "pending"), isNotNull(entityServices.orderId)))
    .limit(50);
}
