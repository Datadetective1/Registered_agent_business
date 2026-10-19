import "server-only";
import { db, type Executor } from "@/db";
import { notifications } from "@/db/schema";
import { appUrl } from "@/server/env";
import { getSettings } from "@/server/settings";
import { layout, type LayoutBrand } from "./templates/blocks";
import { templates, type TemplateData, type TemplateName } from "./templates";
import { getTransport } from "./transports";

export async function brandForEmail(): Promise<LayoutBrand> {
  const s = await getSettings();
  const a = s.contact.address;
  return {
    name: s.brand.name,
    legalName: s.brand.legalName,
    supportEmail: s.contact.supportEmail,
    supportPhone: s.contact.supportPhone,
    address: a.line1 ? [a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`].filter(Boolean).join(", ") : "",
    primaryColor: s.colors.primary,
    appUrl: appUrl(),
  };
}

export async function renderEmail<N extends TemplateName>(template: N, data: TemplateData<N>) {
  const brand = await brandForEmail();
  const ctx = { brand, url: (path: string) => `${appUrl()}${path}` };
  const fn = templates[template] as (d: TemplateData<N>, c: typeof ctx) => ReturnType<(typeof templates)[N]>;
  const rendered = fn(data, ctx);
  const { html, text } = layout(brand, rendered.preheader, rendered.blocks);
  return { subject: rendered.subject, html, text, brand };
}

export type SendOptions<N extends TemplateName> = {
  template: N;
  to: string;
  data: TemplateData<N>;
  customerId?: string | null;
  orderId?: string | null;
  entityId?: string | null;
  internal?: boolean;
};

/**
 * Render, record and dispatch an email. The row in `notifications` is written
 * first, so there's always a record even if the transport fails. Failures never
 * throw: a notification problem must not roll back a payment or status change.
 */
export async function sendEmail<N extends TemplateName>(opts: SendOptions<N>, tx: Executor = db) {
  try {
    const { subject, html, text, brand } = await renderEmail(opts.template, opts.data);
    const transport = getTransport();
    const from = process.env.EMAIL_FROM || `${brand.name} <${brand.supportEmail}>`;
    const result = await transport.send({ from, to: opts.to, replyTo: brand.supportEmail, subject, html, text });
    const [row] = await tx
      .insert(notifications)
      .values({
        customerId: opts.customerId ?? null,
        orderId: opts.orderId ?? null,
        entityId: opts.entityId ?? null,
        template: opts.template,
        toAddress: opts.to,
        subject,
        bodyHtml: html,
        bodyText: text,
        status: result.status,
        transport: transport.name,
        providerMessageId: result.providerMessageId ?? null,
        error: result.error ?? null,
        isInternal: opts.internal ?? false,
        sentAt: result.status === "sent" ? new Date() : null,
      })
      .returning({ id: notifications.id });
    return row;
  } catch (err) {
    console.error(`[email] failed to send ${opts.template}`, err);
    return null;
  }
}

/** Internal operations alert to the configured admin address. */
export async function notifyAdmins<N extends TemplateName>(
  template: N,
  data: TemplateData<N>,
  refs: { orderId?: string | null; customerId?: string | null; entityId?: string | null } = {},
  tx: Executor = db,
) {
  const s = await getSettings();
  return sendEmail(
    { template, to: s.operations.adminNotificationEmail, data, internal: true, ...refs },
    tx,
  );
}
