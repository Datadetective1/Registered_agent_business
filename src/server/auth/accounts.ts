import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { customers, userTokens, users, type User } from "@/db/schema";
import { audit, type Actor } from "@/server/audit";
import { appUrl } from "@/server/env";
import { sendEmail } from "@/server/notifications/send";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import { invalidateUserSessions, type RequestMeta } from "./session";
import { generateToken, sha256Hex } from "./tokens";

const RESET_TTL_MS = 60 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

export async function registerCustomer(
  input: RegisterInput,
  meta: Partial<RequestMeta> = {},
): Promise<{ ok: true; user: User } | { ok: false; error: "email_taken" }> {
  const email = normalizeEmail(input.email);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) return { ok: false, error: "email_taken" };

  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ email, passwordHash, role: "customer", name: `${input.firstName} ${input.lastName}`.trim() })
        .returning();
      const [c] = await tx
        .insert(customers)
        .values({ userId: u.id, firstName: input.firstName, lastName: input.lastName, email, phone: input.phone ?? null })
        .returning();
      await audit(
        { actor: { type: "customer", userId: u.id }, action: "auth.signup", targetType: "user", targetId: u.id, customerId: c.id, meta },
        tx,
      );
      return u;
    });
    await sendEmail({ template: "welcome", to: email, data: { firstName: input.firstName } });
    return { ok: true, user };
  } catch (err) {
    // Unique violation from a concurrent signup with the same email.
    if ((err as { code?: string }).code === "23505") return { ok: false, error: "email_taken" };
    throw err;
  }
}

/** Returns the user on valid credentials. Constant-ish time whether or not the email exists. */
export async function authenticate(emailInput: string, password: string, meta: Partial<RequestMeta> = {}): Promise<User | null> {
  const email = normalizeEmail(emailInput);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    await burnPasswordCheck(password);
    return null;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid || user.disabledAt) {
    await audit({ actor: { type: user.role, userId: user.id }, action: "auth.login_failed", targetType: "user", targetId: user.id, meta });
    return null;
  }
  await audit({ actor: { type: user.role, userId: user.id }, action: "auth.login", targetType: "user", targetId: user.id, meta });
  return user;
}

/** Always resolves the same way to avoid revealing whether an account exists. */
export async function requestPasswordReset(emailInput: string, meta: Partial<RequestMeta> = {}): Promise<void> {
  const email = normalizeEmail(emailInput);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || user.disabledAt) return;

  const token = generateToken();
  await db.transaction(async (tx) => {
    // Invalidate any outstanding reset tokens.
    await tx
      .update(userTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(userTokens.userId, user.id), eq(userTokens.purpose, "password_reset"), isNull(userTokens.usedAt)));
    await tx.insert(userTokens).values({
      id: sha256Hex(token),
      userId: user.id,
      purpose: "password_reset",
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    await audit({ actor: { type: user.role, userId: user.id }, action: "auth.password_reset_requested", targetType: "user", targetId: user.id, meta }, tx);
  });
  await sendEmail({
    template: "password_reset",
    to: user.email,
    data: { resetUrl: `${appUrl()}/reset-password?token=${encodeURIComponent(token)}` },
  });
}

export async function resetPasswordWithToken(token: string, newPassword: string, meta: Partial<RequestMeta> = {}): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const id = sha256Hex(token);
  const passwordHash = await hashPassword(newPassword);
  const userId = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(userTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(userTokens.id, id),
          eq(userTokens.purpose, "password_reset"),
          isNull(userTokens.usedAt),
          gt(userTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: userTokens.userId });
    if (!row) return null;
    await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
    await audit({ actor: { type: "system" }, action: "auth.password_reset", targetType: "user", targetId: row.userId, meta }, tx);
    return row.userId;
  });
  if (!userId) return false;
  await invalidateUserSessions(userId);
  return true;
}

export async function changePassword(
  actor: Actor & { userId: string },
  currentSessionId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.id, actor.userId)).limit(1);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) return false;
  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, user.id));
  await invalidateUserSessions(user.id, currentSessionId);
  await audit({ actor, action: "auth.password_changed", targetType: "user", targetId: user.id });
  return true;
}

/** Create or promote an admin user (used by scripts/create-admin.ts). */
export async function upsertAdmin(emailInput: string, password: string, name = "Administrator") {
  const email = normalizeEmail(emailInput);
  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    const [linked] = await db.select({ id: customers.id }).from(customers).where(eq(customers.userId, existing.id)).limit(1);
    if (linked) throw new Error("That email belongs to a customer account; use a different email for admin access.");
    await db.update(users).set({ passwordHash, role: "admin", disabledAt: null }).where(eq(users.id, existing.id));
    return existing.id;
  }
  const [u] = await db.insert(users).values({ email, passwordHash, role: "admin", name }).returning({ id: users.id });
  await audit({ actor: { type: "system" }, action: "admin.created", targetType: "user", targetId: u.id });
  return u.id;
}
