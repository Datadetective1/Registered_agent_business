# Launch checklist

Work through this list before taking real customers. The admin dashboard's **Launch readiness** panel tracks several of these items automatically.

## Business & legal

- [ ] Final business name, legal entity and domain chosen. Update them in `src/config/site.ts` or Admin → Settings. Set `APP_URL`.
- [ ] **All six legal documents reviewed by a licensed attorney** (`content/legal/*.md`).
  - Fill in every `[BRACKETED]` decision.
  - Then tick *attorney-reviewed* for each one in Admin → Settings.
- [ ] Refund policy decisions made for the bracketed items: registered agent after setup, renewals, and business address.
- [ ] Contract with the wholesale partner reconciled with what the site says.
  - Who is the agent of record?
  - How is non-qualifying mail handled?
  - What resignation procedure applies?
  - Is the delivery-time language accurate?
- [ ] "Registered agent address isn't a mailing address" wording confirmed against partner policy.
- [ ] Texas state page facts re-verified (`src/content/states.ts`, last verified 2026-10-19 against Texas SOS pages).

## Pricing & products

- [ ] Prices confirmed in Admin → Settings → Services & pricing. Current values are placeholders:
  - RA: $99/yr
  - Texas LLC: $49 service fee + $300 state fee
- [ ] Available registered agent states set. TX only by default; add only states you can fulfill.
- [ ] Business address service left **unavailable** until its pricing, features (actual partner capabilities) and terms are final.

## Payments (only with explicit approval)

- [ ] End-to-end test in **Stripe test mode**: purchase, webhook, renewal via test clock, failed payment, refund, and billing portal.
- [ ] Stripe account activated; business details and statement descriptor set.
- [ ] Live webhook endpoint created for `/api/webhooks/stripe` with the 7 events listed in the README.
- [ ] Billing portal configured in **live** mode.
- [ ] Only then: set the live key and `STRIPE_ALLOW_LIVE=true`.

## Email (only with explicit approval)

- [ ] Sending domain verified (SPF, DKIM, DMARC) with the email provider.
- [ ] `EMAIL_FROM` set, plus `EMAIL_TRANSPORT=resend` and `RESEND_API_KEY`.
- [ ] Templates reviewed in Admin → Email outbox. Copy lives in `src/server/notifications/templates/index.ts`.
- [ ] `operations.adminNotificationEmail` set to a monitored inbox.

## Infrastructure

- [ ] Host with a persistent volume for `STORAGE_DIR`, or an S3-compatible storage adapter implemented. Backups configured for **both** the database and document storage.
- [ ] Managed Postgres with automated backups and point-in-time recovery.
- [ ] `npm run db:migrate` runs on deploy.
- [ ] Daily cron calls `POST /api/cron/daily` with `CRON_SECRET`.
- [ ] `TRUSTED_PROXY_HOPS` matches your proxy/CDN setup (it keeps rate limiting accurate).
- [ ] If running more than one instance, set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
- [ ] HTTPS everywhere. HSTS is sent automatically in production.
- [ ] Error monitoring (e.g. Sentry) and uptime check on `/api/health`.

## Security

- [ ] Admin accounts created with `npm run admin:create`, using strong unique passwords.
- [ ] Consider adding TOTP two-factor authentication for admins before launch. Admins can see all customer data.
- [ ] The dev seed admin (`admin@example.com`) does not exist in production.
- [ ] Rate limits reviewed (`src/app/(site)/(auth)/actions.ts` and the other actions).

## SEO & analytics

- [ ] Search Console property verified; `sitemap.xml` submitted.
- [ ] Optional: privacy-friendly analytics domain set in Admin → Settings.
- [ ] Guides reviewed before publishing (`status: published`). See `docs/SEO_CONTENT_PLAN.md`.
