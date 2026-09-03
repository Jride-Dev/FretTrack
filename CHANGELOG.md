# Changelog

Current version: `0.3.1`

This file tracks product, reliability, security, and operational changes by release. Historical prerelease labels remain only in their original release records.

## Unreleased

- Added a dedicated Estimates workspace for draft, sent, approved, and declined revisions. Fixed service quantities to use whole-number controls and persistence, and added a real Email Estimate document flow that sends the locked line items, revision, tax, and total instead of the vague Estimate ready template. The generic template now refuses to send until a real estimate revision exists.
- Added revocable, expiring customer estimate links. Customers can review the locked revision, print or save it as a PDF, and approve or decline it from a public token page; each response is recorded in the estimate lifecycle and timeline without misattributing it to a shop user.
- Fixed document-email retries so an ambiguous estimate send keeps the same request identity through the retry, allowing Message History and the provider idempotency key to reconcile the original operation instead of creating a duplicate delivery.
- Fixed New Work Order persistence by removing the legacy left-side sidebar from the new-job route and rendering the intake form as a full-width workspace on desktop and mobile.
- Extended the professional workspace hierarchy to a full-width Customers surface with a focused directory, restrained selection states, account and contact sections, contained history tables, and a responsive single-column mobile layout without changing customer saves, permissions, import preview, Loyalty, reminders, or shop isolation.
- Extended the professional workspace hierarchy to a full-width Inventory surface with restrained Parts, Vendors, Purchase Orders, Purchase History, and Barcode Labels tabs plus contained tables and editors without changing shop-scoped inventory services, receiving, stock adjustments, purchasing, or permissions.
- Extended the professional workspace hierarchy to a full-width Scheduling surface with contained week columns, restrained filters, and a responsive event editor without changing scheduling services, status actions, dirty-state protection, or permissions.
- Extended the professional workspace system to New Work Order and the shared Work Order, Parts & Payments surface with reusable page-heading and section primitives, grouped intake fields, restrained tabs, and contained billing panels without changing save, permission, or commerce behavior.
- Fixed the public free-trial URL so it opens account creation at the real top-level authentication gate, and added a dedicated retry screen when a newly created workspace is safe in the database but its profile reload fails.
- Added a provider-neutral customer correspondence backend: durable shop/customer/channel threads, direct shop scoping, inbound/outbound direction, read state, explicit customer-report selection, idempotent inbound provider identities, ambiguous-message routing without guessing a work order, narrow guarded RPCs, and cross-shop pgTAP coverage. This does not yet enable inbound email, SMS, Realtime, or a conversation UI.
- Hardened Stripe Checkout so any open subscription on a shop's connected Stripe customer blocks a second subscription, including legacy or manually repaired subscriptions with missing shop metadata.
- Removed the retired access-application modal from the public landing page and aligned README, support, FAQ, and account documentation with confirmed-email self-service registration and the one-time 14-day Pro trial.
- Fixed specialist purchasing so selecting an existing packaged part fills its saved whole-package vendor price, and newly created packaged parts retain the exact package price after reload instead of reconstructing it from a rounded per-item cost.
- Corrected vendor-package purchasing so staff enter the number of packages, the items inside one package, and the price of one whole package. FretTrack now preserves that exact package price separately, previews the actual vendor charge, and derives the inventory-each valuation without multiplying a pack price by its contents.
- Reduced `InventoryPage.jsx` from a 953-line controller to a focused composition surface backed by separate data/history, part/stock, and vendor/purchase-order controller hooks, including stale-safe selected-part history loading.
- Reduced `App.jsx` from 1,117 to 838 lines by moving session restoration, approval/operator checks, stale-safe shop bootstrap, first-shop creation, shop switching, profile refresh, and sign-out cleanup into `useSessionShopBootstrap.js`.
- Reduced `JobDetail.jsx` from 926 to 669 lines by extracting Work Note save/retry protection, photo upload/edit coordination, and message/document/timeline coordination into focused hooks, including stale-safe timeline refreshes.
- Added a guarded commerce boundary: technicians can append ordinary payments without receiving price, discount, tax, refund, or finalization authority; refunds and payment voids require owner/admin; saved payment rows are append-only; and invoice finalization stores a server-calculated minor-unit snapshot while locking charge rows until an audited reopen.
- Hardened workflow retries around that boundary: pending photo deletion now survives upload completion, photo and customer-message retries reuse stable operation identities, confirmed sends and payments remain confirmed when a follow-up refresh fails, ordinary work-order saves preserve database-owned payment history, and payments or authorized refunds use the guarded append-only RPC without attempting a conflicting full draft save first.
- Added an owner/admin estimate lifecycle with draft, sent, approved, and declined states; server-calculated minor-unit snapshots and revision history; optimistic concurrency; locked charges after sending; audited customer decisions; and an explicit return-to-draft path for revised estimates.
- Added an explicit shop tax-calculation boundary: tax is disabled by default unless an owner/admin enables manual shop-configured calculation, profile changes are versioned, and estimate/invoice snapshots preserve calculation mode, profile revision, jurisdiction, registration reference, and taxable categories.

