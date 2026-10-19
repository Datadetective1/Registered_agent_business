import { AccountStep } from "@/components/checkout/account-step";
import { CheckoutShell, CheckoutSteps, OrderSummary } from "@/components/checkout/checkout-shell";
import { FormationCheckout } from "@/components/checkout/forms";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { getOptionalSession } from "@/server/auth/guards";
import { getMarketingContext } from "@/server/marketing";

export const metadata = { title: "Start a Texas LLC: Checkout" };

export default async function FormationOrderPage() {
  const [c, session] = await Promise.all([getMarketingContext(), getOptionalSession()]);
  if (!c.formation || !c.formationActive) {
    return (
      <Container className="max-w-xl py-16">
        <Alert tone="warning" title="Temporarily unavailable">Texas LLC formation can&apos;t be ordered online right now. Please contact us.</Alert>
      </Container>
    );
  }
  const formation = { description: `${c.formation.name}: service fee`, amountCents: c.formationFeeCents };
  const stateFee = { description: c.stateFeeLabel, amountCents: c.stateFeeCents };

  if (!session) {
    return (
      <CheckoutShell
        title="Start your Texas LLC"
        step={0}
        summary={
          <OrderSummary
            lines={[
              { ...formation, billing: "one_time" },
              { ...stateFee, billing: "one_time", kind: "government_fee" },
            ]}
            footnote={`Optional registered agent service: ${c.raPrice}/year.`}
          />
        }
      >
        <AccountStep returnTo="/order/llc-formation" />
      </CheckoutShell>
    );
  }
  if (session.user.role === "admin" || !session.customer) {
    return (
      <Container className="max-w-xl py-16">
        <Alert tone="info" title="You're signed in as an administrator">Sign in with a customer account to place an order.</Alert>
        <ButtonLink href="/admin" variant="secondary" className="mt-4">Go to admin</ButtonLink>
      </Container>
    );
  }
  return (
    <Container className="py-8 sm:py-12">
      <CheckoutSteps current={1} />
      <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">Start your Texas LLC</h1>
      <div className="mt-8">
        <FormationCheckout formation={formation} stateFee={stateFee} ra={{ description: c.ra?.name ?? "Registered Agent Service", amountCents: c.raPriceCents, available: c.raActive }} />
      </div>
    </Container>
  );
}
