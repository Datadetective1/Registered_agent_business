import type { SubscriptionStatus } from "@/db/schema";

/** Normalized result of a completed checkout, from Stripe or the simulated gateway. */
export type PaymentConfirmation = {
  orderId: string;
  gateway: "stripe" | "simulated";
  amountTotalCents: number;
  currency: string;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeInvoiceId?: string | null;
  receiptUrl?: string | null;
  invoiceUrl?: string | null;
  invoicePdfUrl?: string | null;
  subscription?: SubscriptionSync | null;
};

export type SubscriptionSync = {
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  endedAt: Date | null;
};
