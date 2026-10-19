import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { notifications, sessions, userTokens, users } from "@/db/schema";
import { authenticate, registerCustomer, requestPasswordReset, resetPasswordWithToken, upsertAdmin } from "@/server/auth/accounts";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, validateSessionToken } from "@/server/auth/session";
import { generateToken, sha256Hex } from "@/server/auth/tokens";
import { rateLimit } from "@/server/rate-limit";
import { resetDb } from "../helpers/db";

beforeEach(resetDb);

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});

describe("registration and login", () => {
  it("creates user + customer, rejects duplicate email case-insensitively", async () => {
    const r = await registerCustomer({ email: "Jane@Example.com", password: "a-long-password", firstName: "Jane", lastName: "Doe" });
    expect(r.ok).toBe(true);
    const dup = await registerCustomer({ email: "jane@example.com", password: "another-password", firstName: "J", lastName: "D" });
    expect(dup).toEqual({ ok: false, error: "email_taken" });
    const [u] = await db.select().from(users).where(eq(users.email, "jane@example.com"));
    expect(u.role).toBe("customer");
    expect(u.passwordHash).not.toContain("a-long-password");
  });

  it("authenticates valid credentials only", async () => {
    await registerCustomer({ email: "a@example.com", password: "a-long-password", firstName: "A", lastName: "B" });
    expect(await authenticate("A@example.com", "a-long-password")).not.toBeNull();
    expect(await authenticate("a@example.com", "wrong-password")).toBeNull();
    expect(await authenticate("missing@example.com", "a-long-password")).toBeNull();
  });

  it("rejects disabled users", async () => {
    await registerCustomer({ email: "d@example.com", password: "a-long-password", firstName: "A", lastName: "B" });
    await db.update(users).set({ disabledAt: new Date() }).where(eq(users.email, "d@example.com"));
    expect(await authenticate("d@example.com", "a-long-password")).toBeNull();
  });
});

describe("sessions", () => {
  it("stores only a hash of the token and resolves the customer", async () => {
    const r = await registerCustomer({ email: "s@example.com", password: "a-long-password", firstName: "S", lastName: "T" });
    if (!r.ok) throw new Error("setup");
    const { token } = await createSession(r.user.id, "customer");
    const [row] = await db.select().from(sessions);
    expect(row.id).toBe(sha256Hex(token));
    expect(row.id).not.toBe(token);
    const ctx = await validateSessionToken(token);
    expect(ctx?.user.email).toBe("s@example.com");
    expect(ctx?.customer?.firstName).toBe("S");
    expect(await validateSessionToken(generateToken())).toBeNull();
  });

  it("expired sessions are rejected", async () => {
    const r = await registerCustomer({ email: "e@example.com", password: "a-long-password", firstName: "E", lastName: "X" });
    if (!r.ok) throw new Error("setup");
    const { token } = await createSession(r.user.id, "customer");
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("admin sessions have no customer", async () => {
    const id = await upsertAdmin("ops@example.com", "an-admin-password");
    const { token } = await createSession(id, "admin");
    const ctx = await validateSessionToken(token);
    expect(ctx?.user.role).toBe("admin");
    expect(ctx?.customer).toBeNull();
  });
});

describe("password reset", () => {
  it("issues a single-use token by email and revokes sessions", async () => {
    const r = await registerCustomer({ email: "p@example.com", password: "old-password-1", firstName: "P", lastName: "Q" });
    if (!r.ok) throw new Error("setup");
    const { token: sessionToken } = await createSession(r.user.id, "customer");
    await requestPasswordReset("p@example.com");
    const [mail] = await db.select().from(notifications).where(eq(notifications.template, "password_reset"));
    expect(mail.status).toBe("logged");
    const resetToken = decodeURIComponent(/token=([^"&\s]+)/.exec(mail.bodyText)![1]);

    expect(await resetPasswordWithToken(resetToken, "new-password-2")).toBe(true);
    expect(await resetPasswordWithToken(resetToken, "new-password-3")).toBe(false); // single use
    expect(await authenticate("p@example.com", "new-password-2")).not.toBeNull();
    expect(await validateSessionToken(sessionToken)).toBeNull(); // sessions revoked
  });

  it("does nothing for unknown emails and rejects expired tokens", async () => {
    await requestPasswordReset("nobody@example.com");
    expect(await db.select().from(userTokens)).toHaveLength(0);

    const r = await registerCustomer({ email: "x@example.com", password: "old-password-1", firstName: "X", lastName: "Y" });
    if (!r.ok) throw new Error("setup");
    const token = generateToken();
    await db.insert(userTokens).values({ id: sha256Hex(token), userId: r.user.id, purpose: "password_reset", expiresAt: new Date(Date.now() - 1) });
    expect(await resetPasswordWithToken(token, "new-password-2")).toBe(false);
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within a window", async () => {
    for (let i = 0; i < 3; i++) expect((await rateLimit("t:key", 3, 60)).ok).toBe(true);
    const blocked = await rateLimit("t:key", 3, 60);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect((await rateLimit("t:other", 3, 60)).ok).toBe(true);
  });
});
