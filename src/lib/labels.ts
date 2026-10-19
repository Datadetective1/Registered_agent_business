import type { DocumentType, EntityServiceStatus, EntityType, SubscriptionStatus } from "@/db/schema";
import type { Tone } from "./order-status";

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  llc: "Limited Liability Company (LLC)",
  corporation: "Corporation",
  nonprofit: "Nonprofit Corporation",
  lp: "Limited Partnership (LP)",
  llp: "Limited Liability Partnership (LLP)",
  pllc: "Professional LLC (PLLC)",
  other: "Other",
};

export const ENTITY_STATUS_LABEL: Record<string, string> = {
  pending_formation: "Formation in progress",
  active: "Active",
  inactive: "Inactive",
  dissolved: "Dissolved",
  unknown: "Not yet verified",
};

export const ENTITY_SERVICE_STATUS: Record<EntityServiceStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending activation", tone: "warning" },
  active: { label: "Active", tone: "success" },
  cancellation_scheduled: { label: "Ends at renewal date", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
};

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  incomplete: { label: "Incomplete", tone: "warning" },
  incomplete_expired: { label: "Expired", tone: "neutral" },
  trialing: { label: "Trial", tone: "info" },
  active: { label: "Active", tone: "success" },
  past_due: { label: "Payment past due", tone: "danger" },
  canceled: { label: "Cancelled", tone: "neutral" },
  unpaid: { label: "Unpaid", tone: "danger" },
  paused: { label: "Paused", tone: "neutral" },
};

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  formation_document: "Formation document",
  state_correspondence: "State correspondence",
  service_of_process: "Service of process",
  annual_report: "Annual report",
  ein_confirmation: "EIN confirmation",
  operating_agreement: "Operating agreement",
  identity_verification: "Identity verification",
  customer_upload: "Customer upload",
  receipt: "Receipt",
  other: "Other",
};

/** Document types that trigger an immediate "new legal/state document" notification. */
export const URGENT_DOCUMENT_TYPES: DocumentType[] = ["service_of_process", "state_correspondence"];

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  succeeded: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
  partially_refunded: { label: "Partially refunded", tone: "neutral" },
};

export const SUPPORT_CATEGORY_LABEL: Record<string, string> = {
  general: "General question",
  sales: "Pricing or services",
  billing: "Billing",
  documents: "Documents",
  order: "An existing order",
  registered_agent: "Registered agent service",
  other: "Other",
};
