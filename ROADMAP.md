# Roadmap

FretTrack is currently at `v0.2.6-beta.14`.

This roadmap reflects the product as it exists now, not the earlier beta baseline. The goal from here is to harden the repair-shop workflow, close the most painful operational gaps, and prepare the app for a real paid launch without overbuilding too early.

## Current Product State

Already landed:

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

Current weak spots:

- Customer Damage Report print rendering still needs a proper isolated rebuild
- offline continuity only supports new-job drafts, not existing job edits
- SMS remains disabled
- inventory does not exist yet
- staff permissions are still broad-role based, not granular
- public invoice and work-order links are planned but not implemented

## Beta 15: Dedicated Print Renderer Rebuild

The next print pass should be treated as a document-rendering project, not a CSS patch cycle.

- isolate print rendering from screen UI
- rebuild Customer Damage Report output from scratch
- stop using shared interactive map layout for printable documents
- avoid more global print CSS patching
- use screenshot checkpoints before merging
- make work orders, invoices, and customer reports reliable printable documents
- keep print fixes scoped to dedicated printable components or routes

## Beta 16: Advanced Staff Permissions

FretTrack needs better multi-user operational control for growing shops.

- add advanced employee permissions
- support owner, admin, tech, front desk, accounting, and read-only style access
- hide internal cost and sensitive financial controls from non-authorized users
- improve member management and staff administration flows
- separate operational permissions from broad role labels where needed
- add employee audit visibility later once activity attribution is mature

## Beta 17: Public Invoice and Work Order Links

This should be the first premium add-on path rather than a default base-subscription feature.

- public invoice and work-order links
- website-linked invoice portal
- secure tokenized customer access
- public read-only invoice and work-order views
- later payment links and QR codes
- future customer portal expansion only after the first public-link model is stable

## Beta 18: Inventory Foundation

Inventory should be the first major post-core workflow module.

- add parts records
- add vendors and suppliers
- track stock on hand
- add reorder basics
- let jobs attach inventory parts while still allowing one-off typed parts
- preserve historical job pricing even when inventory pricing changes later
- start with practical repair-shop inventory, not full ERP complexity

## Beta 19: Offline Phase 2

Beta 14 established the first safe offline continuity layer. The next phase should extend that carefully.

- queued photo uploads
- recently-opened job cache
- conflict handling for existing job edits
- limited read-only cached job access
- better retry and recovery flow for failed draft sync
- keep offline continuity separate from backup/disaster-recovery claims

## Beta 20: Launch Hardening

Paid launch prep should stay operational and customer-trust focused.

- add storage quota warnings before hard limits feel surprising
- add billing contact, support, and cancellation copy
- add Terms, Privacy, export, and deletion policy placeholders
- tighten launch readiness around entitlements, trial state, and support expectations
- keep Stripe out until entitlement behavior is stable in real use

## Ongoing Product Direction

These are continuous product themes rather than one release target.

- keep the core repair workflow generous and fast
- continue real-shop beta testing against daily intake, photos, payments, print, and messaging
- keep email active as the primary outbound communication path while SMS is still disabled
- preserve theme-independent readability for print and export views
- improve repeat-customer and subcontractor workflows as usage patterns become clearer
- keep odd or unusual instrument support flexible through free-typed values where structured lists are not enough

## Explicitly Not Future Work Anymore

These are already shipped and should not be described as future roadmap items:

- PWA install support
- mobile and tablet responsive improvements
- camera-first photo workflow
- offline local draft queue for new work orders
- customer and subcontractor standalone management
- work-order and invoice email sending
