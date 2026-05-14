# FretTrack Architecture Overview

Generated for architecture review on 2026-05-11.

## 1. Current Module Structure

- `src/app/`: app composition shell. `App.jsx` owns job loading, mode selection, layout rendering, top-level handlers, save action dispatching, and Supabase connection status.
- `src/modules/jobs/`: primary repair workflow feature. Contains job form/list/detail screens, status select, activity timeline, print sheet/actions, tech detail sections, payment/totals/work log sections, damage and customer report sections, job selectors, job event logging foundation, job number helpers, validation, and job persistence service.
- `src/modules/customers/`: standalone customer add/list/search/detail foundations, customer persistence, duplicate detection, normalization, validation, type/source constants, CSV/Excel row mapping helpers, and job-derived customer migration helpers. The module exposes a barrel API through `src/modules/customers/index.js`.
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

- `customers`: first-class shop-scoped customer table with flexible `display_name`, optional person/company fields, normalized email/phone fields for duplicate detection, address fields, and import-prep fields (`import_source`, `import_batch_id`, `external_ref`), secured by shop membership RLS.
- `jobs`: parent work order table. Stores customer/instrument intake fields, optional `customer_id`, `date_received`, status, `tech_details`, timestamps, and new multi-shop job number fields: `shop_id`, `job_date`, `job_day_code`, `daily_sequence`, and `job_number`.
- `job_daily_sequences`: per-shop/per-date counter table used by `create_job_with_number(job_payload jsonb)` to atomically assign `YYDDD-SEQ`.
- `job_parts`: child rows for parts attached to a job.
- `job_services`: child rows for services/labor attached to a job.
- `work_logs`: editable job work log entries.
- `job_images`: uploaded image metadata for Supabase Storage objects.
- `customer_messages`: outbound email/SMS message history.
- `job_events`: activity timeline foundation for job lifecycle events such as creates, updates, status changes, images, payments, and work logs.
- Commerce backbone tables: `transaction_events`, `payment_events`, `inventory_movements`, `tax_profiles`, `payment_methods`, `transaction_number_sequences`, and `currencies`.
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
10. Email messages are sent through Supabase Edge Functions and logged to `customer_messages`; Edge Functions verify the signed-in user's shop role before sending/logging.

## 4. Shop Scope And RLS Audit

The v0.2.6-beta.1 membership/RLS audit treats shop scope as a system boundary:

| Module/table | Scope status | Write/delete behavior |
| --- | --- | --- |
| `jobs` | `shop_id` is required; app queries filter by current shop; RLS selects by membership. | Owner/admin/tech can create/update; owner/admin can delete; viewer is read-only. |
| `customers` | `shop_id` is required; app queries filter by current shop; local fallback records are filtered by current shop. | Owner/admin/tech can create/update; owner/admin can delete only when no jobs reference the customer; viewer is read-only. |
| Instruments | No standalone instrument table yet; instrument data is currently catalog constants plus fields embedded on `jobs`. | Controlled through job write permissions until a customer asset/instrument module exists. |
| `job_events` | Stores `shop_id` and `job_id`; app event reads filter by both job and current shop. | Owner/admin/tech can insert activity; events remain append-only in app behavior; viewer is read-only. |
| `job_images` and Storage | Metadata is scoped through parent `job_id`; Storage paths begin with `job_id`; Storage policies check parent job membership/write role. | Owner/admin/tech can upload/delete; viewer is read-only. Public bucket read remains a trial limitation. |
| Payments | Current payment rows are embedded inside `jobs.tech_details`; commerce `payment_events` are shop-scoped in the pending commerce backbone. | Embedded payments follow job update permissions; commerce events are append-only and writer-only. |
| `job_parts` | Scoped through parent `job_id`; RLS checks parent job membership/write role. | Owner/admin/tech can insert/update/delete; viewer is read-only. |
| `job_services` | Scoped through parent `job_id`; RLS checks parent job membership/write role. | Owner/admin/tech can insert/update/delete; viewer is read-only. |
| `work_logs` | Scoped through parent `job_id`; RLS checks parent job membership/write role. | Owner/admin/tech can insert/update/delete; viewer is read-only. |
| Shop settings | Currently local browser settings plus environment fallbacks, not database-backed. | UI limits edits to owner/admin, but persistent DB-backed shop settings are deferred. |

