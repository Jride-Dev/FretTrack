# Changelog

Current version: `0.2.7-beta.0`

This file tracks what changed in each release, including fixes that were added because an earlier change exposed or broke something.

## Documentation Catch-Up - Current Beta Candidate

- Added the first 0.2.8 Inventory Purchasing Foundation pass with shop-scoped vendors, purchase orders, purchase order items, inventory receipts, receipt items, part barcode identity fields, vendor SKU, desired stock levels, last/average cost tracking, purchase history UI, and transactional receiving RPCs.
- Added 0.2.8-B inventory polish with printable barcode labels, `FT-PART-` lookup support, purchase order filters/actions, clearer receiving quantities/costs, expanded purchase history, and tighter receiving RPC validation.
- Bumped package metadata and the in-app version display to `0.2.7-beta.0`.
- Added SECURITY DEFINER RPC hardening for flagged Supabase RPCs with explicit grants, locked search paths, stronger inventory/accounting input validation, and documented callable-role intent.
- Added Paid Access Lifecycle Phase 1 so public product language is Trial, Shop, and Pro, expired trials preserve data while blocking writes, and legacy internal unpaid values remain compatibility-only during migration.
- Added Shop Tier Foundation Phase 1: Shop unlocks Photo Editor and Team Members, and Pro remains the advanced reporting/automation tier.
- Added backend enforcement for Shop team-member access so preserved staff memberships cannot access shop data or mutate member records while trial access is expired.
- Hardened customer email/SMS Edge Function access checks so preserved staff rows cannot bypass effective team-member access or expired-trial write blocking.
- Added visible Shop lock states for Photo Editor and Team Members plus Pro lock states for Advanced Reporting without adding Stripe, billing forms, pricing, caps, or payment automation.
- Added `npm run check:tiers` coverage for the Trial/Shop/Pro entitlement split and guard wiring.
- Moved first-owner shop creation behind an approved-beta, confirmed-email bootstrap RPC so new shop creation no longer depends on direct `shop_members` inserts through RLS.
- Improved Auth sign-up confirmation handling with an explicit redirect target, clearer existing-account messaging, and a resend-confirmation action.
- Hardened the public beta application Worker so database saves stay authoritative, archive failures do not make saved requests look failed, success messages include the saved email/status, applicant confirmation delivery is reported separately, spam/junk-folder guidance is shown to applicants, and regression checks cover save, confirmation email, email-failure, archive-failure, validation, and invalid JSON behavior.
- Clarified the tester-facing app auth flow so beta applicants create a login account, then see pending-approval guidance instead of assuming they should create a shop before approval.
- Added centralized permission helpers for operator, owner/admin, tech, viewer, photo, inventory, scheduling, customer, and premium-reporting checks.
- Added Premium Trial Management Phase 1 with operator-only 7/14/30-day trial start, extension, and end RPCs.
- Deployed Permission Hardening + Premium Trial Management Phase 1 and refreshed README/release/deployment documentation for the live state.
- Separated beta access approval from paid trial entitlement state so expired trials preserve data and memberships but block writes until access is restored.
- Added an operator-only current access panel showing the signed-in user's shop role, beta status, operator status, subscription/trial state, effective tier, enabled premium features, and write access.
- Hardened photo upload, edit, overwrite, delete, and customer-report toggle permissions with granular photo guards.
- Added premium entitlement architecture for future paid-feature checks without gating core free shop workflow.
- Added Advanced Reporting Phase 1 with premium-gated dashboard cards for revenue, job, customer, and inventory metrics.
- Added unsaved-changes protection foundation with reusable dirty-state handling and visible save status.
- Added beta approval applicant notifications through the `notify-beta-approval` Supabase Edge Function.
- Added Photo Editor Phase 1 for job photos: freehand markup, shapes, arrows, text captions, crop, brightness, save-as-copy, guarded overwrite, and manual background cleanup.
- Added `photo_derivatives` metadata for edited-photo provenance.
- Added deployment notes as the permanent place for migration caveats, manual deploy notes, pending checks, and production verification.
- Added the new photo editor screenshot at `docs/screenshots/photo_editor.jpg`.
- Fixed operator UI access guards so non-operator shop users cannot restore, navigate to, or render the internal Operator Dashboard from persisted workspace mode.
- Added beta feedback polish for work orders: Promise Date, stable priority tags, shortened inventory search copy, Mail In / Shipped In job source, Headstock and Serial Number damage-map views, reordered New Job customer fields with state dropdown and opt-ins, and string-gauge presets with corrected high/low string ordering.
- Added an old iPad/WebKit compatibility pass with Vite legacy bundles, guarded browser API polyfills, a top-level error boundary, a public unsupported-browser fallback, and a lighter login bootstrap before authenticated modules load.
- Added temporary `?debug=legacy` login diagnostics, Supabase auth startup logging, session-check timeout handling, and visible auth failure messages for iOS 12 WebKit troubleshooting.

## v0.2.6-beta.14 - Offline New-Job Draft Continuity

