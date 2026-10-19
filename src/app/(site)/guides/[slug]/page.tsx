import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/site/json-ld";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section } from "@/components/ui/layout";
import { getGuide } from "@/server/content";
import { appUrl } from "@/server/env";
import { getMarketingContext } from "@/server/marketing";
import { breadcrumbJsonLd, pageMetadata } from "@/server/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return {};
  return pageMetadata({
    title: guide.meta.title,
    description: guide.meta.description,
    path: `/guides/${slug}`,
    type: "article",
    noindex: guide.meta.status !== "published",
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [guide, c] = await Promise.all([getGuide(slug), getMarketingContext()]);
  if (!guide) notFound();
  const { meta } = guide;

  return (
    <Section>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: meta.title,
          description: meta.description,
          dateModified: meta.updated || undefined,
          mainEntityOfPage: `${appUrl()}/guides/${slug}`,
          publisher: { "@type": "Organization", name: c.brand },
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: meta.title, path: `/guides/${slug}` },
        ])}
      />
      <Container>
        <div className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link href="/guides" className="hover:text-ink">
              Guides
            </Link>{" "}
            / <span>{meta.category}</span>
          </nav>
          {meta.status === "draft" ? (
            <Alert tone="warning" title="Draft: visible in development only" className="mt-6">
              This guide is not published. Review and fact-check it, then set <code>status: published</code> in its front matter.
            </Alert>
          ) : null}
          <h1 className="mt-6 text-3xl font-semibold leading-tight sm:text-4xl">{meta.title}</h1>
          {meta.updated ? <p className="mt-3 text-sm text-muted">Updated {meta.updated}</p> : null}
          <article className="prose-content mt-8" dangerouslySetInnerHTML={{ __html: guide.html }} />
          <aside className="mt-12 rounded-lg border border-line bg-surface p-6">
            <p className="font-sans text-lg font-semibold">Need a registered agent?</p>
            <p className="mt-1 text-[15px] text-muted">
              {c.brand} provides registered agent service for {c.raPrice} per year, with documents delivered to your secure account.
            </p>
            <ButtonLink href="/registered-agent" className="mt-4">
              Learn more
            </ButtonLink>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
