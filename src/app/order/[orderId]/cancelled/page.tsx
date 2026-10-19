import { notFound } from "next/navigation";
import { resumeCheckout } from "@/app/order/actions";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCustomer } from "@/server/auth/guards";
import { getCustomerOrder } from "@/server/orders";

export const metadata = { title: "Checkout cancelled" };

export default async function CancelledPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const session = await requireCustomer(`/order/${orderId}/cancelled`);
  const order = await getCustomerOrder(session.customer.id, orderId);
  if (!order) notFound();
  return (
    <Container className="max-w-xl py-12">
      <h1 className="text-2xl font-semibold">Checkout was cancelled</h1>
      {order.status === "new" ? (
        <>
          <p className="mt-3 text-muted">You haven&apos;t been charged. You can return to payment whenever you&apos;re ready.</p>
          <form action={resumeCheckout.bind(null, order.id)} className="mt-6 flex flex-wrap gap-3">
            <SubmitButton pendingLabel="Opening checkout…">Return to payment</SubmitButton>
            <ButtonLink href="/" variant="secondary">
              Back to home
            </ButtonLink>
          </form>
        </>
      ) : (
        <Alert tone="info" className="mt-4">
          This order has already been paid. <a className="underline" href={`/account/orders/${order.id}`}>View your order</a>.
        </Alert>
      )}
    </Container>
  );
}
