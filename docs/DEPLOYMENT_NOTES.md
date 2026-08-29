# Deployment Notes

Review this file before every production deploy and update it after app, public-site, database, or Edge Function changes.

## Current status

- Stable `v0.2.9` is the currently tagged GitHub release while `release/0.3.0` prepares the stable Operational Shop Release.
- The production app already includes the post-0.2.9 Guitar Bench and print-safety work from PRs #225 and #226, deployed as Cloudflare Pages build `39ac92ae.frettrack.pages.dev`. The branded app URL and public root returned `200 OK`, and their asset references matched the guarded local production build.
- The 0.3.0 release changes application/public version metadata, release documentation, and public landing/docs content. It does not add a database migration or change a Supabase Edge Function.
- Production migration history matched the repository through `20260828022147_accounting_safe_job_void.sql` during the latest read-only comparison.
- The public landing/docs Worker currently serves stable access, pricing, annual savings, Terms, Privacy, Support, product guides, community links, and the access-application flow. The 0.3.0 public-site deployment will replace the retired public testing package with release notes while retaining old route aliases.
- The 0.3.0 release branch passed the exact GitHub regression/build commands, 343 local pgTAP/RLS assertions, all 29 Playwright tests, the production deploy preflight, local data-integrity checks, migration parity, and `npm audit` with zero vulnerabilities.
- The linked-project integrity audit still reports two legacy ownerless shop profiles. One contains historical work-order/customer data and neither has an identifiable owner or matching access request, so they must not be deleted or assigned by guesswork. Resolve or formally classify those records before the final production release gate.

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
- Restore selection must reject `FAILED.txt` and require validated completion metadata before any destructive local refresh begins.

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
- No database or Edge Function deployment is required solely for the 0.3.0 release metadata/public-site update.

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
