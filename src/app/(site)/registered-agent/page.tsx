import Link from "next/link";
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
    title: `Registered Agent Service: ${c.raPrice}/year`,
    description: `Registered agent service for ${c.raPrice} per year. We receive service of process and state correspondence for your business and deliver it to your secure online account.`,
    path: "/registered-agent",
  });
}

export default async function RegisteredAgentPage() {
  const c = await getMarketingContext();
  const faqs = faqGroups(c)[0].items.concat(faqGroups(c)[2].items.slice(0, 4));

  return (
    <>
      <JsonLd
        data={await serviceJsonLd({
          name: "Registered Agent Service",
          description: c.ra?.shortDescription ?? "",
          path: "/registered-agent",
          priceCents: c.raPriceCents,
          recurring: true,
        })}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Registered Agent", path: "/registered-agent" }])} />
      <JsonLd data={faqJsonLd(faqs)} />

      <Hero
        eyebrow="Registered agent service"
        title="A dependable registered agent for your business"
        lead={
          <p>
            We accept legal papers and official state mail on behalf of your business, scan them, and deliver them to your secure
            online account, with an email alert each time. {c.raPrice} per year, renewing annually.
          </p>
        }
        actions={
          <>
            <ButtonLink href="/order/registered-agent" size="lg">
              Get started for {c.raPrice}/year
            </ButtonLink>
            <ButtonLink href="#how-switching-works" size="lg" variant="secondary">
              How switching works
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
            footnote={`Currently available for businesses registered in: ${c.raStatesLabel || "—"}.`}
          />
        }
      />

      <Section>
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              title="What a registered agent does"
              lead="Most states require every LLC and corporation to name a registered agent: a person or company with a physical address in the state that accepts legal papers and official notices for the business."
            />
            <div className="mt-6 space-y-4 text-[16px] leading-relaxed text-muted">
              <p>
                When someone sues a business, the papers are delivered (&ldquo;served&rdquo;) to its registered agent. The state also
                sends important notices there. If those documents are missed, a business can lose its good standing or face a
                judgment it never had a chance to respond to.
              </p>
              <p>
                Using a registered agent service means you don&apos;t need to be at a fixed address during business hours, your
                own address isn&apos;t listed as your registered office, and legal papers don&apos;t arrive at your home or in front
                of customers.
              </p>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-lg border border-line bg-surface p-6">
              <h3 className="font-sans text-base font-semibold">Included with your service</h3>
              <FeatureList className="mt-4" items={c.ra?.features ?? []} />
            </div>
            <Disclosure title="The registered agent address is not a general mailing address">
              Our registered agent address is for service of process and official correspondence from the Secretary of State
              and other government agencies only. Please don&apos;t use it for everyday business mail, banking, packages, or as your
              principal office. Need a mailing address? See our{" "}
              <Link href="/business-address" className="text-brand underline underline-offset-2">
                Business Address service
              </Link>
              .
            </Disclosure>
          </div>
        </Container>
      </Section>

      <Section id="how-switching-works" className="scroll-mt-20 border-y border-line bg-surface">
        <Container>
          <SectionHeading
            eyebrow="Getting started"
            title="Setting up or switching your registered agent"
            lead="Whether your business is new or already has an agent, setup is straightforward."
          />
          <div className="mt-10">
            <Steps
              steps={[
                { title: "Purchase service", body: `${c.raPrice} per year. Choose the business it's for at checkout.` },
                { title: "Complete onboarding", body: "Confirm your business details and who we should notify when documents arrive." },
                { title: "Get your agent details", body: "Your account shows the exact registered agent name and address to use." },
                {
                  title: "Update the state, if switching",
                  body: "Existing businesses file a change of registered agent with the state. Your previous agent stays on record until it's accepted.",
                },
              ]}
            />
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted">
            {c.brand} provides registered agent service in partnership with a nationwide commercial registered agent. Depending
            on your state, our partner may be listed as the registered agent of record. Your account always shows the exact name
            and address to use on state filings.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading title="Questions about registered agents" />
            <p className="mt-4 text-[15px] text-muted">
              Coverage today: {c.raStatesLabel || "—"}.{" "}
              <Link href="/registered-agent/states" className="text-brand underline underline-offset-2">
                See all states
              </Link>
              .
            </p>
          </div>
          <FaqList faqs={faqs} />
        </Container>
      </Section>

      <CtaBand
        title="Keep your business in good standing"
        body={`Registered agent service for ${c.raPrice} per year. Turn off auto-renewal anytime.`}
        primary={{ href: "/order/registered-agent", label: "Get registered agent service" }}
      />
    </>
  );
}
