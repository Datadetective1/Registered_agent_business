import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  adminNotes,
  customers,
  documents,
  entities,
  entityServices,
  informationRequests,
  orders,
  providerOrders,
  services,
  subscriptions,
  supportRequests,
  type DocumentType,
  type Order,
  type OrderStatus,
} from "@/db/schema";
import { canTransition, ORDER_STATUS } from "@/lib/order-status";
import { audit, type Actor } from "@/server/audit";
import { createDocument, notifyCustomerOfDocument } from "@/server/documents";
import { sendEmail } from "@/server/notifications/send";
import { orderProductName } from "@/server/orders";
import { gatewayFor } from "@/server/payments/gateway";

export class AdminActionError extends Error {}

type AdminActor = Actor & { userId: string };

export type StatusChangeInput = {
  to: OrderStatus;
  note?: string;
  notifyCustomer: boolean;
  /** Required when moving to submitted_to_provider. */
  externalReference?: string;
  /** Required when moving to information_needed. */
  infoRequestMessage?: string;
  /** Registered agent details; required to complete an order with a pending RA service. */
  agentName?: string;
  agentAddress?: string;
};

/**
 * Move an order through the manual fulfillment workflow. Validates the transition,
 * updates provider/service records, writes an audit event and notifies the customer.
 */
export async function changeOrderStatus(orderId: string, input: StatusChangeInput, actor: AdminActor) {
  const outcome = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw new AdminActionError("Order not found.");
    const from = order.status;
    if (!canTransition(from, input.to)) {
      throw new AdminActionError(`Can't move an order from ${ORDER_STATUS[from].label} to ${ORDER_STATUS[input.to].label}.`);
    }
    const now = new Date();
    const patch: Partial<Order> = { status: input.to };
    const openProvider = await tx
      .select()
      .from(providerOrders)
      .where(and(eq(providerOrders.orderId, order.id), inArray(providerOrders.status, ["pending_manual", "submitted", "processing"])));

    if (input.to === "information_needed") {
      const message = input.infoRequestMessage?.trim();
      if (!message) throw new AdminActionError("Describe what information you need from the customer.");
      await tx.insert(informationRequests).values({ orderId: order.id, customerId: order.customerId, message, createdByUserId: actor.userId });
    }

    if (input.to === "submitted_to_provider") {
      const ref = input.externalReference?.trim();
      if (!ref) throw new AdminActionError("Enter the provider's order or reference number.");
      if (!openProvider.length) throw new AdminActionError("There's no pending provider order. Has the customer completed onboarding?");
      for (const po of openProvider) {
        await tx
          .update(providerOrders)
          .set({ status: "submitted", externalReference: ref, submittedAt: now, submittedByUserId: actor.userId })
          .where(eq(providerOrders.id, po.id));
      }
    }

    if (input.to === "processing") {
      for (const po of openProvider) await tx.update(providerOrders).set({ status: "processing" }).where(eq(providerOrders.id, po.id));
    }

    let activatedRa: { agentName: string; agentAddress: string } | null = null;
    if (input.to === "completed") {
      patch.completedAt = now;
      for (const po of openProvider) await tx.update(providerOrders).set({ status: "completed", completedAt: now }).where(eq(providerOrders.id, po.id));
      const svc = await tx
        .select({ es: entityServices, service: services })
        .from(entityServices)
        .innerJoin(services, eq(services.id, entityServices.serviceId))
        .where(eq(entityServices.orderId, order.id));
      const pendingRa = svc.filter((s) => s.service.kind === "registered_agent" && s.es.status === "pending");
      if (pendingRa.length) {
        const agentName = input.agentName?.trim();
        const agentAddress = input.agentAddress?.trim();
        if (!agentName || !agentAddress) {
          throw new AdminActionError("Enter the registered agent name and address assigned by the provider before completing this order.");
        }
        activatedRa = { agentName, agentAddress };
      }
      for (const { es, service } of svc) {
        if (es.status !== "pending") continue;
        await tx
          .update(entityServices)
          .set({
            status: "active",
            activatedAt: now,
            details: service.kind === "registered_agent" && activatedRa ? { ...es.details, ...activatedRa } : es.details,
          })
          .where(eq(entityServices.id, es.id));
      }
      if (order.type === "llc_formation" && order.entityId) {
        await tx.update(entities).set({ status: "active" }).where(eq(entities.id, order.entityId));
      }
    }

    let subsToCancel: Array<typeof subscriptions.$inferSelect> = [];
    if (input.to === "cancelled" || input.to === "refunded") {
      if (input.to === "cancelled") patch.cancelledAt = now;
      else patch.refundedAt = now;
      for (const po of openProvider) await tx.update(providerOrders).set({ status: "cancelled" }).where(eq(providerOrders.id, po.id));
      await tx
        .update(entityServices)
        .set({ status: "cancelled", endsAt: now })
        .where(and(eq(entityServices.orderId, order.id), inArray(entityServices.status, ["pending", "active", "cancellation_scheduled"])));
      subsToCancel = await tx
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.orderId, order.id), inArray(subscriptions.status, ["active", "trialing", "past_due", "incomplete"])));
      for (const sub of subsToCancel) {
        await tx.update(subscriptions).set({ status: "canceled", canceledAt: now, endedAt: now, cancelAtPeriodEnd: false }).where(eq(subscriptions.id, sub.id));
      }
    }

    await tx.update(orders).set(patch).where(eq(orders.id, order.id));
    if (input.note?.trim()) {
      await tx.insert(adminNotes).values({ authorUserId: actor.userId, orderId: order.id, customerId: order.customerId, body: input.note.trim() });
    }
    await audit(
      {
        actor,
        action: "order.status_changed",
        targetType: "order",
        targetId: order.id,
        orderId: order.id,
        customerId: order.customerId,
        metadata: { from, to: input.to, externalReference: input.externalReference ?? null, notified: input.notifyCustomer },
      },
      tx,
    );
    return { order: { ...order, ...patch } as Order, subsToCancel, activatedRa };
  });

  // Stop billing for cancelled/refunded orders (after the DB commit).
  for (const sub of outcome.subsToCancel) {
    try {
      await gatewayFor(sub.gateway).cancelSubscriptionNow(sub);
    } catch (err) {
      await audit({ actor, action: "subscription.cancel_failed", targetType: "subscription", targetId: sub.id, customerId: sub.customerId, metadata: { error: String(err) } });
      throw new AdminActionError("The order was updated, but the subscription couldn't be cancelled in Stripe. Cancel it in the Stripe dashboard.");
    }
  }

  await notifyStatusChange(outcome.order, input, outcome.activatedRa);
  return outcome.order;
}

