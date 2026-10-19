import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before routes render. Two jobs only:
 * 1. CSRF defense for state-changing /api requests: require a same-origin Origin header.
 *    (Server Actions have this check built in; webhooks/cron authenticate by signature/secret.)
 * 2. Optimistic redirect to sign-in for /account and /admin when no session cookie exists.
 *    Real authorization happens in every page, action and route handler.
 */
const SESSION_COOKIES = ["session", "__Host-session"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ORIGIN_EXEMPT = ["/api/webhooks/", "/api/cron/"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(req.method) && !ORIGIN_EXEMPT.some((p) => pathname.startsWith(p))) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let sameOrigin = false;
    try {
      sameOrigin = Boolean(origin && host && new URL(origin).host === host);
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) return new NextResponse("Forbidden", { status: 403 });
  }

  const isPrivate = pathname.startsWith("/account") || pathname.startsWith("/admin");
  if (isPrivate && !SESSION_COOKIES.some((c) => req.cookies.has(c))) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?returnTo=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  if (isPrivate || pathname.startsWith("/order")) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (isPrivate) res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/order/:path*", "/api/:path*"],
};