## v0.3.1 - Current Stable Release

- Reduced application-shell orchestration by moving PWA installation, theme preferences, sidebar persistence, and stale-safe assignable-member loading into focused hooks.
- Reduced Job Detail orchestration by moving derived billing/measurement state and payment/service draft actions into focused hooks while retaining existing save and optimistic-concurrency behavior.
- Made versioned work-order saves report post-save customer synchronization failures as partial failures, and made immediate or delayed payment conflicts show the server conflict instead of silently disappearing.
- Split the global stylesheet into ordered foundation, workspace, and feature/detail files without changing selectors, cascade order, responsive rules, or print behavior.
- Updated focused checks to follow extracted Job Detail owners and removed a dirty-diff scope assertion from email isolation validation so unrelated intentional release files do not create false failures.
- Retained the established `0.3.0` product, billing, security, migration, and operational boundaries; `0.3.1` is a maintainability release with no plan or schema change.

## v0.3.0 - Operational Shop Release

- Added a focused full-width Guitar Bench that matches the Amplifier and Keyboard workspaces while retaining one shared work-order surface for parts, services, payments, messaging, scheduling, photos, printing, and history.
- Rebuilt the Customer Service and Condition Report and invoice-style Job Sheet as isolated print documents with image-readiness handling, instrument-appropriate terminology, deterministic layouts, and protection against duplicate or stale print actions.
- Added accounting-safe work-order exclusion so invalid or test records can be removed from operational totals without deleting customer, payment, invoice, message, or audit history.
- Completed the stable public release surface with 0.3.0 product documentation, release notes, pricing, access, legal, support, and operational guidance instead of a public testing program.
- Made public access-application retries idempotent across the database request, Resend delivery keys, and private archive object so a lost response cannot duplicate confirmation mail or backup copies.
- Kept canceled ownerless shops in the production integrity review whenever a Stripe customer or subscription identifier remains attached; only fully billing-detached canceled tenants qualify as closed historical records.
- Made beta approval emails idempotent across concurrent calls and post-provider database failures by claiming a durable delivery before Resend, reusing a stable provider key and message snapshot, atomically finalizing the legacy notification marker, and blocking blind retries once provider deduplication can no longer guarantee safety.
- Released FretTrack 0.2.9 as the first stable commercial build, retaining controlled account approval while removing customer-facing beta branding.
- Made Stripe webhook claims recoverable when terminal finalization is unavailable: the current token owner can release an unfinished claim, nonterminal replays remain non-2xx so Stripe retries, and abandoned processing leases can be reclaimed after five minutes without allowing stale attempts to finalize newer work.
- Atomically claim signed Stripe webhook event IDs before processing so concurrent duplicate deliveries cannot both enter billing lifecycle handling; failed attempts remain retryable through token-guarded finalization.
- Added a fail-closed, server-authoritative Stripe Checkout launch switch with an exact shop-ID pilot allowlist, authenticated UI status, narrow Stripe Edge Function service-role grants, and uninterrupted Billing Portal access for existing subscribers.
- Made the annual Stripe sandbox validator portable across Windows and Linux, added controlled missing-CLI handling, and added signed duplicate and older-event replay assertions.
- Polished Pro Automated Service Reminder settings with a customer-style email preview, a collapsed advanced editor, labeled personalization-field insertion controls, responsive theme-aware styling, normalization of legacy literal newline escapes into real email paragraphs, and an accurate missing-booking-link warning instead of a fake preview URL.
- Added a Pro/Enterprise Loyalty Program with configurable stamp rules, one reconciled award per eligible paid/completed work order, reversible eligibility when billing or ownership changes, customer progress, and an idempotent staff redemption ledger that deliberately remains separate from invoice payment and store credit.
- Added Pro/Enterprise Automated Service Reminders with separate customer consent, shop-configurable service keywords/month interval/template/booking URL, a durable long-horizon Supabase queue, nightly Cron dispatch, final pre-send entitlement and consent checks, stable provider idempotency, existing recipient-quota accounting, and Message History records.
- Connected amplifier and keyboard benches to job-linked vendor purchasing. Technicians can order an existing or newly created inventory part, preserve vendor package quantity separately from the quantity needed by the job, receive it through Inventory, and explicitly add the received job quantity to Parts & Payments. Concurrent same-key requests replay the winning purchase instead of surfacing a duplicate-key error.
- Restored the full commercial workflow for amplifier and keyboard work orders, including parts, services, tax, discounts, payments, balances, invoice email, print documents, photos, scheduling, messages, and history, while retaining specialist repair benches and dirty-state protection.
- Replaced guitar inspection terminology on amplifier and keyboard work orders with instrument-specific safety, keybed, electrical, MIDI, diagnosis, functional-test, and final-verification fields.
- Made job parts and services persistence failures reject the save instead of displaying a false success, and preserved previously saved billing children until replacement writes succeed.
- Expanded Keyboard Repair into a CRM-focused technician workflow with per-key RLS-protected fault records, an interactive MIDI-aware keybed map, standardized fault codes, sensor profiles, raw MIDI logs, model-family checklists, inventory-backed parts requests, repair analytics, and customer diagnostic emails using FretTrack's existing consent, quota, message history, job-cost, and stock transaction paths.
- Added a Pro-gated Keyboard Repair workspace for synthesizers, digital pianos, stage pianos, MIDI controllers, electric pianos, and organs, including focused intake, editable make/model presets, an active-work queue, keybed/power inspection, initial/final functional testing, optimistic concurrency, server-authoritative downgrade protection, and server-numbered concurrent intake so simultaneous repair modules cannot claim the same browser-previewed work order.
- Added a Product Hunt review badge to the public FretTrack portal footer, including responsive badge layout and the required image security policy allowance.
- Prevented an in-flight Work Note save from leaking draft, saving, or dirty state into another selected job, added optimistic concurrency to amplifier saves so a stale technician session is rejected instead of overwriting newer bench work, and made scheduled-email reconciliation atomic so a delayed cancellation cannot replace a delivery another request already recorded.
- Added a Pro-gated transactional email scheduler that snapshots recipient/subject/body, schedules and cancels through Resend up to 30 days ahead, requires customer email opt-in, preserves immediate email behavior and quota enforcement, and adds a Drop Off Scheduled template sourced from the job appointment time.
- Added a Pro-gated Amplifier Repair workspace with make/model presets, amplifier intake, an amplifier-only work queue, a dedicated bench worksheet, before/after electrical and digital diagnostics, private audio/waveform/spectrum evidence, role-aware permissions, server-authoritative entitlement enforcement, historical read access after downgrade, and refresh-safe detail routing.
- Expanded browser validation with Pro/Shop amplifier entitlement and persistence coverage, quieter self-contained image fixtures, and an opt-in read-only Browserbase smoke runner for the production sign-in shell.
- Hardened the merged Work Note, local test-seed, and Stripe lifecycle fixes after adversarial review: failed Work Note retries keep one row identity, deterministic seed collisions recover without crossing shops or rewriting audit history, older Stripe events cannot advance synchronization state, and itemless Stripe payloads are handled safely.
- Preserved Stripe subscription renewal dates with the current item-level period fields while retaining legacy top-level webhook compatibility.
- Recorded the completed Stripe concurrency migration/webhook rollout and fresh pre-migration backup evidence while keeping real Stripe lifecycle smoke tests as a paid-launch gate.
- Made local Playwright shop seeding safely retryable by reusing deterministic jobs before requesting a new job number, with a second no-reset CI seed pass.
- Serialized rapid Work Note submissions so repeated Save clicks share one persistence request and cannot delete each other during stale-row cleanup.
- Expanded the local Playwright matrix with saved Work Note coverage and an isolated UK shop proving millimetres, GBP, and VAT remain consistent across Job Detail, totals, and printable Job Sheets.
- Paginated the existing Stripe subscription lookup so an open shop subscription beyond the first 100 provider records still blocks duplicate Checkout.
- Closed the remaining Stripe billing-integrity races: simultaneous Checkout tabs now share one shop-generation idempotency key, while service-role-only synchronized webhook writes reload current Stripe state and prevent older or late-finishing events from overwriting newer plan/access state.
- Hardened Stripe self-serve billing against duplicate subscriptions and superseded events, made Portal prices authoritative over stale Checkout metadata, and kept failed-payment grace states compatible with the legacy shop-profile mirror.
- Added a local Playwright and Supabase pgTAP testing foundation with authenticated shop fixtures, transactional cross-shop RLS coverage, and isolated pull-request CI reporting.

