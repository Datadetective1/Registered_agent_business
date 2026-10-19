import type { MarketingContext } from "@/server/marketing";

/**
 * FAQ content. Answers are plain text (also used for FAQPage structured data).
 * They read live brand, prices and coverage from the context so they never drift
 * from settings. Only make claims that are true for the current configuration.
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
          a: "A registered agent is the person or company officially named to receive legal papers (such as a lawsuit, called service of process) and official notices from the state on behalf of a business. The agent must have a physical street address in the state where the business is registered.",
        },
        {
          q: "Does my business need a registered agent?",
          a: "Yes, in almost every case. Texas and most other states require LLCs, corporations and other registered businesses to keep a registered agent on file at all times. If you don't, the state can eventually forfeit or terminate the business's registration.",
        },
        {
          q: "Can I be my own registered agent?",
          a: "Often, yes, if you have a physical street address in the state and are reliably there during normal business hours. Many owners use a service instead so their home address isn't listed in public state records, and so legal papers don't arrive at home or in front of customers.",
        },
        {
          q: "Can I use the registered agent address as my business address?",
          a: "No. The registered agent address is only for legal papers and official government notices. Please don't use it for banking, Amazon or other marketplace accounts, insurance, Google Business Profile verification, licenses, packages, or everyday business mail. Our Business Address service is a separate product for those needs.",
        },
        {
          q: "Who is listed as the registered agent on state records?",
          a: `${c.brand} provides registered agent service through ${c.agentOfRecord}, which is the registered agent of record listed on state filings. Its in-state address is your business's registered office. Your account shows the exact agent name and address to use with the state.`,
        },
        {
          q: "Which states do you cover?",
          a: c.raNationwide
            ? "Registered agent service is available for businesses registered in any of the 50 states."
            : `Registered agent service is currently available for businesses registered in: ${c.raStatesLabel}.`,
        },
      ],
    },
    {
      title: `Using ${c.brand}`,
      items: [
        {
          q: "What's included with registered agent service?",
          a: "Registered agent representation in your state, receipt of service of process, receipt of official state and government notices, digital copies in your secure online account, email alerts when something arrives, and renewal reminders.",
        },
        {
          q: "How will I receive my documents?",
          a: "When legal papers or state notices arrive for your business, they're scanned and added to your secure online account, and we email you right away. For your security, documents are never attached to emails. You sign in to view and download them.",
        },
        {
          q: "I already have a registered agent. How do I switch?",
          a: `${c.changeOfAgentMessage} Your current agent stays on record until the state accepts the change.`,
        },
        {
          q: "Are you a law firm?",
          a: `No. ${c.brand} is not a law firm and does not provide legal, tax, or accounting advice. If you receive a lawsuit or legal notice, contact a licensed attorney promptly, since many legal documents have strict response deadlines.`,
        },
        {
          q: "Is my information secure?",
          a: "Payments are processed by Stripe; we never see or store your full card number. Documents are stored privately and are only available after you sign in. They are never posted at public links.",
        },
      ],
    },
    {
      title: "Pricing, renewals and refunds",
      items: [
        {
          q: "How much does registered agent service cost?",
          a: `${c.raPrice} per year per business. There's no setup fee and no monthly fee.`,
        },
        {
          q: "How does renewal work?",
          a: `Registered agent service renews automatically each year at the then-current price, using your saved payment method. We email you before each renewal. You can turn off auto-renewal at any time from your account.`,
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
          q: "How much does it cost to form a Texas LLC?",
          a: `Our Texas LLC formation service is ${c.formationFee}, plus the ${c.stateFee} Texas Secretary of State filing fee, which is a government fee we pass through at cost. That's ${c.formationTotal} total. Adding registered agent service for the first year brings it to ${c.formationWithRaTotal}.`,
        },
        {
          q: "How long does it take to form a Texas LLC?",
          a: "Timing depends on the Texas Secretary of State's processing times, which change throughout the year. We submit your filing after you complete your information and update your order status at each step.",
        },
        {
          q: "What information do I need?",
          a: "Your LLC's name, whether it will be member-managed or manager-managed, the names and addresses of its members or managers, a business address, and your registered agent (us, or one you provide). You can pay first and add these details right after checkout.",
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
