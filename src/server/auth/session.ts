import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { customers, sessions, users, type Customer, type User } from "@/db/schema";
import { clientIpFrom } from "@/server/client-ip";
import { isProduction } from "@/server/env";
import { generateToken, sha256Hex } from "./tokens";

/**
 * Server-side sessions.
 * - The cookie holds a random 256-bit token; the DB stores only its SHA-256.
 * - Cookies: HttpOnly, SameSite=Lax, Secure + __Host- prefix in production.
 * - Sliding expiry: customers 30 days, admins 12 hours.
 */
const CUSTOMER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

export const SESSION_COOKIE = isProduction() ? "__Host-session" : "session";

export type SessionContext = {
  sessionId: string;
  user: Pick<User, "id" | "email" | "role" | "name">;
  customer: Customer | null;
};

function ttlFor(role: User["role"]): number {
  return role === "admin" ? ADMIN_TTL_MS : CUSTOMER_TTL_MS;
}

export type RequestMeta = { ip: string | null; userAgent: string | null };

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  return { ip: clientIpFrom(h), userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

/** Create a session row and return the raw token (to be put in the cookie). */
export async function createSession(userId: string, role: User["role"], meta: Partial<RequestMeta> = {}) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlFor(role));
  await db.insert(sessions).values({
    id: sha256Hex(token),
    userId,
    expiresAt,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });
  return { token, expiresAt };
}

/** Look up a session by raw token; extends it when past half its lifetime. */
export async function validateSessionToken(token: string): Promise<(SessionContext & { expiresAt: Date }) | null> {
  if (!token || token.length > 100) return null;
  const sessionId = sha256Hex(token);
  const [row] = await db
    .select({ session: sessions, user: users, customer: customers })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(customers, eq(customers.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.user.disabledAt) return null;

  let expiresAt = row.session.expiresAt;
  const ttl = ttlFor(row.user.role);
  if (expiresAt.getTime() - Date.now() < ttl / 2) {
    expiresAt = new Date(Date.now() + ttl);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId));
  }
  return {
    sessionId,
    expiresAt,
    user: { id: row.user.id, email: row.user.email, role: row.user.role, name: row.user.name },
    customer: row.customer,
  };
}

export async function invalidateSession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateUserSessions(userId: string, exceptSessionId?: string) {
  const all = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  for (const s of all) if (s.id !== exceptSessionId) await invalidateSession(s.id);
}

export async function deleteExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/* ------------------------------ cookie helpers ------------------------------ */

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: 0,
  });
}

/** Current session for this request (memoized per request). */
export const getCurrentSession = cache(async (): Promise<SessionContext | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

/** Log a user in: new session + cookie (session fixation safe — always a fresh token). */
export async function startSession(user: Pick<User, "id" | "role">) {
  const meta = await requestMeta();
  const { token, expiresAt } = await createSession(user.id, user.role, meta);
  await setSessionCookie(token, expiresAt);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
}
