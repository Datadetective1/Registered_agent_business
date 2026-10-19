# Architecture & Launch Plan

This document is the plan for the launch product. It covers deliverables 1–9; the code is deliverable 10.
The working brand name is "Business Agent". It's a placeholder, set in one place (see §2.3).

---

## 1. Current-state assessment

| Item | Finding |
| --- | --- |
| Repository | Empty: no commits, no files, and an empty GitHub remote. This is a greenfield build. |
| Runtime | Node 22.22, npm 10, pnpm, bun |
| Database | PostgreSQL 16 server installed locally. No managed DB is configured yet. |
| Browsers | Chromium (Playwright build 1194) preinstalled for end-to-end tests |
| Docker | Client only, no daemon. Can't run `stripe-mock`, so Stripe is tested with signed test payloads and an injected client. |
| External services | No Stripe keys, no email provider, no domain. The app has to run end-to-end without any of them. |

What follows from this:
1. There is nothing existing to stay compatible with, so we can pick the leanest mainstream stack.
2. Payments need a **simulated gateway** for local and CI runs, and the real **Stripe test mode** gateway once keys are added.
3. Email defaults to a **log-only transport**: messages are stored and viewable in the admin outbox, and nothing is sent.

## 2. Recommended stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16 (App Router) + React 19 + TypeScript** | One deployable for the marketing site, customer app, admin and API. Server-rendered HTML is good for SEO, and Server Actions handle forms with built-in origin checks. |
| Rendering model | Request-time rendering, `cacheComponents: false` | Settings, prices and branding come from the DB and are cached in-process for 60s. The build never needs a database, and admin edits show up right away. |
| Database | **PostgreSQL** | Relational integrity for orders and money, and supported by every host. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** (`pg` driver) | Typed SQL with no binary engine. Migrations are plain SQL files in `drizzle/`. Prisma's current `latest` tag is a release candidate, so we avoided it. |
| Styling | **Tailwind CSS v4** with brand colours as CSS variables | Small CSS, no runtime cost. Colours come from settings. |
| Validation | **zod** | One schema serves form validation, server validation and provider payload typing. |
| Auth | **Built in: DB sessions + `node:crypto` scrypt** | The pattern Lucia recommends. Hashed session tokens, HttpOnly/SameSite cookies, no third-party auth service, no native dependencies. |
| Payments | **Stripe Checkout (hosted) + Billing Portal + webhooks** | PCI scope stays SAQ-A. One-time charges, annual subscriptions, saved cards, invoices and receipts are all handled by Stripe. |
| Email | `EmailTransport` interface: `log` (default) / `resend` (opt-in) | Production email stays off until it is explicitly enabled. |
| File storage | `StorageAdapter` interface: local private disk (default) | Files are stored outside `public/` and served only through an authorized route. An S3 adapter can be added later behind the same interface. |
| Tests | **Vitest** (unit + DB integration) and **Playwright** (end-to-end + mobile) | |
| Fonts | Self-hosted via `@fontsource` | No requests to Google, so nothing to disclose for privacy, and no network needed at build time. |

### 2.1 What we deliberately did NOT add
No microservices, queues, Redis, Kubernetes, event sourcing, CMS, auth SaaS, analytics SaaS or AI features.
The scheduled work (renewal reminders and cleanup) is a single cron-triggered endpoint.

### 2.2 Hosting recommendation (not deployed)
Use a single Node host with a persistent disk and managed Postgres: Railway, Render, Fly.io or a small VPS.
The default local document storage needs a persistent volume. If you deploy to serverless instead, add the S3 storage adapter first.

### 2.3 Branding & settings: one central place
- `src/config/site.ts` holds the **default** brand values: company name, legal entity, support email/phone, address, colours, logo, social links.
- The `settings` DB table holds **overrides** that you can edit at **Admin → Settings**. At runtime the overrides are merged over the defaults.
- `services` DB table holds **prices and product configuration** and is editable at **Admin → Settings → Services & pricing**.
  Defaults are seeded from `src/config/catalog.ts`.
- `APP_URL` (env) is the one canonical site URL. It's used for canonical tags, the sitemap, Stripe redirects and email links.
- Components never hard-code the brand. They read it through `getSettings()` / `useBrand()`.

---

## 3. Database schema

The source of truth is `src/db/schema.ts`. Every table uses UUID primary keys and `timestamptz` timestamps.
Money is stored as **integer cents**.

