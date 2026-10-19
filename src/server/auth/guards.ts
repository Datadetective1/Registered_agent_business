import "server-only";
import { redirect } from "next/navigation";
import type { Customer } from "@/db/schema";
import { getCurrentSession, type SessionContext } from "./session";

/**
 * Authorization guards. Call these at the top of every protected page, layout,
 * Server Action and route handler — never rely on the proxy alone.
 */
export async function getOptionalSession(): Promise<SessionContext | null> {
  return getCurrentSession();
}

export async function requireUser(returnTo?: string): Promise<SessionContext> {
  const session = await getCurrentSession();
  if (!session) redirect(returnTo ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}` : "/sign-in");
  return session;
}

export type CustomerSession = SessionContext & { customer: Customer };

export async function requireCustomer(returnTo?: string): Promise<CustomerSession> {
  const session = await requireUser(returnTo);
  if (session.user.role === "admin") redirect("/admin");
  if (!session.customer) redirect("/sign-in");
  return session as CustomerSession;
}

export async function requireAdmin(): Promise<SessionContext> {
  const session = await requireUser("/admin");
  if (session.user.role !== "admin") redirect("/account");
  return session;
}

/** For Server Actions: returns null instead of redirecting (actions return errors). */
export async function customerOrNull(): Promise<CustomerSession | null> {
  const s = await getCurrentSession();
  return s && s.user.role === "customer" && s.customer ? (s as CustomerSession) : null;
}

export async function adminOrNull(): Promise<SessionContext | null> {
  const s = await getCurrentSession();
  return s && s.user.role === "admin" ? s : null;
}
