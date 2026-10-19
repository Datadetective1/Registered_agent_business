import { AccountStep } from "@/components/checkout/account-step";
import { CheckoutShell, OrderSummary } from "@/components/checkout/checkout-shell";
import { RegisteredAgentCheckoutForm } from "@/components/checkout/forms";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { stateByCode } from "@/config/states";
import { getOptionalSession } from "@/server/auth/guards";
import { businessPickerData } from "@/server/checkout-pages";
import { getMarketingContext } from "@/server/marketing";

export const metadata = { title: "Registered Agent Service: Checkout" };

export default async function RegisteredAgentOrderPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const [{ state }, c, session] = await Promise.all([searchParams, getMarketingContext(), getOptionalSession()]);
  if (!c.ra || !c.raActive) {
    return (
      <Container className="max-w-xl py-16">
        <Alert tone="warning" title="Temporarily unavailable">Registered agent service can&apos;t be ordered online right now. Please contact us.</Alert>
      </Container>
    );
  }
  const states = c.raStates.map((code) => ({ code, name: stateByCode(code)?.name ?? code }));
  const defaultState = state && c.raStates.includes(state.toUpperCase()) ? state.toUpperCase() : undefined;
  const returnTo = `/order/registered-agent${defaultState ? `?state=${defaultState}` : ""}`;
  const summary = (
    <OrderSummary
      lines={[{ description: `${c.ra.name} (first year)`, amountCents: c.raPriceCents, billing: "annual" }]}
      footnote={`Available for businesses registered in: ${c.raStatesLabel}.`}
    />
  );

  if (!session) {
    return (
      <CheckoutShell title="Registered agent service" step={0} summary={summary}>
        <AccountStep returnTo={returnTo} />
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
  const entities = await businessPickerData(session.customer.id, "registered_agent", c.raStates);
  return (
    <CheckoutShell title="Registered agent service" step={1} summary={summary}>
      <RegisteredAgentCheckoutForm entities={entities} states={states} defaultState={defaultState} />
    </CheckoutShell>
  );
}
