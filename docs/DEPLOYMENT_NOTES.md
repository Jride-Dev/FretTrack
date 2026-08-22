# Deployment Notes

Review this file before every production deploy and after every manual database/function deployment.

## Current Deployment Status

- Current branch checked during this review: `main`.
- PR `#201` added the amplifier/keyboard purchasing bridge, PR `#202` added Pro Automated Service Reminders, and PR `#203` added the Pro Loyalty Program. All three merged to `main` on 2026-08-22 after their combined regression/build, audit, database/browser, focused checker, and production-build gates passed.
- App domain returned `200 OK` with the current beta.6 bundle on 2026-08-22: https://app.frettrack-app.com/. Its JavaScript asset matched guarded build `assets/index-D7iGJXxo.js` and Cloudflare Pages deployment `36d6f1f7.frettrack.pages.dev`.
- The public landing/docs Worker deployed eight updated documentation assets on 2026-08-22 as version `c5b50ed3-a77c-4142-8414-55b9223c9320`. The live docs hub, complete guide, customer, inventory, jobs, billing, shop/account, and beta-tester pages all returned `200 OK` with the new specialist purchasing, Automated Service Reminder, and Loyalty content; docs responses retained CSP, `nosniff`, strict referrer policy, and `no-store` caching.
- Production migration history matches the repository through `20260822041624_pro_loyalty_program.sql`.
- Supabase Edge Functions are active at `stripe-webhook` version 14, `send-email` version 38, and JWT-protected `send-service-reminders` version 1. The reminder endpoint rejected an unauthenticated request with `401` and returned `200` with zero work during an authenticated smoke test.
- Supabase Vault contains the three named Cron inputs, and active job `frettrack-service-reminders-nightly` runs at `17 3 * * *` (03:17 UTC). The six initial shop rules are disabled, so deployment did not opt customers in or send reminders.
- Cloudflare Pages production HTML matched the guarded production build and returned the expected CSP, Permissions Policy, Referrer Policy, and content-type protection headers.
- Pre-migration snapshot `backups/hosted-supabase-20260822-000443` completed with database, migration-history, Storage, manifest, checksums, row counts, comparison report, and local Docker-volume archive. The compare report found no schema or migration-history drift from the immediately preceding snapshot.

## Current Migration Note

The 2026-08-22 production dry run contained exactly these reviewed migrations, which were applied in order:

- `20260822033718_specialist_purchasing_bridge.sql`
- `20260822035953_pro_automated_service_reminders.sql`
- `20260822041624_pro_loyalty_program.sql`

The post-deployment migration list aligned local and remote history, and a second `supabase db push --linked --dry-run` reported the database up to date with no pending migrations.

Continue using `supabase migration list --linked`, `supabase db push --dry-run`, and `npm run check:migrations` before future production schema changes. Do not use a blanket push when unrelated migrations are pending.

0.2.8 inventory work also includes these migrations that must be verified against remote migration history before production apply:

- `20260617220231_inventory_purchasing_foundation_phase_1.sql`
- `20260618072854_inventory_receiving_rpc_polish.sql`
- `20260619092622_po_items_create_inventory_parts.sql`
- `20260620015312_inventory_vendor_shipping_landed_cost.sql`

## Recent Deployed Systems

