# Deployment Notes

Review this file before every production deploy and update it after app, public-site, database, or Edge Function changes.

## Current status

- FretTrack 0.3.0 is deployed as the stable Operational Shop Release. Tagging and GitHub release publication follow the recorded production verification below.
- The production app is Cloudflare Pages build `1c947651.frettrack.pages.dev`. The branded app URL and public root returned `200 OK`, and the live asset references exactly matched the guarded local production build.
- Migration `20260829071930_access_application_side_effect_idempotency.sql` is applied in production. Repeated access submissions now retain one request identity/timestamp so email and archive retries reuse stable side-effect keys.
- Production migration history matches the repository through `20260829071930_access_application_side_effect_idempotency.sql`; the linked dry run reports that the remote database is up to date.
- The public landing/docs Worker is deployed as version `3ed22996-0154-4818-8599-0bc739b0d26b` and serves stable 0.3.0 access, pricing, annual savings, Terms, Privacy, Support, product guides, community links, release notes, and legacy documentation aliases.
- The 0.3.0 release branch passed the exact GitHub regression/build commands, 350 local pgTAP/RLS assertions, all 29 Playwright tests, the production deploy preflight, local data-integrity checks, migration parity, and `npm audit` with zero vulnerabilities.
- The two legacy ownerless shop profiles are formally classified as closed historical tenants because both subscriptions are canceled, neither has a Stripe customer/subscription ID, and neither has a member who could access the tenant. `B-U Music Garage` retains eight jobs and five customers for historical integrity; `Pv Music House` has no jobs or customers. The integrity gate requires an owner for every operational shop while preserving canceled historical tenants without assigning, deleting, or reactivating them.

## Commercial configuration

- FretTrack is operated by Jeffrey Russell d/b/a Torrance Guitar Repair.
- Shop is $29.99 monthly or $299.99 yearly.
- Pro is $39.99 monthly or $399.99 yearly.
- New approved workspaces receive a non-converting 14-day Pro trial with no card required.
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
3. Confirm the app visibly reports `0.3.0` without prerelease wording.
4. Confirm the public landing page and docs report stable `v0.3.0` and contain no public testing-program calls to action.
5. Confirm Terms, Privacy, Support, pricing, access application, Discord, GitHub, Reddit, Product Hunt, and Torrance Guitar Repair links.
6. Confirm unauthenticated Checkout, Billing Portal, and protected notification functions reject unauthorized requests.
7. Record the Cloudflare Pages deployment URL, landing Worker version, validation result, and any hosted migration/function changes here before publishing the `v0.3.0` GitHub release.

## Protected local files

Backup contents, local Supabase configuration, local fixture reports, screenshots, environment files, and stashes are not release artifacts unless deliberately reviewed and added. Never delete or commit them as collateral cleanup.
