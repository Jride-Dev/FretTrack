# Roadmap

FretTrack is currently in the `v0.2.x beta` product-hardening series.

This roadmap uses product milestone versions rather than the older numbered-beta planning labels. Version bumps should be intentional: if a task does not explicitly ask for a version bump, ask first before changing package/app/docs version numbers.

## Version Meaning

| Version | Meaning |
| --- | --- |
| `v0.2.61 beta` | Customers complete |
| `v0.2.62 beta` | Inventory complete |
| `v0.2.63 beta` | Scheduling complete |
| `v0.3.0 beta` | Operational Shop Release |

## Current Product State

Already landed or in the current branch:

- beta access approval gate
- operator dashboard
- billing and subscription foundation without Stripe
- customer and subcontractor management module
- customer and subcontractor balance/history foundation
- work-order and invoice email flow
- mobile and PWA readiness
- offline draft queue foundation for new work orders
- image optimization before upload
- job-level parts and services editing
- inventory parts foundation with stock counts, movements, low-stock visibility, and job attachment

Current weak spots:

- Customer Damage Report print rendering still needs a proper isolated rebuild
- offline continuity only supports new-job drafts, not existing job edits
- SMS remains disabled
- scheduling/calendar workflow is not built yet
- staff permissions are still broad-role based, not granular
- public invoice and work-order links are planned but not implemented
- inventory still needs deeper receiving, low-stock management, barcode labels, and purchase history after the first parts foundation

## v0.2.63 Beta: Scheduling / Calendar

Scheduling should be a practical shop calendar, not a full external-calendar replacement.

- job due dates
- intake appointments
- pickup appointments
- follow-up reminders
- daily and weekly schedule visibility
- shop-scoped `schedule_events`
- job/customer-linked schedule events
- week view with type/status filters
- Job Detail scheduling section
- internal-only scheduling in the first pass, with no customer-facing appointment confirmations yet

## v0.3.x Beta Series: Commerce Foundation

This series turns the operational workflow into a more complete shop commerce flow while staying focused on repair-shop needs.

- estimates
- invoices
- payments
- taxes
- transaction numbering
- sales history

## v0.4.x Beta Series: Operations

This series deepens the back-office and repeat-workflow tools after the core shop release is stable.

- customer import
- reporting
- inventory receiving workflow
- low stock management
- barcode labels
- purchase history

## v0.5.x Beta Series: Commercial Release Preparation

This series prepares FretTrack for paid production use.

- subscription licensing
- Stripe integration
- trial management
- multi-tenant billing
- production deployment
- backups
- monitoring

## Ongoing Product Direction

- keep the core repair workflow generous and fast
- continue real-shop beta testing against daily intake, photos, payments, print, inventory, scheduling, and messaging
- keep email active as the primary outbound communication path while SMS is still disabled
- preserve theme-independent readability for print and export views
- improve repeat-customer and subcontractor workflows as usage patterns become clearer
- keep odd or unusual instrument support flexible through free-typed values where structured lists are not enough

## Explicitly Not Future Work Anymore

These are already shipped or have a first foundation in place and should not be described as future-only roadmap items:

- PWA install support
- mobile and tablet responsive improvements
- camera-first photo workflow
- offline local draft queue for new work orders
- customer and subcontractor standalone management
- work-order and invoice email sending
- inventory parts foundation