- Inventory purchasing foundation: parts, vendors, purchase orders, receiving, purchase history, barcode labels, and transactional receiving RPCs
- Amplifier/keyboard specialist purchasing bridge with job-linked purchase lines, package/job quantity separation, Inventory receiving, and idempotent Parts & Payments fulfillment
- Pro Automated Service Reminders with independent consent, durable queueing, nightly Cron dispatch, quota integration, and Message History
- Pro Loyalty Program with paid/completed-work-order award reconciliation and audited redemption
- Scheduling / Calendar Phase 1
- Premium entitlement foundation
- Advanced Reporting Phase 1
- Beta access operator notification fix
- Beta approval notification function
- Photo Editor Phase 1 frontend
- Photo Editor Phase 1 documentation and screenshot: `docs/screenshots/photo_editor.jpg`
- Permission hardening with centralized role checks and granular photo controls
- Premium Trial Management Phase 1 with operator-managed 7/14/30-day trials
- Paid Access Lifecycle Phase 1 is implemented locally: Trial/Shop/Pro public model, expired trials block writes, and legacy internal unpaid values remain compatibility-only.
- Supabase SECURITY DEFINER RPC hardening is implemented locally in `20260616063922`: flagged RPCs have explicit grants/search paths, inventory and transaction write paths have stronger validation, and public beta intake remains intentionally `anon` callable until the landing Worker moves to a server-side credential.
- 0.2.8 inventory purchasing work adds vendor/Purchase Order/receiving/barcode/purchase-history flows and transactional receiving RPCs.
- 0.2.8-D vendor + landed-cost purchasing polish adds Company/Sales Rep vendor labels, vendor address and Online Only fields, PO Shipping Cost, optional Add shipping to cost allocation, landed-cost receipt fields, and partial-receipt shipping allocation.
- Free vs Pro Tier Split Phase 1 was the earlier entitlement boundary pass before the Trial/Shop/Pro wording change.
- Shop Tier Foundation Phase 1 is implemented locally but not deployed from this development pass.
- Customer email/SMS Edge Function effective team-member access hardening is implemented locally but not deployed from this review pass
- `notify-beta-access-request` Supabase Edge Function
- `notify-beta-approval` Supabase Edge Function
- Cloudflare landing Worker beta application email path
- Cloudflare landing Worker beta application hardening deployed on 2026-06-12: Supabase request creation is authoritative, email/R2 archive failures return warnings after save, and `npm run check:landing-worker` covers the request lifecycle.
- Cloudflare landing Worker launch-page redesign deployed on 2026-06-18 as Worker version `490c7988-a697-4d06-8845-a72ff6fc6017`. It adds a product screenshot hero, workflow/security/pricing sections, bundled favicon/static screenshot assets through `LANDING_ASSETS`, and `no-store` HTML caching so deploys do not leave stale launch copy in browser cache.

## Verification Reminders

Before future deploys, check:

```powershell
git status
git branch --show-current
git pull origin main
npm run check:migrations
npm run check:landing-worker
npm run check:permissions
npm run check:tiers
npm run build
npm run check:production-build-config
git diff --check
curl.exe -I https://app.frettrack-app.com/
curl.exe -I https://frettrack-app.com/
```

`npm run check:production-build-config` is a hard safety gate for app deploys. It must pass after `npm run build` and before `npx wrangler pages deploy dist --project-name=frettrack --branch=main`; it fails if the compiled `dist` bundle contains local Supabase URLs, demo auth keys, or local test-shop defaults.

For App Pages deploys, prefer the guarded wrapper:

```powershell
npm run deploy:app:production
```

The wrapper forces the production Supabase URL, forces the production FretTrack Edge Function key from `.env` when the shell does not provide one, clears local test-shop defaults for the build, runs `npm run check:production-build-config`, and only then deploys `dist` to Cloudflare Pages. Use `npm run deploy:app:production:check` for the same build/config preflight without uploading.

## Backup Automation

- Daily hosted Supabase snapshots are managed by `scripts/backup-hosted-supabase.ps1`.
- The npm wrapper is `npm run backup:supabase`.
- The Windows Scheduled Task is `FretTrack Daily Supabase Backup`, scheduled for `02:00` local time.
- Repair or register the task with `npm run backup:register-task`.
- Each snapshot writes SQL dumps, Supabase Storage bucket files, checksums, migration versions, row counts, a transcript log, and a compare report under `backups/hosted-supabase-*`. Storage files are listed recursively and copied object by object for reliability with the current Supabase CLI.
- Each scheduled run also archives the existing local Docker volume `supabase_db_FretTrack` under `backups/docker-volume-*`.
- Local Docker database refresh is intentionally separate and manual through `npm run db:local:refresh-from-backup`.
- The task runs under the current Windows user account and depends on that user's Supabase CLI login/profile, network access, and local Docker access.
- Manual scheduled-task verification on `2026-06-26 02:58` completed with result `0`, snapshot `backups/hosted-supabase-20260626-025825`, and Docker archive `backups/docker-volume-20260626-025825/supabase_db_FretTrack.tar.gz`.
- Backup workflow details live in `docs/DATABASE_BACKUPS.md`.

