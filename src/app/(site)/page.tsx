import Link from "next/link";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand, FaqList, FeatureList, Hero, PriceCard, SectionHeading, Steps, TrustPoints } from "@/components/site/marketing";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { ArrowRightIcon, BuildingIcon, FileIcon, MailIcon, ShieldIcon } from "@/components/ui/icons";
import { findFaqs } from "@/content/faq";
import { getMarketingContext } from "@/server/marketing";
import { organizationJsonLd, pageMetadata } from "@/server/seo";

export async function generateMetadata() {
  const c = await getMarketingContext();
  return pageMetadata({
    title: `${c.brand}: Registered Agent Service & Texas LLC Formation`,
    absoluteTitle: true,
    description: `Registered agent service for ${c.raPrice}/year with documents delivered to your secure online account, plus Texas LLC formation with the state fee shown upfront.`,
    path: "/",
  });
}

export default async function HomePage() {
  const c = await getMarketingContext();
  const faqs = findFaqs(c, [
    "What is a registered agent?",
    "Can I be my own registered agent?",
    "How will I receive my documents?",
    "How much does it cost to form a Texas LLC?",
  ]);

  return (
    <>
      <JsonLd data={await organizationJsonLd()} />

      <Hero
        eyebrow="Registered agent · Texas LLC formation"
        title={<>Business compliance services, priced plainly.</>}
        lead={
          <p>
            {c.brand} receives legal papers and state correspondence for your business and delivers them to your secure online
            account. Registered agent service is {c.raPrice} per year. Texas LLC formation is {c.formationTotal}, including the
            state filing fee.
          </p>
        }
        actions={
          <>
            <ButtonLink href="/order/registered-agent" size="lg">
              Get registered agent service
            </ButtonLink>
            <ButtonLink href="/start-an-llc" size="lg" variant="secondary">
              Start a Texas LLC
            </ButtonLink>
          </>
        }
        aside={
          <PriceCard
            name="Registered Agent Service"
            price={c.raPrice}
            period="per year"
            features={(c.ra?.features ?? []).slice(0, 5)}
            cta={
              <ButtonLink href="/order/registered-agent" className="w-full">
                Get started
              </ButtonLink>
            }
            footnote="Renews annually. You can turn off auto-renewal at any time from your account."
          />
        }
      />

      <Container>
        <TrustPoints items={["Prices shown before checkout", "Documents delivered online, never by email attachment", "No long-term contract"]} />
      </Container>

      <Section>
        <Container>
          <SectionHeading eyebrow="Services" title="What we do" lead="A small set of services, done carefully. Each one has a clear price and a clear scope." />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <ServiceCard
              icon={<ShieldIcon />}
              title="Registered Agent"
              price={`${c.raPrice}/year`}
              body="We accept service of process and official state mail for your business, scan it, and post it to your secure online account."
              href="/registered-agent"
            />
            <ServiceCard
              icon={<BuildingIcon />}
              title="Texas LLC Formation"
              price={`${c.formationFee} + ${c.stateFee} state fee`}
              body="We prepare and file your Texas Certificate of Formation based on your answers, and deliver the filed documents to your account."
              href="/start-an-llc"
            />
            <ServiceCard
              icon={<MailIcon />}
              title="Business Address"
              price={c.addressActive && c.address ? "See pricing" : "Coming soon"}
              body="A business mailing address for everyday mail. This is a separate service from your registered agent address."
              href="/business-address"
            />
          </div>
        </Container>
      </Section>

      <Section className="border-y border-line bg-surface">
        <Container>
          <SectionHeading eyebrow="How it works" title="From checkout to compliant in four steps" />
          <div className="mt-10">
            <Steps
              steps={[
                { title: "Choose a service", body: "See the full price, including any state fees, before you pay." },
                { title: "Pay securely", body: "Checkout is handled by Stripe. We never see your full card number." },
                { title: "Tell us about your business", body: "A short form collects exactly what's needed to set up your service." },
                { title: "Track it in your account", body: "Follow your order status and download documents as they arrive." },
              ]}
            />
          </div>
          <p className="mt-8">
            <Link href="/how-it-works" className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
              Read the full process <ArrowRightIcon size={16} />
            </Link>
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHeading
              eyebrow="When a document arrives"
              title="Important documents reach you quickly and securely"
              lead="Legal papers often come with deadlines. Our process is built to get them in front of you quickly and securely."
            />
            <div className="mt-8">
              <FeatureList
                items={[
                  "The document is received at your registered office",
                  "It's scanned and uploaded to your account",
                  "We email you that a new document is waiting",
                  "You sign in to view and download it",
                ]}
              />
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <span className="inline-flex size-10 items-center justify-center rounded-md bg-info-bg text-info-fg">
                <FileIcon />
              </span>
              <div>
                <p className="text-sm font-semibold">Service of process</p>
                <p className="text-sm text-muted">Example notification</p>
              </div>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              &ldquo;A new document has been added to your account for <span className="text-ink">Lone Star Example LLC</span>.
              Legal and government documents can have response deadlines. Please review it promptly.&rdquo;
            </p>
            <p className="mt-4 text-xs text-subtle">Illustration only. Documents are never attached to emails.</p>
          </div>
        </Container>
      </Section>

      <Section className="border-t border-line bg-surface">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading title="Common questions" lead={<>Straight answers. More in our <Link href="/faq" className="text-brand underline underline-offset-2">FAQ</Link>.</>} />
          <FaqList faqs={faqs} />
        </Container>
      </Section>

      <CtaBand
        title="Ready when you are"
        body={`Registered agent service is ${c.raPrice} per year. Setup takes about five minutes.`}
        primary={{ href: "/order/registered-agent", label: "Get registered agent service" }}
        secondary={{ href: "/pricing", label: "See all pricing" }}
      />
    </>
  );
}

function ServiceCard({ icon, title, price, body, href }: { icon: React.ReactNode; title: string; price: string; body: string; href: string }) {
  return (
    <Link href={href} className="group flex flex-col rounded-lg border border-line bg-surface p-6 transition-colors hover:border-line-strong">
      <span className="inline-flex size-10 items-center justify-center rounded-md bg-sand text-brand">{icon}</span>
      <h3 className="mt-5 font-sans text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm font-medium text-accent">{price}</p>
      <p className="mt-3 flex-1 text-[15px] leading-relaxed text-muted">{body}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand">
        Learn more <ArrowRightIcon size={16} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
