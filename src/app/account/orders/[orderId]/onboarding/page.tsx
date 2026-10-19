import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessAddressIntakeForm, LlcFormationIntakeForm, RegisteredAgentIntakeForm } from "@/components/account/intake-forms";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/layout";
import { LLC_DESIGNATORS } from "@/lib/intake";
import { flattenToFormValues } from "@/lib/forms";
import { ORDER_TYPE_LABEL } from "@/lib/order-status";
import { orderNumberLabel } from "@/lib/utils";
import { requireCustomer } from "@/server/auth/guards";
import { getCustomerOrderDetail } from "@/server/customer";
import { INTAKE_EDITABLE } from "@/server/fulfillment";
import type { CheckoutData } from "@/server/orders";

function splitDesignator(name: string): { name: string; designator: string } {
  for (const d of LLC_DESIGNATORS) {
    const re = new RegExp(`[,\\s]+${d.replace(/\./g, "\\.")}\\s*$`, "i");
    if (re.test(name)) return { name: name.replace(re, "").trim(), designator: d };
  }
  return { name: name.trim(), designator: "LLC" };
}

export default async function OnboardingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const session = await requireCustomer(`/account/orders/${orderId}/onboarding`);
  const detail = await getCustomerOrderDetail(session.customer.id, orderId);
  if (!detail || detail.order.status === "new") notFound();
  const { order, entity } = detail;
  const c = session.customer;
  const checkout = order.checkoutData as CheckoutData;
  const fullName = `${c.firstName} ${c.lastName}`;
  const contact = { name: fullName, email: c.email, phone: c.phone ?? "" };

  const header = (
    <PageHeader
      title="Tell us about your business"
      description={`Order ${orderNumberLabel(order.number)} · ${ORDER_TYPE_LABEL[order.type]}. Takes about five minutes.`}
    />
  );

  if (!INTAKE_EDITABLE.includes(order.status)) {
    return (
      <div className="space-y-6">
        {header}
        <Alert tone="info" title="Your information has been submitted">
          Your order is being processed, so it can no longer be edited online.{" "}
          <Link href="/account/support" className="underline">
            Contact support
          </Link>{" "}
          if something needs to change.
        </Alert>
      </div>
    );
  }

  let defaults: Record<string, string>;
  if (order.intake) {
    defaults = flattenToFormValues(order.intake);
    if (order.type === "registered_agent" && !defaults["mailingAddress.line1"]) defaults.mailingSameAsPrincipal = "on";
  } else if (order.type === "registered_agent") {
    defaults = flattenToFormValues({
      entity: { legalName: entity?.legalName, entityType: entity?.entityType, jurisdiction: entity?.jurisdiction },
      mailingSameAsPrincipal: true,
      contact,
    });
  } else if (order.type === "llc_formation") {
    const n = splitDesignator(checkout.llcName ?? entity?.legalName ?? "");
    defaults = flattenToFormValues({
      company: { name: n.name, designator: n.designator },
      management: "member_managed",
      governingPersons: [{ name: fullName, address: { state: "TX" } }],
      organizer: { name: fullName, address: { state: "TX" } },
      businessAddress: { state: "TX" },
      purpose: { type: "general" },
      effective: { type: "upon_filing" },
      contact,
    });
  } else {
    defaults = flattenToFormValues({ businessName: entity?.legalName, contact });
  }

  return (
    <div className="space-y-8">
      {header}
      <div className="rounded-xl border border-line bg-surface p-5 sm:p-8">
        {order.type === "registered_agent" ? (
          <RegisteredAgentIntakeForm orderId={order.id} defaults={defaults} />
        ) : order.type === "llc_formation" ? (
          <LlcFormationIntakeForm orderId={order.id} defaults={defaults} ownAgent={checkout.raChoice === "own"} />
        ) : (
          <BusinessAddressIntakeForm orderId={order.id} defaults={defaults} />
        )}
      </div>
    </div>
  );
}
