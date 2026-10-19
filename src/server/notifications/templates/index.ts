/**
 * EMAIL TEMPLATES
 * ---------------
 * Edit the copy here. Each template returns a subject, a preheader (inbox preview
 * text) and a list of blocks. `ctx.brand` is the live brand from settings, and
 * `ctx.url(path)` builds an absolute link to the site.
 *
 * Keep the tone factual, and don't promise outcomes or timelines that depend on
 * the state or a provider.
 */
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { button, callout, details, heading, list, p, quote, small, type Block, type LayoutBrand } from "./blocks";

export type TemplateContext = { brand: LayoutBrand; url: (path: string) => string };
export type Rendered = { subject: string; preheader: string; blocks: Block[] };
type Template<D> = (data: D, ctx: TemplateContext) => Rendered;

const signoff = (ctx: TemplateContext) => p(`— The ${ctx.brand.name} team`);

/* ------------------------------- customer ------------------------------- */

export const orderConfirmation: Template<{
  firstName: string;
  orderNumber: number;
  orderId: string;
  productName: string;
  items: Array<{ description: string; totalCents: number }>;
  totalCents: number;
  needsOnboarding: boolean;
}> = (d, ctx) => ({
  subject: `Order #${d.orderNumber} confirmed: ${d.productName}`,
  preheader: d.needsOnboarding
    ? "Payment received. One more step: complete your business information."
    : "Payment received. We'll keep you updated.",
  blocks: [
    heading("We received your order"),
    p(`Hi ${d.firstName},`),
    p(`Thank you. Your payment went through and your order for ${d.productName} is in.`),
    details([
      ["Order", `#${d.orderNumber}`],
      ...d.items.map((i): [string, string] => [i.description, formatMoney(i.totalCents)]),
      ["Total paid", formatMoney(d.totalCents)],
    ]),
    ...(d.needsOnboarding
      ? [
          p("Next step: answer a few questions about your business so we can get started. It takes about five minutes, and we've filled in what you gave us at checkout."),
          button("Continue to business details", ctx.url(`/account/orders/${d.orderId}/onboarding`), ctx.brand.primaryColor),
        ]
      : [button("View your order", ctx.url(`/account/orders/${d.orderId}`), ctx.brand.primaryColor)]),
    small("Your receipt is available under Billing in your account."),
    signoff(ctx),
  ],
});

export const onboardingReceived: Template<{ firstName: string; orderNumber: number; orderId: string }> = (d, ctx) => ({
  subject: `We have your information: order #${d.orderNumber}`,
  preheader: "Your order is in our processing queue.",
  blocks: [
    heading("Your information was received"),
    p(`Hi ${d.firstName},`),
    p("Thanks for completing your business information. Your order is now in our processing queue. We'll email you when it has been submitted and when it's complete."),
    button("Track your order", ctx.url(`/account/orders/${d.orderId}`), ctx.brand.primaryColor),
    signoff(ctx),
  ],
});

export const informationRequested: Template<{
  firstName: string;
  orderNumber: number;
  orderId: string;
  message: string;
}> = (d, ctx) => ({
  subject: `Action needed: more information for order #${d.orderNumber}`,
  preheader: "We need a little more information to continue your order.",
  blocks: [
    heading("We need a little more information"),
    p(`Hi ${d.firstName},`),
    p(`To continue with order #${d.orderNumber}, we need the following:`),
    quote(d.message),
    p("You can reply and upload documents securely from your account. Please don't send sensitive documents by email."),
    button("Respond in your account", ctx.url(`/account/orders/${d.orderId}`), ctx.brand.primaryColor),
    signoff(ctx),
  ],
});

export const providerSubmitted: Template<{ firstName: string; orderNumber: number; orderId: string; productName: string }> = (
  d,
  ctx,
) => ({
  subject: `Order #${d.orderNumber} has been submitted`,
  preheader: `Your ${d.productName} order has been submitted for processing.`,
  blocks: [
    heading("Your order has been submitted"),
    p(`Hi ${d.firstName},`),
    p(`Your ${d.productName} order (#${d.orderNumber}) has been submitted for processing. State processing times vary, and we'll email you as soon as it's complete.`),
    button("Track your order", ctx.url(`/account/orders/${d.orderId}`), ctx.brand.primaryColor),
    signoff(ctx),
  ],
});

export const orderCompleted: Template<{
  firstName: string;
  orderNumber: number;
  orderId: string;
  productName: string;
  hasDocuments: boolean;
}> = (d, ctx) => ({
  subject: `Order #${d.orderNumber} is complete`,
  preheader: d.hasDocuments ? "Your documents are ready in your account." : "Your order is complete.",
  blocks: [
    heading("Your order is complete"),
    p(`Hi ${d.firstName},`),
    p(`Your ${d.productName} order (#${d.orderNumber}) is complete.`),
    ...(d.hasDocuments ? [p("Your documents are available to download securely from your account.")] : []),
    button(d.hasDocuments ? "View your documents" : "View your order", ctx.url(`/account/orders/${d.orderId}`), ctx.brand.primaryColor),
    signoff(ctx),
  ],
});

