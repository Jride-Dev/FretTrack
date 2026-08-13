# Roadmap

FretTrack is moving from the old `v0.2.6-beta.14` live baseline into product milestone beta releases. Version bumps should be intentional: if a task does not explicitly ask for a version bump, ask first before changing package, app, or docs version numbers.

## Current Product State

The current release candidate is `v0.2.9-beta.5`. It builds toward the `v0.3.0` Operational Shop Release with the existing inventory, scheduling, reporting, trial, photo, shop, and Stripe self-service foundations plus safer workspace, Inventory, and Job Detail module boundaries.

Shipped or current-branch foundations:

- beta access approval gate
- operator dashboard
- Stripe self-service billing foundation with authenticated Checkout and Portal sessions, signature-verified webhook synchronization, and webhook idempotency records
- customer and subcontractor management
- customer and subcontractor balance/history foundation
- work-order and invoice email flow
- mobile and PWA readiness
- offline draft queue foundation for new work orders
- image optimization before upload
- editable job-level parts and services
- inventory purchasing foundation with parts, stock counts, movements, low-stock visibility, job attachment, vendors, purchase orders, receiving, purchase history, barcode labels, inbound PO shipping, and landed-cost allocation
- Scheduling / Calendar Phase 1 with week view, schedule events, job/customer links, and Job Detail scheduling
- reusable unsaved-changes protection for high-risk manual-edit screens
- premium entitlement architecture for future feature gating
- centralized role/permission helpers for operator, owner/admin, tech, and viewer behavior
- operator-controlled premium trials with 7/14/30-day start and extension controls
- Advanced Reporting Phase 1 with premium-gated dashboard metric cards
- beta approval applicant email notifications through `notify-beta-approval`
- Photo Editor Phase 1 with freehand markup, shapes, arrows, captions, crop, brightness, save-as-copy, guarded overwrite, and manual background cleanup
- Shop Tier Foundation Phase 1 with Trial, Shop, and Pro entitlement boundaries: Shop covers the paid core workflow, Pro unlocks Photo Editor, Team Members, and Advanced Reporting, and internal unpaid compatibility rows remain preserved for migration safety
- Pro Team Assignment Foundation with primary technician assignment, Current Jobs assignee filtering, role-safe self-assignment, audit history, stale-update protection, and non-scoring workload visibility
- Email and Photo Usage Caps Foundation with atomic recipient/upload reservations, repair-photo byte accounting, failure release, and owner/admin usage visibility
- workspace routing and persisted-navigation boundaries with lazy-loaded top-level pages
- focused Inventory presentation modules for parts, vendors, history, labels, purchase orders, and receiving
- focused Job Detail presentation modules for inspection, work, billing, reports, print documents, dialogs, and header state
- authoritative Inventory editor refresh after receiving or stock adjustments
- local-development protection against accidental hosted Supabase mutations
- active-shop business address included consistently in generated invoice email and printable invoice-style Job Sheet output

Known weak spots:

- Customer Damage Report print rendering still needs a proper isolated rebuild
- broad job and inventory persistence services still need later query/mutation decomposition; beta.4 deliberately changed presentation boundaries first
- offline continuity only supports new-job drafts, not existing job edits
- SMS remains disabled
- staff permissions are centralized but still broad-role based, not task-by-task custom ACLs
- public invoice and work-order links are planned but not implemented
- jobs cannot yet be voided or excluded from accounting reports; cancelling or archiving a test job does not currently remove it from accounting job counts
- deeper inventory operations such as vendor import/export, supplier integrations, vendor returns, forecasting, outbound/customer shipping, carrier labels, and tracking numbers are still future work
- Stripe lifecycle validation, production recovery evidence, and monitoring hardening remain paid-launch work
- Photo Editor Phase 1 is practical canvas editing, not a full Photoshop-style editor or AI cutout tool
- Final public pricing and paid overages are not implemented; Shop/Pro email and repair-photo caps are enforced, while Shop/Pro self-service subscription plumbing is deployed and awaiting full live lifecycle validation

## Milestone Version Ladder

