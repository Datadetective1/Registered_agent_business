import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cronSecret } from "@/server/env";
import { runDailyJobs } from "@/server/jobs";

export const dynamic = "force-dynamic";

/**
 * Daily jobs (renewal reminders, cleanup). Call once a day from your host's scheduler:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://YOUR_DOMAIN/api/cron/daily
 * or run `npm run cron:daily` on the server.
 */
function authorized(req: NextRequest): boolean {
  const secret = cronSecret();
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runDailyJobs();
  return NextResponse.json({ ok: true, ...result });
}
