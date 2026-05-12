# FretTrack Architecture Overview

Generated for architecture review on 2026-05-11.

## 1. Current Module Structure

- `src/app/`: app composition shell. `App.jsx` owns job loading, mode selection, layout rendering, top-level handlers, save action dispatching, and Supabase connection status.
- `src/modules/jobs/`: primary repair workflow feature. Contains job form/list/detail screens, status select, activity timeline, print sheet/actions, tech detail sections, payment/totals/work log sections, damage and customer report sections, job selectors, job event logging foundation, job number helpers, validation, and job persistence service.
- `src/modules/customers/`: customer lookup and customer name/phone normalization helpers.
- `src/modules/instruments/`: instrument catalog, instrument type normalization, and string count helpers.
- `src/modules/photos/`: job photo upload/delete persistence plus photo uploader/gallery foundations.
- `src/modules/shops/`: shop configuration/settings foundation using environment-backed shop ID/name fallbacks and local trial settings.
- `src/modules/messaging/`: customer message panel, message templates, and message service helpers.
- `src/modules/images/`: compatibility entry for job image sections.
- `src/modules/billing/`: accounting and total calculation helpers.
- `src/shared/lib/`: shared library setup, currently Supabase client and connection check.
- `src/shared/theme/`: theme constants and theme storage key.
- `src/shared/utils/`: shared formatting helpers such as currency formatting.
- `src/components/`: legacy/compatibility components plus shared operational components still awaiting final module placement.
- `src/data/` and `src/utils/`: compatibility shims from earlier architecture passes.
- `src/services/`: non-feature service helpers, currently browser image processing.
- `public/`: app branding and instrument/damage-map assets used by the UI.
- `supabase/`: Edge Functions and migrations.

## 2. Database Tables

Current schema files define:

- `jobs`: parent work order table. Stores customer/instrument intake fields, `date_received`, status, `tech_details`, timestamps, and new multi-shop job number fields: `shop_id`, `job_date`, `job_day_code`, `daily_sequence`, and `job_number`.
- `job_daily_sequences`: per-shop/per-date counter table used by `create_job_with_number(job_payload jsonb)` to atomically assign `YYDDD-SEQ`.
- `job_parts`: child rows for parts attached to a job.
- `job_services`: child rows for services/labor attached to a job.
- `work_logs`: editable job work log entries.
- `job_images`: uploaded image metadata for Supabase Storage objects.
- `customer_messages`: outbound email/SMS message history.
- `job_events`: activity timeline foundation for job lifecycle events such as creates, updates, status changes, images, payments, and work logs.
- Supabase Storage bucket: `job-images`.

Key constraints/functions:

- Unique `(shop_id, job_number)`.
- Unique `(shop_id, job_date, daily_sequence)`.
- `create_job_with_number(job_payload jsonb)` assigns the final database-safe job number.
- Job statuses are currently: `Checked In`, `On Bench`, `Waiting Parts`, `Completed`, `Picked Up`, `Cancelled`.

## 3. App Workflow

1. Shop user opens the Vite React app.
2. `App.jsx` loads jobs through `getJobs()`.
3. `JobForm.jsx` creates a new intake draft with a frontend preview job number.
4. When Supabase is configured, `addJob()` calls `create_job_with_number` so the database assigns the final `YYDDD-SEQ` number safely.
5. Job list filters current work orders and can hide picked-up jobs.
6. Job detail supports customer/instrument edits, status changes, parts, services, totals, payments, work logs, activity timeline, neck inspection, damage maps, images, messaging, print views, and debug JSON export.
7. Job saves update the parent job and synchronize child tables for parts, services, and work logs.
8. Image uploads are compressed client-side, saved to Supabase Storage, and recorded in `job_images`.
9. Basic activity events are logged to `job_events` when available; failures warn and do not block saves.
10. Email messages are sent through Supabase Edge Functions and logged to `customer_messages`.

## 4. Known Issues

- Accounting totals are not permission-gated yet.
- SMS is disabled for trial builds and requires carrier registration.
- Public trial protection uses a temporary shared shop function key rather than user authentication.
- Supabase/Postgres `:5432` is a common setup trap and is not the app URL.
- Vite intentionally fails if port `5173` is already in use.
- Some legacy compatibility folders remain while the module refactor is in progress.
- Shop settings are local browser settings until authentication/organization records exist.
- Existing jobs now have a backfilled `job_created` activity event, but historical updates before v0.2.5 are not reconstructed in detail.

## 5. Current Feature Completion Status

- Intake/job creation: functional, now prepared for database-assigned shop-scoped job numbers.
- Current jobs list and search: functional.
- Job detail editing: functional.
- Parts/services/totals/payments: functional, but permission and audit locking are pending.
- Work logs: functional with edit/delete and safer save behavior.
- Damage maps and job images: functional with compressed upload path.
- Photos module: service and component foundations added; job detail still preserves the existing image UI.
- Activity timeline: visible read-only timeline panel added; richer filtering/detail views are pending.
- Shop settings: basic local trial settings screen added; persistent database-backed shop settings are pending.
- Print/customer report views: functional.
- Email messaging: active through Supabase Edge Functions.
- SMS messaging: code present, disabled in trial builds.
- Theme selection: functional.
- Multi-shop sequencing: schema/RPC/code applied and verified against the live Supabase project; full multi-shop operations still need auth and provisioning.

## 6. Pending Roadmap Items

- Add richer timeline filtering and event detail views.
- Finish module cleanup for services, parts, photos, print, messaging, shops, and auth.
- Replace trial function-key protection with real authentication.
- Add organization membership and role-based permissions.
- Lock applied discounts/taxes/totals and add intentional `Edit Totals` flows.
- Enable SMS after carrier registration.
- Build shop-specific installer/export packages.
- Document provisioning, release, and installer workflows.
- Continue real shop testing against the `0.2.x` baseline.

## 7. External Services Used

- Supabase Database: jobs, child tables, messages, and sequence assignment.
- Supabase Storage: `job-images` bucket.
- Supabase Edge Functions: `send-email` and `send-sms`.
- Resend: email delivery provider for the `send-email` function.
- Twilio/SMS: planned and scaffolded, currently disabled.
- Browser APIs: local storage fallback, file/image processing, printing.
- Vite/React: frontend runtime and build tooling.

## 8. Authentication Status

- No full user authentication is implemented yet.
- Trial builds use a temporary `FRETTRACK_FUNCTION_KEY` / `VITE_FRETTRACK_FUNCTION_KEY` gate for Edge Functions.
- Supabase client uses the public anon/publishable key.
- Role-based shop/member permissions are pending.

## 9. Multi-Shop Readiness Status

- Data model now includes `shop_id`.
- Job number assignment is scoped by `shop_id` and `job_date`.
- `VITE_FRETTRACK_SHOP_ID` and `VITE_FRETTRACK_SHOP_NAME` have been added to `.env.example`; the app falls back to `default-shop` and `FretTrack Trial Shop`.
- Atomic database sequence assignment is implemented in SQL through `job_daily_sequences` and `create_job_with_number`.
- True multi-shop operations still need authentication, shop provisioning, and persistent per-shop configuration.

## 10. Current Blockers

- Supabase CLI is not installed in this workspace, so migrations were applied through the Supabase connector and mirrored in local migration files.
- Authentication and role model are not yet implemented.
- Monetary controls need audit/permission hardening before broader multi-user rollout.
- SMS requires carrier registration and provider configuration before enabling.
- Some compatibility shims remain until the feature-module refactor is completed.