### 3.1 Identity & customers
| Table | Purpose | Key columns |
| --- | --- | --- |
| `users` | Login identity | `email` (unique, lower-cased), `password_hash`, `role` (`customer` \| `admin`), `disabled_at`, `last_login_at` |
| `sessions` | Server-side sessions | `id` = SHA-256 of the cookie token (raw tokens are never stored), `user_id`, `expires_at`, `ip`, `user_agent` |
| `user_tokens` | Password-reset tokens | hashed `id`, `purpose`, `expires_at`, `used_at` |
| `customers` | Billing/account holder (1:1 with a customer user today, ready for teams later) | `user_id`, name, phone, `mailing_address_id`, `stripe_customer_id` |
| `addresses` | Every postal address, always owned by a customer | `customer_id`, `line1`, `line2`, `city`, `state`, `postal_code`, `country` |

### 3.2 Businesses & services
| Table | Purpose | Key columns |
| --- | --- | --- |
| `entities` | A customer's company. One customer can have **many** entities. | `customer_id`, `legal_name`, `entity_type`, `jurisdiction`, `status`, `sos_file_number`, `formation_date`, `principal_address_id`, `mailing_address_id`, contact fields |
| `services` | **Catalog**: what we sell, and at what price | `code`, `kind` (`registered_agent` \| `formation` \| `business_address`), `billing` (`one_time` \| `annual`), `price_cents`, `government_fee_cents`, `jurisdiction`, `is_active`, `features`, `config` |
| `entity_services` | A **service instance** on an entity. One entity can have **many** services. | `entity_id`, `service_id`, `order_id`, `subscription_id`, `status` (`pending` \| `active` \| `cancellation_scheduled` \| `cancelled` \| `expired`), `details` (e.g. assigned agent name and address) |

Service state is kept separate from billing state. A paid RA subscription doesn't mean the RA appointment is effective yet.
`entity_services.status` tracks the operational truth, and `subscriptions` tracks money.

### 3.3 Orders & money
| Table | Purpose | Key columns |
| --- | --- | --- |
| `orders` | One checkout | `number` (human-readable, starts at 10001), `type` (`registered_agent` \| `llc_formation` \| `business_address`), `status`, totals, `checkout_data` (pre-payment answers: situation, entity incl. formation date, contact, LLC name, RA choice), `intake` (onboarding answers, zod-validated), `intake_draft` ("save and finish later" values), Stripe session/intent ids, `terms_accepted_at`, `attribution` |
| `order_items` | Line items. Service fees and **government fees are separate lines**. | `service_id`, `kind` (`service` \| `government_fee`), `billing`, `unit_amount_cents`, `quantity`, `total_cents` |
| `subscriptions` | Annual auto-renewing services (mirrors Stripe) | `stripe_subscription_id`, `status`, `current_period_end` (renewal date), `cancel_at_period_end`, `reminders_sent` |
| `payments` | Every charge attempt, including renewals; this is the customer's invoices/receipts list | `amount_cents`, `status`, `stripe_invoice_id`, `stripe_payment_intent_id`, `receipt_url`, `invoice_url`, `invoice_pdf_url`, `failure_message` |
| `webhook_events` | Idempotency log for Stripe events | `id` = Stripe event id, `processed_at`, `error` |

### 3.4 Fulfillment
| Table | Purpose | Key columns |
| --- | --- | --- |
| `provider_orders` | Each piece of work handed to a wholesale provider. A switching customer's order has two: `registered_agent` and `change_of_agent`. | `order_id`, `entity_id`, `provider` (`manual` today), `operation`, `status` (`pending_manual` \| `submitted` \| `processing` \| `completed` \| `failed` \| `cancelled`), `external_reference`, `payload` (snapshot of what was or must be entered), `response` |
| `information_requests` | Admin asks the customer for more information | `order_id`, `message`, `status` (`open` \| `responded` \| `closed`), `customer_response` |
| `documents` | Metadata for privately stored files | `customer_id`, `entity_id`, `order_id`, `information_request_id`, `type`, `source`, `status`, `visibility` (`customer` \| `internal`), `storage_key`, `mime_type`, `size_bytes`, `sha256`, `metadata`, `customer_viewed_at` |

### 3.5 Communication & operations
| Table | Purpose |
| --- | --- |
| `notifications` | Every email we generate: template, recipient, subject, rendered body, status (`logged` \| `sent` \| `failed` \| `skipped`). It doubles as the admin outbox and the customer's notification list. |
| `support_requests` | Contact-form and in-account support messages |
| `admin_notes` | Internal notes on an order, customer, entity or support request. Customers never see them. |
| `audit_events` | Who did what, when, and from where: auth events, status changes, document access, settings changes, webhook effects |
| `settings` | Key → JSON overrides for branding and operational settings |
| `rate_limits` | Fixed-window counters, so rate limiting works across instances without Redis |
| `analytics_events` | Cookieless, PII-free funnel events |

