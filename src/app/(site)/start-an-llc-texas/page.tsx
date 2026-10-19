import Link from "next/link";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand, Disclosure, FaqList, FeatureList, Hero, SectionHeading, Steps } from "@/components/site/marketing";
import { TrackEvent } from "@/components/site/track-event";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { findFaqs } from "@/content/faq";
import { getMarketingContext } from "@/server/marketing";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, serviceJsonLd } from "@/server/seo";

export async function generateMetadata() {
  const c = await getMarketingContext();
  return pageMetadata({
    title: `Start a Texas LLC: ${c.formationFee} + ${c.stateFee} State Fee`,
    description: `Form your Texas LLC for a ${c.formationFee} service fee plus the ${c.stateFee} Texas filing fee. We prepare and file your Certificate of Formation and deliver the filed documents to your account.`,
    path: "/start-an-llc-texas",
  });
}

export default async function StartTexasLlcPage() {
  const c = await getMarketingContext();
  const faqs = findFaqs(c, [
    "How much does it cost to form a Texas LLC?",
    "How long does it take to form a Texas LLC?",
    "What information do I need?",
    "Will you make sure my LLC name is available?",
    "Does my business need a registered agent?",
    "What is your refund policy?",
  ]);

  return (
    <>
      <TrackEvent name="formation_page_viewed" />
      <JsonLd
        data={await serviceJsonLd({
          name: "Texas LLC Formation",
          description: c.formation?.shortDescription ?? "",
          path: "/start-an-llc-texas",
          priceCents: c.formationFeeCents + c.stateFeeCents,
          areaServed: "Texas",
        })}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Start a Texas LLC", path: "/start-an-llc-texas" }])} />
      <JsonLd data={faqJsonLd(faqs)} />

      <Hero
        eyebrow="Texas LLC formation"
        title="Start your Texas LLC with every fee shown upfront"
        lead={
          <p>
            We prepare your Certificate of Formation, file it with the Texas Secretary of State, and deliver the filed documents to your
            account. Add registered agent service in the same order.
          </p>
        }
        actions={
          <ButtonLink href="/order/llc-formation" size="lg" className="w-full sm:w-auto">
            Start my Texas LLC
          </ButtonLink>
        }
        aside={
          <div className="rounded-xl border border-line bg-paper p-6 sm:p-7">
            <p className="text-sm font-semibold">What you&apos;ll pay</p>
            <dl className="mt-4 space-y-2.5 text-[15px]">
              <div className="flex justify-between gap-4">
                <dt>Our formation service fee</dt>
                <dd className="font-medium tabular-nums">{c.formationFee}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>
                  {c.stateFeeLabel}
                  <span className="block text-xs text-muted">Government fee, paid to the state at cost</span>
                </dt>
                <dd className="font-medium tabular-nums">{c.stateFee}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-2.5 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{c.formationTotal}</dd>
              </div>
              <div className="flex justify-between gap-4 pt-1 text-muted">
                <dt>Optional: registered agent, 1 year</dt>
                <dd className="tabular-nums">+ {c.raPrice}</dd>
              </div>
            </dl>
            {c.formationActive ? (
              <ButtonLink href="/order/llc-formation" className="mt-6 w-full">
                Start my LLC
              </ButtonLink>
            ) : (
              <p className="mt-6 text-sm text-muted">Temporarily unavailable. Please contact us.</p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted">The state filing fee is a government fee, not our revenue.</p>
          </div>
        }
      />

      <Section>
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading title="What's included" />
            <FeatureList className="mt-6" items={c.formation?.features ?? []} />
          </div>
          <div>
            <SectionHeading title="What we'll ask for" lead="Checkout takes a couple of minutes. You can pay first and give us the filing details right after." />
            <FeatureList
              className="mt-6"
              items={[
                "Your LLC's name (and a backup name)",
                "Member-managed or manager-managed",
                "Names and addresses of the members or managers",
                "A business address",
                "Your registered agent: us, or someone you designate",
              ]}
            />
          </div>
        </Container>
      </Section>

      <Section className="border-y border-line bg-surface">
        <Container>
          <SectionHeading eyebrow="The process" title="How it works" />
          <div className="mt-10">
            <Steps
              steps={[
                { title: "Check out", body: "Pay our service fee and the state fee, with registered agent service if you want it." },
                { title: "Tell us the details", body: "Answer a short form about your LLC's name, management and members." },
                { title: "We file and track it", body: "We submit your Certificate of Formation and update your order as the state processes it." },
                { title: "Get your documents", body: "When Texas approves the filing, the filed documents appear in your account." },
              ]}
            />
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted">
            State processing times vary through the year and are outside our control. You&apos;ll see your order&apos;s status in your account at
            every step.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <SectionHeading title="Texas LLC questions" />
            <Disclosure title="We're a filing service, not a law firm">
              We prepare and submit filings based on the information you provide, and don&apos;t give legal or tax advice. After formation,
              ongoing requirements such as Texas franchise tax reports remain your responsibility.{" "}
              <Link href="/texas-llc" className="text-brand underline underline-offset-2">
                Read our Texas LLC guide
              </Link>
              .
            </Disclosure>
          </div>
          <FaqList faqs={faqs} />
        </Container>
      </Section>

      <CtaBand
        title="Form your Texas LLC"
        body={`${c.formationFee} service fee + ${c.stateFee} state filing fee. Add registered agent service for ${c.raPrice}/year.`}
        primary={{ href: "/order/llc-formation", label: "Start my Texas LLC" }}
      />
    </>
  );
}
