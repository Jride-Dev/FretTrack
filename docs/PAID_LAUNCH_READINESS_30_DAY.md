# Paid Launch Readiness: 30-Day Plan

Date: 2026-08-11
Last updated: 2026-08-14

## Current Verdict

FretTrack's paid launch target is Stripe-powered self-serve billing, not a controlled manual paid beta.

The core repair workflow, guarded production deploy path, migration drift checks, data-integrity checks, Stripe self-service foundation, and a full local database-and-Storage restore drill are in place. The remaining paid-launch risks are operational: completing backup reliability evidence, handling the remaining Auth/security settings, and validating real Stripe lifecycle events end to end.

## Verified on 2026-08-11

- `npm run check:migrations` passed against the linked Supabase project.
- `npm run check:supabase-data-integrity` passed against the linked Supabase project.
- Remote migration history is aligned through `20260814041144`.
- Production deploy protection exists through `npm run deploy:app:production` and `npm run check:production-build-config`.
- Stripe Checkout opened successfully from the production owner Billing page without changing the shop subscription merely by opening the flow.
- `create-checkout-session`, `create-billing-portal-session`, and the source-controlled `stripe-webhook` are deployed; Checkout/Portal require JWTs and the webhook uses Stripe signature verification.
- The focused `set_updated_at` search-path hardening migration is applied remotely; its local Supabase Security Advisor validation returned no warnings.
- Stripe billing concurrency migration `20260814041144` is applied remotely. The matching `stripe-webhook` version 12 is active, anonymous access to its synchronization table/RPCs returns HTTP 401, and a webhook request without a Stripe signature fails closed with HTTP 400.

## Backup and Restore Readiness

FretTrack has a repository-backed backup workflow:

```powershell
npm run backup:supabase
```

The backup script captures hosted database SQL dumps, migration history, current migration/function source folders, checksums, row counts, compare reports, and Supabase Storage bucket files. Storage object binaries are intentionally copied separately because database dumps only include Storage metadata.

Scheduled-backup status:

- Windows Scheduled Task `FretTrack Daily Supabase Backup` exists and is enabled.
- A manual invocation of the exact scheduled task completed successfully on `2026-08-11` with Task Scheduler result `0` and snapshot `backups/hosted-supabase-20260811-182456`.
- That snapshot independently passed SHA-256 validation for all 4,873 manifest entries and contains the current migration history plus 194 Storage object binaries.
- The backup script now starts Docker Desktop and waits for its engine because current Supabase CLI database dumps require Docker. The scheduled task skips only the optional local-volume archive; manual full backups and pre-restore safety archives still capture it.
- A complete local restore drill from that snapshot passed on `2026-08-11`: 73 backed-up table counts matched, local data-integrity checks passed, all 58 migrations aligned, and all 194 restored Storage downloads matched the snapshot SHA-256 hashes.
- A fresh pre-migration full backup completed on `2026-08-14` at `backups/hosted-supabase-20260814-113801`. It contains 4,883 hashed manifest files, 73 backed-up table counts, all 59 then-remote migrations, and 198 Storage object binaries; its compare report found no schema or migration-history change from the preceding snapshot.

Paid-launch requirement:

- Record three consecutive successful daily scheduled backup runs, or move daily production backups to a reliable always-on machine/runner.
- Repeat the local restore drill after material schema/Auth/Storage version changes; the `2026-08-11` baseline drill is recorded in `docs/test-reports/paid-launch-restore-drill-2026-08-11.md`.

## Restore Drill

Use this for local restore testing only. Do not restore over production unless a separate incident plan has been approved.

1. Confirm the intended snapshot folder.

   ```powershell
   Get-ChildItem F:\FretTrack\backups -Directory -Filter "hosted-supabase-*"
   ```

2. Confirm it contains:

   - `schema.sql`
   - `data.sql`
   - `migration_history_schema.sql`
   - `migration_history_data.sql`
   - `storage-buckets/`
   - `manifest.json`
   - `checksums.sha256`
   - `row-counts.txt`
   - `migration-versions.txt`
   - `compare-report.md`

