import "server-only";
import type { Customer, Order, OrderItem, Subscription } from "@/db/schema";
import { paymentsMode } from "@/server/env";
import { simulatedGateway } from "./simulated";
import { stripeGateway } from "./stripe";
import type { SubscriptionSync } from "./types";

export interface PaymentGateway {
  readonly name: "stripe" | "simulated";
  /** Create a hosted checkout for the order; returns the URL to redirect to. */
  createCheckout(args: { order: Order; items: OrderItem[]; customer: Customer }): Promise<{ url: string; sessionId: string }>;
  /** Hosted page where customers manage cards and see invoices. Null if unsupported. */
  billingPortalUrl(customer: Customer, returnUrl: string): Promise<string | null>;
  /** Turn auto-renewal on/off (cancel at period end). Returns the synced state if the gateway reports one. */
  setAutoRenew(sub: Subscription, autoRenew: boolean): Promise<SubscriptionSync | null>;
  /** Cancel immediately (used when an order is cancelled/refunded by an admin). */
  cancelSubscriptionNow(sub: Subscription): Promise<void>;
}

/** The gateway for new checkouts, or null if payments are disabled. */
export function getGateway(): PaymentGateway | null {
  const mode = paymentsMode();
  if (mode === "stripe") return stripeGateway;
  if (mode === "simulated") return simulatedGateway;
  return null;
}

/** The gateway that owns an existing subscription. */
export function gatewayFor(name: "stripe" | "simulated"): PaymentGateway {
  return name === "stripe" ? stripeGateway : simulatedGateway;
}
