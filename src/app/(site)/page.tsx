import Link from "next/link";
import { JsonLd } from "@/components/site/json-ld";
import { BenefitStrip, CtaBand, FaqList, FeatureList, InfoCards, PriceCard, SectionHeading, Steps } from "@/components/site/marketing";
import { TrackEvent } from "@/components/site/track-event";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow, Section } from "@/components/ui/layout";
import {
  ArrowRightIcon,
  BellIcon,
  BuildingIcon,
  CalendarIcon,
  ChatIcon,
  CheckIcon,
  FileIcon,
  GlobeIcon,
  LockIcon,
  MailIcon,
  ScaleIcon,
  ShieldIcon,
  TagIcon,
} from "@/components/ui/icons";
import { findFaqs } from "@/content/faq";
import { getMarketingContext } from "@/server/marketing";
import { organizationJsonLd, pageMetadata, serviceJsonLd } from "@/server/seo";

export async function generateMetadata() {
  const c = await getMarketingContext();
  return pageMetadata({
    title: `Registered Agent Service for ${c.raPrice}/Year | ${c.brand}`,
    absoluteTitle: true,
    description: `Registered agent service for ${c.raPrice} per year with no setup or monthly fees. We receive legal papers and state notices for your business and deliver them to your secure online account.`,
    path: "/",
  });
}

