import { notFound } from "next/navigation";
import { completeSimulatedPayment } from "@/app/order/actions";
import { OrderSummary } from "@/components/checkout/checkout-shell";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCustomer } from "@/server/auth/guards";
import { isProduction, paymentsMode } from "@/server/env";
import { getCustomerOrder, getOrderItems } from "@/server/orders";

export const metadata = { title: "Simulated checkout" };

/** Development-only stand-in for Stripe Checkout. Never available in production. */
export default async function SimulatedCheckoutPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ declined?: string }> }) {
  if (isProduction() || paymentsMode() !== "simulated") notFound();
  const [{ orderId }, { declined }] = await Promise.all([params, searchParams]);
  const session = await requireCustomer(`/order/${orderId}/simulated-checkout`);
  const order = await getCustomerOrder(session.customer.id, orderId);
  if (!order) notFound();
  const items = await getOrderItems(order.id);
  return (
    <Container className="max-w-xl py-12">
      <Alert tone="warning" title="Simulated payment (development only)">
        Stripe keys aren&apos;t configured, so this page stands in for Stripe Checkout. No money moves. Completing it runs the same
        fulfillment code as a real Stripe payment.
      </Alert>
      {declined && order.status === "new" ? (
        <Alert tone="danger" role="alert" title="Your card was declined" className="mt-4">
          No charge was made. Try again with a different card.
        </Alert>
      ) : null}
      <div className="mt-6">
        <OrderSummary lines={items.map(({ item }) => ({ description: item.description, amountCents: item.totalCents, billing: item.billing, kind: item.kind }))} />
      </div>
      {order.status === "new" ? (
        <form action={completeSimulatedPayment.bind(null, order.id)} className="mt-6 flex flex-wrap gap-3">
          <SubmitButton size="lg" pendingLabel="Processing…">
            Pay (simulated)
          </SubmitButton>
          <ButtonLink href={`/order/${order.id}/simulated-checkout?declined=1`} variant="secondary" size="lg">
            Simulate a declined card
          </ButtonLink>
          <ButtonLink href={`/order/${order.id}/cancelled`} variant="ghost" size="lg">
            Cancel
          </ButtonLink>
        </form>
      ) : (
        <Alert tone="success" className="mt-6">This order is already paid.</Alert>
      )}
    </Container>
  );
}
