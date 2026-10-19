/**
 * Email building blocks. Each returns matching HTML and plain-text parts so that
 * every template produces both. Inline styles only (email clients ignore <style>).
 */
export type Block = { html: string; text: string };

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

export const p = (text: string): Block => ({
  html: `<p style="${FONT}margin:0 0 16px;font-size:15px;line-height:1.6;color:#1b2430;">${esc(text)}</p>`,
  text,
});

export const heading = (text: string): Block => ({
  html: `<h1 style="${FONT}margin:0 0 16px;font-size:20px;line-height:1.3;color:#1b2430;font-weight:600;">${esc(text)}</h1>`,
  text: `${text}\n${"=".repeat(Math.min(text.length, 60))}`,
});

export const button = (label: string, url: string, color: string): Block => ({
  html: `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="background:${esc(color)};border-radius:6px;"><a href="${esc(url)}" style="${FONT}display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(label)}</a></td></tr></table>`,
  text: `${label}: ${url}`,
});

export const details = (rows: Array<[label: string, value: string]>): Block => ({
  html: `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border:1px solid #e3e1da;border-radius:6px;border-collapse:separate;">${rows
    .map(
      ([k, v], i) =>
        `<tr><td style="${FONT}padding:10px 14px;font-size:13px;color:#5b6573;${i ? "border-top:1px solid #e3e1da;" : ""}width:40%;">${esc(k)}</td><td style="${FONT}padding:10px 14px;font-size:14px;color:#1b2430;${i ? "border-top:1px solid #e3e1da;" : ""}">${esc(v)}</td></tr>`,
    )
    .join("")}</table>`,
  text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
});

export const callout = (text: string): Block => ({
  html: `<div style="${FONT}margin:0 0 20px;padding:12px 14px;border-left:3px solid #b7862c;background:#faf6ec;font-size:14px;line-height:1.55;color:#1b2430;">${esc(text)}</div>`,
  text: `NOTE: ${text}`,
});

export const quote = (text: string): Block => ({
  html: `<div style="${FONT}margin:0 0 20px;padding:12px 14px;background:#f4f3ef;border-radius:6px;font-size:14px;line-height:1.55;color:#1b2430;white-space:pre-wrap;">${esc(text)}</div>`,
  text: text
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n"),
});

export const small = (text: string): Block => ({
  html: `<p style="${FONT}margin:0 0 12px;font-size:13px;line-height:1.5;color:#5b6573;">${esc(text)}</p>`,
  text,
});

export const list = (items: string[]): Block => ({
  html: `<ul style="${FONT}margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6;color:#1b2430;">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`,
  text: items.map((i) => `- ${i}`).join("\n"),
});

export type LayoutBrand = {
  name: string;
  legalName: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  primaryColor: string;
  appUrl: string;
};

export function layout(brand: LayoutBrand, preheader: string, blocks: Block[]): { html: string; text: string } {
  const contact = [brand.supportEmail, brand.supportPhone].filter(Boolean).join(" · ");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(brand.name)}</title></head>
<body style="margin:0;padding:0;background:#f4f3ef;">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="${FONT}padding:0 4px 16px;font-size:16px;font-weight:700;color:${esc(brand.primaryColor)};">${esc(brand.name)}</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e3e1da;border-radius:8px;padding:28px 28px 12px;">
${blocks.map((b) => b.html).join("\n")}
</td></tr>
<tr><td style="${FONT}padding:16px 4px;font-size:12px;line-height:1.5;color:#5b6573;">
${esc(brand.legalName)}${brand.address ? ` · ${esc(brand.address)}` : ""}<br>
Questions? ${esc(contact)}<br>
${esc(brand.name)} is not a law firm and does not provide legal, tax, or accounting advice.
</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    ...blocks.map((b) => b.text),
    "",
    "—",
    brand.legalName + (brand.address ? ` · ${brand.address}` : ""),
    `Questions? ${contact}`,
    `${brand.name} is not a law firm and does not provide legal, tax, or accounting advice.`,
  ].join("\n\n");
  return { html, text };
}
