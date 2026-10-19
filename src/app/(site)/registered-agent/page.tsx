import Link from "next/link";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand, Disclosure, FaqList, FeatureList, Hero, PriceCard, SectionHeading, Steps } from "@/components/site/marketing";
import { TrackEvent } from "@/components/site/track-event";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { findFaqs } from "@/content/faq";
import { getMarketingContext } from "@/server/marketing";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, serviceJsonLd } from "@/server/seo";

export async function generateMetadata() {
  const c = await getMarketingContext();
  return pageMetadata({
    title: `Registered Agent Service: ${c.raPrice}/Year, No Setup Fee`,
    description: `Registered agent service for ${c.raPrice} per year. We receive service of process and state notices for your business and deliver them to your secure online account. ${c.raNationwide ? "Available in all 50 states." : ""}`.trim(),
    path: "/registered-agent",
  });
}

export default async function RegisteredAgentPage() {
  const c = await getMarketingContext();
  const faqs = findFaqs(c, [
    "Does my business need a registered agent?",
    "Can I be my own registered agent?",
    "Can I use the registered agent address as my business address?",
    "Who is listed as the registered agent on state records?",
    "I already have a registered agent. How do I switch?",
    "How does renewal work?",
    "What happens if I turn off auto-renewal?",
    "Which states do you cover?",
  ]);

  return (
    <>
      <TrackEvent name="registered_agent_page_viewed" />
      <JsonLd
        data={await serviceJsonLd({ name: "Registered Agent Service", description: c.ra?.shortDescription ?? "", path: "/registered-agent", priceCents: c.raPriceCents, recurring: true })}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Registered Agent", path: "/registered-agent" }])} />
      <JsonLd data={faqJsonLd(faqs)} />

      <Hero
        eyebrow="Registered agent service"
        title="Registered agent service for one clear annual price"
        lead={
          <p>
            We accept legal papers and official state notices for your business, scan them, and deliver them to your secure online account
            with an email alert. {c.raPrice} per year, no setup fee, no monthly fee.
          </p>
        }
        actions={
          <>
            <ButtonLink href="/order/registered-agent" size="lg" className="w-full sm:w-auto">
              Get started for {c.raPrice}/year
            </ButtonLink>
            <ButtonLink href="#switching" size="lg" variant="secondary" className="w-full sm:w-auto">
              Switching agents?
            </ButtonLink>
          </>
        }
        aside={
          <PriceCard
            id="get-started"
            name="Registered Agent Service"
            price={c.raPrice}
            period="per year, per business"
            features={c.ra?.features ?? []}
            cta={
              c.raActive ? (
                <ButtonLink href="/order/registered-agent" className="w-full">
                  Get started
                </ButtonLink>
              ) : (
                <p className="text-sm text-muted">Temporarily unavailable. Please contact us.</p>
              )
            }
            footnote={c.renewalMessage}
          />
        }
      />

      <Section>
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              title="What a registered agent does"
              lead="States require every LLC and corporation to name a registered agent: a person or company with an in-state street address that accepts legal papers and official notices for the business."
            />
            <div className="mt-6 space-y-4 text-[16px] leading-relaxed text-muted">
              <p>
                When someone sues a business, the papers are delivered (&ldquo;served&rdquo;) to its registered agent. The state also sends
                important notices there. If those documents are missed, a business can lose its good standing or face a judgment it never had a
                chance to respond to.
              </p>
              <p>
                With a registered agent service, you don&apos;t need to be at a fixed address during business hours, your home address isn&apos;t
                the one on the registered agent record, and legal papers don&apos;t arrive at your home or in front of customers.
              </p>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-lg border border-line bg-surface p-6">
              <h3 className="font-sans text-base font-semibold">Included every year</h3>
              <FeatureList
                className="mt-4"
                items={[
                  "Registered agent representation in your state",
                  "Receipt of service of process",
                  "Receipt of qualifying state and government notices",
                  "Digital copies in your secure online account",
                  "Email alerts when documents arrive",
                  "Renewal reminders before each annual renewal",
                ]}
              />
            </div>
            <Disclosure title="The registered agent address is not a business mailing address">
              <p>
                It&apos;s only for legal papers and official government notices. Please don&apos;t use it for banking, Amazon or other marketplace
                accounts, insurance, Google Business Profile verification, licenses, packages, or everyday business mail.
              </p>
              <p className="mt-2">
                Need an address for those?{" "}
                <Link href="/business-address" className="text-brand underline underline-offset-2">
                  Business Address
                </Link>{" "}
                is a separate service.
              </p>
            </Disclosure>
          </div>
        </Container>
      </Section>

      <Section className="border-y border-line bg-surface">
        <Container>
          <SectionHeading eyebrow="How it works" title="What happens after you sign up" />
          <div className="mt-10">
            <Steps
              steps={[
                { title: "Sign up in minutes", body: "Tell us about your company, create your account and pay. No paperwork to print." },
                { title: "We set up your service", body: "We confirm your details and set up registered agent service. Your account then shows the agent name and address to use with the state." },
                { title: "Documents come to your account", body: "When legal papers or state notices arrive, they're scanned to your account and we email you right away." },
              ]}
            />
          </div>
        </Container>
      </Section>

      <Section id="switching" className="scroll-mt-20">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading title="Already have a registered agent?" />
            <p className="mt-4 text-[16px] leading-relaxed text-muted">{c.changeOfAgentMessage}</p>
            <p className="mt-3 text-[16px] leading-relaxed text-muted">Your current agent stays on record until the state accepts the change, so there&apos;s no gap in coverage.</p>
            <ButtonLink href="/order/registered-agent" variant="secondary" className="mt-6">
              Switch to {c.brand}
            </ButtonLink>
          </div>
          <div className="rounded-lg border border-line bg-surface p-6">
            <h3 className="font-sans text-base font-semibold">Who appears on state records</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {c.brand} provides registered agent service through {c.agentOfRecord}, which is the registered agent of record listed on state
              filings. Its in-state office is your business&apos;s registered office. You&apos;ll find the exact name and address to use in your
              account once your service is set up.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Coverage: {c.raNationwide ? "all 50 states" : c.raCoverageLabel}.{" "}
              <Link href="/registered-agent/states" className="text-brand underline underline-offset-2">
                See coverage by state
              </Link>
              .
            </p>
          </div>
        </Container>
      </Section>

      <Section className="border-t border-line bg-surface">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading title="Registered agent questions" />
          <FaqList faqs={faqs} />
        </Container>
      </Section>

      <CtaBand
        title="Keep your business in good standing"
        body={`Registered agent service for ${c.raPrice} per year. No setup fee, no monthly fee.`}
        primary={{ href: "/order/registered-agent", label: "Get registered agent service" }}
      />
    </>
  );
}
