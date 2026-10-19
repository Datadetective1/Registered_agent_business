import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { SERVICE_CODES } from "@/config/catalog";
import { db } from "@/db";
import { entities, orderItems, orders, services, type EntityType, type Order, type OrderType, type Service } from "@/db/schema";
import { getActiveServiceByCode } from "./settings";

/** Pre-payment answers stored on the order. */
export type CheckoutData = {
  /** Registered agent / address orders: does the business already exist, or is it being formed? */
  situation?: "existing" | "forming";
  /** New business entered at checkout (when an existing entity wasn't selected). */
  entity?: { legalName: string; entityType: EntityType; jurisdiction: string; formationDate?: string | null };
  /** Contact details from checkout (also saved to the customer's profile). */
  contact?: { firstName: string; lastName: string; email: string; phone: string; country: string; line1: string; line2?: string; city: string; state: string; postalCode: string };
  /** Formation: "ours" adds our registered agent service; "own" means the customer names one. */
  raChoice?: "ours" | "own";
  /** Formation: desired LLC name as typed at checkout. */
  llcName?: string;
};

export type QuoteLine = {
  service: Service;
  kind: "service" | "government_fee";
  billing: Service["billing"];
  description: string;
  unitAmountCents: number;
  quantity: number;
  totalCents: number;
};

export type Quote = {
  lines: QuoteLine[];
  subtotalCents: number;
  governmentFeesCents: number;
  totalCents: number;
};

export class OrderError extends Error {}

function serviceLine(service: Service, description = service.name): QuoteLine {
  return {
    service,
    kind: "service",
    billing: service.billing,
    description: service.billing === "annual" ? `${description} (first year)` : service.billing === "monthly" ? `${description} (first month)` : description,
    unitAmountCents: service.priceCents,
    quantity: 1,
    totalCents: service.priceCents,
  };
}

/** Build line items for an order type from live catalog prices. */
export async function quoteOrder(type: OrderType, opts: { raChoice?: "ours" | "own" } = {}): Promise<Quote> {
  const lines: QuoteLine[] = [];
  if (type === "registered_agent") {
    const ra = await getActiveServiceByCode(SERVICE_CODES.registeredAgent);
    if (!ra) throw new OrderError("Registered agent service is not currently available.");
    lines.push(serviceLine(ra));
  } else if (type === "llc_formation") {
    const formation = await getActiveServiceByCode(SERVICE_CODES.llcFormationTX);
    if (!formation) throw new OrderError("Texas LLC formation is not currently available.");
    lines.push(serviceLine(formation, `${formation.name}: service fee`));
    if (formation.governmentFeeCents > 0) {
      lines.push({
        service: formation,
        kind: "government_fee",
        billing: "one_time",
        description: formation.governmentFeeLabel ?? "State filing fee",
        unitAmountCents: formation.governmentFeeCents,
        quantity: 1,
        totalCents: formation.governmentFeeCents,
      });
    }
    if (opts.raChoice === "ours") {
      const ra = await getActiveServiceByCode(SERVICE_CODES.registeredAgent);
      if (!ra) throw new OrderError("Registered agent service is not currently available.");
      lines.push(serviceLine(ra));
    }
  } else if (type === "business_address") {
    const svc = await getActiveServiceByCode(SERVICE_CODES.businessAddress);
    if (!svc || svc.priceCents <= 0) throw new OrderError("Business address service is not currently available.");
    lines.push(serviceLine(svc));
  }
  const governmentFeesCents = lines.filter((l) => l.kind === "government_fee").reduce((n, l) => n + l.totalCents, 0);
  const subtotalCents = lines.filter((l) => l.kind === "service").reduce((n, l) => n + l.totalCents, 0);
  return { lines, subtotalCents, governmentFeesCents, totalCents: subtotalCents + governmentFeesCents };
}

export async function createPendingOrder(input: {
  customerId: string;
  type: OrderType;
  entityId: string | null;
  checkoutData: CheckoutData;
  quote: Quote;
  termsVersion: string;
  attribution?: Record<string, string>;
}): Promise<Order> {
  if (input.entityId) {
    // Ownership check: the entity must belong to this customer.
    const [e] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(and(eq(entities.id, input.entityId), eq(entities.customerId, input.customerId)))
      .limit(1);
    if (!e) throw new OrderError("Business not found.");
  }
  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        customerId: input.customerId,
        entityId: input.entityId,
        type: input.type,
        status: "new",
        subtotalCents: input.quote.subtotalCents,
        governmentFeesCents: input.quote.governmentFeesCents,
        totalCents: input.quote.totalCents,
        checkoutData: input.checkoutData,
        termsAcceptedAt: new Date(),
        termsVersion: input.termsVersion,
        attribution: input.attribution ?? {},
      })
      .returning();
    await tx.insert(orderItems).values(
      input.quote.lines.map((l) => ({
        orderId: order.id,
        serviceId: l.service.id,
        kind: l.kind,
        billing: l.billing,
        description: l.description,
        quantity: l.quantity,
        unitAmountCents: l.unitAmountCents,
        totalCents: l.totalCents,
      })),
    );
    return order;
  });
}

export async function getOrderItems(orderId: string) {
  return db
    .select({ item: orderItems, service: services })
    .from(orderItems)
    .leftJoin(services, eq(services.id, orderItems.serviceId))
    .where(eq(orderItems.orderId, orderId));
}

/** Customer-scoped order lookup. Returns undefined if the order isn't theirs. */
export async function getCustomerOrder(customerId: string, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return undefined;
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
    .limit(1);
  return order;
}

export async function listCustomerOrders(customerId: string) {
  return db
    .select({ order: orders, entity: entities })
    .from(orders)
    .leftJoin(entities, eq(entities.id, orders.entityId))
    .where(and(eq(orders.customerId, customerId), inArray(orders.status, [
      "payment_confirmed",
      "information_needed",
      "ready_for_fulfillment",
      "submitted_to_provider",
      "processing",
      "completed",
      "cancelled",
      "refunded",
    ])))
    .orderBy(desc(orders.createdAt));
}

/** Orders that need the customer to complete onboarding. */
export function needsOnboarding(order: Pick<Order, "status" | "intakeSubmittedAt">): boolean {
  return order.status === "payment_confirmed" && !order.intakeSubmittedAt;
}

export function orderProductName(type: OrderType): string {
  return type === "registered_agent" ? "Registered Agent Service" : type === "llc_formation" ? "Texas LLC Formation" : "Business Address & Mail Service";
}
