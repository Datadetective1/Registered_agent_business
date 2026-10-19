import { CheckoutPage } from "@/components/checkout/checkout-page";

export const metadata = { title: "Registered Agent Service: Checkout" };

export default async function RegisteredAgentOrderPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return <CheckoutPage product="registered_agent" query={{ state }} />;
}
