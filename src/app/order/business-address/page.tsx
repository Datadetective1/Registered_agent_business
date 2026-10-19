import { CheckoutPage } from "@/components/checkout/checkout-page";

export const metadata = { title: "Business Address: Checkout" };

export default async function BusinessAddressOrderPage() {
  return <CheckoutPage product="business_address" query={{}} />;
}
