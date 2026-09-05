# Deployment Notes

Review this file before every production deploy and update it after app, public-site, database, or Edge Function changes.

## Current status

- FretTrack 0.3.1 is deployed as the current stable maintainability release over the Operational Shop Release.
- The production app is Cloudflare Pages build `e8a97ee3.frettrack.pages.dev`. The branded signup URL opens account creation when `?signup=1` is present, and failed post-creation workspace profile reloads have a dedicated retry path that does not create a second workspace.
- Migration `20260829071930_access_application_side_effect_idempotency.sql` is applied in production. Repeated access submissions now retain one request identity/timestamp so email and archive retries reuse stable side-effect keys.
- Production migration history matches the repository through `20260904233235_automatic_inbound_email_routes.sql`. Before applying the earlier six commerce, correspondence, and inbound-adapter migrations, snapshot `backups/hosted-supabase-20260904-041017` captured the database, 89 migration records, all 241 Storage objects, the local Docker volume, and 4,972 checksummed files with no failure marker or checksum mismatch. The linked migration check, data-integrity gate, permission/RPC checks, commerce checks, billing reconciliation checks, correspondence checks, inbound-adapter checks, and tax-profile boundary checks pass after deployment. Work order `26227-001` retained its manual 20% VAT configuration, and no finalized invoice data required backfill.
- The public landing/docs Worker is deployed as version `939ecbc4-deca-44e5-8244-9f42301eba85` and serves stable 0.3.1 self-service registration, pricing, annual savings, Terms, Privacy, Support, product guides, community links, release notes, tax responsibility guidance, correspondence-framework boundaries, professional workspace screenshots, and legacy documentation aliases. The retired application modal is absent, and legacy application submissions fail closed unless the historical compatibility switch is explicitly enabled.
- Migration `20260904233235_automatic_inbound_email_routes.sql` is applied in production. It removed the incorrectly assigned shared `repairs@rexaaechae.resend.app` route, rotated any pre-release manual route, backfilled all six existing shops, and installs a shop-profile trigger for future signups. Production verification found six shops, six active routes, six distinct shop IDs, six distinct opaque addresses, and no invalid route format. `send-email` requires JWT and fails closed if its sending shop lacks a route; `receive-email` version 5 intentionally disables gateway JWT so Resend can reach it, then verifies the raw Svix signature and five-minute timestamp window before creating a service-role client. The first signed live delivery reached FretTrack on September 4, 2026, but failed before message insertion because the outbound `RESEND_API_KEY` has Sending access and cannot retrieve received content. A separate Full access `RESEND_RECEIVING_API_KEY` is now stored server-side and version 5 uses it exclusively for received-content retrieval. Replaying that failed provider event is the remaining live recovery test; the sending key and webhook signing secret remain unchanged and server-only.
- PR #295 merged at `67434c5` after the VAT and discount regression checks passed. Writable owners/admins can reach Tax / VAT Settings directly from Parts & Billing, disabled tax is explicit, and discount controls explain the required type selection. The app is deployed to Pages build `e8a97ee3.frettrack.pages.dev`, and the public landing/docs Worker is deployed as version `939ecbc4-deca-44e5-8244-9f42301eba85`.
- PR #271 merged at `7778f0b` after regression/build, npm audit, and the full local database/browser workflow passed. The Scheduling professional workspace is deployed to Pages preview `161de8b5.frettrack.pages.dev` and the branded landing/docs Worker is deployed as version `d0288099-63e9-45be-a493-4d1bee52baaa`; production smoke checks returned `200` for the app, root, Scheduling guide, Inventory guide, and Customers guide. No database migrations or Edge Functions changed.
- PR #273 merged at `d773277` after regression/build, npm audit, and the full local database/browser workflow passed. The New Work Order full-width fix is deployed to Pages preview `5ac23754.frettrack.pages.dev`; production smoke checks returned `200` for the app, branded app URL, and landing URL. No database migrations, Edge Functions, or job persistence logic changed.
- PR #275 merged at `38bfaae` after regression/build, npm audit, and the full local database/browser workflow passed. The Estimates workspace, integer-only service quantities, and locked-total Email Estimate document are deployed to Pages preview `57da5273.frettrack.pages.dev`; production smoke checks returned `200` for the preview, branded app, and landing URL. Migration `20260903062624_service_quantity_whole_numbers.sql` was applied and verified remotely; no Edge Function deployment was required.
- PR #277 merged at `15353ad` after regression/build, npm audit, and the full local database/browser workflow passed. Migration `20260903071814_public_estimate_approval_links.sql` was applied after pre-migration snapshot `backups/hosted-supabase-20260903-004145`; the migration history row, lifecycle constraint, RPC grants, and linked security review were verified. The app is deployed to Pages build `f99f3286.frettrack.pages.dev`; production smoke checks returned `200` for the preview and both branded aliases, and an anonymous malformed estimate token rendered the guarded unavailable state. Customer estimate links are revocable, expire after 30 days by default (maximum 90 days), bind to one locked revision, and record customer approval/decline as distinct audit events. No Edge Function deployment was required.
- PR #280 merged at `834c817` after regression/build, npm audit, and the full local database/browser workflow passed. Estimate email sends now retain one operation identity across retryable provider-confirmation failures, so a retry replays the existing Message History/provider idempotency record instead of creating a second send. The app is deployed to Pages build `8a133e5e.frettrack.pages.dev`; production smoke checks returned `200` for the preview and both branded aliases, and the anonymous malformed estimate token rendered the guarded unavailable state. No database migration or Edge Function deployment was required.
- PR #283 merged at `c0d794f` after regression/build, npm audit, and the full local database/browser workflow passed. New Work Order navigation now marks the user transition before workspace hydration can restore a prior mode, preventing the legacy Show sections / Hide sections sidebar from reopening. The app is deployed to Pages build `9ee433a4.frettrack.pages.dev`; production smoke checks returned `200` for the preview and both branded aliases, and the branded app served the new bundle after propagation. No database migration or Edge Function deployment was required.
- PR #285 merged at `4cef97e` after regression/build, npm audit, and the full local database/browser workflow passed. The retired New Work Order sidebar, Show sections / Hide sections controls, and their obsolete layout/state code were removed from every workspace mode; Current Jobs navigation now uses the full workspace table. The app is deployed to Pages build `f703cdb9.frettrack.pages.dev`; production smoke checks returned `200` for the preview and branded app alias, and the branded app served bundle `C3z6G1sv` after propagation. No database migration or Edge Function deployment was required.
- PR #258 merged at `3209f2c` after regression/build, npm audit, and the full local database/browser workflow passed. Production `create-checkout-session` version 14 now blocks a second Checkout whenever the shop-owned connected Stripe customer has any open subscription, including legacy subscriptions with missing or mismatched shop metadata and subscriptions beyond Stripe's first result page. No database migration or webhook deployment was required, and the deployed unauthenticated endpoint returned `401` as expected.
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