export default async function HomePage() {
  const c = await getMarketingContext();
  const faqs = findFaqs(c, [
    "What is a registered agent?",
    "Does my business need a registered agent?",
    "Can I use the registered agent address as my business address?",
    "Who is listed as the registered agent on state records?",
    "How does renewal work?",
    "I already have a registered agent. How do I switch?",
  ]);
  const coverage = c.raNationwide ? "Coverage in all 50 states" : `Available in ${c.raCoverageLabel}`;

  return (
    <>
      <TrackEvent name="homepage_viewed" />
      <JsonLd data={await organizationJsonLd()} />
      <JsonLd
        data={await serviceJsonLd({ name: "Registered Agent Service", description: c.ra?.shortDescription ?? "", path: "/registered-agent", priceCents: c.raPriceCents, recurring: true })}
      />

      {/* 1. Hero: one offer, the price, one primary action. */}
      <div className="border-b border-line bg-surface">
        <Container className="grid gap-10 py-12 sm:py-20 lg:grid-cols-[1.25fr_0.75fr] lg:items-center lg:gap-16">
          <div>
            <Eyebrow>Registered agent service</Eyebrow>
            <h1 className="mt-3 text-[2.2rem] font-semibold leading-[1.1] sm:text-[3.25rem]">Reliable registered agent service for your business</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
              Stay compliant, keep your home address off the public registered agent record, and never miss a lawsuit or state notice. We receive them for
              you and deliver them to your secure online account.
            </p>
            <p className="mt-7 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-serif text-4xl font-semibold text-ink sm:text-5xl">{c.raPrice}</span>
              <span className="text-lg text-muted">per year</span>
              <span className="w-full text-sm text-muted sm:w-auto">No setup fee · No monthly fee</span>
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/order/registered-agent" size="lg" className="w-full sm:w-auto">
                Get registered agent service
              </ButtonLink>
              <Link href="/start-an-llc-texas" className="inline-flex items-center justify-center gap-1.5 py-2 text-[15px] font-medium text-brand hover:underline sm:justify-start">
                Forming a new Texas LLC? <ArrowRightIcon size={16} />
              </Link>
            </div>
            <ul className="mt-8 grid gap-2.5 text-[15px] text-ink sm:grid-cols-3 sm:gap-4">
              {[coverage, "Documents delivered online, with email alerts", "Transparent annual pricing"].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckIcon size={18} className="mt-0.5 shrink-0 text-accent" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <PriceCard
            name="Registered Agent Service"
            price={c.raPrice}
            period="per year"
            features={["Registered agent representation", "Service of process received for you", "State and government notices", "Digital documents + email alerts", "Secure online account"]}
            cta={
              <ButtonLink href="/order/registered-agent" className="w-full">
                Get started
              </ButtonLink>
            }
            footnote={c.renewalMessage}
          />
        </Container>
      </div>

      {/* 2. Trust / benefit strip. */}
      <Section className="py-10 sm:py-12">
        <Container>
          <BenefitStrip
            items={[
              { icon: <GlobeIcon size={18} />, title: c.raNationwide ? "Nationwide coverage" : "In-state coverage", body: c.raNationwide ? "Backed by an established registered agent network in every state." : `Available in ${c.raCoverageLabel}.` },
              { icon: <FileIcon size={18} />, title: "Digital delivery", body: "Documents are scanned to your account, never emailed as attachments." },
              { icon: <TagIcon size={18} />, title: "Clear annual price", body: `${c.raPrice} a year. No setup or monthly fees.` },
              { icon: <LockIcon size={18} />, title: "Private and secure", body: "Documents are only available after you sign in." },
            ]}
          />
        </Container>
      </Section>

      {/* 3. Why a registered agent. */}
      <Section className="border-y border-line bg-surface">
        <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionHeading
            eyebrow="New to this?"
            title="Why your business needs a registered agent"
            lead="When you form an LLC or corporation, the state requires you to name a registered agent: someone with an in-state street address who accepts legal papers and official notices for the business."
          />
          <ul className="space-y-5">
            {[
              { title: "It's required", body: "Texas and most other states require every LLC and corporation to keep a registered agent on file. Without one, a business can lose its good standing." },
              { title: "It's how you get served", body: "If your business is sued, the papers go to your registered agent. Missing them can mean a judgment you never had a chance to answer." },
              { title: "It keeps your address private", body: "The registered agent's address appears in public state records. Using a service means it's not your home address." },
            ].map((p) => (
              <li key={p.title} className="flex gap-3">
                <CheckIcon size={20} className="mt-1 shrink-0 text-accent" />
                <div>
                  <h3 className="font-sans text-base font-semibold">{p.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{p.body}</p>
                </div>
              </li>
            ))}
            <li>
              <Link href="/registered-agent" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-brand hover:underline">
                Learn more about registered agents <ArrowRightIcon size={16} />
              </Link>
            </li>
          </ul>
        </Container>
      </Section>

      {/* 4. What you receive. */}
      <Section>
        <Container>
          <SectionHeading eyebrow="What's included" title="Everything a registered agent should do, nothing you don't need" />
          <div className="mt-10">
            <InfoCards
              items={[
                { icon: <BuildingIcon />, title: "Registered agent address", body: "An in-state registered office address for your state filings. For legal papers and state notices only, not general mail." },
                { icon: <ScaleIcon />, title: "Service of process", body: "If your business is sued, the legal papers are accepted on its behalf during business hours." },
                { icon: <MailIcon />, title: "Government notices", body: "Official correspondence from the Secretary of State and other agencies is received for you." },
                { icon: <FileIcon />, title: "Digital document delivery", body: "Documents are scanned to your account, and we email you as soon as something arrives." },
                { icon: <LockIcon />, title: "Secure online account", body: "View documents, order status, renewal dates and receipts in one place." },
                { icon: <BellIcon />, title: "Renewal reminders", body: "We email you before your annual renewal, and you can turn off auto-renewal anytime." },
              ]}
            />
          </div>
        </Container>
      </Section>

      {/* 5. Pricing. */}
      <Section id="pricing" className="scroll-mt-20 border-y border-line bg-surface">
        <Container className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading eyebrow="Pricing" title="One simple annual price" lead="No setup fee, no monthly fee, and no surprise charges at checkout. You see the full price before you pay." />
            <FeatureList
              className="mt-6"
              items={[`${c.raPrice} per business, per year`, "No setup fee", "No monthly fee", "Turn off auto-renewal anytime from your account"]}
            />
            <p className="mt-6 text-sm text-muted">
              Forming a Texas LLC? Our service fee is {c.formationFee} plus the {c.stateFee} state filing fee.{" "}
              <Link href="/pricing" className="text-brand underline underline-offset-2">
                See all pricing
              </Link>
            </p>
          </div>
          <div className="rounded-xl border border-line bg-paper p-6 sm:p-8">
            <p className="text-sm font-semibold">Registered Agent Service</p>
            <dl className="mt-4 space-y-2 text-[15px]">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Registered agent service, 1 year</dt>
                <dd className="font-medium tabular-nums">{c.raPrice}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Setup fee</dt>
                <dd className="font-medium tabular-nums">$0</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-semibold">
                <dt>Total today</dt>
                <dd className="tabular-nums">{c.raPrice}</dd>
              </div>
            </dl>
            <ButtonLink href="/order/registered-agent" size="lg" className="mt-6 w-full">
              Get registered agent service
            </ButtonLink>
            <p className="mt-3 text-xs leading-relaxed text-muted">{c.renewalMessage}</p>
          </div>
        </Container>
      </Section>

      {/* 6. How it works. */}
      <Section>
        <Container>
          <SectionHeading eyebrow="How it works" title="Set up in a few minutes" />
          <div className="mt-10">
            <Steps
              steps={[
                { title: "Sign up", body: "Tell us about your company, create your account, and pay securely through Stripe." },
                { title: "We set up your service", body: "We confirm your details and set up your registered agent service. Your account shows the agent name and address to use with the state." },
                { title: "Receive documents online", body: "When legal papers or state notices arrive, they're scanned to your account and we email you." },
              ]}
            />
          </div>
        </Container>
      </Section>

      {/* 7. Formation cross-sell. */}
      <Section className="border-y border-line bg-surface">
        <Container className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <Eyebrow>Starting a business?</Eyebrow>
            <h2 className="mt-2 text-3xl font-semibold leading-tight">Haven&apos;t formed your business yet?</h2>
            <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">
              We can file your Texas LLC and serve as your registered agent in one order. You&apos;ll see our service fee, the state filing fee and
              registered agent service as separate lines before you pay.
            </p>
            <ButtonLink href="/start-an-llc-texas" size="lg" variant="secondary" className="mt-6">
              Start a Texas LLC
            </ButtonLink>
          </div>
          <dl className="space-y-2 rounded-xl border border-line bg-paper p-6 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Texas LLC formation service</dt>
              <dd className="font-medium tabular-nums">{c.formationFee}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Texas state filing fee</dt>
              <dd className="font-medium tabular-nums">{c.stateFee}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Registered agent, 1 year (optional)</dt>
              <dd className="font-medium tabular-nums">{c.raPrice}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold">
              <dt>Total with registered agent</dt>
              <dd className="tabular-nums">{c.formationWithRaTotal}</dd>
            </div>
          </dl>
        </Container>
      </Section>

      {/* 8. Trust and transparency: only claims that are true. */}
      <Section>
        <Container>
          <SectionHeading eyebrow="Our commitments" title="What you can count on" />
          <div className="mt-10">
            <InfoCards
              items={[
                { icon: <TagIcon />, title: "Transparent pricing", body: "Every fee is shown before checkout. Government fees are listed separately and passed through at cost." },
                { icon: <ShieldIcon />, title: "Established infrastructure", body: `Registered agent service is provided through ${c.agentOfRecord}, which is listed as the registered agent of record on state filings.` },
                { icon: <LockIcon />, title: "Secure document handling", body: "Documents are stored privately and only available after you sign in. Payments are processed by Stripe." },
                { icon: <ChatIcon />, title: "Real support", body: `Email ${c.s.contact.supportEmail}${c.s.contact.supportPhone ? ` or call ${c.s.contact.supportPhone}` : ""}. ${c.s.contact.supportHours}.` },
                { icon: <CalendarIcon />, title: "No long-term contract", body: "Service is billed yearly. Turn off auto-renewal from your account at any time." },
                {
                  icon: <FileIcon />,
                  title: "Clear policies",
                  body: (
                    <>
                      Read our{" "}
                      <Link href="/legal/registered-agent-terms" className="text-brand underline underline-offset-2">
                        service terms
                      </Link>{" "}
                      and{" "}
                      <Link href="/legal/refund-policy" className="text-brand underline underline-offset-2">
                        refund policy
                      </Link>{" "}
                      before you buy. We&apos;re not a law firm and don&apos;t give legal advice.
                    </>
                  ),
                },
              ]}
            />
          </div>
        </Container>
      </Section>

      {/* 9. FAQ. */}
      <Section className="border-t border-line bg-surface">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            title="Common questions"
            lead={
              <>
                Straight answers. More in our{" "}
                <Link href="/faq" className="text-brand underline underline-offset-2">
                  FAQ
                </Link>
                .
              </>
            }
          />
          <FaqList faqs={faqs} />
        </Container>
      </Section>

      {/* 10. Final CTA. */}
      <CtaBand
        title="Get your registered agent in minutes"
        body={`${c.raPrice} per year. No setup fee, no monthly fee.`}
        primary={{ href: "/order/registered-agent", label: "Get registered agent service" }}
        secondary={{ href: "/start-an-llc-texas", label: "Start a Texas LLC" }}
      />
    </>
  );
}
