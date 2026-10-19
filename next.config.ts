import type { NextConfig } from "next";
import { US_STATES } from "./src/config/states";

// State landing pages live at /{state}-registered-agent (e.g. /texas-registered-agent).
const STATE_SLUGS = US_STATES.map((s) => s.slug).join("|");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com https://billing.stripe.com; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Request-time rendering model: settings/prices come from the database and are
  // cached in-process (see src/server/settings.ts), so builds never need a DB.
  cacheComponents: false,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Document uploads go through Server Actions. Keep in sync with MAX_UPLOAD_BYTES.
      bodySizeLimit: "16mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      { source: "/start-an-llc", destination: "/start-an-llc-texas", permanent: true },
      { source: `/registered-agent/:state(${STATE_SLUGS})`, destination: "/:state-registered-agent", permanent: true },
    ];
  },
  async rewrites() {
    return [{ source: `/:state(${STATE_SLUGS})-registered-agent`, destination: "/registered-agent/:state" }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
