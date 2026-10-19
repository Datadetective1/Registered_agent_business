import "server-only";
import type { Metadata } from "next";
import { appUrl } from "./env";
import { getSettings } from "./settings";

/**
 * Per-page metadata with canonical URL, Open Graph and Twitter cards.
 * `path` is the canonical path ("/registered-agent").
 */
export async function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  type?: "website" | "article";
  /** Use the title as-is (skip the "| Brand" template). */
  absoluteTitle?: boolean;
}): Promise<Metadata> {
  const s = await getSettings();
  const url = `${appUrl()}${opts.path}`;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: s.brand.name,
      type: opts.type ?? "website",
      locale: "en_US",
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description },
    robots: opts.noindex ? { index: false, follow: false } : undefined,
  };
}

export const NOINDEX: Metadata = { robots: { index: false, follow: false } };

export async function organizationJsonLd() {
  const s = await getSettings();
  const a = s.contact.address;
  const sameAs = [s.social.linkedin, s.social.x, s.social.facebook].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: s.brand.name,
    legalName: s.brand.legalName,
    url: appUrl(),
    ...(s.brand.logoUrl ? { logo: s.brand.logoUrl.startsWith("http") ? s.brand.logoUrl : `${appUrl()}${s.brand.logoUrl}` } : {}),
    email: s.contact.supportEmail,
    ...(s.contact.supportPhone ? { telephone: s.contact.supportPhone } : {}),
    ...(a.line1
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: [a.line1, a.line2].filter(Boolean).join(", "),
            addressLocality: a.city,
            addressRegion: a.state,
            postalCode: a.postalCode,
            addressCountry: "US",
          },
        }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export async function serviceJsonLd(opts: { name: string; description: string; path: string; priceCents: number; areaServed?: string; recurring?: boolean }) {
  const s = await getSettings();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    url: `${appUrl()}${opts.path}`,
    provider: { "@type": "Organization", name: s.brand.name, url: appUrl() },
    areaServed: opts.areaServed ? { "@type": "State", name: opts.areaServed } : { "@type": "Country", name: "United States" },
    offers: {
      "@type": "Offer",
      price: (opts.priceCents / 100).toFixed(2),
      priceCurrency: "USD",
      url: `${appUrl()}${opts.path}`,
      ...(opts.recurring ? { priceSpecification: { "@type": "UnitPriceSpecification", price: (opts.priceCents / 100).toFixed(2), priceCurrency: "USD", unitText: "year" } } : {}),
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${appUrl()}${it.path}` })),
  };
}

export function faqJsonLd(faqs: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
