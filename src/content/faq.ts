import type { MarketingContext } from "@/server/marketing";

/**
 * FAQ content. Answers are plain text (also used for FAQPage structured data).
 * They read live brand/prices from the context so they never drift from settings.
 */
export type Faq = { q: string; a: string };
export type FaqGroup = { title: string; items: Faq[] };

export function faqGroups(c: MarketingContext): FaqGroup[] {
  return [
    {
      title: "Registered agent basics",
      items: [
        {
          q: "What is a registered agent?",
          a: "A registered agent is the person or company named in state records to receive service of process (legal papers such as a lawsuit) and official notices from the state on behalf of a business. The registered agent must have a physical street address in the state, called the registered office.",
        },
        {
          q: "Does my business need a registered agent?",
          a: "In Texas and most other states, LLCs, corporations and other registered entities must continuously maintain a registered agent and registered office in the state where they are formed or registered to do business.",
        },
        {
          q: "Can I be my own registered agent?",
          a: "Often, yes, if you have a physical street address in the state and are reliably available there during normal business hours to accept legal papers. Many owners use a registered agent service so their own address isn't listed as the registered office, and so they aren't served with legal papers at home or in front of customers.",
        },
        {
          q: "Can I use the registered agent address as my business mailing address?",
          a: "No. The registered agent address is only for service of process and official correspondence from the state. Please don't use it for general business mail, bank or vendor correspondence, packages, or as your principal office address. If you need a business mailing address, see our separate Business Address service.",
        },
        {
          q: "Who is listed as the registered agent on state records?",
          a: `${c.brand} provides registered agent service in partnership with a nationwide commercial registered agent. Depending on your state, our partner may be listed as the registered agent of record, with its in-state address as your registered office. Your account shows the exact agent name and address to use on state filings.`,
        },
      ],
    },
    {
      title: `Using ${c.brand}`,
      items: [
        {
          q: "How will I receive my documents?",
          a: "When service of process or state correspondence arrives for your business, it is scanned and uploaded to your secure online account, and we email you right away. For your security, documents are never attached to emails. You sign in to view and download them.",
        },
        {
          q: "How do I switch my registered agent?",
          a: "Purchase registered agent service and complete the short onboarding form. Once your service is set up, your account shows the agent name and registered office address to use. In Texas, a change of registered agent is made by filing a statement of change with the Secretary of State (a state filing fee applies). Your current agent stays on record until that filing is accepted.",
        },
        {
          q: "Do you provide legal advice?",
          a: `No. ${c.brand} is not a law firm and does not provide legal, tax, or accounting advice. We forward documents and prepare filings based on the information you provide. If you receive a lawsuit or legal notice, consult a licensed attorney promptly, since many legal documents have strict response deadlines.`,
        },
        {
          q: "Is my information secure?",
          a: "Payments are processed by Stripe; we never see or store your full card number. Documents are stored privately and are only available to you after you sign in. They are never posted at public links.",
        },
      ],
    },
    {
      title: "Pricing, renewals and refunds",
      items: [
        {
          q: "How much does registered agent service cost?",
          a: `Registered agent service is ${c.raPrice} per year per business. There are no setup fees.`,
        },
        {
          q: "How much does it cost to form a Texas LLC?",
          a: `Our Texas LLC formation service is ${c.formationFee}, plus the ${c.stateFee} Texas Secretary of State filing fee, which we pass through at cost. That's ${c.formationTotal} total. Adding registered agent service for the first year brings it to ${c.formationWithRaTotal}.`,
        },
        {
          q: "How does renewal work?",
          a: `Registered agent service renews automatically each year on your purchase anniversary using your saved payment method. We email you before each renewal. You can turn off auto-renewal at any time from your account.`,
        },
        {
          q: "What happens if I turn off auto-renewal?",
          a: "Your service continues until the end of the period you've paid for. Before it ends, you'll need to appoint a new registered agent with the state. If no new agent is appointed, the registered agent may resign as permitted by state law, which can affect your business's standing with the state.",
        },
        {
          q: "What is your refund policy?",
          a: "Please see our Refund Policy for details. State filing fees generally can't be refunded once a filing has been submitted to the state.",
        },
      ],
    },
    {
      title: "Texas LLC formation",
      items: [
        {
          q: "How long does it take to form a Texas LLC?",
          a: "Timing depends on the Texas Secretary of State's processing times, which change throughout the year. We submit your filing after you complete your information and update your order status at each step, so you always know where things stand.",
        },
        {
          q: "What information do I need?",
          a: "Your LLC's name, whether it will be member-managed or manager-managed, the names and addresses of its members or managers, the organizer's name and address, a business address, and your registered agent (us, or one you provide).",
        },
        {
          q: "Will you make sure my LLC name is available?",
          a: "We review the name before submitting, but the Texas Secretary of State makes the final decision about name availability. If the state rejects the name, we'll contact you to choose another.",
        },
      ],
    },
  ];
}

export function allFaqs(c: MarketingContext): Faq[] {
  return faqGroups(c).flatMap((g) => g.items);
}

export function findFaqs(c: MarketingContext, questions: string[]): Faq[] {
  const all = allFaqs(c);
  return questions.map((q) => all.find((f) => f.q === q)).filter((f): f is Faq => Boolean(f));
}