## Manual Deployment Caveats

- Do not use a blanket production migration push when unrelated local migrations are still pending.
- Premium Trial Management Phase 1 adds `20260611120000_premium_trial_management_phase_1.sql`. It replaces entitlement snapshot behavior and adds operator-only trial RPCs; verify migration-history alignment before future production migration work.
- Free vs Pro Tier Split Phase 1 adds `20260611133000_free_pro_tier_split_phase_1.sql`. It seeds explicit `photo_editor`, `advanced_reporting`, and `team_members` entitlements and hardens team-member access/RPCs. This migration still needs an intentional production apply after review.
- Shop Tier Foundation Phase 1 adds `20260612233321_shop_tier_foundation_phase_1.sql`. It adds the `shop` plan identifier and allows `shop` in subscription-tier resolution. The follow-up live-demo polish migration `20260629155417_live_demo_bug_polish_phase_1.sql` moves Photo Editor and Team Members to Pro-only, keeps Advanced Reporting on Pro, sets Shop to one user, and updates team-member RPC wording to Pro. This migration still needs an intentional production apply after review.
- Pro Team Assignment Foundation adds `20260727151302_pro_team_assignment_foundation.sql` for nullable same-shop job assignment, role enforcement, active-member listing, stale-aware targeted updates, audit events, and the `team_assignment` entitlement. It is pending review and must be applied before deploying the beta.2 app; this branch does not apply it or deploy any Edge Function, Worker, billing, or Stripe change.
- Inventory Purchasing Foundation adds `20260617220231_inventory_purchasing_foundation_phase_1.sql`, `20260618072854_inventory_receiving_rpc_polish.sql`, and `20260619092622_po_items_create_inventory_parts.sql`; verify vendors, POs, partial/full receiving, part linkage, barcode search/labels, purchase history, and receive movement rows after deploy.
- Inventory vendor + landed-cost purchasing polish adds `20260620015312_inventory_vendor_shipping_landed_cost.sql`; verify vendor Company/Sales Rep/address/Online Only fields, PO Shipping Cost, Add shipping to cost, partial-receipt allocation, receipt item landed costs, and purchase-history landed-cost display after deploy.
- Inventory/vendor/shipping polish adds `20260630041703_inventory_vendor_shipping_polish_phase_1.sql`; verify Shop Settings inventory Location/Category presets, UPC-facing labels, Special Order Part low-stock suppression, 300x300 max part-image upload to the private `part-images` bucket, and shipping/parts label printer presets after deploy.
- The Free vs Pro review also updates `send-email` and `send-sms`; deploy those Edge Functions after the database migration so service-role message sends respect effective team-member access.
- Beta access approval and premium trial state are separate. Do not use premium trial expiry as a reason to remove beta approval.
- Trial expiry should preserve shop data and memberships, block writes, and require restored access before core operations continue.
- Free owner access must remain active after downgrade. Existing non-owner staff memberships should be preserved but inactive while `team_members` is false, then restored when Shop entitlement returns.
- Stripe, billing webhooks, and payment collection are still not connected.
- If a migration is manually applied with `supabase db query --linked --file`, confirm the schema change and then align remote migration history intentionally.
- Confirm Supabase Edge Function secrets by name only; never print secret values.
- Confirm Cloudflare Worker secrets by name only; never print secret values.
- The public landing Worker now has a bundled static-assets binding named `LANDING_ASSETS` in addition to the existing `FRETTRACK_APP_ASSETS` R2 binding. Confirm favicon routes such as `https://frettrack-app.com/favicon.ico` and landing screenshots such as `https://frettrack-app.com/landing/overview.jpg` after deploying the Worker.
- For public beta application issues, run `npm run check:landing-worker`, submit a live test through `https://frettrack-app.com/api/beta-application`, and confirm the saved row in `public.beta_access_requests`.
- If frontend asset hashes are used to confirm a deployment, compare the current app HTML against the most recent local build output.