## v0.2.9 - Previous Stable Release

- Added a paid-launch readiness pass with a 30-day launch checklist, restore-drill runbook, backup automation blocker, Stripe self-serve billing source control, Checkout/Portal/Webhook launch docs, and `npm run check:paid-launch-readiness` validation.
- Hardened hosted-backup checksum generation to use the platform-independent .NET SHA-256 implementation after the Windows PowerShell hash command failed during a pre-launch backup; the full database, Storage, manifest, and Docker-volume backup now completes end to end.
- Hardened unattended hosted Supabase backups to start and wait for Docker Desktop, which current Supabase CLI dump commands require, while skipping the optional local-volume archive during scheduled runs; manual backups and restore drills retain local-volume safety archives.
- Updated paid-launch, trial, roadmap, and security guidance to reflect the deployed Stripe self-service foundation, current recovery evidence, frontend secret scan, and remaining Supabase Auth/security gates.
- Completed the first full hosted-to-local recovery drill, including linked Auth/Storage version alignment, database row-count and relationship validation, grandfathered Storage-object handling, and byte-for-byte verification of all 194 restored objects.
- Added migration `20260812025459_harden_set_updated_at_search_path.sql` to pin the shared trigger helper to an empty search path and revoke unnecessary direct client execution; timestamp triggers and the local Supabase Security Advisor pass.
- Corrected Stripe invoice lifecycle handling for the current `parent.subscription_details.subscription` payload while retaining legacy invoice compatibility, and added executable coverage for payment recovery, failed-payment, cancellation, trial, and read-only status mapping.
- Expanded paid-launch RPC security coverage for shop bootstrap, public/operator system status, and inventory/PO receiving, and documented the reviewed Supabase Free-plan Auth constraint and intentional Security Advisor exceptions.
- Hardened Stripe Checkout so merely opening or abandoning payment cannot change a beta shop's plan, entitlements, or connected customer state; subscription writes now remain behind signature-verified Stripe webhook confirmation with regression coverage and documented smoke testing.
- Corrected Stripe plan/interval synchronization to use exact configured Price IDs and an explicit billing-interval snapshot, kept failed webhook events retryable, and tightened webhook-audit table grants before production rollout.
- Added the active shop's business address to printable invoice-style Job Sheets and attached Job Sheet email content, while preserving the existing shop-scoped address in generated invoice emails.
- Protected new Work Notes from silent loss: pending text is visibly unsaved, participates in refresh/navigation protection, saves through Save Job, blocks customer printing/email until resolved, supports explicit draft discard, and reports failed Work Note saves.
- Began the 0.3.0 modular architecture foundation by extracting top-level workspace page rendering and navigation state from `App.jsx`, lazy-loading feature pages behind a shared workspace boundary, and separating the current-job status rule from page UI; page restoration, permissions, Close Detail, and dirty-state handlers remain unchanged.
- Corrected the extracted workspace restoration lifecycle so refresh waits for the active shop and its data to hydrate before persisting navigation; Inventory, Scheduling, Customers, Reports, and valid Job Detail selections now restore instead of being overwritten by the initial New Job mode.
- Continued the modular shell extraction by moving the New Job sidebar composition and centralized role/entitlement derivation out of `App.jsx`; the existing Job Form, compact Current Jobs, Till Summary, Upcoming Schedule, write restrictions, photo permissions, team assignment access, and billing visibility remain connected through explicit boundaries.
- Continued the 0.3.0 Inventory decomposition by extracting the read-only History, Barcode Labels, and Vendors tab presentation from `InventoryPage.jsx`; existing vendor mutations, barcode printing, purchase-history snapshots, permissions, and Inventory controller state remain connected through their established handlers.
- Separated Inventory part searching, stock filters, compact list rendering, and barcode-label selection into a focused presentation boundary while keeping part editing, images, receiving, stock adjustments, permissions, and persistence in the existing controller.
- Extracted the controlled Inventory Part editor and stock-action presentation while retaining dirty-state ownership, save/deactivate/receive/adjust handlers, image processing, permissions, and persistence in `InventoryPage.jsx`.
- Extracted Purchase Order filtering, summary-table rendering, and pure snapshot-total calculations while keeping PO creation, receipt entry, status changes, permissions, and persistence in the existing Inventory controller.
- Extracted the controlled Purchase Order creation, detail, status-action, and receiving presentation while retaining PO mutations, partial-receipt state, permissions, and persistence in `InventoryPage.jsx`.
- Began the `JobDetail.jsx` decomposition by extracting its status/assignment/unsaved-state header and document/subcontractor/photo dialog composition; all job updates, permission decisions, email/photo actions, dirty state, and persistence remain owned by Job Detail.
- Moved Job Detail’s pure instrument-selection, measurement-export, and damage-marker formatting into an executable helper boundary without changing saved job values, shop measurement units, or document rendering.
- Extracted the customer-report Damage Map renderer from `JobDetail.jsx` while preserving image-required marker output, empty-map omission, missing-image copy, severity colors, and the existing print layout contract.
- Moved Job Sheet and Customer Damage Report composition into a focused print-document boundary while keeping print commands, shop measurement formatting, calculated totals, and job state in their existing owners.
- Extracted the Job Detail Inspection tab composition into a controlled module while retaining measurement units, technical-field updates, Damage Map persistence/uploads, and write permissions in their established paths.
- Extracted the Job Detail Work tab composition into a controlled module while retaining Work Log append/edit/blur-save behavior, service-line mutations, and write permissions through the existing Job Detail handlers.
- Extracted the Job Detail Parts & Billing tab composition into a controlled module while retaining inventory-backed/manual parts, services, payments, discounts, tax/VAT defaults, invoice email, totals, and permission behavior through established handlers.
- Continued the Job Detail decomposition by moving shell, header/dialog/tab assembly, Intake, Photos, Print actions/documents, Messages, Scheduling, and Timeline composition behind focused presentation boundaries while keeping contact updates, instrument selection, photo upload/edit/delete controls, print/email/finish actions, document data, message sending, linked schedule events, timeline data, permissions, and notices on their existing handlers.
- Moved Job Detail's pure field-patch builders for customer names, received dates, instrument changes, string counts, and job/shop tax-rate edits into the existing formatting helper boundary while preserving dirty-state, permission, save, VAT override, and job-number behavior.
- Moved Job Detail's pure payment add/update/remove builders into the same helper boundary while preserving payment autosave, permissions, invoice totals, and dirty-state behavior.
- Moved Job Detail's neck-inspection and string-gauge patch builders into the same helper boundary while preserving shop measurement units, dirty-state handling, permissions, and instrument-specific string-count sizing.
- Moved Job Detail's manual part and service line-item patch builders into the same helper boundary while preserving inventory-backed stock service calls, included-service part tracking, totals, permissions, and dirty-state behavior.
- Moved Job Detail's discount, generic tech-field, work-order image selection, contact preference, and last-message-template patch builders into the same helper boundary while preserving dirty-state, permissions, document image selection, and messaging behavior.
- Moved Job Detail's work-log row edits/removals, Damage Map update, message merge, and assignment merge builders into pure helper boundaries while preserving save timing, notices, permissions, and timeline refresh behavior.
- Moved Job Detail's inventory-backed part result merges and local photo preview/remove transforms into pure helper boundaries while preserving the existing inventory service calls, photo persistence calls, permissions, stock updates, and refresh behavior.
- Moved Job Detail's picked-up status patch and Damage Map uploaded-image selection logic into pure helper boundaries while preserving the existing finish flow, PVMH pickup prompt, upload handling, and permissions.
- Added a read-only Supabase data-integrity check for deleted-job orphans, ownerless shops, broken shop-member auth links, and auth users without identities so live data can be verified before/after deployments without dumping customer records.
- Fixed direct receiving, stock adjustments, and purchase-order receiving so the selected Inventory editor refreshes its authoritative quantity and cost; a later Save Changes action can no longer overwrite received or adjusted stock with stale form values.
- Added a production build configuration guard so App Pages deploys fail before upload if the compiled bundle contains local Supabase URLs, demo auth keys, or local test-shop defaults.
- Added a guarded App Pages production deploy wrapper that forces the production Supabase build config, runs the production-build guard, and only deploys after the compiled assets pass.
- Extended the production deploy guard to require the FretTrack Edge Function key so customer Work Order emails cannot be deployed with an unauthorized blank function header.
- Added a repository architecture health audit covering validation status, module boundaries, growing source hotspots, test-suite brittleness, local test-environment policy, and the unattended backup reliability blocker.
- Prevented local development from silently using a hosted Supabase project, repaired local test-shop lifecycle/authentication records for the current local Supabase stack, and added a focused isolation check.

