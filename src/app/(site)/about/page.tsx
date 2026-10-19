import { JsonLd } from "@/components/site/json-ld";
import { SectionHeading } from "@/components/site/marketing";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { getMarketingContext } from "@/server/marketing";
import { breadcrumbJsonLd, organizationJsonLd, pageMetadata } from "@/server/seo";

export async function generateMetadata() {
  const c = await getMarketingContext();
  return pageMetadata({
    title: `About ${c.brand}`,
    description: `${c.brand} provides registered agent service and Texas LLC formation with clear pricing and secure online document delivery.`,
    path: "/about",
  });
}

export default async function AboutPage() {
  const c = await getMarketingContext();
  const principles = [
    { title: "Clear prices", body: "Every fee is listed before checkout. Government fees are shown separately and passed through at cost." },
    { title: "Careful handling", body: "Legal papers can carry deadlines. We treat every document as time-sensitive and notify you as soon as it's in your account." },
    { title: "Plain language", body: "We explain what a service does and doesn't include, so you can make an informed decision." },
    { title: "Honest limits", body: "We're not a law firm and don't give legal advice. When you need an attorney, we'll say so." },
  ];
  return (
    <>
      <JsonLd data={await organizationJsonLd()} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "About", path: "/about" }])} />
      <Section className="border-b border-line bg-surface">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="About us" title={`About ${c.brand}`} />
          <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-muted">
            <p>
              {c.brand} helps small business owners meet a few essential legal requirements: keeping a registered agent on file and
              forming a company correctly. We focus on doing these well, with prices you can see upfront and an online account that
              shows exactly where things stand.
            </p>
            <p>
              Registered agent coverage is provided in partnership with an established nationwide commercial registered agent, which
              maintains the in-state offices where legal papers are received. We manage your account, your orders and your
              documents, and we&apos;re your point of contact for support.
            </p>
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <h2 className="text-2xl font-semibold">How we work</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map((p) => (
              <div key={p.title} className="rounded-lg border border-line bg-surface p-5">
                <h3 className="font-sans text-base font-semibold">{p.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 rounded-lg border border-line bg-surface p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <h2 className="font-sans text-lg font-semibold">Talk to us</h2>
              <p className="mt-1 text-[15px] text-muted">
                {c.s.contact.supportEmail}
                {c.s.contact.supportPhone ? ` · ${c.s.contact.supportPhone}` : ""} · {c.s.contact.supportHours}
              </p>
            </div>
            <ButtonLink href="/contact" variant="secondary" className="mt-4 sm:mt-0">
              Contact us
            </ButtonLink>
          </div>
        </Container>
      </Section>
    </>
  );
}
