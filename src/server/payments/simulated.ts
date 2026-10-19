import "server-only";
import { randomUUID } from "node:crypto";
import { isProduction } from "@/server/env";
import type { PaymentGateway } from "./gateway";

/**
 * Development/CI-only gateway. Checkout goes to /order/[id]/simulated-checkout,
 * which runs the same confirmOrderPayment() code path as the Stripe webhook.
 * env.paymentsMode() never selects this in production.
 */
export const simulatedGateway: PaymentGateway = {
  name: "simulated",
  async createCheckout({ order }) {
    if (isProduction()) throw new Error("Simulated payments are disabled in production.");
    return { url: `/order/${order.id}/simulated-checkout`, sessionId: `sim_cs_${randomUUID()}` };
  },
  async billingPortalUrl() {
    return null;
  },
  async setAutoRenew() {
    return null;
  },
  async cancelSubscriptionNow() {},
};