- Added an offline status chip and banner for clear local-draft messaging.
- Added an IndexedDB-backed Pending Local Drafts queue for new work orders.
- Added offline fallback for new job saves when the network or remote save fails.
- Added manual one-at-a-time draft sync, discard, and last-error visibility.
- Kept existing remote job edits, photos, and authenticated Supabase data online-only for this first offline continuity pass.

## v0.2.6-beta.13 - Mobile, Tablet, And PWA Readiness

- Added installable PWA support with manifest, service worker, and install prompt handling.
- Added iPhone/iPad Add to Home Screen guidance.
- Improved mobile and tablet header, actions, and detail-first layout behavior.
- Added camera-first upload controls for job photos and damage-map view images.
- Improved touch targets and responsive controls across the bench workflow.

## v0.2.6-beta.12 - Editable Work Order Parts And Services

- Added editable parts rows on existing work orders.
- Added editable services/labor rows on existing work orders.
- Added add/remove controls for job-level parts and services.
- Preserved totals, discounts, tax, balance due, invoice emails, and print output when job-level line items are edited.
- Kept the scope to job-level editing, not inventory, vendors, purchase orders, or stock tracking.

## v0.2.6-beta.11 - Work Order And Invoice Email Flow

- Added Email Work Order from Job Detail.
- Added Email Invoice from the billing/totals workflow.
- Added an editable email preview modal for recipient, subject, and body.
- Added work order and invoice email summaries through the existing authenticated Supabase Edge Function and Resend delivery path.
- Added job event logging for `work_order_emailed` and `invoice_emailed`.
- Blocked sends when the selected customer or subcontractor has no valid email address.

## v0.2.6-beta.10 - Customer And Subcontractor CRM Beta

- Promoted the customer and subcontractor management workflow to a full beta milestone.
- Added customer profiles, customer balances, payment history, and CRM-style customer workflow.
- Added customer creation modal and beta access workflow improvements.
- Improved mobile/tablet behavior and email notification workflow around the beta experience.
- Documented remaining Customer Damage Report and damage-map print rendering instability.

## v0.2.6-beta.9 - Beta Access Approval And Operator Controls

- Added beta access approval gate so new sign-ins do not automatically enter a shop workspace.
- Added operator approval workflow in the internal dashboard.
- Added landing page beta application flow that creates real beta access requests.
- Added email notifications for beta applications.
- Improved mobile/tablet layout, print readability, and security/access hardening around beta onboarding and workspace bootstrap.

## v0.2.6-beta.6 - Beta Operations And Storage Hotfix

- Added paid-tier foundation tables, trial/grace/read-only/beta-bypass states, entitlement snapshots, and a billing placeholder without enabling Stripe.
- Added client-side image optimization before Supabase Storage upload, including JPEG conversion, resize/compression defaults, upload notices, and job image optimization metadata.
- Added the internal Beta Operator Dashboard with server-side operator checks, shop/member/usage/activity views, beta-bypass toggle, trial extension, and status controls.
- Added owner/admin shop member management for existing FretTrack users, including member list, role changes, removal, and last-owner protection.
- Added extended-range instrument support with selectable/custom string count, baritone model suggestions, string-aware setup labels, and string-count display on print/report output.
- Fixed the operator dashboard entry point for operator users with multiple shop memberships.
- Added autosave for job payment changes so payment adds/removes save immediately and payment edits debounce-save.
- Confirmed Cloudflare Pages production custom domain now serves the updated app bundle.

## v0.2.6-beta.4.1 - Simon's Beta Release Hotfix

- Fixed the printed Job Sheet tech summary so it shows New String Brand, New String Gauge, and Final Neck Inspection instead of printing the full setup measurement table after the balance section.
- Fixed Inspection neck relief/action inputs by applying measurement value and unit updates atomically so controlled fields no longer discard keyboard entry.
- Hardened the Inspection measurement fields further so typing stores raw text immediately and unit parsing only runs when the field loses focus.
- Removed Palos Verdes Music House placeholder text from generic sub-contract business fields.
- Refreshed README beta access instructions and screenshots for the current invite-only beta flow.

## v0.2.6-beta.4 - Simon's Beta Release

- Added lightweight Accounting / Reports with shop-scoped summaries, payments by method, tax/VAT collected, open balances, CSV export, and print/PDF-friendly report output.
- Added shop-level currency, locale, tax/VAT label, and tax/VAT registration settings with USD and GBP defaults.
- Added shop-level date formatting settings for US, UK, and ISO-style display without changing stored timestamps.
- Added shop-level measurement preferences for imperial/in and metric/mm display/input behavior without silently migrating stored measurements.
- Prepared the beta workflow for a Norwich, United Kingdom shop using GBP, VAT, DD/MM/YYYY dates, and millimeters.

## v0.2.6-beta.2