| Version | Meaning |
| --- | --- |
| `v0.2.61 beta` | Customers complete |
| `v0.2.62 beta` | Inventory complete |
| `v0.2.63 beta` | Scheduling complete |
| `v0.3.0 beta` | Operational Shop Release |

## v0.2.63 Beta: Scheduling / Calendar

Scheduling Phase 1 is the current branch milestone. It is meant to be a practical shop calendar, not a full external-calendar replacement.

Included in Phase 1:

- shop-scoped `schedule_events`
- job due dates
- intake appointments
- pickup appointments
- follow-up reminders
- shop blocks and other internal events
- daily and weekly schedule visibility
- week view with type/status filters
- job/customer-linked schedule events
- Job Detail scheduling section
- upcoming schedule panel
- internal-only scheduling, with no customer-facing appointment confirmations yet

## v0.3.0 Beta: Operational Shop Release

The Operational Shop Release should pull the core workflow into one stable beta experience.

- stable intake-to-pickup job workflow
- customers, inventory purchasing foundation, and scheduling working together
- reliable work-order and invoice email summaries
- customer-facing **Drop Off Scheduled** email template using the authoritative appointment date and time from Scheduling, including: “Your appointment is scheduled for [date and time].”
- reliable beta application and approval notification flow
- practical photo documentation editor for annotated customer/shop records
- dependable basic print output
- clean operator/admin workflow for beta shops
- beta access approval and premium trial access kept as separate systems
- Trial, Shop, and Pro are the public product states; internal unpaid compatibility rows remain migration-only
- expired trials preserve data and memberships, allow safe viewing, block writes, and show upgrade-required messaging
- Pro entitlement boundaries are explicit for Photo Editor, Team Members, Advanced Reporting, and advanced Team Assignment/workload controls
- practical shop settings for currency, tax labels, date formats, and measurement preferences
- owner/admin accounting-safe job void/exclusion: remove test or invalid jobs from operational accounting totals and counts without physically deleting customer, invoice, payment, or audit history; finalized invoices and recorded payments must require explicit void/refund handling
- known launch limitations documented clearly

## v0.3.x: Commerce Foundation

This series turns the operational workflow into a more complete shop commerce flow while staying focused on repair-shop needs.

- estimates
- invoices
- payments
- taxes
- transaction numbering
- sales history
- entitlement checks for premium commerce/reporting boundaries
- keep commerce entitlements server-authoritative as Stripe lifecycle handling is validated

## v0.4.x: Operations

This series deepens back-office and repeat-workflow tools after the core operational shop release is stable.

- customer import
- reporting
- vendor import/export
- low stock management
- configurable customer service reminders based on the last completed setup/job, supporting 6-month or 12-month timing and shop-editable email wording for seasonal setup advice and returning-customer offers
- lower-priority customer loyalty tracking based on completed-job history, with shop-defined rewards such as a complimentary restring and clear reward redemption history
- supplier integrations
- vendor returns
- inventory forecasting
- outbound/customer shipping workflow
- carrier labels and tracking numbers
- deeper photo/document workflows if real-shop testing shows gaps

## v0.5.x: Commercial Release Preparation

This series extends and hardens the paid-production foundation introduced before `v0.3.0`.

- subscription licensing
- advanced Stripe lifecycle operations and billing support tooling
- multi-tenant billing administration
- recurring restore drills and off-device backup automation
- deeper monitoring, incident response, and billing reconciliation

## Explicitly Shipped / Not Future Work

These are already shipped or have a first foundation in place and should not be described as future-only roadmap items:

- customer and subcontractor standalone management
- work-order and invoice email sending
- PWA install support
- mobile and tablet responsive improvements
- camera-first photo workflow
- offline local draft queue for new work orders
- editable job-level parts and services
- inventory purchasing foundation with vendors, purchase orders, receiving, purchase history, barcode labels, inbound PO shipping, and landed-cost allocation
- Scheduling / Calendar Phase 1
- unsaved-changes protection foundation
- premium entitlement foundation
- premium trial management foundation
- Shop Tier Foundation Phase 1
- Advanced Reporting Phase 1
- beta approval applicant email notification foundation
- Photo Editor Phase 1