## v0.2.9-beta.3

- Replaced the Community section's temporary TGR letter mark with the supplied JR's Custom Shop / Torrance Guitar Repair logo.
- Expanded the public Support page with a dedicated FAQ covering uptime resets, Operational status interpretation, Shop Settings defaults, read-only access, photo persistence, and useful privacy-conscious bug reports; also documented that the uptime clock is a conservative shared-infrastructure recovery indicator rather than proof of an app restart or shop outage.
- Fixed Shop Settings VAT-rate inheritance for existing jobs: legacy and shop-linked jobs now use the current shop default across Job Detail, newly generated invoices, customer balances, and accounting reports, while a rate edited inside a job remains an explicit override and previously sent email content is untouched.
- Simplified the authenticated system-status banner to one `OPERATIONAL` label, quiet provider health dots, and a continuously advancing FretTrack uptime based on relevant Supabase and Cloudflare incident recovery history refreshed every 30 minutes; removed the animated database plug. The headline now keeps FretTrack's own status authoritative so a provider degradation is reported only on the affected provider chip.
- Fixed legacy production schema drift where new jobs created without an explicit status defaulted to the disallowed value `Intake`; the database default now matches the app and status constraint at `Checked In`.
- Added purchase-unit conversion for inventory parts, purchase orders, and partial receiving. PO lines and receipts snapshot their purchase unit and whole-number conversion, while stock, job usage, and normal adjustments remain in individual inventory units.
- Compacted the authenticated operational-status banner and replaced its misleading “time since Operational was published” uptime display with live Supabase and Cloudflare Pages/Workers health sourced from the providers’ official status feeds; declared incidents retain an incident-duration indicator.
- Fixed measurement-unit propagation so explicit Shop Settings (Imperial/inches or Metric/millimeters) now drive new jobs, Job Details, neck-measurement entry, print sheets, customer reports, generated document emails, exports, and advanced report measurement summaries instead of stale job-level unit defaults.
- Added operator-published system notices and a persisted Operational/Maintenance/Degraded/Outage status shared by the authenticated app and public website, including server-timestamp-based uptime/incident duration, locally persisted notice-sound preferences, and a public-safe status endpoint. The additive migration is included for review and is not applied by this branch.
- Fixed Job Detail’s `Close Detail` action so it returns to the page that opened the job, preserves the selected job context, and retains the existing unsaved-change confirmation without changing job status.
- Hardened production deployment rollover recovery so stale Vite chunks cannot cache Cloudflare's HTML app-shell fallback as JavaScript or CSS, and a failed dynamic import receives one guarded automatic reload without entering a reload loop.
- Improved detail and edit navigation clarity across Jobs, Customers, Inventory, Vendors, Purchase Orders, and Scheduling with explicit `Close Detail`, `Cancel`, `Close Preview`, and edit-aware `Save Changes` labels while preserving existing close and dirty-state handlers.
- Renamed the job-detail-only `Close Job Detail` action to `Close Detail` so it no longer implies that it changes the job status; `Finish / Picked Up` remains the persisted job completion action.
- Added optional job drop-off date/time, the shared `Drop Off` job status, and server-authoritative generated Scheduling events for job drop-off and promise dates. Generated events are shop/job/kind unique, update without duplication, clear independently from manual events, and show their job-date source in Scheduling.
- Added migration `20260728094434_job_dates_scheduling_sync.sql` and `npm run check:job-dates-scheduling-sync`; the migration is included for review and is not applied by this branch.
- Added server-authoritative Shop and Pro usage caps for monthly transactional email recipients, monthly source-photo uploads, and current repair-photo storage, including atomic idempotent reservations, failure release, exact-path Storage enforcement, deletion reconciliation, operator overrides, and owner/admin usage meters.
- Shop includes 1,000 email recipients/month, 2,000 source-photo uploads/month, and 5 GiB photo storage. Pro includes 5,000 recipients/month, 10,000 source uploads/month, and 25 GiB photo storage. Shop and Pro trials inherit their selected tier.
- Added migration `20260727231401_email_photo_usage_caps_foundation.sql`, `docs/EMAIL_AND_PHOTO_USAGE_CAPS.md`, and `npm run check:usage-caps`. No migration or Edge Function is applied or deployed by this branch, and no Stripe or paid-overage behavior was added.

