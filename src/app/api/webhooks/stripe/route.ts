import { NextResponse, type NextRequest } from "next/server";
import { paymentsMode } from "@/server/env";
import { handleStripeEvent, verifyStripeEvent } from "@/server/payments/webhooks";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint. Configure in the Stripe dashboard (test mode) or with
 * `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Events needed:
 * checkout.session.completed, checkout.session.async_payment_succeeded,
 * invoice.paid, invoice.payment_failed, customer.subscription.updated,
 * customer.subscription.deleted, charge.refunded.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (paymentsMode() !== "stripe" || !secret) {
    return NextResponse.json({ error: "Stripe webhooks are not configured" }, { status: 503 });
  }
  const body = await req.text();
  let event;
  try {
    event = verifyStripeEvent(body, req.headers.get("stripe-signature"), secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (err) {
    console.error(`[stripe] failed to process ${event.type} ${event.id}`, err);
    // Non-2xx makes Stripe retry later.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
