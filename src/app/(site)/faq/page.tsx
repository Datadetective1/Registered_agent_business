import { JsonLd } from "@/components/site/json-ld";
import { FaqList, SectionHeading } from "@/components/site/marketing";
import { Container, Section } from "@/components/ui/layout";
import { allFaqs, faqGroups } from "@/content/faq";
import { getMarketingContext } from "@/server/marketing";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata } from "@/server/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "Frequently Asked Questions",
    description: "Answers about registered agents, Texas LLC formation, pricing, renewals and how documents are delivered.",
    path: "/faq",
  });
}

export default async function FaqPage() {
  const c = await getMarketingContext();
  const groups = faqGroups(c);
  return (
    <>
      <JsonLd data={faqJsonLd(allFaqs(c))} />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }])} />
      <Section className="border-b border-line bg-surface pb-12">
        <Container>
          <SectionHeading eyebrow="FAQ" title="Frequently asked questions" lead="Can't find what you're looking for? Contact us and we'll help." />
        </Container>
      </Section>
      <Section className="pt-10">
        <Container className="max-w-4xl space-y-12">
          {groups.map((g) => (
            <section key={g.title} aria-labelledby={`faq-${g.title}`}>
              <h2 id={`faq-${g.title}`} className="mb-4 text-2xl font-semibold">
                {g.title}
              </h2>
              <FaqList faqs={g.items} />
            </section>
          ))}
        </Container>
      </Section>
    </>
  );
}