3. Start local Supabase.

   ```powershell
   supabase start
   ```

4. Refresh local Supabase from the latest hosted backup.

   ```powershell
   npm run db:local:refresh-from-backup
   ```

5. Validate restore health.

   ```powershell
   npm run check:migrations
   npm run check:supabase-data-integrity
   npm run build
   git diff --check
   ```

6. Smoke-test restored data locally:

   - Login to an owner/admin account.
   - Open Customers, Current Jobs, Job Detail, Inventory, Purchase Orders, Scheduling, Reports, Billing, and Operator if applicable.
   - Open several older jobs and confirm customer, instrument, work notes, photos, payments, purchase orders, receipts, and reports render.
   - Confirm Storage-backed images load from the restored local Storage state where expected.

7. Record the drill result in `docs/test-reports/` without customer secrets or private customer details.

## Stripe and Billing Gap Audit

Implemented foundation:

- Plans, entitlements, subscriptions, subscription state, usage snapshots, and operator trial controls exist.
- The app has a Billing page with current plan/status/usage display.
- Write access is gated by active paid/trial/read-only state.
- Usage caps exist for email recipients and photos.

Stripe-ready implementation now deployed:

- `create-checkout-session` creates authenticated Stripe Checkout subscription sessions for Shop and Pro monthly/yearly prices.
- `create-billing-portal-session` opens the Stripe Billing Portal for an existing shop Stripe customer.
- `stripe-webhook` verifies Stripe signatures from the raw request body, records processed event IDs, and updates FretTrack subscription state from Stripe subscription and invoice events.
- Opening, canceling, abandoning, or failing Checkout does not mutate the shop's current plan or entitlements; subscription writes occur only after a signature-verified Stripe webhook.
- Webhook synchronization maps opaque Price IDs by exact configured-secret comparison, stores the Stripe recurring interval explicitly, and retries previously failed event IDs.
- Invoice payment events resolve their subscription through Stripe's current `parent.subscription_details.subscription` payload, with a legacy fallback; `invoice.paid` recovery and `invoice.payment_succeeded` remain supported.
- Executable Deno lifecycle tests cover current and legacy invoice payloads plus active, trialing, past-due, incomplete, canceled, and paused/read-only mappings.
- The Billing page now exposes Stripe Checkout and Billing Portal actions to shop owners/admins.
- Stripe webhook events are source-controlled through `stripe_webhook_events` for idempotency and operational review.
- Shop-scoped synchronization generations and atomic service-role-only subscription/profile writes prevent older or late-finishing webhook handlers from overwriting newer billing state.

Launch gaps still requiring real Stripe account data and live validation:

- Confirm the configured production Stripe prices and webhook endpoint again immediately before paid launch.
- Automated subscription creation, renewal, cancellation, past-due, failed-payment, payment recovery, and trial-ended handling must be verified end to end from Stripe events.
- The current function-key gate for document email is browser-facing build configuration and should be treated as a weak gate, not a paid-launch security boundary. Server-side authenticated membership checks should remain the real authority.

Required Supabase secrets:

```powershell
supabase secrets set STRIPE_API_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_SHOP_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_SHOP_YEARLY=price_...
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_PRO_YEARLY=price_...
supabase secrets set FRETTRACK_APP_URL=https://app.frettrack-app.com
```

Do not paste real Stripe secrets into committed files or screenshots. The functions also accept `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` aliases, but the current hosted project already uses `STRIPE_API_KEY` and `STRIPE_WEBHOOK_SIGNING_SECRET`.

## Exact 30-Day Launch Checklist

### Days 1-3: Recovery and Deploy Safety

