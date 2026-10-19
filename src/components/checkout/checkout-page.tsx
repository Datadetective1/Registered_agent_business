import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import type { CheckoutProduct } from "@/lib/checkout";
import { loadCheckoutPage } from "@/server/checkout-pages";
import { CheckoutWizard } from "./wizard";

const UNAVAILABLE: Record<CheckoutProduct, { title: string; body: string; cta?: { href: string; label: string } }> = {
  registered_agent: { title: "Temporarily unavailable", body: "Registered agent service can't be ordered online right now. Please contact us." },
  llc_formation: { title: "Temporarily unavailable", body: "Texas LLC formation can't be ordered online right now. Please contact us." },
  business_address: {
    title: "Coming soon",
    body: "Our business address service isn't available to order yet.",
    cta: { href: "/contact?topic=business-address", label: "Ask to be notified" },
  },
};

/** Server wrapper shared by the /order/* pages. */
export async function CheckoutPage({ product, query }: { product: CheckoutProduct; query: { state?: string; name?: string } }) {
  const page = await loadCheckoutPage(product, query);
  if (page.kind === "unavailable") {
    const u = UNAVAILABLE[product];
    return (
      <Container className="max-w-xl py-16">
        <Alert tone={product === "business_address" ? "info" : "warning"} title={u.title}>
          {u.body}
        </Alert>
        <ButtonLink href={u.cta?.href ?? "/contact"} variant="secondary" className="mt-4">
          {u.cta?.label ?? "Contact us"}
        </ButtonLink>
      </Container>
    );
  }
  if (page.kind === "admin") {
    return (
      <Container className="max-w-xl py-16">
        <Alert tone="info" title="You're signed in as an administrator">
          Sign in with a customer account to place an order.
        </Alert>
        <ButtonLink href="/admin" variant="secondary" className="mt-4">
          Go to admin
        </ButtonLink>
      </Container>
    );
  }
  return (
    <Suspense>
      <CheckoutWizard {...page.props} />
    </Suspense>
  );
}
