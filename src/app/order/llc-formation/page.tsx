import { CheckoutPage } from "@/components/checkout/checkout-page";

export const metadata = { title: "Start a Texas LLC: Checkout" };

export default async function FormationOrderPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  return <CheckoutPage product="llc_formation" query={{ name }} />;
}
