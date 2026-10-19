import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* -------------------------------------------------------------------------- */
/*  Enums                                                                     */
/* -------------------------------------------------------------------------- */

export const userRole = pgEnum("user_role", ["customer", "admin"]);

export const entityType = pgEnum("entity_type", [
  "llc",
  "corporation",
  "nonprofit",
  "lp",
  "llp",
  "pllc",
  "other",
]);
export const entityStatus = pgEnum("entity_status", [
  "pending_formation",
  "active",
  "inactive",
  "dissolved",
  "unknown",
]);

export const serviceKind = pgEnum("service_kind", ["registered_agent", "formation", "business_address"]);
export const billingType = pgEnum("billing_type", ["one_time", "annual", "monthly"]);
export const entityServiceStatus = pgEnum("entity_service_status", [
  "pending",
  "active",
  "cancellation_scheduled",
  "cancelled",
  "expired",
]);

export const orderType = pgEnum("order_type", ["registered_agent", "llc_formation", "business_address"]);
export const orderStatus = pgEnum("order_status", [
  "new",
  "payment_confirmed",
  "information_needed",
  "ready_for_fulfillment",
  "submitted_to_provider",
  "processing",
  "completed",
  "cancelled",
  "refunded",
]);
export const lineItemKind = pgEnum("line_item_kind", ["service", "government_fee"]);
export const paymentGateway = pgEnum("payment_gateway", ["stripe", "simulated"]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
]);

