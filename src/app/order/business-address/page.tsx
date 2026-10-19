import { AccountStep } from "@/components/checkout/account-step";
import { CheckoutShell, OrderSummary } from "@/components/checkout/checkout-shell";
import { BusinessAddressCheckoutForm } from "@/components/checkout/forms";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { US_STATES } from "@/config/states";
import { getOptionalSession } from "@/server/auth/guards";
import { businessPickerData } from "@/server/checkout-pages";
import { getMarketingContext } from "@/server/marketing";

export const metadata = { title: "Business Address: Checkout" };

export default async function BusinessAddressOrderPage() {
  const [c, session] = await Promise.all([getMarketingContext(), getOptionalSession()]);
  const svc = c.address;
  if (!svc || !c.addressActive) {
    return (
      <Container className="max-w-xl py-16">
        <Alert tone="info" title="Not yet available">
          Our business address service isn&apos;t available to order yet.
        </Alert>
        <ButtonLink href="/contact?topic=business-address" variant="secondary" className="mt-4">
          Ask to be notified
        </ButtonLink>
      </Container>
    );
  }
  const summary = (
    <OrderSummary lines={[{ description: `${svc.name} (first ${svc.billing === "monthly" ? "month" : "year"})`, amountCents: svc.priceCents, billing: svc.billing }]} />
  );
  if (!session) {
    return (
      <CheckoutShell title="Business address" step={0} summary={summary}>
        <AccountStep returnTo="/order/business-address" />
      </CheckoutShell>
    );
  }
  if (session.user.role === "admin" || !session.customer) {
    return (
      <Container className="max-w-xl py-16">
        <Alert tone="info" title="You're signed in as an administrator">Sign in with a customer account to place an order.</Alert>
      </Container>
    );
  }
  const entities = await businessPickerData(session.customer.id, "business_address", null);
  return (
    <CheckoutShell title="Business address" step={1} summary={summary}>
      <BusinessAddressCheckoutForm entities={entities} states={US_STATES.map((s) => ({ code: s.code, name: s.name }))} />
    </CheckoutShell>
  );
}
