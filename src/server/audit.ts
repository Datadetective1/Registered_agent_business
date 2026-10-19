import "server-only";
import { db, type Executor } from "@/db";
import { auditEvents } from "@/db/schema";
import type { RequestMeta, SessionContext } from "./auth/session";

export type Actor = { type: "customer" | "admin" | "system" | "stripe"; userId?: string | null };

export const SYSTEM: Actor = { type: "system" };
export const STRIPE: Actor = { type: "stripe" };

export function actorFrom(session: Pick<SessionContext, "user">): Actor {
  return { type: session.user.role === "admin" ? "admin" : "customer", userId: session.user.id };
}

export type AuditInput = {
  actor: Actor;
  action: string;
  targetType?: string;
  targetId?: string;
  customerId?: string | null;
  orderId?: string | null;
  /** Never put secrets, full card data, or passwords here. */
  metadata?: Record<string, unknown>;
  meta?: Partial<RequestMeta>;
};

export async function audit(input: AuditInput, tx: Executor = db) {
  await tx.insert(auditEvents).values({
    actorType: input.actor.type,
    actorUserId: input.actor.userId ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    customerId: input.customerId ?? null,
    orderId: input.orderId ?? null,
    metadata: input.metadata ?? {},
    ip: input.meta?.ip ?? null,
    userAgent: input.meta?.userAgent ?? null,
  });
}
