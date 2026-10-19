import { SectionHeading } from "@/components/site/marketing";
import { Container, Section } from "@/components/ui/layout";
import { getOptionalSession } from "@/server/auth/guards";
import { getSettings } from "@/server/settings";
import { pageMetadata } from "@/server/seo";
import { ContactForm } from "./contact-form";

export async function generateMetadata() {
  return pageMetadata({
    title: "Contact Us",
    description: "Questions about registered agent service, Texas LLC formation, or your account? Send us a message.",
    path: "/contact",
  });
}

const TOPICS: Record<string, { category: string; subject: string }> = {
  "business-address": { category: "sales", subject: "Business address service" },
  pricing: { category: "sales", subject: "Pricing question" },
  "registered-agent": { category: "registered_agent", subject: "Registered agent question" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const [{ topic }, s, session] = await Promise.all([searchParams, getSettings(), getOptionalSession()]);
  const preset = topic ? TOPICS[topic] : undefined;
  const c = session?.customer;
  return (
    <Section>
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionHeading eyebrow="Contact" title="How can we help?" lead="Send us a message and we'll reply by email, usually within one business day." />
          <dl className="mt-8 space-y-4 text-[15px]">
            <div>
              <dt className="text-sm text-muted">Email</dt>
              <dd>
                <a className="text-brand hover:underline" href={`mailto:${s.contact.supportEmail}`}>
                  {s.contact.supportEmail}
                </a>
              </dd>
            </div>
            {s.contact.supportPhone ? (
              <div>
                <dt className="text-sm text-muted">Phone</dt>
                <dd>{s.contact.supportPhone}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm text-muted">Hours</dt>
              <dd>{s.contact.supportHours}</dd>
            </div>
          </dl>
          <p className="mt-8 rounded-md border border-line bg-surface p-4 text-sm leading-relaxed text-muted">
            We can&apos;t provide legal advice. If you&apos;ve been served with a lawsuit or legal notice, please contact a licensed
            attorney promptly.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
          <ContactForm
            defaults={{
              name: c ? `${c.firstName} ${c.lastName}` : undefined,
              email: c?.email,
              category: preset?.category,
              subject: preset?.subject,
            }}
          />
        </div>
      </Container>
    </Section>
  );
}
