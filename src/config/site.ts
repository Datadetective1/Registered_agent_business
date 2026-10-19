/**
 * CENTRAL BRAND & SITE CONFIGURATION
 * ----------------------------------
 * These are the *defaults*. Every value here can be overridden at runtime from
 * Admin → Settings (stored in the `settings` table under the key "site").
 *
 * When the final business name/domain is chosen, either:
 *   1. edit the values below and redeploy, or
 *   2. change them in Admin → Settings (no deploy needed).
 *
 * Never hard-code the brand elsewhere — read it via getSettings() (server) or
 * useSite() (client).
 *
 * The canonical URL/domain is NOT here: it comes from the APP_URL environment
 * variable so that canonical tags, Stripe redirects and email links always match
 * the deployment.
 */
export const siteDefaults = {
  brand: {
    /** Public-facing company name. TEMPORARY PLACEHOLDER. */
    name: "Business Agent",
    /** Registered legal entity that operates the service (used in footer, terms, emails). */
    legalName: "Business Agent LLC (placeholder legal name)",
    /** Short descriptor used in titles and Open Graph. */
    tagline: "Registered agent and business filing services with clear, upfront pricing.",
    /** Optional logo image path or URL (e.g. "/brand/logo.svg"). Empty = text wordmark. */
    logoUrl: "",
    /** 1–3 characters shown in the wordmark badge when no logo is set. */
    monogram: "BA",
  },
  contact: {
    supportEmail: "support@example.com",
    /** Leave empty to hide phone numbers site-wide. */
    supportPhone: "",
    supportHours: "Monday–Friday, 9:00am–5:00pm Central",
    /** Company mailing address shown in the footer and emails. Leave line1 empty to hide. */
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "TX",
      postalCode: "",
    },
  },
  /** Brand colors (hex). Applied as CSS variables; keep sufficient contrast with white text. */
  colors: {
    primary: "#0F2B46",
    primaryHover: "#0A2034",
    accent: "#1F6B57",
  },
  social: {
    linkedin: "",
    x: "",
    facebook: "",
  },
  operations: {
    /** Where internal alerts (new order, customer responded, renewal cancelled) are addressed. */
    adminNotificationEmail: "operations@example.com",
    /** Days before renewal to send reminders. */
    renewalReminderDays: [30, 7],
    /** Active fulfillment provider. Only "manual" exists until a provider API is integrated. */
    fulfillmentProvider: "manual",
  },
  analytics: {
    /** Optional privacy-friendly analytics (Plausible-compatible) domain. Empty = off. */
    plausibleDomain: "",
    /** Script URL for the analytics provider (Plausible or self-hosted compatible). */
    plausibleScriptUrl: "https://plausible.io/js/script.js",
  },
  legal: {
    /**
     * Set to true ONLY after an attorney has reviewed the corresponding document.
     * While false, pages show a visible "draft — pending legal review" notice and
     * the admin dashboard shows a launch warning.
     */
    reviewed: {
      terms: false,
      privacy: false,
      "refund-policy": false,
      "registered-agent-terms": false,
      "formation-disclaimer": false,
      "mail-address-terms": false,
    } as Record<string, boolean>,
    /** Bump when terms change materially; recorded on each order. */
    termsVersion: "draft-2026-10",
  },
};

export type SiteSettings = typeof siteDefaults;
