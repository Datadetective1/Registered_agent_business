import { notFound } from "next/navigation";
import { CheckoutSteps } from "@/components/checkout/checkout-shell";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { CheckIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { STRIPE } from "@/server/audit";
import { requireCustomer } from "@/server/auth/guards";
import { confirmOrderPayment } from "@/server/fulfillment";
import { getCustomerOrder, orderProductName } from "@/server/orders";
import { retrieveCheckout } from "@/server/payments/stripe";

export const metadata = { title: "Payment received" };

export default async function SuccessPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const [{ orderId }, { session_id }] = await Promise.all([params, searchParams]);
  const session = await requireCustomer(`/order/${orderId}/success`);
  let order = await getCustomerOrder(session.customer.id, orderId);
  if (!order) notFound();

  // Fallback if the webhook hasn't arrived yet: verify the session with Stripe directly.
  if (order.status === "new" && order.gateway === "stripe" && session_id && session_id === order.stripeCheckoutSessionId) {
    try {
      const { paid, confirmation } = await retrieveCheckout(session_id);
      if (paid && confirmation && confirmation.orderId === order.id) {
        await confirmOrderPayment(confirmation, STRIPE);
        order = (await getCustomerOrder(session.customer.id, orderId))!;
      }
    } catch (err) {
      console.error("[checkout] success-page verification failed", err);
    }
  }

  if (order.status === "new") {
    return (
      <Container className="max-w-2xl py-12">
        <Alert tone="info" title="We're confirming your payment">
          This usually takes a few seconds. Refresh this page in a moment. If you were charged and this doesn&apos;t update, contact us
          with order #{order.number}.
        </Alert>
        <ButtonLink href={`/order/${order.id}/success${session_id ? `?session_id=${encodeURIComponent(session_id)}` : ""}`} variant="secondary" className="mt-4">
          Refresh
        </ButtonLink>
      </Container>
    );
  }

  return (
    <Container className="max-w-2xl py-8 sm:py-12">
      <CheckoutSteps current={3} />
      <div className="mt-8 rounded-xl border border-line bg-surface p-6 sm:p-8">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-success-bg text-success-fg">
          <CheckIcon />
        </span>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">Payment received. Thank you.</h1>
        <p className="mt-2 text-[16px] text-muted">
          Order #{order.number} · {orderProductName(order.type)} · {formatMoney(order.totalCents)}
        </p>
        <p className="mt-6 text-[16px] leading-relaxed">
          One more step: tell us about your business so we can start your order. It takes about five minutes, and we&apos;ve emailed
          you a confirmation.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={`/account/orders/${order.id}/onboarding`} size="lg">
            Complete business information
          </ButtonLink>
          <ButtonLink href="/account" size="lg" variant="secondary">
            Go to my account
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