export const newDocument: Template<{
  firstName: string;
  entityName: string;
  documentTitle: string;
  documentTypeLabel: string;
  urgent: boolean;
  entityId: string | null;
}> = (d, ctx) => ({
  subject: d.urgent
    ? `Important: new ${d.documentTypeLabel.toLowerCase()} for ${d.entityName}`
    : `New document available for ${d.entityName}`,
  preheader: `${d.documentTitle} is available in your account.`,
  blocks: [
    heading(d.urgent ? "An important document was received" : "A new document is available"),
    p(`Hi ${d.firstName},`),
    p(`A new document has been added to your account for ${d.entityName}.`),
    details([
      ["Document", d.documentTitle],
      ["Type", d.documentTypeLabel],
    ]),
    ...(d.urgent
      ? [
          callout(
            "Legal and government documents can have response deadlines. Please review this document promptly and consult an attorney if you need advice about how to respond.",
          ),
        ]
      : []),
    button("View document", ctx.url(d.entityId ? `/account/entities/${d.entityId}` : "/account/documents"), ctx.brand.primaryColor),
    small("For your security, documents are only available after signing in. They are never attached to emails."),
    signoff(ctx),
  ],
});

export const renewalReminder: Template<{
  firstName: string;
  entityName: string;
  serviceName: string;
  renewalDate: Date;
  amountCents: number;
  daysBefore: number;
  autoRenew: boolean;
}> = (d, ctx) => ({
  subject: d.autoRenew
    ? `${d.serviceName} for ${d.entityName} renews on ${formatDate(d.renewalDate)}`
    : `${d.serviceName} for ${d.entityName} ends on ${formatDate(d.renewalDate)}`,
  preheader: d.autoRenew ? `Renews automatically for ${formatMoney(d.amountCents)}.` : "Auto-renewal is off.",
  blocks: [
    heading(d.autoRenew ? "Upcoming renewal" : "Your service is ending soon"),
    p(`Hi ${d.firstName},`),
    ...(d.autoRenew
      ? [
          p(`Your ${d.serviceName} for ${d.entityName} renews automatically on ${formatDate(d.renewalDate)}. We'll charge your saved payment method ${formatMoney(d.amountCents)}. You don't need to do anything.`),
          p("To update your payment method or change your renewal settings, visit Billing in your account."),
        ]
      : [
          p(`Auto-renewal is turned off, so your ${d.serviceName} for ${d.entityName} will end on ${formatDate(d.renewalDate)}.`),
          callout(
            "Most states require every business entity to keep a registered agent on file at all times. If our service ends, you may need to appoint a new registered agent with the state.",
          ),
        ]),
    button("Manage billing", ctx.url("/account/billing"), ctx.brand.primaryColor),
    signoff(ctx),
  ],
});

export const serviceActivated: Template<{
  firstName: string;
  entityName: string;
  entityId: string;
  serviceName: string;
  agentName?: string;
  agentAddress?: string;
}> = (d, ctx) => ({
  subject: `${d.serviceName} is active for ${d.entityName}`,
  preheader: d.agentName ? "Your registered agent details are ready." : "Your service is now active.",
  blocks: [
    heading("Your service is active"),
    p(`Hi ${d.firstName},`),
    p(`${d.serviceName} for ${d.entityName} is now active.`),
    ...(d.agentName
      ? [
          p("Use exactly these details wherever the state asks for your registered agent:"),
          details([
            ["Registered agent", d.agentName],
            ["Registered office", d.agentAddress ?? ""],
          ]),
          callout("This address is only for service of process and official state correspondence. Please don't use it as a mailing address."),
        ]
      : []),
    button("View your business", ctx.url(`/account/entities/${d.entityId}`), ctx.brand.primaryColor),
    signoff(ctx),
  ],
});

export const paymentSucceeded: Template<{ firstName: string; description: string; amountCents: number; receiptUrl: string | null }> = (
  d,
  ctx,
) => ({
  subject: `Payment received: ${formatMoney(d.amountCents)}`,
  preheader: d.description,
  blocks: [
    heading("Payment received"),
    p(`Hi ${d.firstName},`),
    p(`We received your payment of ${formatMoney(d.amountCents)} for ${d.description}. Thank you.`),
    button(d.receiptUrl ? "View receipt" : "View billing", d.receiptUrl ?? ctx.url("/account/billing"), ctx.brand.primaryColor),
    signoff(ctx),
  ],
});

