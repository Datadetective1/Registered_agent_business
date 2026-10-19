/**
 * WHOLESALE PROVIDER ABSTRACTION
 * ------------------------------
 * Inputs are provider-neutral and built from our own data (see payloads.ts).
 * A provider translates them into whatever its system needs.
 *
 * Today only ManualProvider exists: an admin enters the order into the wholesale
 * partner's dashboard by hand, using the entry sheet it produces.
 *
 * To add Registered Agents Inc. (or any partner) later:
 *   1. Implement FulfillmentProvider against the partner's DOCUMENTED API.
 *   2. Register it in ./index.ts.
 *   3. Map the partner's statuses/webhooks onto ProviderOrderStatus.
 *   4. Switch Admin → Settings → Fulfillment provider.
 * Nothing in fulfillment.ts or the UI should need to change.
 */
import type { AddressInput } from "@/lib/intake";

export type ProviderId = "manual";
export type ProviderOrderStatus = "pending_manual" | "submitted" | "processing" | "completed" | "failed" | "cancelled";
export type ProviderOperation = "registered_agent" | "change_of_agent" | "formation" | "business_address" | "ein" | "update_entity" | "cancel_service";

export type Person = { name: string; address: AddressInput };
export type Contact = { name: string; email: string; phone: string };

export type RegisteredAgentOrderInput = {
  orderNumber: number;
  entity: {
    legalName: string;
    entityType: string;
    jurisdiction: string;
    sosFileNumber?: string;
    formationDate?: string;
    principalAddress: AddressInput;
    mailingAddress: AddressInput;
  };
  contact: Contact;
  appointment: { type: string; currentAgentName?: string };
  customer: Contact;
};

/**
 * A business switching to us from another registered agent: the state must be told
 * (a change-of-agent filing). Tracked as its own provider order so it can't be missed.
 */
export type ChangeOfAgentInput = {
  orderNumber: number;
  entity: { legalName: string; entityType: string; jurisdiction: string; sosFileNumber?: string };
  currentAgentName?: string;
  contact: Contact;
  customer: Contact;
};

export type FormationOrderInput = {
  orderNumber: number;
  jurisdiction: string;
  entityType: "llc";
  name: string;
  alternateName?: string;
  management: "member_managed" | "manager_managed";
  governingPersons: Person[];
  organizer: Person;
  businessAddress: AddressInput;
  registeredAgent: { useOurService: true } | { useOurService: false; name: string; address: AddressInput };
  purpose: { type: "general" | "specific"; text?: string };
  effective: { type: "upon_filing" | "specific_date"; date?: string };
  contact: Contact;
  customer: Contact;
};

export type BusinessAddressOrderInput = {
  orderNumber: number;
  businessName: string;
  contact: Contact;
  notes?: string;
  customer: Contact;
};

export type EinOrderInput = { orderNumber: number; entityName: string; responsibleParty: Contact };
export type UpdateEntityInput = { externalReference: string; changes: Record<string, unknown> };
export type CancelServiceInput = { externalReference: string | null; entityName: string; jurisdiction: string; reason: string };

/** A labelled field an admin copies into the partner dashboard. */
export type EntrySheet = Array<{ title: string; fields: Array<{ label: string; value: string }> }>;

export type ProviderSubmission = {
  status: ProviderOrderStatus;
  /** Partner's order id when submitted automatically; null for manual orders until an admin records it. */
  externalReference: string | null;
  /** Human instructions for manual steps. */
  instructions?: string;
  /** Manual providers return the data to enter, grouped for the admin entry sheet. */
  sheet?: EntrySheet;
  raw?: Record<string, unknown>;
};

export type ProviderOrderRef = { externalReference: string | null; operation: ProviderOperation; recordedStatus: ProviderOrderStatus };
export type ProviderDocument = { filename: string; mimeType: string; fetch: () => Promise<Buffer> };

export interface FulfillmentProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  /** False when a human must act (ManualProvider). */
  readonly isAutomated: boolean;
  createRegisteredAgentOrder(input: RegisteredAgentOrderInput): Promise<ProviderSubmission>;
  createChangeOfAgentOrder(input: ChangeOfAgentInput): Promise<ProviderSubmission>;
  createFormationOrder(input: FormationOrderInput): Promise<ProviderSubmission>;
  createBusinessAddressOrder(input: BusinessAddressOrderInput): Promise<ProviderSubmission>;
  createEINOrder(input: EinOrderInput): Promise<ProviderSubmission>;
  getOrderStatus(ref: ProviderOrderRef): Promise<ProviderOrderStatus>;
  getDocuments(ref: ProviderOrderRef): Promise<ProviderDocument[]>;
  updateEntity(input: UpdateEntityInput): Promise<ProviderSubmission>;
  cancelService(input: CancelServiceInput): Promise<ProviderSubmission>;
}
