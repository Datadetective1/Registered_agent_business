import { JsonLd } from "@/components/site/json-ld";
import { Disclosure, FeatureList, Hero, PriceCard, SectionHeading } from "@/components/site/marketing";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { formatMoney } from "@/lib/money";
import { getMarketingContext } from "@/server/marketing";
import { breadcrumbJsonLd, pageMetadata } from "@/server/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "Business Address & Mail Service",
    description:
      "A business mailing address for everyday mail, separate from your registered agent address. Learn the difference and how the service works.",
    path: "/business-address",
  });
}

const COMPARISON: Array<[string, string, string]> = [
  ["Purpose", "Receive legal papers (service of process) and official state notices", "Receive everyday business mail"],
  ["Required by the state?", "Yes, for LLCs and corporations in most states", "No, it's optional"],
  ["Where it appears", "On your public state filings as your registered office", "Wherever you choose to use it"],
  ["Use for banking, vendors or customers?", "No", "Yes, where permitted by the institution"],
];

export default async function BusinessAddressPage() {
  const c = await getMarketingContext();
  const svc = c.address;
  const billingLabel = svc?.billing === "monthly" ? "per month" : "per year";

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Business Address", path: "/business-address" }])} />
      <Hero
        eyebrow="Business address & mail"
        title="A business mailing address, separate from your registered agent"
        lead={
          <p>
            A business address gives you a place to receive everyday business mail. It is a different service from registered agent
            service, and it is not used for service of process.
          </p>
        }
        aside={
          c.addressActive && svc ? (
            <PriceCard
              name={svc.name}
              price={formatMoney(svc.priceCents)}
              period={billingLabel}
              features={svc.features}
              cta={
                <ButtonLink href="/order/business-address" className="w-full">
                  Get a business address
                </ButtonLink>
              }
            />
          ) : (
            <div className="rounded-xl border border-line bg-paper p-6 sm:p-7">
              <p className="text-sm font-semibold">Not yet available</p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                We&apos;re finalizing this service and will publish full details and pricing before it launches. Contact us if
                you&apos;d like to be notified.
              </p>
              <ButtonLink href="/contact?topic=business-address" variant="secondary" className="mt-5 w-full">
                Notify me
              </ButtonLink>
            </div>
          )
        }
      />

      <Section>
        <Container>
          <SectionHeading title="Registered agent address vs. business address" lead="They're easy to confuse. Here's how they differ." />
          <div className="mt-8 overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[600px] border-collapse text-left text-[15px]">
              <thead>
                <tr className="bg-sand">
                  <th scope="col" className="w-1/4 px-5 py-3 text-sm font-semibold text-muted"></th>
                  <th scope="col" className="px-5 py-3 text-sm font-semibold">Registered agent address</th>
                  <th scope="col" className="px-5 py-3 text-sm font-semibold">Business address</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([label, ra, ba]) => (
                  <tr key={label} className="border-t border-line align-top">
                    <th scope="row" className="px-5 py-3.5 text-sm font-medium text-muted">
                      {label}
                    </th>
                    <td className="px-5 py-3.5">{ra}</td>
                    <td className="px-5 py-3.5">{ba}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      <Section className="border-t border-line bg-surface">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading title="What's included" />
            {c.addressActive && svc && svc.features.length > 0 ? (
              <FeatureList className="mt-6" items={svc.features} />
            ) : (
              <p className="mt-6 text-[16px] leading-relaxed text-muted">
                Service details will be listed here when the service launches. We only describe features that are available today.
              </p>
            )}
          </div>
          <Disclosure title="Identity verification may be required">
            Mail-receiving services in the United States generally require identity verification (for example, USPS Form 1583 and
            two forms of ID) before mail can be received on your behalf. We&apos;ll explain exactly what&apos;s needed during setup.
          </Disclosure>
        </Container>
      </Section>
    </>
  );
}
