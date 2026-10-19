/**
 * State-specific registered agent content. A state page is published only when the
 * state is enabled for sale (Admin → Services → availableStates) AND has content
 * here. Avoid thin template pages: write each state carefully and cite sources.
 */
export type StateContent = {
  intro: string;
  requirements: string[];
  appointing: string[];
  sources: Array<{ label: string; href: string }>;
};

export const STATE_CONTENT: Record<string, StateContent> = {
  TX: {
    // Verified 2026-10-19 against the Texas SOS Registered Agents FAQ and Form 401/205 instructions.
    intro:
      "Texas requires LLCs, corporations, and other filing entities to continuously maintain a registered agent and a registered office in Texas. The registered agent receives legal papers and official notices on the business's behalf.",
    requirements: [
      "The registered office must be a street address in Texas where legal papers can be personally delivered to the registered agent during normal business hours.",
      "The registered office can't be solely a mailbox service or a telephone answering service, so a P.O. box doesn't qualify.",
      "The agent can be an individual Texas resident or an organization authorized to do business in Texas with an office at the registered office address. A business can't serve as its own registered agent.",
      "The registered agent must consent to serve. A person named without consent can reject the appointment.",
      "Failing to maintain a registered agent and registered office can lead to a Texas entity's involuntary termination.",
    ],
    appointing: [
      "New Texas LLCs name their registered agent in the Certificate of Formation (Form 205) filed with the Texas Secretary of State.",
      "Existing entities change their registered agent by filing Form 401, Change of Registered Agent and/or Registered Office, with the Secretary of State. The state charges a filing fee.",
      "Out-of-state businesses registered to do business in Texas also need a Texas registered agent.",
    ],
    sources: [
      { label: "Texas SOS: Registered Agents FAQs", href: "https://www.sos.state.tx.us/corp/registeredagentfaqs.shtml" },
      { label: "Texas SOS: Form 401 instructions", href: "https://www.sos.state.tx.us/corp/instructions/401.shtml" },
    ],
  },
};
