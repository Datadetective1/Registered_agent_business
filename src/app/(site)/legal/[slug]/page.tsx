import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Container, Section } from "@/components/ui/layout";
import { LEGAL_DOCS } from "@/config/legal";
import { getLegalDocument } from "@/server/content";
import { pageMetadata } from "@/server/seo";
import { getSettings } from "@/server/settings";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  if (!doc) return {};
  return pageMetadata({ title: doc.title, description: `${doc.title} for our registered agent and business filing services.`, path: `/legal/${slug}` });
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const known = LEGAL_DOCS.find((d) => d.slug === slug);
  if (!known) notFound();
  const [doc, s] = await Promise.all([getLegalDocument(slug), getSettings()]);
  if (!doc) notFound();
  const reviewed = s.legal.reviewed[slug] === true;

  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-3xl">
          {!reviewed ? (
            <Alert tone="warning" title="Draft document: pending legal review" className="mb-8">
              This document is a working draft and has not yet been reviewed by an attorney. It will be finalized before
              {` ${s.brand.name}`} begins accepting live orders.
            </Alert>
          ) : null}
          <h1 className="text-3xl font-semibold sm:text-4xl">{known.title}</h1>
          {doc.updated ? <p className="mt-2 text-sm text-muted">Last updated: {doc.updated}</p> : null}
          <article className="prose-content mt-8" dangerouslySetInnerHTML={{ __html: doc.html }} />
        </div>
      </Container>
    </Section>
  );
}
