/**
 * PRODUCT CATALOG DEFAULTS
 * ------------------------
 * Seeded into the `services` table by `npm run db:seed`. After seeding, prices and
 * descriptions are edited in Admin → Settings → Services & pricing (the database is
 * the source of truth at runtime). Amounts are in cents.
 *
 * All prices below are TEMPORARY placeholders.
 */
import { US_STATES } from "./states";

/** All 50 states (DC can be added in Admin → Services if the partner covers it). */
const ALL_STATES = US_STATES.map((s) => s.code).filter((c) => c !== "DC");

export type ServiceKind = "registered_agent" | "formation" | "business_address";
export type BillingType = "one_time" | "annual" | "monthly";

export type ServiceConfig = {
  /** Registered agent: states where the service can currently be purchased. */
  availableStates?: string[];
  /** Business address: optional fulfillment notes shown to admins. */
  adminNotes?: string;
};

export type CatalogService = {
  code: string;
  name: string;
  kind: ServiceKind;
  billing: BillingType;
  priceCents: number;
  governmentFeeCents: number;
  governmentFeeLabel: string | null;
  jurisdiction: string | null;
  isActive: boolean;
  sortOrder: number;
  shortDescription: string;
  features: string[];
  config: ServiceConfig;
};

export const SERVICE_CODES = {
  registeredAgent: "registered_agent",
  llcFormationTX: "llc_formation_tx",
  businessAddress: "business_address",
} as const;

export const catalogDefaults: CatalogService[] = [
  {
    code: SERVICE_CODES.registeredAgent,
    name: "Registered Agent Service",
    kind: "registered_agent",
    billing: "annual",
    priceCents: 9900,
    governmentFeeCents: 0,
    governmentFeeLabel: null,
    jurisdiction: null,
    isActive: true,
    sortOrder: 1,
    shortDescription:
      "We serve as your business's registered agent: we receive service of process and official state correspondence and deliver it to your online account.",
    features: [
      "Registered agent coverage in your state",
      "Receipt of service of process (legal notices)",
      "Handling of state and government correspondence",
      "Digital document delivery to your account",
      "Email notification when documents arrive",
      "Online account to manage your businesses",
      "Renews annually; turn off auto-renewal anytime",
    ],
    // The wholesale partner covers every state; narrow this list in Admin if needed.
    config: { availableStates: ALL_STATES },
  },
  {
    code: SERVICE_CODES.llcFormationTX,
    name: "Texas LLC Formation",
    kind: "formation",
    billing: "one_time",
    priceCents: 14900,
    governmentFeeCents: 30000,
    governmentFeeLabel: "Texas Secretary of State filing fee",
    jurisdiction: "TX",
    isActive: true,
    sortOrder: 2,
    shortDescription:
      "We prepare and submit your Texas Certificate of Formation for a limited liability company based on the information you provide.",
    features: [
      "Preparation of your Texas Certificate of Formation (LLC)",
      "Submission to the Texas Secretary of State",
      "Filed formation documents delivered to your account",
      "Order status tracking in your account",
      "State filing fee passed through at cost — no markup",
    ],
    config: {},
  },
  {
    code: SERVICE_CODES.businessAddress,
    name: "Business Address & Mail Service",
    kind: "business_address",
    billing: "annual",
    priceCents: 0,
    governmentFeeCents: 0,
    governmentFeeLabel: null,
    jurisdiction: null,
    // Not purchasable until pricing and capabilities are configured in Admin.
    isActive: false,
    sortOrder: 3,
    shortDescription:
      "A business mailing address for everyday business mail, separate from your registered agent address.",
    // Intentionally empty: list only capabilities that are actually configured with
    // the fulfillment partner (e.g. mail scanning, forwarding). Shown verbatim to customers.
    features: [],
    config: {},
  },
];
