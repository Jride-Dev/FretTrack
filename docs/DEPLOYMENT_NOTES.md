# Deployment Notes

Review this file before every production deploy and update it after app, public-site, database, or Edge Function changes.

## Current status

- FretTrack 0.3.1 is deployed as the current stable maintainability release over the Operational Shop Release.
- The production app is Cloudflare Pages build `c07a0402.frettrack.pages.dev`. The branded app URL and immutable Pages build returned `200 OK`; the deployed application includes the purchase-package correction and guarded shop tax-profile boundary.
- Migration `20260829071930_access_application_side_effect_idempotency.sql` is applied in production. Repeated access submissions now retain one request identity/timestamp so email and archive retries reuse stable side-effect keys.
- Production migration history matches the repository through `20260901025709_shop_tax_profile_boundary.sql`; the linked migration check and post-deploy dry run report that the remote database is up to date.
- The public landing/docs Worker is deployed as version `c420169b-9971-4b38-9bfa-a955d2d19984` and serves stable 0.3.1 self-service registration, pricing, annual savings, Terms, Privacy, Support, product guides, community links, release notes, tax responsibility guidance, and legacy documentation aliases. The retired application modal is absent, and legacy application submissions fail closed unless the historical compatibility switch is explicitly enabled.
- PR #256 passed regression/build, npm audit, and the full local database/browser workflow. Production smoke checks returned `200` for landing, Support, and FAQ; confirmed the direct `?signup=1` account CTA and confirmed-email copy; confirmed the retired modal is absent; and confirmed the legacy application endpoint returns `410 Gone` without accepting a submission.
- PR #247 and follow-up PR #248 passed GitHub regression/build, the full local database/browser job, and `npm audit`. Local validation passed 438 pgTAP/RLS assertions, public/private schema lint, focused tax and commerce checks, permission/tier gates, the production deploy preflight, and a zero-vulnerability audit. Tax calculation now defaults disabled, requires an explicit manual jurisdiction, versions the shop profile, freezes applied tax provenance in estimate/invoice snapshots, discounts the taxable base proportionally, preserves legacy work-order inheritance, and safely disables incomplete legacy shop defaults for owner review.
- PR #243 passed GitHub regression/build, the full local database/browser job, and `npm audit`; locally it passed 411 pgTAP/RLS assertions, the Supabase security advisor with no findings, the production deploy preflight, and the focused authenticated estimate workflow. The deployed estimate lifecycle stores server-calculated snapshots, locks sent totals, records approval or decline, requires explicit revision drafts, serializes charge mutations with snapshot creation, and safely replays lost-response retries without duplicate audit events.
- PR #245 passed GitHub regression/build, the full local database/browser job, and `npm audit`; locally it passed 414 pgTAP/RLS assertions, schema lint, inventory/specialist checks, the production deploy preflight, and a focused authenticated browser test proving one five-pack at $19.40 remains a $19.40 vendor charge with a derived $3.88 inventory-each valuation. Package count, package contents, and whole-package vendor price are now distinct, and the exact package price is stored separately from rounded per-item valuation.
- PR #241 passed the exact GitHub regression/build commands, 380 local pgTAP/RLS assertions, all 30 Playwright tests, focused photo/message/payment race checks, the production deploy preflight, migration parity, and `npm audit` with zero vulnerabilities. The deployed application prevents pending photo deletion from being reversed by upload completion, makes photo and message retries reuse stable operation identities, and routes payments/refunds through the guarded append-only commerce boundary without a conflicting full-draft save.
- The two legacy ownerless shop profiles are formally classified as closed historical tenants because both subscriptions are canceled, neither has a Stripe customer/subscription ID, and neither has a member who could access the tenant. `B-U Music Garage` retains eight jobs and five customers for historical integrity; `Pv Music House` has no jobs or customers. The integrity gate requires an owner for every operational shop while preserving canceled historical tenants without assigning, deleting, or reactivating them.

## Commercial configuration

- FretTrack is operated by Jeffrey Russell d/b/a Torrance Guitar Repair.
- Shop is $29.99 monthly or $299.99 yearly.
- Pro is $39.99 monthly or $399.99 yearly.
- New email-confirmed users can create one workspace without manual approval; it receives a non-converting 14-day Pro trial with no card required.
- Production Stripe account: `acct_1U8kPt2mvRJalgin`.
- Production webhook: `we_1U8lOW2mvRJalgincc2N7SPn`.
- Production customer portal configuration: `bpc_1U8lui2mvRJalgineCPlaGoc`.
- Checkout is enabled for eligible owners/admins, requires Terms acceptance, and uses an empty pilot allowlist. Existing subscriptions retain Billing Portal access even if new Checkout is later closed.
- Automatic tax remains disabled until applicable registrations and obligations are confirmed.
- Never print or replace the hosted Stripe API key, webhook signing secret, price IDs, or other secret values during ordinary verification.

## Hosted service baseline

- Stripe Billing uses authenticated Checkout/Portal functions and a signature-verified webhook with atomic event claims, lease recovery, event ordering, and replay handling.
- Access-notification function slugs and database objects containing `beta` remain deployed compatibility identifiers; customer-facing copy uses **FretTrack access** and **Account Access**.
- Pro Scheduled Email uses `send-email`; Automated Service Reminders use the JWT-protected `send-service-reminders` worker and the `frettrack-service-reminders-nightly` Cron job at 03:17 UTC.
- Reminder rules default to disabled until a shop explicitly configures and enables one.
- The isolated Stripe sandbox passed annual Checkout, plan change, cancellation, payment lifecycle, duplicate replay, older-event rejection, and cleanup validation.

## Backup and recovery baseline

