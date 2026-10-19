import { JsonLd } from "@/components/site/json-ld";
import { CtaBand, SectionHeading } from "@/components/site/marketing";
import { Container, Section } from "@/components/ui/layout";
import { getMarketingContext } from "@/server/marketing";
import { breadcrumbJsonLd, pageMetadata } from "@/server/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "How It Works",
    description: "What happens after you order registered agent service or Texas LLC formation, from checkout to documents in your account.",
    path: "/how-it-works",
  });
}

function Timeline({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <ol className="relative mt-8 space-y-8 border-l border-line-strong pl-8">
      {items.map((it, i) => (
        <li key={it.title} className="relative">
          <span className="absolute -left-[45px] inline-flex size-[26px] items-center justify-center rounded-full border border-line-strong bg-surface text-xs font-semibold text-brand">
            {i + 1}
          </span>
          <h3 className="font-sans text-base font-semibold">{it.title}</h3>
          <p className="mt-1 text-[15px] leading-relaxed text-muted">{it.body}</p>
        </li>
      ))}
    </ol>
  );
}

export default async function HowItWorksPage() {
  const c = await getMarketingContext();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "How It Works", path: "/how-it-works" }])} />
      <Section className="border-b border-line bg-surface pb-12">
        <Container>
          <SectionHeading
            eyebrow="How it works"
            title="What happens after you order"
            lead="Every order follows the same clear steps, and you can see where yours is at any time in your account."
          />
        </Container>
      </Section>

      <Section>
        <Container className="grid gap-14 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">Registered agent service</h2>
            <Timeline
              items={[
                { title: "Checkout", body: `Choose the business and pay ${c.raPrice} for the first year. You'll create an account if you don't have one.` },
                { title: "Onboarding", body: "Confirm your business details, addresses, and who we should notify when documents arrive." },
                { title: "Setup", body: "We set up your registered agent service. Your order status updates as each step is completed." },
                { title: "Your agent details", body: "Your account shows the registered agent name and address to use with the state." },
                { title: "Ongoing", body: "When documents arrive, they're uploaded to your account and you're notified by email." },
              ]}
            />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Texas LLC formation</h2>
            <Timeline
              items={[
                { title: "Checkout", body: `Pay the ${c.formationFee} service fee and ${c.stateFee} state filing fee, plus registered agent service if you add it.` },
                { title: "Your LLC details", body: "Answer questions about your LLC's name, management, members, and addresses." },
                { title: "Review and filing", body: "We review your answers and submit your Certificate of Formation to the Texas Secretary of State." },
                { title: "State processing", body: "The state reviews the filing. If anything needs your attention, we'll contact you." },
                { title: "Complete", body: "When the filing is approved, your filed documents are added to your account." },
              ]}
            />
          </div>
        </Container>
      </Section>

      <Section className="border-t border-line bg-surface">
        <Container className="grid gap-10 md:grid-cols-3">
          {[
            {
              title: "When documents arrive",
              body: "Service of process and state mail are scanned and uploaded to your account. We email you a notice, never the document itself.",
            },
            {
              title: "If we need more information",
              body: "We'll email you and show a clear request in your account, where you can reply and upload documents securely.",
            },
            {
              title: "Renewals and cancellation",
              body: "Annual services renew automatically, with reminders before each renewal. You can turn off auto-renewal from your account.",
            },
          ].map((b) => (
            <div key={b.title}>
              <h2 className="font-sans text-lg font-semibold">{b.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{b.body}</p>
            </div>
          ))}
        </Container>
      </Section>

      <CtaBand
        title="Get started today"
        body="Most customers finish checkout and onboarding in under ten minutes."
        primary={{ href: "/order/registered-agent", label: "Get registered agent service" }}
        secondary={{ href: "/start-an-llc", label: "Start a Texas LLC" }}
      />
    </>
  );
}
