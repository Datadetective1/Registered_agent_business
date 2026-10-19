import type { MetadataRoute } from "next";
import { appUrl, isProduction } from "@/server/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // Non-production deployments (previews, staging) should never be indexed.
  if (!isProduction() || process.env.ALLOW_INDEXING === "false") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/account", "/admin", "/order", "/api", "/reset-password"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
    host: appUrl(),
  };
}