### 3.6 Relationships (summary)
```
users 1─1 customers 1─* entities 1─* entity_services *─1 services
customers 1─* orders 1─* order_items *─1 services
orders 1─* provider_orders, information_requests, documents, notifications
entities 1─* subscriptions 1─* payments
customers 1─* documents, support_requests, notifications, addresses
```

---

## 4. Directory structure

```
├─ content/guides/*.md        SEO guides (markdown + frontmatter); drafts are unpublished
├─ docs/                      ARCHITECTURE, OPERATIONS (fulfillment runbook), LAUNCH_CHECKLIST
├─ drizzle/                   generated SQL migrations (committed)
├─ scripts/                   seed, create-admin, cron
├─ storage/                   private uploads (git-ignored, never public)
├─ src/
│  ├─ app/
│  │  ├─ (site)/              public marketing pages, legal, guides, auth pages
│  │  ├─ order/               pre-checkout + success/cancel + simulated checkout
│  │  ├─ account/             customer dashboard
│  │  ├─ admin/               admin dashboard
│  │  ├─ api/                 stripe webhook, document download, cron, analytics, health
│  │  ├─ sitemap.ts robots.ts opengraph-image.tsx layout.tsx globals.css
│  ├─ components/             ui/ (primitives), site/, account/, admin/
│  ├─ config/                 site.ts (brand defaults), catalog.ts (product defaults), states.ts, legal.ts
│  ├─ db/                     schema.ts, client
│  ├─ lib/                    pure helpers (money, format, status labels, intake schemas); usable on the client
│  └─ server/                 server-only domain logic
│     ├─ auth/                passwords, sessions, guards
│     ├─ payments/            gateway interface, stripe, simulated, webhook handler
│     ├─ providers/           FulfillmentProvider interface, ManualProvider, registry
│     ├─ notifications/       send(), transports, templates/
│     ├─ storage/             StorageAdapter, local disk, upload validation
│     ├─ orders.ts fulfillment.ts settings.ts audit.ts rate-limit.ts analytics.ts ...
└─ tests/                     unit/, integration/, e2e/
```

The rule: `src/server/**` imports `server-only`. Database access happens only in `src/server` and the `src/db` client.
Pages and actions call into `src/server`, and every customer query is **scoped by the session's `customer_id`**.

---

## 5. Page map

**Public (indexable)**
`/` · `/registered-agent` · `/registered-agent/states` · `/{state}-registered-agent` (rewritten to `/registered-agent/[state]`; only states with real content, Texas at launch) ·
`/start-an-llc-texas` (formation service) · `/texas-llc` (informational guide) · `/business-address` · `/pricing` · `/how-it-works` · `/faq` · `/about` · `/contact` ·
`/guides` · `/guides/[slug]` · `/legal/[slug]` (terms, privacy, refund-policy, registered-agent-terms, formation-disclaimer, mail-address-terms)

**Auth (noindex)**: `/sign-in` · `/create-account` · `/forgot-password` · `/reset-password`

**Redirects (308)**: `/start-an-llc` → `/start-an-llc-texas`, `/registered-agent/{state}` → `/{state}-registered-agent`.

**Order flow (noindex)**: `/order/registered-agent` · `/order/llc-formation` · `/order/business-address` (each `?step=company|contact|account|payment`) ·
`/order/[id]/success` · `/order/[id]/cancelled` · `/order/[id]/simulated-checkout` (development only)

**Customer account (noindex, auth)**: `/account` · `/account/entities/[id]` · `/account/orders` · `/account/orders/[id]` ·
`/account/orders/[id]/onboarding` · `/account/documents` · `/account/billing` · `/account/profile` · `/account/support`

**Admin (noindex, admin role)**: `/admin` · `/admin/orders[/id]` · `/admin/customers[/id]` · `/admin/entities[/id]` ·
`/admin/subscriptions` · `/admin/payments` · `/admin/documents` · `/admin/support[/id]` · `/admin/notifications[/id]` ·
`/admin/audit` · `/admin/analytics` · `/admin/settings` · `/admin/settings/services`

