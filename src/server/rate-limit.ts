import "server-only";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

/**
 * Fixed-window rate limiter stored in Postgres (works across instances, no Redis).
 * Keys look like "login:ip:203.0.113.5" or "login:email:a@b.com".
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; remaining: number; retryAfterSeconds: number }> {
  const interval = `${windowSeconds} seconds`;
  const result = await db.execute<{ count: number; reset_at: Date }>(sql`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, now() + ${interval}::interval)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= now() THEN now() + ${interval}::interval ELSE rate_limits.reset_at END
    RETURNING count, reset_at
  `);
  const row = result.rows[0];
  const count = Number(row.count);
  const resetAt = new Date(row.reset_at);
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
  };
}

/** Check several limits; fails if any is exceeded. */
export async function rateLimitAll(checks: Array<[key: string, limit: number, windowSeconds: number]>) {
  let ok = true;
  let retryAfterSeconds = 0;
  for (const [key, limit, win] of checks) {
    const r = await rateLimit(key, limit, win);
    if (!r.ok) {
      ok = false;
      retryAfterSeconds = Math.max(retryAfterSeconds, r.retryAfterSeconds);
    }
  }
  return { ok, retryAfterSeconds };
}

export async function deleteExpiredRateLimits() {
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, new Date()));
}

export function tooManyAttemptsMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`;
}
