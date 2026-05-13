# Changelog

Current version: `0.2.6`

This file tracks what changed in each release, including fixes that were added because an earlier change exposed or broke something.

## v0.2.6

- Added the Supabase Auth sign-in/sign-up gate for configured builds.
- Added `shop_members` with owner, admin, tech, and viewer roles.
- Added first-shop owner bootstrap for the configured shop ID.
- Added member-scoped RLS policies for jobs, job child records, messages, and activity events.
- Scoped remote job loading to the configured shop.
- Applied the live auth/shop membership migration for the current trial Supabase project.
- Improved auth and Supabase error messages so failures surface the provider message.
- Added PayPal funding metadata and README support links in the public repo workflow.
- Fixed remote save fallback payloads so required `job_date` values are preserved.

## v0.2.5

- Added a single app-level `AppNotice` component for save/status feedback and removed duplicate/local success notice state from job detail, new job, and shop settings flows.
- Applied and verified the live Supabase migrations for shop-scoped job numbers, `job_events`, and a starter `job_created` timeline backfill for existing jobs.
- Added an Activity Timeline panel to Job Detail backed by `job_events`.
- Added visible timeline entries for job creation, updates, status changes, image upload/delete, payments, and work logs.
- Added a Shop Settings screen for shop name, phone, email, address, logo placeholder, and print footer text.
- Moved print branding to shop settings/config and removed hardcoded business info from print components.
- Added `docs/TRIAL_READINESS.md` for first-shop testing.
- Added save-time data integrity checks for customer name, instrument type, status, and negative parts/services prices.
- Added `Export Job JSON` for trial-shop debugging.
- Kept auth and SMS out of this sprint.

## v0.2.4

- Moved job photo upload/delete persistence into `src/modules/photos/photoService.js`.
- Added `PhotoUploader.jsx` and `PhotoGallery.jsx` as photos-module UI foundations while preserving the existing image UI behavior.
- Kept `src/data/jobImagesRepository.js` as a compatibility re-export.
- Added `job_events` database migration and `jobEventsService.js` for future activity timeline support.
- Added non-blocking event logging for job creation, job updates, status changes, image uploads/deletes, payments, and work logs.
- Moved App-level money formatting, job sorting, till summary selectors, and theme constants into shared/module helpers.
- Added `shopConfig.js` and environment-backed shop ID/name fallbacks.
- Removed the hardcoded shop name from `App.jsx` and job print sheet.
- Updated package/app version to `0.2.4`.

## v0.2.3

- Added separate `customer_first_name` and `customer_last_name` fields to the Supabase `jobs` table.
- Backfilled existing jobs from `customer_name` so older records remain searchable.
- Updated New Job, Job Detail, customer lookup, and job search to use first and last names while preserving `customer_name` for display and message templates.
- Added database indexes for first name, last name, last/first name, and full customer name lookup.
- Added Referral as a job source option.
- Added the missing Supabase `job_images.public_url` column used by image uploads.
- Fixed damage-map picture imports so new and existing jobs show the selected image immediately, fall back to a local preview when a storage upload cannot create a fresh image record, and avoid reusing an older damage image after a failed upload.
- Changed damage marker photo attachments to use the shared job image upload path when available and display thumbnail previews in the damage list.
- Fixed appended work order history so work log entries save immediately instead of disappearing when the work order is closed before pressing Save Job.
- Hardened work log syncing so Save Job no longer reports success when Supabase work log persistence fails, and existing work logs are not deleted before replacement entries are saved.
- Added compatibility for older Supabase `work_logs` tables that do not have the newer `text` column, and added an explicit schema migration to create that column when missing.
- Hardened Finish / Picked Up so it uses the explicit save path and surfaces save errors instead of silently relying on background child-record sync.

## v0.2.2

- Added the full FretTrack theme preset system.
- Set `bench-dark` as the default theme for first-time users.
- Added Bench Dark, Shop Light, Amber Tube, Seafoam, Blackguard, Burgundy Burst, Blue Steel, and High Contrast presets.
- Added Theme Settings with a compact theme selector.
- Refactored presentation colors to shared CSS variables and reusable surface/control classes.
- Print/export views force a readable light background regardless of active theme.
- Added smaller professional button styling with reusable primary, secondary, tertiary, FAB, small, and large button classes.

## v0.2.1

- Added plain-text email templates for Check-in, Estimate ready, Approval needed, Work started, Repair complete, Pickup reminder, Payment reminder, and Update with photos.
- Templates support `{{customer_name}}`, `{{instrument}}`, and `{{job_number}}`.
- Selecting a template fills the subject and body while allowing edits before sending.
- The editable preview is exactly what is sent through the email function.
- Saves the last selected message template per job.

## v0.2.0