**SEO plumbing**: `sitemap.xml` (public pages + published guides + live state pages), `robots.txt` (disallows account, admin, order, api),
canonical URLs from `APP_URL`, Open Graph/Twitter metadata, JSON-LD (Organization, Service/Offer, FAQPage, BreadcrumbList, Article).

---

## 6. Customer workflow

1. **Land → learn.** Home, product pages and pricing all show transparent prices, with service fee and state fee shown separately.
2. **Checkout** (`/order/...`, `src/components/checkout/wizard.tsx`): four steps, Company → Contact → Account → Payment.
   - **Company.** RA: "I already have a business" or "I'm forming a new business", then legal name, entity type, state, and an optional formation date ("I don't know" is fine). Signed-in customers can pick a business on file. Forming a Texas LLC offers to switch to the formation checkout with the answers carried over, so formation + state fee + RA is one order. LLC: desired name and the registered agent choice.
   - **Contact.** Name, email, phone, country and mailing address (saved to the profile).
   - **Account.** Created (or signed into) without leaving checkout. An email that already has an account switches to sign-in in place. Signed-in customers skip this step.
   - **Payment.** Itemized review with government fees labelled, edit links, terms, then "Pay securely".
   - The step is in the URL, so back/forward and refresh work. Answers are kept in `sessionStorage` for the tab (never the password) and cleared on the success page. The same validators (`src/lib/checkout.ts`) run in the browser and again in the server actions (`src/app/order/actions.ts`).
3. **Pay** on Stripe Checkout (test mode), or on the simulated checkout locally (which can also simulate a declined card). Prices are always computed on the server from `services`.
4. **Payment confirmed.** This is the webhook, or the success-page fallback; both run the same idempotent function.
   - The order moves to `payment_confirmed`.
   - The entity is created if it's new.
   - For RA, the subscription and the entity service (status `pending`) are recorded.
   - The payment is recorded, the customer gets an order-confirmation email, and the admin gets an alert.
5. **Onboarding** (`/account/orders/[id]/onboarding`): a product-specific form, prefilled from checkout.
   - "Save and finish later" stores unvalidated values in `orders.intake_draft`.
   - RA: entity details, addresses, contact for forwarding, current agent. "Currently has a different registered agent" also creates a `change_of_agent` provider order.
   - LLC: Texas Form 205 information.
   - When it's submitted: `ready_for_fulfillment`, a `provider_orders` row is created through the provider abstraction, and the customer sees a confirmation.
   - Customers see four plain stages: Order received → Information submitted → Processing → Completed.
   - The customer can keep editing these answers until an admin marks the order submitted to the provider.
6. **Track.** The dashboard shows entities, services, RA status, renewal dates, order timelines, and documents to download.
7. **Respond** to information requests: reply and/or upload documents.
8. **Renew automatically** each year through the Stripe subscription. Reminders go out 30 and 7 days before renewal (configurable).
   - Payment success and failure emails are sent.
   - The customer can update their card in the Stripe portal.
   - They can **turn off auto-renewal**. A clear warning explains that the RA appointment ends and the state must be updated. The admin is notified.

## 7. Admin workflow (manual fulfillment)

1. **Queue.** `/admin` tiles: New orders, Needs information, Ready for provider, Submitted, Processing, Completed (30 days), Upcoming renewals, Failed payments. "Ready for provider" is the main work queue; orders that also need a change-of-agent filing carry a badge.
2. **Open the order** to see the customer, entity, items and payment, the intake answers, and the **Provider entry sheet**.
   The sheet lists every field in provider-dashboard order, with one-click copy and "copy all".
3. **Place the order** in the wholesale partner dashboard by hand.
4. **Record it.** The order page has one button per next step (Request information, Mark ready for provider, Mark submitted to provider + reference, Mark processing, Mark completed, Cancel, Refund). Click "Mark submitted to provider" and enter the provider's reference.
   The order moves to `submitted_to_provider`, the customer is notified, and the action is audit-logged.
5. **Progress:** `processing` → `completed`. At each step the admin can add an internal note, notify the customer (a checkbox), request information (order → `information_needed` + email), or upload documents (customer-visible or internal).
6. **Change of agent** (switching customers only). The change-of-agent filing has its own card: record its reference and move it Submitted → Completed. The order can't be completed while it's open.
7. **Complete.** Upload the filed documents and enter the RA details (assigned agent name and address).
   The entity service becomes `active` and the customer gets a completion email.
8. **Ongoing.** When a service-of-process or state-mail document arrives, upload it to the entity. The customer is emailed immediately.
9. **Everything is audited.** Each order page shows a readable status history and the raw audit trail.