Role intent:

- `viewer`: read-only access to shop records.
- `tech`: operational writes for jobs, customers, photos, parts, services, work logs, messages, and commerce events.
- `admin`: tech permissions plus destructive/admin setup operations.
- `owner`: admin permissions plus owner-only membership administration.

## 5. Known Issues

- Applied accounting totals are not locked behind an intentional edit workflow yet.
- Customer import has mapper/normalization/validation/duplicate-prep helpers, but no import preview or bulk insert/update UI yet.
- SMS is disabled for trial builds and requires carrier registration.
- Edge Functions now verify signed-in shop role, but still carry the temporary shared shop function key as an extra trial gate.
- Supabase/Postgres `:5432` is a common setup trap and is not the app URL.
- Vite intentionally fails if port `5173` is already in use.
- Some legacy compatibility folders remain while the module refactor is in progress.
- Shop settings are local browser settings until authentication/organization records exist.
- The `job-images` bucket still uses public URLs; private/signed image delivery is deferred.
- Existing jobs now have a backfilled `job_created` activity event, but historical updates before v0.2.5 are not reconstructed in detail.

## 6. Current Feature Completion Status

- Intake/job creation: functional, now prepared for database-assigned shop-scoped job numbers.
- Current jobs list and search: functional.
- Job detail editing: functional.
- Parts/services/totals/payments: functional; role-level write protection is in place, but applied monetary edit locking is pending.
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

## 7. Pending Roadmap Items

- Add richer timeline filtering and event detail views.
- Finish module cleanup for services, parts, photos, print, messaging, shops, and auth.
- Replace trial function-key protection with pure user/session authorization.
- Add member invitation and management screens.
- Lock applied discounts/taxes/totals and add intentional `Edit Totals` flows.
- Move shop settings into database-backed shop records.
- Move customer-owned instruments/assets into a standalone shop-scoped module.
- Move job images to private/signed delivery when ready for broader production use.
- Enable SMS after carrier registration.
- Build shop-specific installer/export packages.
- Document provisioning, release, and installer workflows.
- Continue real shop testing against the `0.2.x` baseline.

## 8. External Services Used

- Supabase Database: jobs, child tables, messages, and sequence assignment.
- Supabase Storage: `job-images` bucket.
- Supabase Edge Functions: `send-email` and `send-sms`.
- Resend: email delivery provider for the `send-email` function.
- Twilio/SMS: planned and scaffolded, currently disabled.
- Browser APIs: local storage fallback, file/image processing, printing.
- Vite/React: frontend runtime and build tooling.

## 9. Authentication Status

- Supabase Auth is implemented for configured builds.
- Shop membership and roles are implemented in `shop_members`.
- Trial builds still include a temporary `FRETTRACK_FUNCTION_KEY` / `VITE_FRETTRACK_FUNCTION_KEY` gate for Edge Functions in addition to signed-in role checks.
- Supabase client uses the public anon/publishable key.
- Role-based RLS is implemented for jobs, customers, job child tables, activity events, messaging logs, storage objects, and pending commerce backbone tables.
- Member invitation/admin screens are pending.

## 10. Multi-Shop Readiness Status

- Data model now includes `shop_id`.
- Job number assignment is scoped by `shop_id` and `job_date`.
- `VITE_FRETTRACK_SHOP_ID` and `VITE_FRETTRACK_SHOP_NAME` have been added to `.env.example`; the app falls back to `default-shop` and `FretTrack Trial Shop`.
- Atomic database sequence assignment is implemented in SQL through `job_daily_sequences` and `create_job_with_number`.
- True multi-shop operations still need shop provisioning and persistent per-shop configuration.

## 11. Current Blockers

- Supabase CLI remote pushes are currently blocked by the Supabase pooler auth circuit breaker until credentials/lockout clear.
- Pending local migrations remain unapplied remotely until `db push` can run again.
- Monetary controls need applied-total locking before broader multi-user rollout.
- Shop settings are not database-backed yet.
- The public `job-images` bucket needs private/signed delivery before broader production use.
- SMS requires carrier registration and provider configuration before enabling.
- Some compatibility shims remain until the feature-module refactor is completed.