- Fix the scheduled backup reliability issue.
- Record three consecutive successful scheduled backups.
- Complete one local restore drill from a hosted snapshot.
- Confirm Storage objects are included and restored where needed.
- Confirm `npm run deploy:app:production:check` passes before every production deploy.
- Keep the local-development isolation and production-build guard mandatory.

### Days 4-7: Stripe Configuration

- Finalize public plan names, prices, feature boundaries, trial duration, and cancellation terms.
- Create live Stripe products/prices for Shop Monthly, Shop Yearly, Pro Monthly, and Pro Yearly.
- Set the Stripe price IDs as Supabase secrets.
- Set the Stripe webhook signing secret as a Supabase secret.
- Configure Stripe webhook delivery to the deployed `stripe-webhook` Edge Function URL.
- Confirm support escalation path for billing problems.

### Days 8-14: Stripe Billing Validation

- Deploy `create-checkout-session`, `create-billing-portal-session`, and `stripe-webhook`.
- Keep JWT verification enabled for Checkout/Portal and deploy only `stripe-webhook` with `--no-verify-jwt`; its verified Stripe signature is the external-call authentication boundary.
- Verify subscription created, renewed, canceled, past due, payment failed, payment recovered, and trial ended events.
- Verify Stripe event idempotency and replay safety.
- Verify failed webhook deliveries retry successfully without being suppressed as completed duplicates.
- Verify webhook signature validation.
- Verify an abandoned or canceled Checkout leaves the existing beta/paid subscription and entitlements unchanged.
- Verify Billing Portal return flow.
- Verify owner/admin-only billing access.
- Verify tech/viewer accounts cannot open Checkout or Portal sessions.

### Days 15-20: Security and Data Safety

- Run a paid-launch RLS review across jobs, customers, invoices, messages, photos, inventory, purchase orders, reports, billing, and operator flows.
- Confirm all Edge Functions perform server-side membership/shop checks.
- Confirm no service role key or provider secret exists in frontend bundles.
- Confirm browser-facing keys are not treated as security authorities.
- Confirm public docs explain privacy, backups, uptime, and support boundaries plainly.
- If the production Supabase project is on Pro, enable its leaked-password protection; otherwise record that accepted risk and use the strongest available password settings. Then verify normal owner/admin/tech/viewer sign-in and password-reset flows.
- The linked organization was confirmed on the Free plan on `2026-08-11`; leaked-password protection is therefore recorded as unavailable for now. Email confirmation is required and anonymous/phone sign-in are disabled, but the dashboard password-strength setting still needs a final manual check before launch.

### Days 21-25: Production Smoke Matrix

- Test owner/admin/tech/viewer/expired/read-only roles.
- Test new job, work notes, Job Sheet, invoice, customer report, email send, customer messages, photos, damage map, inventory adjustments, purchase orders, receiving, scheduling, reports, and billing.
- Test UK metric/VAT shop and US imperial/tax shop.
- Test local restore after the newest production backup.
- Test production login after deploy and verify compiled Supabase config.

### Days 26-30: Launch Packaging

- Freeze non-critical feature work.
- Update release notes, public docs, support FAQ, pricing copy, onboarding copy, and Discord announcement.
- Prepare rollback notes for the last known-good Cloudflare deployment and last known-good database backup.
- Confirm backup/restore owner, billing support owner, and production incident owner.
- Launch only after the Stripe self-serve path has completed every gate above.

## Go / No-Go Gates

Go only if:

- Backup automation has recent successful scheduled runs.
- A local restore drill has passed.
- Production deploy guard passes.
- Migration drift check passes.
- Supabase data-integrity check passes.
- Stripe self-serve billing is configured and documented.
- Paid access changes are smoke-tested for at least one Shop and one Pro case.

No-go if:

- Scheduled backups are still failing.
- Restore has not been tested.
- Stripe event handling is relied on but not source-controlled and replay-tested.
- Stripe secrets or live price IDs are missing.
- Production deploys can still be built with local Supabase configuration.
- Any role can read or mutate another shop's paid/customer/job data.