Order statuses and allowed transitions (`src/lib/order-status.ts`):
```
new → payment_confirmed | cancelled
payment_confirmed → information_needed | ready_for_fulfillment | cancelled | refunded
information_needed → ready_for_fulfillment | cancelled | refunded
ready_for_fulfillment → submitted_to_provider | information_needed | cancelled | refunded
submitted_to_provider → processing | completed | information_needed | cancelled | refunded
processing → completed | information_needed | cancelled | refunded
completed → refunded
cancelled → refunded
```
Refunds: the admin "Refund" button (with a confirmation tick box) refunds through the gateway only in Stripe **test** mode or the simulated gateway, then marks the order refunded and cancels its services and auto-renewal. Live-mode refunds stay in the Stripe dashboard until live refunds from the app are explicitly approved.

## 8. Provider abstraction

```ts
// src/server/providers/types.ts
interface FulfillmentProvider {
  readonly id: 'manual' /* | 'registered_agents_inc' later */;
  readonly isAutomated: boolean;
  createRegisteredAgentOrder(input: RegisteredAgentOrderInput): Promise<ProviderSubmission>;
  createChangeOfAgentOrder(input: ChangeOfAgentInput): Promise<ProviderSubmission>;
  createFormationOrder(input: FormationOrderInput): Promise<ProviderSubmission>;
  createBusinessAddressOrder(input: BusinessAddressOrderInput): Promise<ProviderSubmission>;
  createEINOrder(input: EinOrderInput): Promise<ProviderSubmission>;
  getOrderStatus(ref: ProviderOrderRef): Promise<ProviderStatus>;
  getDocuments(ref: ProviderOrderRef): Promise<ProviderDocument[]>;
  updateEntity(input: UpdateEntityInput): Promise<ProviderSubmission>;
  cancelService(input: CancelServiceInput): Promise<ProviderSubmission>;
}
```

- **Inputs are provider-neutral.** They're built from our own data by `src/server/providers/payloads.ts`. They are not provider API shapes.
- **`ManualProvider`** never calls any network. Each `create*` returns `{ status: 'pending_manual', instructions, fields }`, and `fields` is exactly what the admin entry sheet renders.
  `getOrderStatus` reads back what the admin recorded. `getDocuments` returns `[]`, because documents are uploaded by hand.
- **`fulfillment.ts`** is the only caller. It persists every result to `provider_orders`, so swapping providers changes no UI or business logic.
- **Registry**: the `fulfillment.provider` setting picks the provider, and only `manual` is registered.
- **Adding `RegisteredAgentsIncProvider` later** means:
  1. Implement the interface against their **documented** API.
  2. Register it.
  3. Map their status and webhook events onto `provider_orders.status`.
  4. Flip the setting.

  Nothing in this repo guesses at their endpoints or calls them.

## 9. Implementation plan (phases)

| # | Phase | Exit criteria |
| --- | --- | --- |
| 1 | Scaffold: Next 16, Tailwind, Drizzle, test tooling, brand config, UI primitives | `lint`, `typecheck`, `test` green |
| 2 | Schema, migrations, seed (services, settings, admin) | Migrations apply to a clean DB, seed is idempotent |
| 3 | Auth: sessions, roles, password reset, rate limits, origin checks, audit | Auth integration tests pass, including cross-customer access denial |
| 4 | Public site: all pages, SEO plumbing, legal drafts, guides architecture | Pages render on mobile and desktop, sitemap/robots valid |
| 5 | Checkout: order creation, Stripe Checkout (test) + simulated gateway, webhooks, idempotent payment confirmation, ManualProvider | Webhook signature tests and idempotency tests pass |
| 6 | Customer account: onboarding forms, dashboard, documents, billing, profile, support, renewal toggle | Customer can complete onboarding and see status and documents |
| 7 | Admin: queue, order detail + entry sheet, status workflow, notes, info requests, uploads, all lists, settings | Admin can take an order from paid to completed |
| 8 | Notifications, templates, renewal reminders cron, analytics | Templates render, reminders are deduplicated |
| 9 | End-to-end: the milestone flow in Playwright, mobile screenshots, auth-boundary e2e | Green e2e run |
| 10 | Docs: README, operations runbook, launch checklist | |

### Explicit non-goals for launch
- No real Registered Agents Inc. API calls.
- No live Stripe: the app refuses `sk_live_` keys unless `STRIPE_ALLOW_LIVE=true`.
- No production email: `EMAIL_TRANSPORT=log` is the default.
- No deployment.
- No state-system submissions of any kind.