async function notifyStatusChange(order: Order, input: StatusChangeInput, ra: { agentName: string; agentAddress: string } | null) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1);
  if (!customer) return;
  const base = { customerId: customer.id, orderId: order.id, entityId: order.entityId, to: customer.email };
  const product = orderProductName(order.type);
  // Information requests always notify: the customer has to act.
  if (input.to === "information_needed") {
    await sendEmail({ ...base, template: "information_requested", data: { firstName: customer.firstName, orderNumber: order.number, orderId: order.id, message: input.infoRequestMessage ?? "" } });
    return;
  }
  if (!input.notifyCustomer) return;
  if (input.to === "submitted_to_provider") {
    await sendEmail({ ...base, template: "provider_submitted", data: { firstName: customer.firstName, orderNumber: order.number, orderId: order.id, productName: product } });
  } else if (input.to === "completed") {
    const docs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.orderId, order.id), eq(documents.visibility, "customer")))
      .limit(1);
    await sendEmail({ ...base, template: "order_completed", data: { firstName: customer.firstName, orderNumber: order.number, orderId: order.id, productName: product, hasDocuments: docs.length > 0 } });
    if (ra && order.entityId) {
      const [entity] = await db.select().from(entities).where(eq(entities.id, order.entityId)).limit(1);
      await sendEmail({
        ...base,
        template: "service_activated",
        data: { firstName: customer.firstName, entityName: entity?.legalName ?? "your business", entityId: order.entityId, serviceName: "Registered Agent Service", ...ra },
      });
    }
  }
}

export async function addAdminNote(target: { orderId?: string; customerId?: string; entityId?: string; supportRequestId?: string }, body: string, actor: AdminActor) {
  const text = body.trim();
  if (!text) throw new AdminActionError("Note can't be empty.");
  await db.insert(adminNotes).values({
    authorUserId: actor.userId,
    orderId: target.orderId ?? null,
    customerId: target.customerId ?? null,
    entityId: target.entityId ?? null,
    supportRequestId: target.supportRequestId ?? null,
    body: text.slice(0, 5000),
  });
  await audit({ actor, action: "note.added", targetType: target.orderId ? "order" : target.entityId ? "entity" : target.supportRequestId ? "support_request" : "customer", targetId: target.orderId ?? target.entityId ?? target.supportRequestId ?? target.customerId, orderId: target.orderId ?? null, customerId: target.customerId ?? null });
}

