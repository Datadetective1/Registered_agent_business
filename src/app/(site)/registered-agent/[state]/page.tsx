import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand, Disclosure, FaqList, FeatureList, Hero, PriceCard, SectionHeading } from "@/components/site/marketing";
import { TrackEvent } from "@/components/site/track-event";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { stateBySlug, statePagePath } from "@/config/states";
import { findFaqs } from "@/content/faq";
import { STATE_CONTENT } from "@/content/states";
import { getMarketingContext } from "@/server/marketing";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata, serviceJsonLd } from "@/server/seo";

async function load(slug: string) {
  const st = stateBySlug(slug);
  if (!st) return null;
  const c = await getMarketingContext();
  const content = STATE_CONTENT[st.code];
  if (!content || !c.raStates.includes(st.code)) return null;
  return { st, c, content };
}

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  const data = await load((await params).state);
  if (!data) return {};
  const { st, c } = data;
  return pageMetadata({
    title: `${st.name} Registered Agent: ${c.raPrice}/Year, No Setup Fee`,
    description: `${st.name} registered agent service for ${c.raPrice} per year. ${st.name} requirements, how to appoint or change your agent, and how documents are delivered.`,
    path: statePagePath(st.slug),
  });
}

export default async function StatePage({ params }: { params: Promise<{ state: string }> }) {
  const data = await load((await params).state);
  if (!data) notFound();
  const { st, c, content } = data;
  const faqs = findFaqs(c, [
    "Can I be my own registered agent?",
    "I already have a registered agent. How do I switch?",
    "Can I use the registered agent address as my business address?",
    "Who is listed as the registered agent on state records?",
    "How much does registered agent service cost?",
  ]);

  return (
    <>
      <TrackEvent name="registered_agent_page_viewed" />
      <JsonLd
        data={await serviceJsonLd({
          name: `${st.name} Registered Agent Service`,
          description: content.intro,
          path: statePagePath(st.slug),
          priceCents: c.raPriceCents,
          areaServed: st.name,
          recurring: true,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Registered Agent", path: "/registered-agent" },
          { name: st.name, path: statePagePath(st.slug) },
        ])}
      />
      <JsonLd data={faqJsonLd(faqs)} />
      <Hero
        eyebrow={`${st.name} registered agent`}
        title={`${st.name} registered agent service`}
        lead={<p>{content.intro}</p>}
        actions={
          <ButtonLink href={`/order/registered-agent?state=${st.code}`} size="lg">
            Get {st.name} registered agent service
          </ButtonLink>
        }
        aside={
          <PriceCard
            name={`${st.name} Registered Agent`}
            price={c.raPrice}
            period="per year"
            features={(c.ra?.features ?? []).slice(0, 5)}
            cta={
              <ButtonLink href={`/order/registered-agent?state=${st.code}`} className="w-full">
                Get started
              </ButtonLink>
            }
          />
        }
      />
      <Section>
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading title={`${st.name} requirements`} />
            <FeatureList className="mt-6" items={content.requirements} />
          </div>
          <div>
            <SectionHeading title="Appointing or changing your agent" />
            <FeatureList className="mt-6" items={content.appointing} />
            <div className="mt-8">
              <Disclosure title="Registered agent address only">
                Our registered agent address is only for legal papers and official state notices. Don&apos;t use it for banking, marketplace
                accounts, insurance, Google Business Profile verification or general mail.
              </Disclosure>
            </div>
          </div>
        </Container>
      </Section>
      <Section className="border-t border-line bg-surface">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading title="Common questions" />
            <p className="mt-4 text-sm text-muted">
              Sources:{" "}
              {content.sources.map((s, i) => (
                <span key={s.href}>
                  {i ? ", " : ""}
                  <a href={s.href} className="underline underline-offset-2" rel="noopener noreferrer" target="_blank">
                    {s.label}
                  </a>
                </span>
              ))}
              . This page is general information, not legal advice. See also{" "}
              <Link href="/start-an-llc-texas" className="underline underline-offset-2">
                forming a Texas LLC
              </Link>
              .
            </p>
          </div>
          <FaqList faqs={faqs} />
        </Container>
      </Section>
      <CtaBand
        title={`${st.name} registered agent service`}
        body={`${c.raPrice} per year. Documents delivered to your secure online account.`}
        primary={{ href: `/order/registered-agent?state=${st.code}`, label: "Get started" }}
      />
    </>
  );
}