## v0.2.9-beta.2

- Added the Pro Team Assignment Foundation: persisted same-shop primary technician assignments, owner/admin management, technician self-claim/removal, viewer read-only display, active-member validation, safe historical assignee names, targeted stale-aware updates, assignment audit events, Current Jobs filtering, and a non-scoring workload summary.
- Added `team_assignment` as an advanced Pro workflow entitlement without changing existing Team Members membership behavior, billing, or Stripe. Active trials and approved writable beta shops can exercise the feature; expired/read-only shops retain readable historical data.
- Added migration `20260727151302_pro_team_assignment_foundation.sql` and `npm run check:pro-team-assignment`; the migration is not applied by this branch.
- Fixed the Pro Team Assignment validation check so it verifies the exact authoritative migration from repository contents after merge, including clean working trees, instead of relying on feature-branch diffs.

## v0.2.9-beta.1

- Hotfixed the compact Current Jobs sidebar after the full-page release: restored restrained rectangular summary rows, contained job/date text, removed oversized pill/tab styling and horizontal clipping, and preserved the separate full-width Current Jobs filters and sorting page.
- Bumped FretTrack to `0.2.9-beta.1` with persistent country/region, metric/imperial action units, USD/GBP/CAD currency context, shop-defined Sales Tax/VAT/GST wording and default rate, plus a full Current Jobs page with active scope, search, priority/status/due filters, sorting, and responsive cards.
- Corrected the responsive Scheduling event-details dialog action layout so small-screen buttons stack at full available width without horizontal clipping, and made the regression check verify the actual mobile media rule across platform line endings.
- Fixed Scheduling week-view event overflow with contained, clamped compact cards and a responsive keyboard-accessible event details dialog that preserves role-gated edit, complete, reopen, cancel, and delete actions, backed by `npm run check:scheduling-week-event-layout`.
- Fixed generated customer email shop isolation so invoice/work-order/document emails and job message templates resolve identity from the active job shop profile, block missing or mismatched shop context, reset drafts across job/shop changes, and avoid stale JR/Torrance/default shop signatures with `npm run check:email-shop-isolation` coverage.
- Fixed Damage Map marker intake so users must add or select a damage map image before markers can be placed, with guarded marker creation, clearer empty-state copy, safer customer-facing no-image output, and `npm run check:damage-map-image-required` coverage.
- Added beta UK/privacy polish with international `Postal Code / ZIP` labels, alphanumeric postal-code entry, trimmed postal-code storage, a `Hump / rise at body joint` neck condition option, a beta-shop customer data/privacy note, and `npm run check:beta-uk-privacy-polish` coverage.
- Added Discord, GitHub, Reddit, and Torrance Guitar Repair links to the public FretTrack landing-page footer.
- Added a full landing-page community section with a prominent Discord news-and-updates call to action, custom Discord, Reddit, and GitHub-themed FretTrack artwork, and dedicated GitHub, Reddit, and Torrance Guitar Repair destination cards.
- Bumped package metadata and the in-app version display to `0.2.9-beta.1`.
- Finalized the 0.2.9 beta release marker for Pro Reports Dashboard Phase 2, Pro branding/status UI hardening, Pro emblem support, beta tester workbook/checklist delivery, public Terms/Privacy/Support readiness, and paid beta preparation before Stripe Billing Foundation begins.
- Fixed a Reports runtime crash caused by a missing `formatDateTime` helper in the Advanced Reports table renderers, and added `npm run check:reports` coverage so missing report formatter references are caught before release.
- Added 0.2.9-D Reports hardening with browser print support, per-section CSV exports, 25-row table previews, 250-row show-all safety, 1,000-row export caps, simple report date/status filters, section-level error containment, and larger mock dataset checks without adding PDF generation dependencies.
- Added 0.2.9-F Customer Import Parser + Template Foundation with a CSV template, isolated PapaParse-backed preview helper, alias mapping, first/last name combination, validation, duplicate detection, skipped/error CSV output, and `npm run check:customer-import` coverage without adding customer database writes, an import modal, an import route, or Supabase calls.
- Added 0.2.9-G Customer Import Preview UI in the Customers module so owners/admins can download the CSV template, upload a CSV, preview normalized rows, review validation/duplicate warnings, respect 100-row preview and 1,000-row file caps, and download skipped/error CSV output without writing customer records.
- Added 0.2.9-H Shipping Foundation with a `job_shipments` table, address snapshots, carrier/tracking/status fields, RLS, scoped shipping service helpers, shipment permission helpers, and `npm run check:shipping` coverage without adding shipping UI, carrier APIs, labels/rates, Stripe, or notifications.
- Added Shipping / Receiving / Chain of Custody Foundation Phase 1 with a Shipping dashboard, manual vendor/customer inbound and outbound records, tracking and label-reference fields, `shipping_items`, custody event history, location/category preset reuse, and `npm run check:shipping` coverage without adding carrier APIs, label purchasing, Stripe automation, or automatic notifications.
- Added 0.2.9-I Shop Bootstrap Reliability so first-shop creation now atomically creates the shop profile, owner membership, and default trial subscription, then reloads real shop access instead of continuing from a partial local state.
- Added 0.2.9-J live-demo polish: New Job intake now preserves customer contact/address fields in the saved job payload, instrument type persists with category-aware gauge presets including acoustic, bass, and nylon/classical choices, Shop no longer advertises Pro-only Photo Editor/Team Members access, header navigation highlights the active page, and scheduling/customer overflow styles were tightened.
- Added inventory/vendor/shipping polish with owner/admin-managed inventory Location and Category presets in Shop Settings, UPC-facing labels, Vendor wording cleanup, Special Order Part behavior that avoids stocked low-inventory nags, 300x300-or-smaller part images stored in a private `part-images` bucket, and shipping/parts label printer presets backed by `npm run check:inventory-shipping-polish`.
- Fixed the inventory preset editor so multi-word Location/Category values such as `Black Bag`, `Plastic Bin`, `White top drawer`, and `Guitar Parts` type and save normally, and cleaned up Add/Edit Part field labels/order after the inventory polish pass.
- Fixed job photo persistence so saved gallery, edited-photo, and damage-map images prefer stable Supabase Storage paths and regenerate fresh signed URLs on job load instead of reusing expired temporary URLs.
- Restored legacy Damage Map photo hydration for older jobs. Legacy storage-path and URL field names are normalized before display, so recoverable map and damage-area photos receive fresh signed URLs when the job reopens.
- Fixed Job Sheet printing so the customer-facing page canvas and Job Sheet wrapper are explicitly white and borderless, with one Letter-page margin instead of an added sheet frame and second margin layer.
- Fixed the global print canvas so Job Sheets, Customer Reports, and Damage Acknowledgments cannot inherit a dark/system app theme around the document. Outer print roots and shared document wrappers now print white and borderless while internal document structure remains intact.
- Restored normal job photo upload controls for writable owner/admin/tech users. Basic photo capture and device import now follow lifecycle-aware job write access, while Pro-only photo editing remains separately gated.
- Completed a role and permission audit pass: Job Detail controls now remain read-only for viewers and expired shops across intake, inspection, damage maps, work logs, parts, services, payments, status changes, schedules, photo selection, and messaging preferences; owner/admin/tech operational access stays intact, operator tools remain verified-operator-only, and `npm run check:role-permissions` covers the role matrix.
- Fixed the invoice/work-order email dialog so a successful send closes it cleanly, failures release the sending state for retry, and Cancel, Escape, or backdrop dismissal always remain available without resending the document.
- Fixed document email dialog regressions: Job Sheet and Customer Report checkboxes stay aligned without horizontal overflow, and successful document emails retain safe job-event logging without interrupting delivery.
- Expanded the public Docs hub at `https://frettrack-app.com/docs` into customer-facing how-to pages for getting started, beta testing, shops/accounts, customers, jobs, estimates, photos/damage maps, inventory, shipping/custody, scheduling, reports, billing basics, roles, troubleshooting, and FAQ content without relying on GitHub Wiki access.
- Added a full screenshot-backed public how-to manual at `/docs/how-to-use-frettrack`, adapted from the FretTrack Wiki/user-guide chapters and using the GitHub Wiki screenshot set from the repository.
- Fixed landing Worker routing for public docs so `/docs`, `/docs/`, `/docs.html`, and clean `/docs/...` how-to pages return 200 directly, avoid slash/canonical redirect loops, and consistently include CSP, Permissions-Policy, Referrer-Policy, and X-Content-Type-Options headers.
- Cleaned user-facing copy in Reports, Billing, Shop Settings, Shipping, Scheduling, auth, and operator-only screens so product UI no longer exposes internal phase/debug wording.
- Added 0.2.9-B0 plan branding and subscription status UI foundation: the app header, version area, Shop Settings subscription panel, Billing page, and Advanced Reporting lock/unlock state now use one normalized plan object for Trial / Shop / Pro / Expired labels, countdowns, and emblem choice. Pro and Trial Pro shops use the Pro emblem and Pro labels, never the primary FretTrack Shop identity, and `npm run check:plan-branding` verifies the key display states without adding Stripe Checkout, Customer Portal, webhooks, or billing secrets.
- Added 0.2.9-A Pro Reports Dashboard Phase 2 with Pro-gated operational reporting for shop overview counts, jobs by status, priority, overdue promise dates, ready-for-pickup work, waiting-on-parts work, job aging, recent work-log activity, low-stock inventory by desired stock level, purchase order status, landed-cost purchase history, and upcoming schedule workload.
- Redesigned the public `frettrack-app.com` landing Worker for launch readiness with a product screenshot hero, workflow, security, Trial/Shop/Pro pricing preview, and beta application sections.
- Added bundled landing Worker static assets for the FretTrack favicon package and product screenshots, plus `npm run check:landing-worker` coverage for the landing HTML and favicon route.
- Added the first 0.2.8 Inventory Purchasing Foundation pass with shop-scoped vendors, purchase orders, purchase order items, inventory receipts, receipt items, part barcode identity fields, vendor SKU, desired stock levels, last/average cost tracking, purchase history UI, and transactional receiving RPCs.
- Added 0.2.8-B inventory polish with printable barcode labels, `FT-PART-` lookup support, purchase order filters/actions, clearer receiving quantities/costs, expanded purchase history, and tighter receiving RPC validation.
- Fixed purchase order new-part line items so they create and link real inventory parts at quantity 0 before receiving, and hardened PO receiving to repair legacy null-part lines before stock, receipt history, and movement rows are written.
- Added 0.2.8-C offline mode audit documentation, clarified user-facing offline scope, and kept offline inventory receiving, purchase orders, photo queues, and existing-job edits out of scope until a real sync architecture exists.
- Added SECURITY DEFINER RPC hardening for flagged Supabase RPCs with explicit grants, locked search paths, stronger inventory/accounting input validation, and documented callable-role intent.
- Added Paid Access Lifecycle Phase 1 so public product language is Trial, Shop, and Pro, expired trials preserve data while blocking writes, and legacy internal unpaid values remain compatibility-only during migration.
- Added Shop Tier Foundation Phase 1: Shop represents the paid core workflow, and Pro is the upgraded feature tier for Photo Editor, Team Members, and Advanced Reporting.
- Added backend enforcement for Shop team-member access so preserved staff memberships cannot access shop data or mutate member records while trial access is expired.
- Hardened customer email/SMS Edge Function access checks so preserved staff rows cannot bypass effective team-member access or expired-trial write blocking.
- Added visible Pro lock states for Photo Editor, Team Members, and Advanced Reporting without adding Stripe, billing forms, pricing, caps, or payment automation.
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
- Added a collapsible New Job section menu so shops can hide the left rail and give the form more working space.
- Added 0.2.8-D vendor and landed-cost purchasing polish: Company/Sales Rep labels, vendor address fields, Online Only behavior, inbound PO Shipping Cost, optional Add shipping to cost allocation, and purchase-history landed-cost display.
- Added 0.2.8-E instrument intake polish: Instrument Type / Brand / Model now use a cascading catalog with brand-matched model suggestions while still allowing custom brand and model entry.
- Added 0.2.8-F New Job instrument intake polish with screenshot-ready instrument detail grouping, optional Year/Finish/Orientation fields stored in job details, improved Serial Number/Color labels and placeholders, removed extra Brand/Model helper copy, and tightened the Year field layout.
- Added opt-in Job Sheet and Customer Report delivery controls to the document email dialog. Selected documents render as readable, customer-facing email sections while the normal message remains editable.

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
- Added beta messaging operator notes in `docs/FEEDBACK_AND_SYSTEM_NOTICES.md`.
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
