import Link from "next/link";
import { JsonLd } from "@/components/site/json-ld";
import { FeatureList, SectionHeading } from "@/components/site/marketing";
import { TrackEvent } from "@/components/site/track-event";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { formatMoney } from "@/lib/money";
import { getMarketingContext } from "@/server/marketing";
import { breadcrumbJsonLd, pageMetadata } from "@/server/seo";

export async function generateMetadata() {
  const c = await getMarketingContext();
  return pageMetadata({
    title: "Pricing",
    description: `Registered agent service ${c.raPrice}/year. Texas LLC formation ${c.formationFee} plus the ${c.stateFee} state filing fee. Every price shown before checkout.`,
    path: "/pricing",
  });
}

export default async function PricingPage() {
  const c = await getMarketingContext();
  const addr = c.address;
  return (
    <>
      <TrackEvent name="pricing_viewed" />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }])} />
      <Section className="border-b border-line bg-surface pb-12 sm:pb-14">
        <Container>
          <SectionHeading
            eyebrow="Pricing"
            title="Simple prices, shown in full"
            lead="Our service fees and any government fees are listed separately, so you can see exactly what you're paying for."
          />
        </Container>
      </Section>

      <Section className="pt-10 sm:pt-14">
        <Container className="grid gap-6 lg:grid-cols-3">
          <PlanCard
            name="Registered Agent"
            price={c.raPrice}
            period="per year"
            description={c.ra?.shortDescription ?? ""}
            lines={[["Annual service", `${c.raPrice}/year`]]}
            features={c.ra?.features ?? []}
            cta={c.raActive ? { href: "/order/registered-agent", label: "Get started" } : null}
            note="Renews automatically each year. Turn off auto-renewal anytime."
          />
          <PlanCard
            name="Texas LLC Formation"
            price={c.formationTotal}
            period="one time"
            description={c.formation?.shortDescription ?? ""}
            lines={[
              ["Our service fee", c.formationFee],
              [c.stateFeeLabel, c.stateFee],
              ["Optional registered agent", `${c.raPrice}/year`],
            ]}
            features={c.formation?.features ?? []}
            cta={c.formationActive ? { href: "/order/llc-formation", label: "Start my LLC" } : null}
            note="The state filing fee is passed through at cost."
          />
          <PlanCard
            name="Business Address"
            price={c.addressActive && addr ? formatMoney(addr.priceCents) : "—"}
            period={c.addressActive && addr ? (addr.billing === "monthly" ? "per month" : "per year") : "coming soon"}
            description={addr?.shortDescription ?? ""}
            lines={[]}
            features={c.addressActive && addr ? addr.features : []}
            cta={c.addressActive ? { href: "/order/business-address", label: "Get started" } : { href: "/contact?topic=business-address", label: "Notify me" }}
            note="A separate service from your registered agent address."
          />
        </Container>
      </Section>

      <Section className="border-t border-line bg-surface">
        <Container className="grid items-start gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">Good to know</h2>
            <ul className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted">
              <li>
                <strong className="text-ink">Renewals.</strong> Annual services renew on your purchase anniversary. We email you before
                each renewal.
              </li>
              <li>
                <strong className="text-ink">Government fees.</strong> State filing fees are set by the state, are charged at cost, and
                generally can&apos;t be refunded once a filing has been submitted.
              </li>
              <li>
                <strong className="text-ink">Refunds.</strong> See our{" "}
                <Link href="/legal/refund-policy" className="text-brand underline underline-offset-2">
                  Refund Policy
                </Link>
                .
              </li>
              <li>
                <strong className="text-ink">Payments.</strong> Processed securely by Stripe. Receipts and invoices are available in
                your account.
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-paper p-6">
            <h2 className="text-xl font-semibold">Questions about pricing?</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              We&apos;re happy to explain what&apos;s included before you buy.
            </p>
            <ButtonLink href="/contact?topic=pricing" variant="secondary" className="mt-5">
              Contact us
            </ButtonLink>
          </div>
        </Container>
      </Section>
    </>
  );
}

function PlanCard({
  name,
  price,
  period,
  description,
  lines,
  features,
  cta,
  note,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  lines: Array<[string, string]>;
  features: string[];
  cta: { href: string; label: string } | null;
  note: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface p-6 sm:p-7">
      <h2 className="font-sans text-lg font-semibold">{name}</h2>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="font-serif text-4xl font-semibold">{price}</span>
        <span className="text-muted">{period}</span>
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">{description}</p>
      {lines.length ? (
        <dl className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
          {lines.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {features.length ? <FeatureList className="mt-5 border-t border-line pt-5" items={features} /> : null}
      <div className="mt-auto pt-6">
        {cta ? (
          <ButtonLink href={cta.href} className="w-full" variant={cta.label === "Notify me" ? "secondary" : "primary"}>
            {cta.label}
          </ButtonLink>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-muted">{note}</p>
      </div>
    </div>
  );
}
