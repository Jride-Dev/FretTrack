# Roadmap

FretTrack is moving from the old `v0.2.6-beta.14` live baseline into product milestone beta releases. Version bumps should be intentional: if a task does not explicitly ask for a version bump, ask first before changing package, app, or docs version numbers.

## Current Product State

The old live baseline is `v0.2.6-beta.14`. The current branch builds on that baseline with inventory purchasing and landed-cost foundation work, Scheduling / Calendar Phase 1, premium entitlement/reporting foundations, operator-controlled premium trial management, beta approval notifications, Photo Editor Phase 1, and Shop Tier Foundation Phase 1.

Shipped or current-branch foundations:

- beta access approval gate
- operator dashboard
- billing and subscription foundation without Stripe
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

Known weak spots:

- Customer Damage Report print rendering still needs a proper isolated rebuild
- offline continuity only supports new-job drafts, not existing job edits
- SMS remains disabled
- staff permissions are centralized but still broad-role based, not task-by-task custom ACLs
- public invoice and work-order links are planned but not implemented
- deeper inventory operations such as vendor import/export, supplier integrations, vendor returns, forecasting, outbound/customer shipping, carrier labels, and tracking numbers are still future work
- commerce, licensing, billing automation, production backups, and monitoring are later release tracks
- Photo Editor Phase 1 is practical canvas editing, not a full Photoshop-style editor or AI cutout tool
- Free/Shop/Pro pricing, plan caps, storage enforcement, Stripe, and self-service billing are still not implemented

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
- reliable beta application and approval notification flow
- practical photo documentation editor for annotated customer/shop records
- dependable basic print output
- clean operator/admin workflow for beta shops
- beta access approval and premium trial access kept as separate systems
- Trial, Shop, and Pro are the public product states; internal unpaid compatibility rows remain migration-only
- expired trials preserve data and memberships, allow safe viewing, block writes, and show upgrade-required messaging
- Pro entitlement boundaries are explicit for Photo Editor, Team Members, and Advanced Reporting
- practical shop settings for currency, tax labels, date formats, and measurement preferences
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
- no Stripe or billing automation until the entitlement boundaries are stable

## v0.4.x: Operations

This series deepens back-office and repeat-workflow tools after the core operational shop release is stable.

- customer import
- reporting
- vendor import/export
- low stock management
- supplier integrations
- vendor returns
- inventory forecasting
- outbound/customer shipping workflow
- carrier labels and tracking numbers
- deeper photo/document workflows if real-shop testing shows gaps

## v0.5.x: Commercial Release Preparation

This series prepares FretTrack for paid production use.

- subscription licensing
- Stripe integration
- billing automation around trial management
- multi-tenant billing
- production deployment
- backups
- monitoring

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