export const renewalSucceeded: Template<{
  firstName: string;
  entityName: string;
  entityId: string;
  serviceName: string;
  amountCents: number;
  nextRenewalDate: Date | null;
  receiptUrl: string | null;
}> = (d, ctx) => ({
  subject: `${d.serviceName} renewed for ${d.entityName}`,
  preheader: `Renewed for ${formatMoney(d.amountCents)}. No action needed.`,
  blocks: [
    heading("Your service has renewed"),
    p(`Hi ${d.firstName},`),
    p(`Your ${d.serviceName} for ${d.entityName} renewed for another year. We charged your saved payment method ${formatMoney(d.amountCents)}. You don't need to do anything.`),
    details([
      ["Business", d.entityName],
      ["Amount", formatMoney(d.amountCents)],
      ["Next renewal", d.nextRenewalDate ? formatDate(d.nextRenewalDate) : "Shown in your account"],
    ]),
    button("View your business", ctx.url(`/account/entities/${d.entityId}`), ctx.brand.primaryColor),
    small(d.receiptUrl ? `Your receipt: ${d.receiptUrl}` : "Your receipt is available under Billing in your account. You can turn off auto-renewal there anytime."),
    signoff(ctx),
  ],
});

export const paymentFailed: Template<{ firstName: string; description: string; amountCents: number }> = (d, ctx) => ({
  subject: "Action needed: your payment didn't go through",
  preheader: `We couldn't process ${formatMoney(d.amountCents)} for ${d.description}.`,
  blocks: [
    heading("Your payment didn't go through"),
    p(`Hi ${d.firstName},`),
    p(`We weren't able to process your payment of ${formatMoney(d.amountCents)} for ${d.description}.`),
    p("Please update your payment method to avoid an interruption in service. We'll retry the payment automatically."),
    button("Update payment method", ctx.url("/account/billing"), ctx.brand.primaryColor),
    signoff(ctx),
  ],
});

export const renewalCancelled: Template<{ firstName: string; entityName: string; serviceName: string; endDate: Date | null }> = (
  d,
  ctx,
) => ({
  subject: `Auto-renewal turned off: ${d.serviceName} for ${d.entityName}`,
  preheader: d.endDate ? `Service continues until ${formatDate(d.endDate)}.` : "Auto-renewal is off.",
  blocks: [
    heading("Auto-renewal is turned off"),
    p(`Hi ${d.firstName},`),
    p(`Auto-renewal for ${d.serviceName} for ${d.entityName} is now off.${d.endDate ? ` Your service continues until ${formatDate(d.endDate)}.` : ""}`),
    callout(
      "If your business needs to keep a registered agent, you'll need to appoint a new one with the state before this date. You can turn auto-renewal back on from your account at any time before then.",
    ),
    button("Manage billing", ctx.url("/account/billing"), ctx.brand.primaryColor),
    signoff(ctx),
  ],
});

export const passwordReset: Template<{ resetUrl: string }> = (d, ctx) => ({
  subject: `Reset your ${ctx.brand.name} password`,
  preheader: "This link expires in 1 hour.",
  blocks: [
    heading("Reset your password"),
    p("We received a request to reset the password for your account. This link expires in 1 hour and can only be used once."),
    button("Choose a new password", d.resetUrl, ctx.brand.primaryColor),
    small("If you didn't request this, you can ignore this email. Your password won't change."),
  ],
});

export const welcome: Template<{ firstName: string }> = (d, ctx) => ({
  subject: `Welcome to ${ctx.brand.name}`,
  preheader: "Your account is ready.",
  blocks: [
    heading("Your account is ready"),
    p(`Hi ${d.firstName},`),
    p(`Your ${ctx.brand.name} account has been created. Use it to track orders, download documents and manage your services.`),
    button("Go to your account", ctx.url("/account"), ctx.brand.primaryColor),
    signoff(ctx),
  ],
});

export const supportReceived: Template<{ name: string; subject: string }> = (d, ctx) => ({
  subject: `We received your message: ${d.subject}`,
  preheader: "We'll reply as soon as we can.",
  blocks: [
    p(`Hi ${d.name},`),
    p(`Thanks for contacting ${ctx.brand.name}. We received your message and will reply by email, usually within one business day.`),
    small("Please don't send sensitive documents or ID numbers by email. If we need documents, we'll ask you to upload them securely in your account."),
    signoff(ctx),
  ],
});

/* ------------------------------- internal ------------------------------- */

export const adminNewOrder: Template<{ orderNumber: number; orderId: string; productName: string; customerName: string; totalCents: number }> = (
  d,
  ctx,
) => ({
  subject: `[New order] #${d.orderNumber} ${d.productName}: ${formatMoney(d.totalCents)}`,
  preheader: `${d.customerName} paid ${formatMoney(d.totalCents)}.`,
  blocks: [
    p(`New paid order from ${d.customerName}.`),
    details([
      ["Order", `#${d.orderNumber}`],
      ["Product", d.productName],
      ["Total", formatMoney(d.totalCents)],
    ]),
    button("Open in admin", ctx.url(`/admin/orders/${d.orderId}`), ctx.brand.primaryColor),
  ],
});

