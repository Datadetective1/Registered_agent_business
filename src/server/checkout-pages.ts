import "server-only";
import { and, eq } from "drizzle-orm";
import type { WizardProps } from "@/components/checkout/wizard";
import { stateName } from "@/config/states";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import type { CheckoutProduct } from "@/lib/checkout";
import { getOptionalSession } from "./auth/guards";
import { entitiesForCheckout } from "./checkout";
import { paymentsMode, stripeIsTestMode } from "./env";
import { getMarketingContext } from "./marketing";

/** Data for the business picker on checkout pages. */
export async function businessPickerData(customerId: string, kind: "registered_agent" | "business_address", allowedStates: string[] | null) {
  const list = await entitiesForCheckout(customerId, kind);
  return list
    .filter((r) => !allowedStates || allowedStates.includes(r.entity.jurisdiction))
    .map((r) => ({ id: r.entity.id, legalName: r.entity.legalName, stateName: stateName(r.entity.jurisdiction), disabled: r.hasService }));
}

export type CheckoutPageData =
  | { kind: "unavailable"; product: CheckoutProduct }
  | { kind: "admin" }
  | { kind: "ok"; props: WizardProps };

/** Everything the checkout wizard needs, for any product. */
export async function loadCheckoutPage(product: CheckoutProduct, query: { state?: string; name?: string }): Promise<CheckoutPageData> {
  const [c, session] = await Promise.all([getMarketingContext(), getOptionalSession()]);
  const available = product === "registered_agent" ? c.raActive : product === "llc_formation" ? c.formationActive : c.addressActive;
  if (!available) return { kind: "unavailable", product };
  if (session && (session.user.role !== "customer" || !session.customer)) return { kind: "admin" };

  const customer = session?.customer ?? null;
  let prefill: WizardProps["prefill"] = {};
  if (customer) {
    prefill = { firstName: customer.firstName, lastName: customer.lastName, email: customer.email, phone: customer.phone ?? "" };
    if (customer.mailingAddressId) {
      const [a] = await db
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, customer.mailingAddressId), eq(addresses.customerId, customer.id)))
        .limit(1);
      if (a) {
        Object.assign(prefill, {
          line1: a.line1,
          line2: a.line2 ?? "",
          city: a.city,
          state: a.state,
          postalCode: a.postalCode,
          country: a.country === "US" ? "United States" : a.country,
        });
      }
    }
  }

  const kind = product === "business_address" ? "business_address" : "registered_agent";
  const businesses = customer && product !== "llc_formation" ? await businessPickerData(customer.id, kind, product === "registered_agent" ? c.raStates : null) : [];
  const mode = paymentsMode();
  const state = query.state?.toUpperCase().slice(0, 2);

  return {
    kind: "ok",
    props: {
      product,
      brand: c.brand,
      offers: {
        ra: { available: c.raActive, name: c.ra?.name ?? "Registered Agent Service", priceCents: c.raPriceCents, states: c.raStates },
        formation: {
          available: c.formationActive,
          name: c.formation?.name ?? "Texas LLC Formation",
          serviceFeeCents: c.formationFeeCents,
          stateFeeCents: c.stateFeeCents,
          stateFeeLabel: c.stateFeeLabel,
        },
        address: { available: c.addressActive, name: c.address?.name ?? "Business Address", priceCents: c.address?.priceCents ?? 0, billing: c.address?.billing ?? "monthly" },
      },
      messages: { renewal: c.renewalMessage, changeOfAgent: c.changeOfAgentMessage },
      payments: mode === "stripe" ? (stripeIsTestMode() ? "stripe_test" : "stripe_live") : mode,
      account: { signedIn: Boolean(customer), email: session?.user.email },
      prefill,
      businesses,
      defaults: { state: state && /^[A-Z]{2}$/.test(state) ? state : undefined, name: query.name?.slice(0, 150) || undefined },
    },
  };
}
