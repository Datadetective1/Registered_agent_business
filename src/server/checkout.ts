import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { entities, entityServices, orders, services, type Customer, type OrderType } from "@/db/schema";
import { track } from "./analytics";
import { audit } from "./audit";
import { getGateway } from "./payments/gateway";
import { createPendingOrder, getOrderItems, OrderError, quoteOrder, type CheckoutData } from "./orders";
import { getSettings } from "./settings";

const ACTIVE_SERVICE: Array<"pending" | "active" | "cancellation_scheduled"> = ["pending", "active", "cancellation_scheduled"];

/** Customer's entities, flagged if they already have a live service of the given kind. */
export async function entitiesForCheckout(customerId: string, kind: "registered_agent" | "business_address") {
  const rows = await db.select().from(entities).where(eq(entities.customerId, customerId)).orderBy(entities.legalName);
  const busy = await db
    .select({ entityId: entityServices.entityId })
    .from(entityServices)
    .innerJoin(services, eq(services.id, entityServices.serviceId))
    .where(and(eq(entityServices.customerId, customerId), eq(services.kind, kind), inArray(entityServices.status, ACTIVE_SERVICE)));
  const busyIds = new Set(busy.map((b) => b.entityId));
  return rows.map((e) => ({ entity: e, hasService: busyIds.has(e.id) }));
}

export async function startCheckout(input: {
  customer: Customer;
  userId: string;
  type: OrderType;
  entityId: string | null;
  checkoutData: CheckoutData;
  attribution?: Record<string, string>;
}): Promise<{ url: string; orderId: string }> {
  const gateway = getGateway();
  if (!gateway) throw new OrderError("Online payments are temporarily unavailable. Please contact us to place your order.");

  if (input.entityId && input.type !== "llc_formation") {
    const kind = input.type === "registered_agent" ? "registered_agent" : "business_address";
    const list = await entitiesForCheckout(input.customer.id, kind);
    const match = list.find((r) => r.entity.id === input.entityId);
    if (!match) throw new OrderError("Business not found.");
    if (match.hasService) throw new OrderError("This business already has this service. Manage it from your account.");
  }

  const quote = await quoteOrder(input.type, { raChoice: input.checkoutData.raChoice });
  const s = await getSettings();
  const order = await createPendingOrder({
    customerId: input.customer.id,
    type: input.type,
    entityId: input.entityId,
    checkoutData: input.checkoutData,
    quote,
    termsVersion: s.legal.termsVersion,
    attribution: input.attribution,
  });
  const url = await createCheckoutForOrder(input.customer, order.id);
  await audit({
    actor: { type: "customer", userId: input.userId },
    action: "order.checkout_started",
    targetType: "order",
    targetId: order.id,
    orderId: order.id,
    customerId: input.customer.id,
    metadata: { type: input.type, total: quote.totalCents, gateway: gateway.name },
  });
  await track("payment_started", {}, { orderType: input.type });
  return { url, orderId: order.id };
}

/** Create (or re-create, e.g. after the hosted session expired) a checkout for a `new` order. */
export async function createCheckoutForOrder(customer: Customer, orderId: string): Promise<string> {
  const gateway = getGateway();
  if (!gateway) throw new OrderError("Online payments are temporarily unavailable.");
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.customerId, customer.id)))
    .limit(1);
  if (!order) throw new OrderError("Order not found.");
  if (order.status !== "new") throw new OrderError("This order has already been paid.");
  const items = (await getOrderItems(order.id)).map((r) => r.item);
  const { url, sessionId } = await gateway.createCheckout({ order, items, customer });
  await db
    .update(orders)
    .set({ gateway: gateway.name, stripeCheckoutSessionId: gateway.name === "stripe" ? sessionId : null })
    .where(eq(orders.id, order.id));
  return url;
}
