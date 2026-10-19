import Link from "next/link";
import { SectionHeading } from "@/components/site/marketing";
import { Badge } from "@/components/ui/badge";
import { Container, EmptyState, Section } from "@/components/ui/layout";
import { listGuides } from "@/server/content";
import { pageMetadata } from "@/server/seo";

export async function generateMetadata() {
  return pageMetadata({
    title: "Guides",
    description: "Plain-English guides to registered agents, forming a Texas LLC, and keeping your business in good standing.",
    path: "/guides",
  });
}

export default async function GuidesPage() {
  const guides = await listGuides({ includeDrafts: true });
  return (
    <Section>
      <Container className="max-w-4xl">
        <SectionHeading eyebrow="Guides" title="Guides for business owners" lead="Clear explanations of the requirements that apply to your business." />
        <div className="mt-10">
          {guides.length === 0 ? (
            <EmptyState title="Guides are on the way">We&apos;re writing our first guides now.</EmptyState>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {guides.map((g) => (
                <li key={g.slug} className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">{g.category}</p>
                  <h2 className="mt-1 font-sans text-lg font-semibold">
                    <Link href={`/guides/${g.slug}`} className="hover:text-brand">
                      {g.title}
                    </Link>
                    {g.status === "draft" ? (
                      <Badge tone="warning" className="ml-2 align-middle">
                        Draft (dev only)
                      </Badge>
                    ) : null}
                  </h2>
                  <p className="mt-1 text-[15px] text-muted">{g.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </Section>
  );
}