- Daily hosted snapshots are managed by `scripts/backup-hosted-supabase.ps1` and the `FretTrack Daily Supabase Backup` scheduled task.
- The workflow captures database dumps, migration history, row counts, function sources, checksums, comparison reports, and Storage objects. Manual full backups also archive the local Docker database volume.
- Three consecutive unattended daily backups were recorded from 2026-08-22 through 2026-08-24.
- The 2026-08-11 hosted-to-local restore drill matched 73 table counts, 58 migrations, application integrity, and all 194 Storage object hashes.
- Pre-migration snapshot `backups/hosted-supabase-20260826-111909` completed with 4,911 checksummed files and no failure marker or schema/migration-history drift.
- Pre-release snapshot `backups/hosted-supabase-20260829-005315` completed with database, migration-history, Storage, manifest, and checksum artifacts and no failure marker. Its comparison report found no schema or migration-history drift before the 0.3.0 migration.
- Restore selection must reject `FAILED.txt` and require validated completion metadata before any destructive local refresh begins.

## 0.3.0 production verification

- Merged release PR #227 at `6562fe39586a15ffb885be28fd404567d82fa815` and the historical-tenant gate correction in PR #228 at `2c33f72e21e7e793954c3e5642f856357ad2e24e`.
- Applied production migration `20260829071930`; verified its history row, anonymous intake grant, linked data integrity, repository parity, and an empty migration dry run.
- Deployed Cloudflare Pages build `https://1c947651.frettrack.pages.dev` and public Worker version `3ed22996-0154-4818-8599-0bc739b0d26b`.
- Verified `200 OK` for the branded app, public root, docs, release notes, Terms, Privacy, Support, and both legacy testing-document aliases.
- Verified the live app asset list matches the guarded build, the application bundle reports `0.3.0` without prerelease copy, and public pages retain CSP plus MIME-sniffing protection.
- Verified Discord, GitHub, Reddit, Product Hunt, and Torrance Guitar Repair links, and confirmed unauthenticated Checkout, Billing Portal, and approval-notification requests return `401`.

## 0.3.1 production verification

- Merged release PR #235 at `e1204134e6b778c81151593d53b04fa140033f28` after ITO and all GitHub quality/security gates passed.
- Deployed Cloudflare Pages build `https://bcc1d845.frettrack.pages.dev` and public Worker version `e25e1800-1b76-434b-b4a2-9dfc27d6dfd5`.
- Verified `200 OK` for the branded app, public root, docs, release notes, pricing, Terms, Privacy, Support, and access application.
- Verified the live app asset list exactly matches the guarded production build and the deployed application chunk reports `0.3.1`.
- Verified CSP and MIME-sniffing protection on the app and public root, retained Discord, GitHub, Reddit, Product Hunt, and Torrance Guitar Repair links, and found no public beta-testing call to action.
- Confirmed unauthenticated Checkout, Billing Portal, and approval-notification requests return `401`.
- No database migration or Edge Function deployment was required; production migration history remained aligned through `20260829071930_access_application_side_effect_idempotency.sql`.

## Standard app deployment

Before deployment:

```powershell
git status
git branch --show-current
npm run check:migrations
npm run check:landing-worker
npm run check:permissions
npm run check:tiers
npm run check:version-consistency
npm run check:stable-release
npm run build
npm run deploy:app:production:check
git diff --check
```

Deploy the app only through the guarded wrapper:

```powershell
npm run deploy:app:production
```

The wrapper forces the reviewed production Supabase URL and function key, clears local test-shop defaults, builds `dist`, rejects unsafe compiled configuration, and then deploys Cloudflare Pages.

## Public landing/docs deployment

When `cloudflare/frettrack-coming-soon` changes:

```powershell
npm run check:landing-worker
npx wrangler deploy --config cloudflare/frettrack-coming-soon/wrangler.jsonc
```

Afterward, verify `/`, `/docs`, `/docs/release-notes`, `/terms`, `/privacy`, `/support`, community links, and the legacy `/testing-checklist` plus `/docs/workflow-testing` aliases. The old aliases must show current release information rather than retired testing copy.

## Database and function deployment

- Do not use a blanket production migration push when local-only migrations are present or history is misaligned.
- Review `supabase migration list --linked`, `supabase db push --linked --dry-run`, and `npm run check:migrations` before schema work.
- Apply only reviewed migrations in order, then verify history and application behavior.
- Deploy database changes before dependent Edge Functions and dependent frontend code.
- Confirm secret names or digests without printing values.
- Apply `20260829071930_access_application_side_effect_idempotency.sql` before deploying the 0.3.0 public landing/docs Worker. No Supabase Edge Function deployment is required for this follow-up.
- Keep canceled ownerless historical tenants inaccessible and non-billable. Do not assign or delete them without a separately reviewed recovery or retention request.

## Post-deployment verification

1. Confirm `https://app.frettrack-app.com/` and `https://frettrack-app.com/` return `200 OK`.
2. Confirm the app HTML references the same assets as the guarded production build.
3. Confirm the app visibly reports the current release version without prerelease wording.
4. Confirm the public landing page and docs report the current stable version and contain no public testing-program calls to action.
5. Confirm Terms, Privacy, Support, pricing, access application, Discord, GitHub, Reddit, Product Hunt, and Torrance Guitar Repair links.
6. Confirm unauthenticated Checkout, Billing Portal, and protected notification functions reject unauthorized requests.
7. Record the Cloudflare Pages deployment URL, landing Worker version, validation result, and any hosted migration/function changes here before publishing the matching GitHub release.

## Protected local files

Backup contents, local Supabase configuration, local fixture reports, screenshots, environment files, and stashes are not release artifacts unless deliberately reviewed and added. Never delete or commit them as collateral cleanup.
