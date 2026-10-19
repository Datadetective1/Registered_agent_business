import { NextResponse, type NextRequest } from "next/server";
import { CLIENT_EVENTS, track, type FunnelEvent } from "@/server/analytics";
import { sha256Hex } from "@/server/auth/tokens";
import { clientIpFrom } from "@/server/client-ip";
import { rateLimit } from "@/server/rate-limit";

/** Cookieless funnel beacon. Accepts only allow-listed event names. */
export async function POST(req: NextRequest) {
  let body: { name?: unknown; path?: unknown; referrer?: unknown; search?: unknown };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name : "";
  if (!CLIENT_EVENTS.includes(name as FunnelEvent)) return new NextResponse(null, { status: 400 });

  // Rate-limit by a hash of the IP; the IP itself is never stored.
  const ip = clientIpFrom(req.headers) ?? "unknown";
  const limit = await rateLimit(`beacon:${sha256Hex(ip).slice(0, 16)}`, 60, 600);
  if (!limit.ok) return new NextResponse(null, { status: 429 });

  const str = (v: unknown) => (typeof v === "string" ? v : null);
  await track(name as FunnelEvent, { path: str(body.path), referrer: str(body.referrer), search: str(body.search) });
  return new NextResponse(null, { status: 204 });
}
