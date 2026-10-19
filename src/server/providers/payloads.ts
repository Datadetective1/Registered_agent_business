import "server-only";
import type { Customer, Order } from "@/db/schema";
import { fullLlcName, type BusinessAddressIntake, type LlcFormationIntake, type RegisteredAgentIntake } from "@/lib/intake";
import type { CheckoutData } from "@/server/orders";
import type { BusinessAddressOrderInput, Contact, FormationOrderInput, RegisteredAgentOrderInput } from "./types";

/** Build provider-neutral inputs from our own order data. */
const customerContact = (c: Customer): Contact => ({
  name: `${c.firstName} ${c.lastName}`,
  email: c.email,
  phone: c.phone ?? "",
});

export function registeredAgentInput(order: Order, customer: Customer, intake: RegisteredAgentIntake): RegisteredAgentOrderInput {
  return {
    orderNumber: order.number,
    entity: {
      legalName: intake.entity.legalName,
      entityType: intake.entity.entityType,
      jurisdiction: intake.entity.jurisdiction,
      sosFileNumber: intake.entity.sosFileNumber,
      formationDate: intake.entity.formationDate,
      principalAddress: intake.principalAddress,
      mailingAddress: intake.mailingAddress ?? intake.principalAddress,
    },
    contact: intake.contact,
    appointment: intake.appointment,
    customer: customerContact(customer),
  };
}

export function formationInput(order: Order, customer: Customer, intake: LlcFormationIntake): FormationOrderInput {
  const checkout = order.checkoutData as CheckoutData;
  return {
    orderNumber: order.number,
    jurisdiction: "TX",
    entityType: "llc",
    name: fullLlcName(intake.company),
    alternateName: intake.company.alternateName,
    management: intake.management,
    governingPersons: intake.governingPersons,
    organizer: intake.organizer,
    businessAddress: intake.businessAddress,
    registeredAgent:
      checkout.raChoice === "own" && intake.ownAgent
        ? { useOurService: false, name: intake.ownAgent.name, address: intake.ownAgent.address }
        : { useOurService: true },
    purpose: intake.purpose,
    effective: intake.effective,
    contact: intake.contact,
    customer: customerContact(customer),
  };
}

export function businessAddressInput(order: Order, customer: Customer, intake: BusinessAddressIntake): BusinessAddressOrderInput {
  return {
    orderNumber: order.number,
    businessName: intake.businessName,
    contact: intake.contact,
    notes: intake.notes,
    customer: customerContact(customer),
  };
}
