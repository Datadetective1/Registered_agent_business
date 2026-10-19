/**
 * Client IP for rate limiting and audit logs.
 *
 * X-Forwarded-For is "client, proxy1, proxy2". Entries on the left can be forged by
 * the client, so we count TRUSTED_PROXY_HOPS entries from the right (default 1:
 * the entry appended by your host's load balancer). Set it to 2 if you add a CDN
 * in front of the host.
 */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1);
    return parts[Math.max(0, parts.length - hops)] ?? null;
  }
  return headers.get("x-real-ip");
}