export const adminOrderReady: Template<{ orderNumber: number; orderId: string; productName: string }> = (d, ctx) => ({
  subject: `[Ready for provider] #${d.orderNumber} ${d.productName}`,
  preheader: "Customer information received. Place the order with the provider.",
  blocks: [
    p(`Order #${d.orderNumber} has complete customer information and is ready to place with the wholesale provider.`),
    button("Open fulfillment sheet", ctx.url(`/admin/orders/${d.orderId}`), ctx.brand.primaryColor),
  ],
});

export const adminCustomerResponded: Template<{ orderNumber: number; orderId: string; customerName: string }> = (d, ctx) => ({
  subject: `[Customer responded] #${d.orderNumber}`,
  preheader: `${d.customerName} responded to an information request.`,
  blocks: [
    p(`${d.customerName} responded to an information request on order #${d.orderNumber}.`),
    button("Review response", ctx.url(`/admin/orders/${d.orderId}`), ctx.brand.primaryColor),
  ],
});

export const adminRenewalCancelled: Template<{ entityName: string; entityId: string; customerName: string; endDate: Date | null }> = (
  d,
  ctx,
) => ({
  subject: `[Renewal cancelled] ${d.entityName}`,
  preheader: `${d.customerName} turned off auto-renewal.`,
  blocks: [
    p(`${d.customerName} turned off auto-renewal for registered agent service on ${d.entityName}.`),
    details([["Service ends", d.endDate ? formatDate(d.endDate) : "Unknown"]]),
    list([
      "Confirm whether any wholesale-provider action is needed at the end date.",
      "Follow the state's registered agent resignation rules if service lapses.",
    ]),
    button("Open entity", ctx.url(`/admin/entities/${d.entityId}`), ctx.brand.primaryColor),
  ],
});

export const adminSubscriptionEnded: Template<{ entityName: string; entityId: string; customerName: string }> = (d, ctx) => ({
  subject: `[Service ended] ${d.entityName}`,
  preheader: "A registered agent subscription has ended.",
  blocks: [
    p(`The registered agent subscription for ${d.entityName} (${d.customerName}) has ended.`),
    p("Review whether wholesale-provider cancellation or a state resignation filing is required."),
    button("Open entity", ctx.url(`/admin/entities/${d.entityId}`), ctx.brand.primaryColor),
  ],
});

export const adminSupportRequest: Template<{ id: string; name: string; email: string; subject: string; message: string; category: string }> = (
  d,
  ctx,
) => ({
  subject: `[Support] ${d.subject}`,
  preheader: `${d.name} <${d.email}>`,
  blocks: [
    details([
      ["From", `${d.name} <${d.email}>`],
      ["Category", d.category],
    ]),
    quote(d.message),
    button("Open in admin", ctx.url(`/admin/support/${d.id}`), ctx.brand.primaryColor),
  ],
});

export const adminPaymentFailed: Template<{ customerName: string; customerId: string; description: string; amountCents: number }> = (
  d,
  ctx,
) => ({
  subject: `[Payment failed] ${d.customerName}: ${formatMoney(d.amountCents)}`,
  preheader: d.description,
  blocks: [
    p(`A payment of ${formatMoney(d.amountCents)} from ${d.customerName} failed (${d.description}). Stripe will retry automatically.`),
    button("Open customer", ctx.url(`/admin/customers/${d.customerId}`), ctx.brand.primaryColor),
  ],
});

export const templates = {
  order_confirmation: orderConfirmation,
  onboarding_received: onboardingReceived,
  information_requested: informationRequested,
  provider_submitted: providerSubmitted,
  order_completed: orderCompleted,
  new_document: newDocument,
  renewal_reminder: renewalReminder,
  service_activated: serviceActivated,
  payment_succeeded: paymentSucceeded,
  renewal_succeeded: renewalSucceeded,
  payment_failed: paymentFailed,
  renewal_cancelled: renewalCancelled,
  password_reset: passwordReset,
  welcome,
  support_received: supportReceived,
  admin_new_order: adminNewOrder,
  admin_order_ready: adminOrderReady,
  admin_customer_responded: adminCustomerResponded,
  admin_renewal_cancelled: adminRenewalCancelled,
  admin_subscription_ended: adminSubscriptionEnded,
  admin_support_request: adminSupportRequest,
  admin_payment_failed: adminPaymentFailed,
} as const;

export type TemplateName = keyof typeof templates;
export type TemplateData<N extends TemplateName> = Parameters<(typeof templates)[N]>[0];