## Customer correspondence and onboarding deployment

- Merged PR #261 at `8000560` after GitHub regression/build, npm audit, and the full local database/browser workflow passed.
- Completed the pre-migration hosted snapshot at `backups/hosted-supabase-20260902-021609`. It contains database, migration-history, manifest, checksum, comparison-report, 238 Storage-object, and local Docker-volume artifacts with no `FAILED.txt`; the comparison report found no schema, migration-history, or row-count drift from the preceding snapshot.
- Applied production migration `20260902082416_customer_correspondence_backend.sql`, verified local/remote migration parity, and passed the linked read-only data-integrity check. No Edge Function deployment was required.
- Deployed Cloudflare Pages build `https://ef46ccfd.frettrack.pages.dev` and public Worker version `5a5a29f9-4ade-40ea-a894-6b2f5f0c1def`.
- Verified the live `https://app.frettrack-app.com/?signup=1` route renders Create Account and Confirm Password rather than Sign In.
- Verified `200 OK` for the public root, Support, Getting Started, Release Notes, and Shops and Accounts pages; confirmed the live workspace-retry guidance, v0.3.1 release copy, and planned AmpTrack/MidiTrack add-on wording.
- The correspondence release establishes provider-neutral thread/history ownership and report-selection controls only. Inbound adapters, SMS delivery, Realtime subscriptions, and the future conversation interface remain disabled until separately implemented and reviewed.

## Professional workspace UI deployment

- Merged PR #264 at `1f527fd` after regression/build, local database/browser, npm audit, professional UI, landing Worker, and authenticated workspace checks passed.
- Deployed Cloudflare Pages build `https://5326dfe9.frettrack.pages.dev` and public Worker version `cab62fef-f430-4b49-a326-67c680684aef`.
- Verified `200 OK` for the branded app, public root, docs, Getting Started, Jobs, Release Notes, and the sanitized Bench Dark and Shop Light screenshot assets.
- The deployed app now includes the grouped workspace navigation rail, operational Current Jobs summary, device-aware theme selection, and responsive mobile containment. The public landing page and primary customer guides show the same real application workspace in both themes using fictional shop and customer data.
- Merged phase-two PR #266 at `2b228b9` after Ito reported the mobile wrapping fix and 11 additional scenarios passing with no PR-attributable failures; regression/build, local database/browser, and npm audit checks also passed.
- Deployed Cloudflare Pages build `https://86aeabbd.frettrack.pages.dev` and public Worker version `066048d6-4fd7-4733-8809-7169fc5f7242`.
- Verified `200 OK` for the deployment URL, branded app, public root, docs, Jobs, Release Notes, Terms, Privacy, Support, and both new work-order screenshot assets. The branded app served the guarded production bundle hashes `index-MdpuZeP5.js` and `index-DqqXK6bd.css`.
- Phase two adds the full-width grouped New Work Order surface and restrained shared Job Detail / Parts & Billing workspace, with responsive long-value wrapping and matching fictional screenshots across the landing page and customer guides.
- Merged Customers PR #268 at `796e560` after regression/build, local database/browser, and npm audit checks passed; no Ito finding or review thread was present.
- Deployed Customers app Pages build `https://cb35c784.frettrack.pages.dev` and public Worker version `c8a51d02-4438-4ab0-9a8c-69dbe49f00b9`.
- Verified `200 OK` for the deployment URL, branded app, public root, Customers guide, and sanitized `customers-bench-dark.png`; confirmed the new image and Customers workspace copy are live on the landing page and guide.
- Customers is a presentation-only release: no database migration or Edge Function deployment was required.
- No database migration or Edge Function deployment was required for this presentation and documentation release.

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
