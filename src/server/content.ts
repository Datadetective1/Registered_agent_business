import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { appUrl, isProduction } from "./env";
import { getSettings } from "./settings";

/**
 * File-based content (content/legal/*.md, content/guides/*.md). Content is
 * authored in this repository and therefore trusted; it is rendered with `marked`.
 */
const CONTENT_DIR = path.join(process.cwd(), "content");

type Frontmatter = Record<string, string | boolean | string[]>;

/** Minimal frontmatter parser: `key: value`, booleans, and `[a, b]` lists. */
export function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };
  const data: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, key, rawValue] = m;
    let value: string | boolean | string[] = rawValue.trim();
    if (value === "true" || value === "false") value = value === "true";
    else if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else value = value.replace(/^["']|["']$/g, "");
    data[key] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

async function contentVars(): Promise<Record<string, string>> {
  const s = await getSettings();
  const a = s.contact.address;
  return {
    "brand.name": s.brand.name,
    "brand.legalName": s.brand.legalName,
    "contact.supportEmail": s.contact.supportEmail,
    "contact.supportPhone": s.contact.supportPhone || "[support phone]",
    "contact.address": a.line1 ? [a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`].filter(Boolean).join(", ") : "[company mailing address]",
    appUrl: appUrl(),
  };
}

const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Substitute {{vars}}. Values are HTML-escaped because the markdown is rendered as HTML. */
function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (all, key: string) => (key in vars ? escapeHtml(vars[key]) : all));
}

function render(md: string): string {
  return marked.parse(md, { async: false, gfm: true });
}

/* ---------------------------------- legal --------------------------------- */

export async function getLegalDocument(slug: string) {
  if (!/^[a-z-]+$/.test(slug)) return null;
  try {
    const raw = await readFile(path.join(CONTENT_DIR, "legal", `${slug}.md`), "utf8");
    const { data, body } = parseFrontmatter(raw);
    return { slug, title: String(data.title ?? slug), updated: String(data.updated ?? ""), html: render(interpolate(body, await contentVars())) };
  } catch {
    return null;
  }
}

/* --------------------------------- guides --------------------------------- */

export type GuideMeta = {
  slug: string;
  title: string;
  description: string;
  status: "draft" | "published";
  updated: string;
  category: string;
  keywords: string[];
};

function toMeta(slug: string, data: Frontmatter): GuideMeta {
  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    status: data.status === "published" ? "published" : "draft",
    updated: String(data.updated ?? ""),
    category: String(data.category ?? "Guides"),
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
  };
}

/** Drafts are visible in development (with a banner) but never in production. */
export function guideVisible(meta: GuideMeta): boolean {
  return meta.status === "published" || !isProduction();
}

export async function listGuides(opts: { includeDrafts?: boolean } = {}): Promise<GuideMeta[]> {
  const dir = path.join(CONTENT_DIR, "guides");
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const metas = await Promise.all(
    files.map(async (f) => toMeta(f.replace(/\.md$/, ""), parseFrontmatter(await readFile(path.join(dir, f), "utf8")).data)),
  );
  return metas
    .filter((m) => (opts.includeDrafts ? guideVisible(m) : m.status === "published"))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getGuide(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    const raw = await readFile(path.join(CONTENT_DIR, "guides", `${slug}.md`), "utf8");
    const { data, body } = parseFrontmatter(raw);
    const meta = toMeta(slug, data);
    if (!guideVisible(meta)) return null;
    return { meta, html: render(interpolate(body, await contentVars())) };
  } catch {
    return null;
  }
}
