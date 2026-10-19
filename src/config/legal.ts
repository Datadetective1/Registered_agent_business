/** Legal documents. Content lives in content/legal/<slug>.md. */
export const LEGAL_DOCS = [
  { slug: "terms", title: "Terms of Service", shortTitle: "Terms of Service" },
  { slug: "privacy", title: "Privacy Policy", shortTitle: "Privacy Policy" },
  { slug: "refund-policy", title: "Refund Policy", shortTitle: "Refund Policy" },
  { slug: "registered-agent-terms", title: "Registered Agent Service Terms", shortTitle: "Registered Agent Terms" },
  { slug: "formation-disclaimer", title: "Business Formation Disclaimer", shortTitle: "Formation Disclaimer" },
  { slug: "mail-address-terms", title: "Business Address & Mail Service Terms", shortTitle: "Mail & Address Terms" },
] as const;

export type LegalSlug = (typeof LEGAL_DOCS)[number]["slug"];
