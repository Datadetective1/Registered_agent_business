import Link from "next/link";
import { JsonLd } from "@/components/site/json-ld";
import { SectionHeading } from "@/components/site/marketing";
import { Badge } from "@/components/ui/badge";
import { Container, Section } from "@/components/ui/layout";
import { US_STATES } from "@/config/states";
import { STATE_CONTENT } from "@/content/states";
import { getMarketingContext } from "@/server/marketing";
import { breadcrumbJsonLd, pageMetadata } from "@/server/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "Registered Agent Service by State",
    description: "See which states our registered agent service currently covers, and request a state we don't cover yet.",
    path: "/registered-agent/states",
  });
}

export default async function StatesPage() {
  const c = await getMarketingContext();
  const live = new Set(c.raStates);
  return (
    <Section>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Registered Agent", path: "/registered-agent" },
          { name: "By State", path: "/registered-agent/states" },
        ])}
      />
      <Container>
        <SectionHeading
          eyebrow="Coverage"
          title="Registered agent service by state"
          lead={`We currently offer registered agent service for businesses in ${c.raStatesLabel || "select states"}. We're adding states over time; contact us if you need one that isn't available yet.`}
        />
        <ul className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {US_STATES.map((st) => {
            const available = live.has(st.code);
            const hasPage = available && Boolean(STATE_CONTENT[st.code]);
            return (
              <li key={st.code} className="flex items-center justify-between rounded-md border border-line bg-surface px-4 py-3">
                {hasPage ? (
                  <Link href={`/registered-agent/${st.slug}`} className="font-medium text-brand hover:underline">
                    {st.name}
                  </Link>
                ) : (
                  <span className={available ? "font-medium" : "text-muted"}>{st.name}</span>
                )}
                {available ? <Badge tone="success">Available</Badge> : <Badge>Not yet available</Badge>}
              </li>
            );
          })}
        </ul>
        <p className="mt-8 text-[15px] text-muted">
          Need coverage in another state?{" "}
          <Link href="/contact?topic=registered-agent" className="text-brand underline underline-offset-2">
            Let us know
          </Link>
          .
        </p>
      </Container>
    </Section>
  );
}