export async function closeInformationRequest(requestId: string, actor: AdminActor) {
  const [row] = await db.update(informationRequests).set({ status: "closed", closedAt: new Date() }).where(eq(informationRequests.id, requestId)).returning();
  if (!row) throw new AdminActionError("Request not found.");
  await audit({ actor, action: "info_request.closed", targetType: "information_request", targetId: row.id, orderId: row.orderId, customerId: row.customerId });
}

export async function uploadAdminDocument(
  input: { customerId: string; entityId?: string | null; orderId?: string | null; type: DocumentType; title: string; file: File; visibility: "customer" | "internal"; notifyCustomer: boolean },
  actor: AdminActor,
) {
  if (input.entityId) {
    const [e] = await db.select({ customerId: entities.customerId }).from(entities).where(eq(entities.id, input.entityId)).limit(1);
    if (!e || e.customerId !== input.customerId) throw new AdminActionError("Entity doesn't belong to this customer.");
  }
  const doc = await createDocument(
    {
      customerId: input.customerId,
      entityId: input.entityId ?? null,
      orderId: input.orderId ?? null,
      type: input.type,
      title: input.title,
      file: input.file,
      source: "admin",
      visibility: input.visibility,
      uploadedByUserId: actor.userId,
    },
    actor,
  );
  if (input.notifyCustomer && doc.visibility === "customer") await notifyCustomerOfDocument(doc);
  return doc;
}

export async function setDocumentState(documentId: string, patch: { visibility?: "customer" | "internal"; status?: "available" | "archived" }, actor: AdminActor) {
  const [doc] = await db.update(documents).set(patch).where(eq(documents.id, documentId)).returning();
  if (!doc) throw new AdminActionError("Document not found.");
  await audit({ actor, action: "document.updated", targetType: "document", targetId: doc.id, customerId: doc.customerId, orderId: doc.orderId, metadata: patch });
  return doc;
}

/** Activate (or update) a service on an entity, e.g. record the RA details assigned by the provider. */
export async function activateEntityService(
  entityServiceId: string,
  details: { agentName?: string; agentAddress?: string },
  notifyCustomer: boolean,
  actor: AdminActor,
) {
  const [row] = await db
    .select({ es: entityServices, service: services, entity: entities, customer: customers })
    .from(entityServices)
    .innerJoin(services, eq(services.id, entityServices.serviceId))
    .innerJoin(entities, eq(entities.id, entityServices.entityId))
    .innerJoin(customers, eq(customers.id, entityServices.customerId))
    .where(eq(entityServices.id, entityServiceId))
    .limit(1);
  if (!row) throw new AdminActionError("Service not found.");
  const clean = Object.fromEntries(Object.entries(details).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()]));
  if (row.service.kind === "registered_agent" && (!clean.agentName || !clean.agentAddress)) {
    throw new AdminActionError("Enter both the registered agent name and the registered office address.");
  }
  await db
    .update(entityServices)
    .set({
      status: row.es.status === "pending" ? "active" : row.es.status,
      activatedAt: row.es.activatedAt ?? new Date(),
      details: { ...row.es.details, ...clean },
    })
    .where(eq(entityServices.id, row.es.id));
  await audit({ actor, action: "entity_service.activated", targetType: "entity_service", targetId: row.es.id, customerId: row.customer.id, metadata: clean });
  if (notifyCustomer) {
    await sendEmail({
      template: "service_activated",
      to: row.customer.email,
      customerId: row.customer.id,
      entityId: row.entity.id,
      data: { firstName: row.customer.firstName, entityName: row.entity.legalName, entityId: row.entity.id, serviceName: row.service.name, agentName: clean.agentName, agentAddress: clean.agentAddress },
    });
  }
}

export async function updateEntityRecord(
  entityId: string,
  patch: { status?: (typeof entities.$inferSelect)["status"]; sosFileNumber?: string | null; formationDate?: string | null; legalName?: string },
  actor: AdminActor,
) {
  const [e] = await db.update(entities).set(patch).where(eq(entities.id, entityId)).returning();
  if (!e) throw new AdminActionError("Entity not found.");
  await audit({ actor, action: "entity.updated", targetType: "entity", targetId: e.id, customerId: e.customerId, metadata: patch });
}

export async function setSupportStatus(id: string, status: "open" | "pending" | "closed", actor: AdminActor) {
  const [row] = await db
    .update(supportRequests)
    .set({ status, closedAt: status === "closed" ? new Date() : null })
    .where(eq(supportRequests.id, id))
    .returning();
  if (!row) throw new AdminActionError("Support request not found.");
  await audit({ actor, action: "support.status_changed", targetType: "support_request", targetId: id, customerId: row.customerId, metadata: { status } });
}