- Added first-run shop onboarding/profile setup with shop defaults, tax defaults, print footer text, and private shop logo storage.
- Added post-login shop selection for users with more than one shop membership.
- Added self-service beta shop creation for signed-in users without an existing shop membership.
- Added custom domain deployment support for `app.frettrack-app.com` through Cloudflare Pages.
- Added a Cloudflare Worker coming-soon page for `frettrack-app.com` and `www.frettrack-app.com`, with beta login routing to the app domain.
- Added a dedicated Cloudflare R2 bucket for public `frettrack-app.com` site assets and moved the coming-soon banner/emblem to Worker-served R2 paths.
- Added a public "Shop Owners Wanted for Beta Testing" application modal on `frettrack-app.com`, with submissions stored in R2.
- Documented FretTrack domain email/DNS setup for Resend and Supabase Auth invite branding.
- Added `system_announcements` and in-app announcement banners for beta maintenance and bug-fix notices.
- Added `beta_feedback` and a logged-in **Report Issue** form that stores user, shop, page, browser, and selected job context in Supabase.
- Added beta messaging operator notes in `docs/BETA_MESSAGING.md`.
- Added roadmap items for Supabase Realtime announcement delivery, beta feedback notifications/admin view, and a future paid AI-assisted 3D instrument visualization option.
- Fixed selected-shop job saves so House of Bass and other non-default shops no longer fail RLS because `jobService` captured an old shop id at module load.
- Fixed auth token/focus refresh churn so transient auth events no longer clear the open workspace unless the user explicitly signs out or changes account.
- Added per-shop workspace restore so a browser reload can reopen the last selected mode/job for that shop.
- Fixed stale shop display confusion by clearing local shop selection when no session exists and removing the hardcoded `PV Music House` Create Shop placeholder.
- Added a real password reset/update flow: reset links now land on a set-new-password form, and sign-up/password updates require confirmation and at least 12 characters.
- Added a User section in Shop Settings with a current-password-confirmed Change Password form wired to Supabase Auth.
- Added a shop-specific PVMH subcontractor pickup email prompt when finishing eligible `default-shop` Sub-Contract jobs.
- Fixed damage-map and damage-marker photo persistence by saving storage paths and rehydrating fresh object URLs when saved jobs are reopened.
- Changed damage-marker photo links to inline previews with Replace/Remove controls instead of opening temporary blob links in a new tab.
- Capped damage-map image display height so imported damage views stay manageable in the inspection UI.
- Fixed customer damage report printing so screen-only message panels do not print, empty damage-map placeholders do not consume full pages, and damage/work-order images are capped to print-safe sizes.
- Verified RLS for House of Bass feedback/announcement access and cross-shop feedback blocking.
- Deployed beta fixes to Cloudflare Pages and confirmed the production custom domain served the updated bundles.

## v0.2.6-beta.1

- Added a first-class Customers module so customer records can be created without creating a work order.
- Added import-ready customer fields for flexible display name, company/person names, normalized email/phone, secondary phone, structured address, source, external reference, import source, import batch ID, and notes.
- Refactored customer helpers behind a module API and split customer import mapping, normalization, validation, duplicate detection, constants, and persistence into separate module files without exposing a full import UI yet.
- Added a secured Supabase `customers` table with shop-member RLS policies and backfilled customer records from existing jobs.
- Added `customer_id` links from jobs to customers while keeping existing job customer fields for compatibility and display.
- Blocked customer deletes when jobs still reference the customer.
- Updated new job customer lookup to use standalone customer records when available.
- Added duplicate customer warnings by phone, email, or name.
- Audited shop scoping across jobs, customers, job children, events, photos, messaging, commerce tables, and local state merging.
- Added pending RLS hardening so `viewer` is read-only and owner/admin/tech write permissions are explicit.
- Added Edge Function role checks before customer email/SMS messages can be sent or logged.
- Repaired local Supabase migration history to match real remote migration history.
- Added a Supabase migration drift check script and migration repair documentation.

## v0.2.6

- Added the Supabase Auth sign-in/sign-up gate for configured builds.
- Added `shop_members` with owner, admin, tech, and viewer roles.
- Added first-shop owner bootstrap for the configured shop ID.
- Added member-scoped RLS policies for jobs, job child records, messages, and activity events.
- Scoped remote job loading to the configured shop.
- Applied the live auth/shop membership migration for the current trial Supabase project.
- Improved auth and Supabase error messages so failures surface the provider message.
- Fixed child-record RLS access checks so authenticated shop members can save work logs, parts, services, images, messages, and activity events for jobs in their shop.
- Fixed local-only work orders created during auth/RLS rollout so saving a job can create the missing remote parent record before syncing child records.
- Fixed photo uploads that succeeded in Supabase Storage but failed to create `job_images` records because the remote job did not exist yet.
- Fixed customer message sends for repaired/local-only jobs by verifying the remote work order before invoking email/SMS Edge Functions.
- Added duplicate work order guards for slow/double-submitted job creation and a clear `MULTIPLE WORK ORDERS CANNOT BE CREATED` warning.
- Cleaned up duplicate/empty test work orders created during slow or repeated save attempts.
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
- Positioned as the first invite-only beta release.
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
