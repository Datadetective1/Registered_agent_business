import type { MetadataRoute } from "next";
import { LEGAL_DOCS } from "@/config/legal";
import { US_STATES } from "@/config/states";
import { STATE_CONTENT } from "@/content/states";
import { listGuides } from "@/server/content";
import { appUrl } from "@/server/env";
import { getMarketingContext } from "@/server/marketing";

export const dynamic = "force-dynamic";

const STATIC_PATHS: Array<[path: string, priority: number]> = [
  ["/", 1],
  ["/registered-agent", 0.9],
  ["/start-an-llc", 0.9],
  ["/pricing", 0.8],
  ["/business-address", 0.6],
  ["/how-it-works", 0.6],
  ["/faq", 0.6],
  ["/registered-agent/states", 0.5],
  ["/about", 0.4],
  ["/contact", 0.4],
  ["/guides", 0.5],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const [c, guides] = await Promise.all([getMarketingContext(), listGuides()]);
  const statePages = US_STATES.filter((s) => c.raStates.includes(s.code) && STATE_CONTENT[s.code]).map((s) => ({
    url: `${base}/registered-agent/${s.slug}`,
    priority: 0.8,
  }));
  return [
    ...STATIC_PATHS.map(([path, priority]) => ({ url: `${base}${path}`, priority })),
    ...statePages,
    ...guides.map((g) => ({ url: `${base}/guides/${g.slug}`, lastModified: g.updated || undefined, priority: 0.6 })),
    ...LEGAL_DOCS.map((d) => ({ url: `${base}/legal/${d.slug}`, priority: 0.2 })),
  ];
}
