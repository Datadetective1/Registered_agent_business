import type { OrderStatus, OrderType } from "@/db/schema";

export type Tone = "neutral" | "info" | "warning" | "success" | "danger";

type StatusMeta = {
  /** Operational label (admin). */
  label: string;
  /** Label shown to customers. */
  customerLabel: string;
  /** Customer-facing explanation. */
  customerText: string;
  tone: Tone;
};

export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  new: { label: "New", customerLabel: "Awaiting payment", customerText: "Awaiting payment.", tone: "neutral" },
  payment_confirmed: {
    label: "Payment Confirmed", customerLabel: "Order received",
    customerText: "Payment received. Next, tell us about your business so we can begin.",
    tone: "info",
  },
  information_needed: {
    label: "Information Needed", customerLabel: "Information needed",
    customerText: "We need a little more information from you before we can continue.",
    tone: "warning",
  },
  ready_for_fulfillment: {
    label: "Ready for Provider", customerLabel: "Information submitted",
    customerText: "We have your information and your order is in our processing queue.",
    tone: "info",
  },
  submitted_to_provider: {
    label: "Submitted to Provider", customerLabel: "Processing",
    customerText: "We're processing your order. We'll email you when there's an update.",
    tone: "info",
  },
  processing: { label: "Processing", customerLabel: "Processing", customerText: "We're processing your order. We'll email you when there's an update.", tone: "info" },
  completed: { label: "Completed", customerLabel: "Completed", customerText: "Your order is complete.", tone: "success" },
  cancelled: { label: "Cancelled", customerLabel: "Cancelled", customerText: "This order was cancelled.", tone: "danger" },
  refunded: { label: "Refunded", customerLabel: "Refunded", customerText: "This order was refunded.", tone: "neutral" },
};

/** Allowed manual/automatic transitions. Keep in sync with docs/ARCHITECTURE.md §7. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["payment_confirmed", "cancelled"],
  payment_confirmed: ["information_needed", "ready_for_fulfillment", "cancelled", "refunded"],
  information_needed: ["ready_for_fulfillment", "cancelled", "refunded"],
  ready_for_fulfillment: ["submitted_to_provider", "information_needed", "cancelled", "refunded"],
  submitted_to_provider: ["processing", "completed", "information_needed", "cancelled", "refunded"],
  processing: ["completed", "information_needed", "cancelled", "refunded"],
  completed: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export const OPEN_ORDER_STATUSES: OrderStatus[] = [
  "payment_confirmed",
  "information_needed",
  "ready_for_fulfillment",
  "submitted_to_provider",
  "processing",
];

/** Customer-facing progress milestones (excludes terminal side-states). */
export const ORDER_PROGRESS: { status: OrderStatus; label: string }[] = [
  { status: "payment_confirmed", label: "Order received" },
  { status: "ready_for_fulfillment", label: "Information submitted" },
  { status: "processing", label: "Processing" },
  { status: "completed", label: "Completed" },
];

/** Index of the last milestone reached. */
export function progressIndex(status: OrderStatus): number {
  if (status === "information_needed") return 0;
  if (status === "submitted_to_provider") return 2;
  return ORDER_PROGRESS.findIndex((s) => s.status === status);
}

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  registered_agent: "Registered Agent Service",
  llc_formation: "Texas LLC Formation",
  business_address: "Business Address & Mail",
};