export const providerOperation = pgEnum("provider_operation", [
  "registered_agent",
  "formation",
  "business_address",
  "ein",
  "update_entity",
  "cancel_service",
]);
export const providerOrderStatus = pgEnum("provider_order_status", [
  "pending_manual",
  "submitted",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const infoRequestStatus = pgEnum("info_request_status", ["open", "responded", "closed"]);

export const documentType = pgEnum("document_type", [
  "formation_document",
  "state_correspondence",
  "service_of_process",
  "annual_report",
  "ein_confirmation",
  "operating_agreement",
  "identity_verification",
  "customer_upload",
  "receipt",
  "other",
]);
export const documentSource = pgEnum("document_source", ["customer", "admin", "provider", "system"]);
export const documentStatus = pgEnum("document_status", ["available", "pending_review", "archived"]);
export const documentVisibility = pgEnum("document_visibility", ["customer", "internal"]);

export const notificationStatus = pgEnum("notification_status", ["logged", "sent", "failed", "skipped"]);

export const supportStatus = pgEnum("support_status", ["open", "pending", "closed"]);
export const supportCategory = pgEnum("support_category", [
  "general",
  "sales",
  "billing",
  "documents",
  "order",
  "registered_agent",
  "other",
]);

export const auditActorType = pgEnum("audit_actor_type", ["customer", "admin", "system", "stripe"]);

/* -------------------------------------------------------------------------- */
/*  Identity                                                                  */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(), // always stored lower-cased
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("customer"),
  name: text("name"),
  emailVerifiedAt: ts("email_verified_at"),
  lastLoginAt: ts("last_login_at"),
  disabledAt: ts("disabled_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 (hex) of the session token. The raw token only exists in the cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const userTokens = pgTable(
  "user_tokens",
  {
    /** SHA-256 (hex) of the token sent by email. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(), // "password_reset"
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("user_tokens_user_idx").on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/*  Customers & addresses                                                     */
/* -------------------------------------------------------------------------- */

export const customers = pgTable("customers", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "restrict" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  /** Contact email for notifications (defaults to login email). */
  email: text("email").notNull(),
  phone: text("phone"),
  companyName: text("company_name"),
  mailingAddressId: uuid("mailing_address_id").references((): AnyPgColumn => addresses.id, { onDelete: "set null" }),
  stripeCustomerId: text("stripe_customer_id").unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const addresses = pgTable(
  "addresses",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull().default("US"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("addresses_customer_idx").on(t.customerId)],
);

/* -------------------------------------------------------------------------- */
/*  Entities & services                                                       */
/* -------------------------------------------------------------------------- */

export const entities = pgTable(
  "entities",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    legalName: text("legal_name").notNull(),
    entityType: entityType("entity_type").notNull(),
    /** Two-letter state of formation / registration. */
    jurisdiction: text("jurisdiction").notNull(),
    status: entityStatus("status").notNull().default("unknown"),
    sosFileNumber: text("sos_file_number"),
    formationDate: date("formation_date", { mode: "string" }),
    principalAddressId: uuid("principal_address_id").references(() => addresses.id, { onDelete: "set null" }),
    mailingAddressId: uuid("mailing_address_id").references(() => addresses.id, { onDelete: "set null" }),
    /** Person we notify when service of process / state mail arrives. */
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("entities_customer_idx").on(t.customerId)],
);

/** Catalog of what we sell. Prices are editable in Admin → Settings → Services. */
export const services = pgTable("services", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  kind: serviceKind("kind").notNull(),
  billing: billingType("billing").notNull(),
  priceCents: integer("price_cents").notNull(),
  governmentFeeCents: integer("government_fee_cents").notNull().default(0),
  governmentFeeLabel: text("government_fee_label"),
  jurisdiction: text("jurisdiction"),
  /** Visible and purchasable. */
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  shortDescription: text("short_description").notNull().default(""),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** A service delivered to a specific entity (operational state, separate from billing). */
export const entityServices = pgTable(
  "entity_services",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    status: entityServiceStatus("status").notNull().default("pending"),
    activatedAt: ts("activated_at"),
    endsAt: ts("ends_at"),
    /** e.g. { agentName, agentAddress } for registered agent service, entered at activation. */
    details: jsonb("details").$type<Record<string, string>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("entity_services_entity_idx").on(t.entityId), index("entity_services_customer_idx").on(t.customerId)],
);

/* -------------------------------------------------------------------------- */
/*  Orders & money                                                            */
/* -------------------------------------------------------------------------- */

export const orders = pgTable(
  "orders",
  {
    id: id(),
    number: integer("number").notNull().unique().generatedAlwaysAsIdentity({ startWith: 10001 }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    /** Set at checkout when an existing entity is selected, otherwise created when payment is confirmed. */
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
    type: orderType("type").notNull(),
    status: orderStatus("status").notNull().default("new"),
    currency: text("currency").notNull().default("usd"),
    subtotalCents: integer("subtotal_cents").notNull(),
    governmentFeesCents: integer("government_fees_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    /** Pre-payment answers (entity name/type/state, add-on choices). */
    checkoutData: jsonb("checkout_data").$type<Record<string, unknown>>().notNull().default({}),
    /** Onboarding answers, validated by the zod schema for the order type. */
    intake: jsonb("intake").$type<Record<string, unknown> | null>(),
    intakeSubmittedAt: ts("intake_submitted_at"),
    gateway: paymentGateway("gateway"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    termsAcceptedAt: ts("terms_accepted_at"),
    termsVersion: text("terms_version"),
    attribution: jsonb("attribution").$type<Record<string, string>>().notNull().default({}),
    paidAt: ts("paid_at"),
    completedAt: ts("completed_at"),
    cancelledAt: ts("cancelled_at"),
    refundedAt: ts("refunded_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_customer_idx").on(t.customerId),
    index("orders_status_idx").on(t.status),
    index("orders_entity_idx").on(t.entityId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "restrict" }),
    kind: lineItemKind("kind").notNull().default("service"),
    billing: billingType("billing").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitAmountCents: integer("unit_amount_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    gateway: paymentGateway("gateway").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    status: subscriptionStatus("status").notNull(),
    priceCents: integer("price_cents").notNull(),
    interval: text("interval").notNull().default("year"),
    currentPeriodStart: ts("current_period_start"),
    /** The renewal date. */
    currentPeriodEnd: ts("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: ts("canceled_at"),
    endedAt: ts("ended_at"),
    /** Keys like "2027-10-19:30" so each reminder is sent once per renewal period. */
    remindersSent: jsonb("reminders_sent").$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("subscriptions_customer_idx").on(t.customerId),
    index("subscriptions_period_end_idx").on(t.currentPeriodEnd),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    gateway: paymentGateway("gateway").notNull(),
    stripeInvoiceId: text("stripe_invoice_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    amountCents: integer("amount_cents").notNull(),
    amountRefundedCents: integer("amount_refunded_cents").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    status: paymentStatus("status").notNull(),
    description: text("description").notNull(),
    receiptUrl: text("receipt_url"),
    invoiceUrl: text("invoice_url"),
    invoicePdfUrl: text("invoice_pdf_url"),
    failureMessage: text("failure_message"),
    paidAt: ts("paid_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payments_customer_idx").on(t.customerId), index("payments_order_idx").on(t.orderId)],
);

export const webhookEvents = pgTable("webhook_events", {
  /** Stripe event id (evt_...). Primary key gives idempotency. */
  id: text("id").primaryKey(),
  source: text("source").notNull().default("stripe"),
  type: text("type").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
  processedAt: ts("processed_at"),
  error: text("error"),
});

/* -------------------------------------------------------------------------- */
/*  Fulfillment                                                               */
/* -------------------------------------------------------------------------- */

export const providerOrders = pgTable(
  "provider_orders",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
    /** "manual" today; "registered_agents_inc" once that API is integrated. */
    provider: text("provider").notNull(),
    operation: providerOperation("operation").notNull(),
    status: providerOrderStatus("status").notNull().default("pending_manual"),
    /** Provider's order/reference number (entered by an admin for manual fulfillment). */
    externalReference: text("external_reference"),
    /** Provider-neutral snapshot of what was (or must be) submitted. */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    response: jsonb("response").$type<Record<string, unknown>>().notNull().default({}),
    error: text("error"),
    submittedAt: ts("submitted_at"),
    submittedByUserId: uuid("submitted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: ts("completed_at"),
    lastSyncedAt: ts("last_synced_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("provider_orders_order_idx").on(t.orderId),
    // One open (non-terminal) provider order per order+operation keeps manual fulfillment unambiguous.
    uniqueIndex("provider_orders_open_unique")
      .on(t.orderId, t.operation)
      .where(sql`status in ('pending_manual','submitted','processing')`),
  ],
);

export const informationRequests = pgTable(
  "information_requests",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    status: infoRequestStatus("status").notNull().default("open"),
    customerResponse: text("customer_response"),
    respondedAt: ts("responded_at"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    closedAt: ts("closed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("info_requests_order_idx").on(t.orderId)],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    informationRequestId: uuid("information_request_id").references(() => informationRequests.id, {
      onDelete: "set null",
    }),
    type: documentType("type").notNull(),
    title: text("title").notNull(),
    originalFilename: text("original_filename").notNull(),
    /** Opaque key inside the private storage adapter. Never a public URL. */
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    source: documentSource("source").notNull(),
    status: documentStatus("status").notNull().default("available"),
    visibility: documentVisibility("visibility").notNull().default("customer"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    customerViewedAt: ts("customer_viewed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("documents_customer_idx").on(t.customerId),
    index("documents_entity_idx").on(t.entityId),
    index("documents_order_idx").on(t.orderId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Communication & operations                                                */
/* -------------------------------------------------------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    channel: text("channel").notNull().default("email"),
    template: text("template").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    bodyHtml: text("body_html").notNull(),
    status: notificationStatus("status").notNull(),
    transport: text("transport").notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    /** Internal notifications (to operations) are hidden from customers. */
    isInternal: boolean("is_internal").notNull().default(false),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
    sentAt: ts("sent_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_customer_idx").on(t.customerId), index("notifications_order_idx").on(t.orderId)],
);

export const supportRequests = pgTable(
  "support_requests",
  {
    id: id(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    category: supportCategory("category").notNull().default("general"),
    status: supportStatus("status").notNull().default("open"),
    source: text("source").notNull(), // "contact_form" | "account"
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
    closedAt: ts("closed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("support_requests_status_idx").on(t.status)],
);

export const adminNotes = pgTable(
  "admin_notes",
  {
    id: id(),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    supportRequestId: uuid("support_request_id").references(() => supportRequests.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("admin_notes_order_idx").on(t.orderId), index("admin_notes_customer_idx").on(t.customerId)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorType: auditActorType("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    customerId: uuid("customer_id"),
    orderId: uuid("order_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_events_order_idx").on(t.orderId),
    index("audit_events_customer_idx").on(t.customerId),
    index("audit_events_created_idx").on(t.createdAt),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: ts("reset_at").notNull(),
});

/** Cookieless, PII-free funnel events. */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    name: text("name").notNull(),
    path: text("path"),
    referrerHost: text("referrer_host"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("analytics_events_name_created_idx").on(t.name, t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type Entity = typeof entities.$inferSelect;
export type Service = typeof services.$inferSelect;
export type EntityService = typeof entityServices.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type ProviderOrder = typeof providerOrders.$inferSelect;
export type InformationRequest = typeof informationRequests.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type SupportRequest = typeof supportRequests.$inferSelect;
export type AdminNote = typeof adminNotes.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;

export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type OrderType = (typeof orderType.enumValues)[number];
export type EntityType = (typeof entityType.enumValues)[number];
export type DocumentType = (typeof documentType.enumValues)[number];
export type EntityServiceStatus = (typeof entityServiceStatus.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatus.enumValues)[number];