- Promoted the app from beta/trial polish into the 0.2.0 live baseline.
- Positioned as the first public trial-ready release.
- Email notifications are active.
- SMS is planned/optional.
- Dark theme is the default for new users.
- Work order system is stable enough for real shop testing.
- Keeps email-only trial messaging active with SMS disabled until carrier registration is ready.
- Carries forward themed UI, subcontractor/job-source intake, damage-map persistence fixes, manual save feedback, and editable work logs.

## v0.1.11

- Trial builds now use email-only messaging.
- Added `VITE_SMS_ENABLED=false` to disable SMS calls from the UI.
- SMS buttons remain visible but disabled while keeping the `send-sms` Edge Function code for later carrier registration.
- Removed Twilio from required trial setup.
- Added job source tracking for Walk-In, Telephone Appt., and Sub-Contract work.
- Added subcontractor business/name tracking.
- Added edit and delete controls for work log entries.
- Added saved theme selection with Light, Dark, High Contrast, Blue / Gray, and Red / Blue starter themes.

## v0.1.10-beta

- Added multi-image Import from Device for job photos.
- Added HEIC/HEIF conversion before upload.
- Added Supabase image metadata for storage path, original filename, upload time, and category.
- Rewired Work Order Messages to send only through Supabase Edge Functions.
- Added Resend email sending and Twilio SMS sending with provider-side logging to `customer_messages`.
- Added SMS mode display for Twilio test/live mode.

## v0.1.9

- Changed the instrument selector to Acoustic / Electric / Bass.
- Renamed Previous Jobs to Current Jobs and hides picked-up jobs by default.
- Added Picked up status and a Finish / Picked Up action.
- Added a beta damage map with royalty-free diagram assets for Acoustic, Electric, and Bass instruments.
- Added front/back damage map views with clickable markers, cosmetic/structural/critical severity, notes, recommended repairs, and marker photo attachments.
- Added liability acknowledgment and authorization notes tied to the damage map.
- Replaced before/after neck notes with structured initial/final neck inspection fields and measured deltas.
- Added sales tax settings, payment tracking, paid totals, and balance due.
- Added a Till Summary rollup for paid-in totals, sales tax accrued, open balances, and payment methods.
- Added customer damage acknowledgment report printout for saving as PDF.

## v0.1.8

- Added service preset selector for common repair services.
- Added customer history lookup by name, phone, and email.
- Added quick-fill customer info from previous jobs.
- Added previous-job visibility during intake.
- Improved repeat-customer workflow.

## v0.1.7

- Added guitar and bass brand/model suggestions for the Brand and Model fields.
- Kept Brand and Model as free-typing fields so unusual instruments can still be entered.
- Fixed the Guitar / Bass selector layout.
- Changed job images to show full-picture thumbnails with `object-fit: contain`.
- Clicking a thumbnail still opens the larger image.
- Added discount controls for percentage or dollar discounts.
- Added included-in-service parts so parts can be tracked without increasing the customer total.
- Updated on-screen and printed totals to show billable parts, included parts, subtotal, discount, and total due.

## v0.1.6

- Updated package metadata to version `0.1.6`.
- Added a small visible `Version 0.1.6` label in the app header.
- Expanded the README with setup instructions and version history.

## v0.1.5

- Added instrument type support for `Guitar` and `Bass`.
- Bass jobs show 4 string gauge slots.
- Guitar jobs show 6 string gauge slots.
- Updated the printed job sheet to show `Instrument` and `Brand / Model`.
- Replaced the plain instrument dropdown with a Guitar / Bass selector button pair.

## v0.1.4

- Reduced typing lag in Tech Details fields.
- String gauges, action fields, neck relief, and neck inspection fields now update locally while typing.
- These fields save when leaving the field or when using the header Save Job button.
- Renamed `Test Supabase Save` to `Save Job`.
- Removed the old test-save behavior that created a fake test customer record.

## v0.1.3

- Updated the job number generator to detect multiple jobs on the same date.
- First job of the day keeps the base number, such as `26122`.
- Additional jobs receive suffixes like `26122-01`, `26122-02`, and so on.
- Preserved existing job numbers when loading jobs from Supabase.

## v0.1.2

- Added browser-side image compression before upload.
- Resizes images to a maximum long edge of `1600px`.
- Converts uploaded images to JPEG at reduced quality to protect the 50MB Supabase bucket limit.
- Added a delete button on each job image.
- Deleting an image removes both the Supabase Storage object and the `job_images` database row.

## v0.1.1

- Fixed the local app URL to `http://127.0.0.1:5173/`.
- Clarified that port `5432` belongs to the Supabase/Postgres database, not the browser app.
- Added strict Vite port settings so the app does not silently move to another port.
- Added a desktop launcher batch file, app icon, and Windows shortcut.

## v0.1.0

- Built the Guitar Check-in app with React and Vite.
- Added job creation, previous job lookup, job detail editing, parts, services, work log, tech details, and image upload support.
- Added Supabase support for jobs, child records, and the `job-images` storage bucket.
