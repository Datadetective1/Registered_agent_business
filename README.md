# Business Agent: registered agent & business formation service

"Business Agent" is a **temporary placeholder brand**; see [Branding](#branding--pricing).

This is a lean, single-app product for selling:

- registered agent service ($99/yr, renews automatically)
- Texas LLC formation
- a business address service

Orders are fulfilled **manually** through the wholesale partner's dashboard at launch. The code is structured so a partner API can be plugged in later.

```
Visitor → product page → checkout (Company → Contact → Account → Payment via Stripe) → onboarding form → admin queue
→ admin places order with partner → status updates + documents → customer account
→ annual auto-renewal with reminders
```

- **Architecture, schema, workflows:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Day-to-day fulfillment:** [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- **Before going live:** [`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md)
- **SEO content pipeline:** [`docs/SEO_CONTENT_PLAN.md`](docs/SEO_CONTENT_PLAN.md)

## Safety rails (on by default)

| Rail | How |
| --- | --- |
| No live payments | `sk_live_` keys are refused unless `STRIPE_ALLOW_LIVE=true`. The admin dashboard shows which mode is active. |
| No real emails | `EMAIL_TRANSPORT=log` records every email in the DB. Read them at **Admin → Email outbox**. |
| No partner API calls | Only `ManualProvider` exists. It never makes network calls. |
| No state filings | Nothing submits to any government system. |
| Simulated checkout is dev-only | It's used when no Stripe key is set, and it's refused in production builds. |

## Stack

- Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS v4
- PostgreSQL with Drizzle ORM; migrations are plain SQL in `drizzle/`
- Stripe Checkout, Billing Portal and webhooks
- Built-in session auth (scrypt, hashed DB sessions), zod validation
- Vitest for unit and DB integration tests, Playwright for end-to-end and mobile tests

## Quick start (local)

Prerequisites: Node 20.9+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env                 # then edit DATABASE_URL if needed
createdb bizagent_dev                # or create it however you prefer
npm run db:migrate                   # apply migrations
npm run db:seed                      # load the product catalog (idempotent)
npm run admin:create -- --email you@yourdomain.com   # prints a generated password
npm run dev                          # http://localhost:3000
```

Without Stripe keys the app runs in **simulated payment mode**: checkout goes to a local "Pay (simulated)" page that runs the same fulfillment code as a real Stripe payment. It can also simulate a declined card.

## Stripe (test mode)

1. In the Stripe dashboard, switch to **Test mode** and copy the secret key (`sk_test_…`) into `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   ```
2. Forward webhooks locally with the Stripe CLI and copy the printed signing secret into `STRIPE_WEBHOOK_SECRET`:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,invoice.paid,invoice.payment_failed,customer.subscription.updated,customer.subscription.deleted,charge.refunded
   ```
3. In **Settings → Billing → Customer portal** (test mode), save the portal configuration once. Allow customers to update payment methods and view invoices.
4. Restart `npm run dev` and buy with test card `4242 4242 4242 4242`.

Notes:

- Products are created in Stripe automatically the first time each item is sold.
- Prices always come from the database, so the client can't change them.
- Registered agent service is a yearly Stripe subscription. Formation fees are one-time line items, and the state fee is a separate line.
- To simulate a renewal, use a Stripe [test clock](https://docs.stripe.com/billing/testing/test-clocks), or trigger `invoice.paid` / `invoice.payment_failed` with the Stripe CLI.

## Branding & pricing

- **Brand defaults:** `src/config/site.ts` holds the company name, legal name, support email and phone, address, colors, logo and social links. This is the one file to edit.
- **Live overrides:** Admin → Settings. These are saved in the `settings` table and take effect immediately, with no deploy.
- **Prices and product copy:** Admin → Settings → Services & pricing. Defaults are seeded from `src/config/catalog.ts`.
- **Canonical domain:** the `APP_URL` env var. It drives canonical tags, the sitemap, Stripe redirect URLs and email links.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server. The build needs no database. |
| `npm run lint` / `npm run typecheck` | ESLint, TypeScript |
| `npm test` | Unit and integration tests. They need Postgres; `TEST_DATABASE_URL` defaults to `bizagent_test`, which is reset on every run. |
| `npm run test:e2e` | Playwright end-to-end, auth-boundary and mobile tests against the dev server (uses `.env`'s database) |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` / `db:seed` | Apply migrations, seed the catalog |
| `npm run admin:create -- --email …` | Create or reset an admin. There is no public admin signup. |
| `npm run cron:daily` | Renewal reminders and cleanup. Alternatively, call `POST /api/cron/daily` with `Authorization: Bearer $CRON_SECRET`. |

## Project layout

```
content/        legal drafts and SEO guides (markdown)
docs/           architecture, operations runbook, launch checklist, SEO plan
drizzle/        SQL migrations
scripts/        migrate, seed, create-admin, daily cron
src/app/        (site) public pages · order/ checkout · account/ customer · admin/ · api/
src/config/     brand defaults, catalog defaults, states, legal doc list
src/server/     auth, payments, providers, fulfillment, notifications, storage, jobs
tests/          unit/, integration/ (real Postgres), e2e/ (Playwright)
```

## Deploying (not done yet)

Use a single Node host with **persistent disk** and managed Postgres, e.g. Railway, Render, Fly.io or a VPS.

Required production env:

- `APP_URL`
- `DATABASE_URL`
- `STORAGE_DIR` (on the persistent volume)
- `CRON_SECRET`
- Stripe keys
- `TRUSTED_PROXY_HOPS`, if you sit behind more than one proxy

Run `npm run db:migrate` on each deploy, and schedule the daily cron. Finish [`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md) before taking real orders.
