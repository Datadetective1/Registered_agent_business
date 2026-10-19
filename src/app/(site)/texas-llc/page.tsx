import Link from "next/link";
import { JsonLd } from "@/components/site/json-ld";
import { CtaBand, FeatureList, SectionHeading } from "@/components/site/marketing";
import { TrackEvent } from "@/components/site/track-event";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow, Section } from "@/components/ui/layout";
import { getMarketingContext } from "@/server/marketing";
import { appUrl } from "@/server/env";
import { breadcrumbJsonLd, pageMetadata } from "@/server/seo";

export async function generateMetadata() {
  const c = await getMarketingContext();
  return pageMetadata({
    title: "Texas LLC: Requirements, Costs and How to Form One",
    description: `What Texas requires to form an LLC, what it costs (the state filing fee is ${c.stateFee}), and what to do after you file, including franchise tax reports and an EIN.`,
    path: "/texas-llc",
    type: "article",
  });
}

// Facts verified 2026-10-19 against the Texas SOS (Form 205 instructions, Registered Agents FAQ),
// the Texas Comptroller (franchise tax) and the IRS (EIN). Re-verify at least yearly.
const SOURCES = [
  { label: "Texas SOS: Form 205 instructions", href: "https://www.sos.state.tx.us/corp/instructions/205.shtml" },
  { label: "Texas SOS: Registered Agents FAQs", href: "https://www.sos.state.tx.us/corp/registeredagentfaqs.shtml" },
  { label: "Texas Comptroller: Franchise Tax", href: "https://comptroller.texas.gov/taxes/franchise/" },
  { label: "IRS: Get an Employer Identification Number", href: "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number" },
];

export default async function TexasLlcGuidePage() {
  const c = await getMarketingContext();
  const updated = "October 2026";
  return (
    <>
      <TrackEvent name="formation_page_viewed" />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Texas LLC: requirements, costs and how to form one",
          dateModified: "2026-10-19",
          mainEntityOfPage: `${appUrl()}/texas-llc`,
          publisher: { "@type": "Organization", name: c.brand },
        }}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Texas LLC", path: "/texas-llc" }])} />

      <Section className="border-b border-line bg-surface pb-12">
        <Container className="max-w-3xl">
          <Eyebrow>Texas LLC guide</Eyebrow>
          <h1 className="mt-3 text-[2.1rem] font-semibold leading-tight sm:text-5xl">Texas LLC: requirements, costs and how to form one</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            A limited liability company (LLC) is one of the most common ways to set up a small business in Texas. Here&apos;s what the state
            requires, what it costs, and what comes after you file, in plain English.
          </p>
          <p className="mt-4 text-sm text-muted">Updated {updated}. General information, not legal or tax advice.</p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl space-y-12">
          <section>
            <h2 className="text-2xl font-semibold">What Texas requires to form an LLC</h2>
            <FeatureList
              className="mt-5"
              items={[
                "A name that's distinguishable from names already on file, ending with an LLC designator such as “LLC” or “Limited Liability Company”.",
                "A registered agent with a street address in Texas, available during business hours to accept legal papers. A P.O. box doesn't qualify.",
                "A Certificate of Formation (Form 205) filed with the Texas Secretary of State.",
                "A management choice: member-managed (owners run it) or manager-managed, and the names and addresses of the members or managers.",
                "An organizer: the person who signs and submits the filing.",
              ]}
            />
          </section>

          <section>
            <h2 className="text-2xl font-semibold">What it costs</h2>
            <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[480px] text-left text-[15px]">
                <tbody>
                  <tr className="border-b border-line">
                    <th scope="row" className="px-4 py-3 font-medium">Texas filing fee (Certificate of Formation)</th>
                    <td className="px-4 py-3 tabular-nums">{c.stateFee}</td>
                    <td className="px-4 py-3 text-sm text-muted">Required. Paid to the state.</td>
                  </tr>
                  <tr className="border-b border-line">
                    <th scope="row" className="px-4 py-3 font-medium">Registered agent</th>
                    <td className="px-4 py-3 tabular-nums">$0–{c.raPrice}/yr</td>
                    <td className="px-4 py-3 text-sm text-muted">Free if you serve as your own; {c.raPrice}/year with us.</td>
                  </tr>
                  <tr className="border-b border-line">
                    <th scope="row" className="px-4 py-3 font-medium">Formation service (optional)</th>
                    <td className="px-4 py-3 tabular-nums">{c.formationFee}</td>
                    <td className="px-4 py-3 text-sm text-muted">Our fee to prepare and file it for you.</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-4 py-3 font-medium">EIN from the IRS</th>
                    <td className="px-4 py-3 tabular-nums">$0</td>
                    <td className="px-4 py-3 text-sm text-muted">The IRS issues EINs for free.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">How to form a Texas LLC</h2>
            <ol className="mt-5 list-decimal space-y-3 pl-6 text-[16px] leading-relaxed">
              <li>Choose a name and confirm it&apos;s available.</li>
              <li>Choose a registered agent: yourself, someone you trust, or a registered agent service.</li>
              <li>Decide whether the LLC will be member-managed or manager-managed.</li>
              <li>File the Certificate of Formation with the Texas Secretary of State and pay the filing fee.</li>
              <li>After approval, get an EIN, write a company agreement, and open a business bank account.</li>
            </ol>
            <p className="mt-4 text-[15px] text-muted">
              You can file it yourself through the Secretary of State, or{" "}
              <Link href="/start-an-llc-texas" className="text-brand underline underline-offset-2">
                have us prepare and file it
              </Link>{" "}
              for a {c.formationFee} service fee plus the state fee.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">After you form your LLC</h2>
            <FeatureList
              className="mt-5"
              items={[
                "Get an EIN (employer identification number) from the IRS. It's free.",
                "Write a company agreement (operating agreement). Texas doesn't require you to file it with the state, but it sets out how the LLC is run.",
                "File the annual Texas franchise tax report, due May 15. Businesses at or below the no-tax-due threshold file a Public Information Report or Ownership Information Report instead of paying tax.",
                "Keep a registered agent on file at all times, and update the state if it changes.",
                "Check for city, county or industry licenses and permits that apply to your business.",
              ]}
            />
          </section>

          <section className="rounded-lg border border-line bg-surface p-6">
            <h2 className="font-sans text-lg font-semibold">Ready to start?</h2>
            <p className="mt-1 text-[15px] text-muted">
              We&apos;ll file your Texas LLC and can serve as your registered agent in the same order. Every fee is shown before you pay.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink href="/start-an-llc-texas">Start a Texas LLC</ButtonLink>
              <ButtonLink href="/texas-registered-agent" variant="secondary">
                Texas registered agent
              </ButtonLink>
            </div>
          </section>

          <section>
            <SectionHeading title="Sources" />
            <ul className="mt-3 space-y-1.5 text-[15px]">
              {SOURCES.map((s) => (
                <li key={s.href}>
                  <a href={s.href} className="text-brand underline underline-offset-2" rel="noopener noreferrer" target="_blank">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </Container>
      </Section>

      <CtaBand
        title="Form your Texas LLC with us"
        body={`${c.formationFee} service fee + ${c.stateFee} state filing fee. Registered agent service ${c.raPrice}/year, optional.`}
        primary={{ href: "/start-an-llc-texas", label: "See how it works" }}
      />
    </>
  );
}
