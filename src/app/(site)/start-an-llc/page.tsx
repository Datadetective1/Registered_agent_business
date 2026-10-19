import { JsonLd } from "@/components/site/json-ld";
import { CtaBand, Disclosure, FaqList, FeatureList, Hero, PriceCard, SectionHeading, Steps } from "@/components/site/marketing";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { faqGroups } from "@/content/faq";
import { getMarketingContext } from "@/server/marketing";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, serviceJsonLd } from "@/server/seo";

export async function generateMetadata() {
  const c = await getMarketingContext();
  return pageMetadata({
    title: `Start a Texas LLC: ${c.formationFee} + State Fee`,
    description: `Form your Texas LLC for ${c.formationFee} plus the ${c.stateFee} Texas filing fee (${c.formationTotal} total). We prepare and file your Certificate of Formation and deliver the filed documents to your account.`,
    path: "/start-an-llc",
  });
}

export default async function StartAnLlcPage() {
  const c = await getMarketingContext();
  const faqs = [...faqGroups(c)[3].items, faqGroups(c)[2].items[1]];

  return (
    <>
      <JsonLd
        data={await serviceJsonLd({
          name: "Texas LLC Formation",
          description: c.formation?.shortDescription ?? "",
          path: "/start-an-llc",
          priceCents: c.formationFeeCents + c.stateFeeCents,
          areaServed: "Texas",
        })}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Start a Texas LLC", path: "/start-an-llc" }])} />
      <JsonLd data={faqJsonLd(faqs)} />

      <Hero
        eyebrow="Texas LLC formation"
        title="Start your Texas LLC with the full cost upfront"
        lead={
          <p>
            We prepare your Texas Certificate of Formation from your answers, file it with the Texas Secretary of State, and deliver
            the filed documents to your account. {c.formationFee} service fee plus the {c.stateFee} state filing fee, passed through
            at cost.
          </p>
        }
        actions={
          <ButtonLink href="/order/llc-formation" size="lg">
            Start my Texas LLC
          </ButtonLink>
        }
        aside={
          <PriceCard
            name="Texas LLC Formation"
            price={c.formationTotal}
            period="total due today"
            breakdown={[
              ["Our service fee", c.formationFee],
              [c.stateFeeLabel, c.stateFee],
            ]}
            cta={
              c.formationActive ? (
                <ButtonLink href="/order/llc-formation" className="w-full">
                  Start my LLC
                </ButtonLink>
              ) : (
                <p className="text-sm text-muted">Temporarily unavailable. Please contact us.</p>
              )
            }
            footnote={`Optional: add registered agent service for ${c.raPrice}/year at checkout (${c.formationWithRaTotal} total today).`}
          />
        }
      />

      <Section>
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading title="What's included" />
            <FeatureList className="mt-6" items={c.formation?.features ?? []} />
          </div>
          <div>
            <SectionHeading title="What you'll need" lead="Have these ready and the form takes about ten minutes." />
            <FeatureList
              className="mt-6"
              items={[
                "Your LLC's name and a backup name",
                "Whether it will be member-managed or manager-managed",
                "Names and addresses of the members or managers",
                "The organizer's name and address (usually you)",
                "A business address",
                "A registered agent: us, or someone you designate",
              ]}
            />
          </div>
        </Container>
      </Section>

      <Section className="border-y border-line bg-surface">
        <Container>
          <SectionHeading eyebrow="The process" title="How Texas LLC formation works" />
          <div className="mt-10">
            <Steps
              steps={[
                { title: "Check out", body: "Pay the service fee and state filing fee. Add registered agent service if you'd like." },
                { title: "Answer a few questions", body: "Tell us about your LLC's name, management and members." },
                { title: "We prepare and file", body: "We review your answers and submit your Certificate of Formation to the state." },
                { title: "Receive your documents", body: "When the state approves the filing, the filed documents appear in your account." },
              ]}
            />
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted">
            State processing times vary throughout the year and are outside our control. We update your order status at every step,
            so you always know where things stand.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <SectionHeading title="Texas LLC questions" />
            <Disclosure title="We're a filing service, not a law firm">
              We prepare and submit filings based on the information you provide. We don&apos;t give legal or tax advice about how
              to structure your business. After formation, ongoing obligations such as Texas franchise tax reports remain your
              responsibility.
            </Disclosure>
          </div>
          <FaqList faqs={faqs} />
        </Container>
      </Section>

      <CtaBand
        title="Form your Texas LLC"
        body={`${c.formationTotal} total, including the Texas filing fee. No surprise charges at checkout.`}
        primary={{ href: "/order/llc-formation", label: "Start my Texas LLC" }}
      />
    </>
  );
}
