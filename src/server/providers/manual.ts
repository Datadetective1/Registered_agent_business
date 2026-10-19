import { ENTITY_TYPE_LABEL } from "@/lib/labels";
import type { AddressInput } from "@/lib/intake";
import { APPOINTMENT_TYPES } from "@/lib/intake";
import { stateName } from "@/config/states";
import type {
  BusinessAddressOrderInput,
  ChangeOfAgentInput,
  CancelServiceInput,
  EinOrderInput,
  EntrySheet,
  FormationOrderInput,
  FulfillmentProvider,
  ProviderSubmission,
  RegisteredAgentOrderInput,
  UpdateEntityInput,
} from "./types";

/**
 * ManualProvider: never calls any external system.
 *
 * Every create* call returns `pending_manual` with an entry sheet: the exact
 * fields an admin types into the wholesale partner's dashboard. The admin then
 * records the partner's reference number in our admin dashboard.
 */
const addr = (a: AddressInput | undefined) =>
  a ? [a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`].filter(Boolean).join(", ") : "";

function addressFields(prefix: string, a: AddressInput) {
  return [
    { label: `${prefix}: street`, value: a.line1 },
    ...(a.line2 ? [{ label: `${prefix}: line 2`, value: a.line2 }] : []),
    { label: `${prefix}: city`, value: a.city },
    { label: `${prefix}: state`, value: a.state },
    { label: `${prefix}: ZIP`, value: a.postalCode },
  ];
}

const manual = (instructions: string, sheet: EntrySheet): ProviderSubmission => ({
  status: "pending_manual",
  externalReference: null,
  instructions,
  sheet,
});

export const manualProvider: FulfillmentProvider = {
  id: "manual",
  displayName: "Manual (partner dashboard)",
  isAutomated: false,

  async createRegisteredAgentOrder(i: RegisteredAgentOrderInput) {
    return manual(
      "In the partner dashboard, add registered agent service for this entity in the state shown, using the details below. Then record the partner's order/reference number here and mark the order Submitted.",
      [
        {
          title: "Entity",
          fields: [
            { label: "Legal name", value: i.entity.legalName },
            { label: "Entity type", value: ENTITY_TYPE_LABEL[i.entity.entityType as keyof typeof ENTITY_TYPE_LABEL] ?? i.entity.entityType },
            { label: "State of registration", value: stateName(i.entity.jurisdiction) },
            { label: "SOS file number", value: i.entity.sosFileNumber ?? "" },
            { label: "Formation date", value: i.entity.formationDate ?? "" },
          ],
        },
        { title: "Principal office", fields: addressFields("Principal", i.entity.principalAddress) },
        { title: "Mailing address", fields: addressFields("Mailing", i.entity.mailingAddress) },
        {
          title: "Forwarding contact",
          fields: [
            { label: "Name", value: i.contact.name },
            { label: "Email", value: i.contact.email },
            { label: "Phone", value: i.contact.phone },
          ],
        },
        {
          title: "Appointment",
          fields: [
            { label: "Situation", value: APPOINTMENT_TYPES[i.appointment.type as keyof typeof APPOINTMENT_TYPES] ?? i.appointment.type },
            { label: "Current registered agent", value: i.appointment.currentAgentName ?? "" },
          ],
        },
      ],
    );
  },

  async createChangeOfAgentOrder(i: ChangeOfAgentInput) {
    return manual(
      "This business is switching from another registered agent, so the state must be notified. Once registered agent service is set up for the entity, arrange the change-of-registered-agent filing with the state: through the partner if it offers this, or by preparing the state's change-of-agent form (in Texas, Form 401). Record the partner reference or state filing number here, and mark it Completed when the state accepts the change. Confirm any state filing fee with the customer before filing.",
      [
        {
          title: "Entity",
          fields: [
            { label: "Legal name", value: i.entity.legalName },
            { label: "Entity type", value: ENTITY_TYPE_LABEL[i.entity.entityType as keyof typeof ENTITY_TYPE_LABEL] ?? i.entity.entityType },
            { label: "State", value: stateName(i.entity.jurisdiction) },
            { label: "SOS file number", value: i.entity.sosFileNumber ?? "" },
          ],
        },
        { title: "Current registered agent", fields: [{ label: "Name (as given by customer)", value: i.currentAgentName ?? "Not provided" }] },
        {
          title: "Contact",
          fields: [
            { label: "Name", value: i.contact.name },
            { label: "Email", value: i.contact.email },
            { label: "Phone", value: i.contact.phone },
          ],
        },
      ],
    );
  },

  async createFormationOrder(i: FormationOrderInput) {
    const ra = i.registeredAgent.useOurService
      ? [{ label: "Registered agent", value: "Use partner's registered agent service (our service)" }]
      : [
          { label: "Registered agent name", value: i.registeredAgent.name },
          ...addressFields("Registered office", i.registeredAgent.address),
        ];
    return manual(
      "In the partner dashboard, place a Texas LLC formation order (Certificate of Formation) with the details below. Then record the partner's order/reference number here and mark the order Submitted.",
      [
        {
          title: "Company",
          fields: [
            { label: "LLC name", value: i.name },
            { label: "Alternate name", value: i.alternateName ?? "" },
            { label: "State", value: stateName(i.jurisdiction) },
            { label: "Management", value: i.management === "member_managed" ? "Member-managed" : "Manager-managed" },
            { label: "Purpose", value: i.purpose.type === "general" ? "General (any lawful purpose)" : (i.purpose.text ?? "") },
            { label: "Effective", value: i.effective.type === "upon_filing" ? "Upon filing" : `Delayed: ${i.effective.date}` },
          ],
        },
        {
          title: i.management === "member_managed" ? "Governing persons (members)" : "Governing persons (managers)",
          fields: i.governingPersons.flatMap((p, n) => [
            { label: `#${n + 1} name`, value: p.name },
            { label: `#${n + 1} address`, value: addr(p.address) },
          ]),
        },
        { title: "Organizer", fields: [{ label: "Name", value: i.organizer.name }, { label: "Address", value: addr(i.organizer.address) }] },
        { title: "Registered agent", fields: ra },
        { title: "Business address", fields: addressFields("Business", i.businessAddress) },
        {
          title: "Contact",
          fields: [
            { label: "Name", value: i.contact.name },
            { label: "Email", value: i.contact.email },
            { label: "Phone", value: i.contact.phone },
          ],
        },
      ],
    );
  },

  async createBusinessAddressOrder(i: BusinessAddressOrderInput) {
    return manual("Set up the business address / mail service in the partner dashboard, then record the reference here.", [
      {
        title: "Business",
        fields: [
          { label: "Business name", value: i.businessName },
          { label: "Contact name", value: i.contact.name },
          { label: "Contact email", value: i.contact.email },
          { label: "Contact phone", value: i.contact.phone },
          { label: "Notes", value: i.notes ?? "" },
        ],
      },
    ]);
  },

  async createEINOrder(i: EinOrderInput) {
    return manual("EIN orders are not offered yet.", [{ title: "EIN", fields: [{ label: "Entity", value: i.entityName }] }]);
  },

  async getOrderStatus(ref) {
    // Manual orders: the status is whatever an admin recorded.
    return ref.recordedStatus;
  },

  async getDocuments() {
    // Documents are uploaded by an admin.
    return [];
  },

  async updateEntity(i: UpdateEntityInput) {
    return manual("Update the entity in the partner dashboard.", [
      { title: "Changes", fields: Object.entries(i.changes).map(([k, v]) => ({ label: k, value: String(v) })) },
    ]);
  },

  async cancelService(i: CancelServiceInput) {
    return manual("Cancel this service in the partner dashboard, following any state resignation requirements.", [
      {
        title: "Service",
        fields: [
          { label: "Entity", value: i.entityName },
          { label: "State", value: stateName(i.jurisdiction) },
          { label: "Partner reference", value: i.externalReference ?? "" },
          { label: "Reason", value: i.reason },
        ],
      },
    ]);
  },
};
