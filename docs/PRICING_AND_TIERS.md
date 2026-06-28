# FretTrack Pricing and Tiers

## Philosophy

FretTrack is operational workflow software for guitar repair shops. It is meant to help a shop move cleanly from intake to repair notes, photos, parts, services, payment, reporting, and pickup without forcing repair techs into generic business software that was not built for the bench.

FretTrack is not QuickBooks. It should support lightweight accounting, payments, balances, tax/VAT tracking, and exports, but it should not try to become a full accounting system.

FretTrack is also not enterprise CRM bloat. The product should stay practical, fast, and understandable for small repair shops.

The core repair workflow should remain generous. Pricing should mostly gate infrastructure cost and operational scale, not the basic ability to run a repair shop. A paying shop should not feel punished for creating jobs, serving customers, printing paperwork, or accessing its own records.

## Current Beta Status

FretTrack is in a controlled beta rollout.

During beta, beta access approval and premium trial access are separate systems. Beta approval controls whether a tester can enter the product. Premium trial state controls premium feature access for an approved shop.

Operators can currently manage Shop and Pro trials manually:

- Start a 7-day, 14-day, or 30-day Shop or Pro trial.
- Extend an active Shop or Pro trial by 7, 14, or 30 days.
- End a trial and mark the lifecycle expired without deleting shop data or staff memberships.

When an unpaid trial expires, login and safe viewing remain available, but writes, uploads, customer messages, member management, and premium features are blocked until access is restored. Explicit administrative read-only/canceled states remain available when intentionally configured.

Billing during beta can still be handled manually while real subscription automation is planned and tested.

Stripe and automated subscription management are planned later. The current goal is to validate the product, pricing assumptions, storage behavior, reporting needs, and real shop workflows before locking in automated billing.

Beta tester feedback should directly shape pricing, included features, limits, and the order of future modules.

The 0.2.9-B0 plan-status UI foundation adds plan-aware branding and display only. FretTrack can now show Trial / Shop / Pro / Expired labels, Pro emblem branding for Pro-enabled shops, trial and renewal countdowns, and a Shop Settings Plan / Subscription panel. Pro and Trial Pro accounts must use the Pro emblem and Pro labels as their primary identity; they must not display the regular Shop identity except in comparison copy. Stripe Checkout, Customer Portal, webhooks, automated renewals, payment collection, and customer self-service billing remain future work.

The 0.2.9-C Customer CSV Import MVP adds owner/admin customer-list import for paid-beta onboarding. It supports CSV customer records with template download, column mapping, preview validation, duplicate warnings, skipped/error row export, and `import_source=csv` / `import_batch_id` metadata. Tech and viewer roles cannot import. XLSX import, vendor import, inventory/parts import, rollback history, and automated billing remain future work.

## Current Trial / Shop / Pro Split

Phase 1 defines the product boundary without adding pricing, plan caps, Stripe, billing webhooks, payment forms, SMS limits, storage enforcement, or multi-shop restrictions.

### Trial

Trial is a lifecycle state, not a permanent public plan. An active unpaid trial is assigned either Shop or Pro entitlements by an operator:

- Active Shop trial: core workflow, Photo Editor, and Team Members are writable.
- Active Pro trial: everything in Shop plus Advanced Reporting.
- Expired trial: data and memberships are preserved, login/view access remains where safe, and writes are blocked until access is restored.

Core workflow includes:

- customers
- jobs and status workflow
- photos, gallery, and customer-report toggles
- Damage Map and neck inspection
- job parts and services
- work logs
- basic events
- inventory purchasing basics
- scheduling
- job sheets and customer reports
- totals, tax/VAT, and manual payments
- manual customer email/document sending while writable
- mobile/PWA access

Internal compatibility values `free`, `solo`, and `enterprise` may still appear in the database during migration. Existing `free + active` beta shops are preserved for now and should be converted manually later; FretTrack should not market that state as a permanent public plan.

### Shop

Shop is the normal paid operating plan for repair shops. Phase 1 currently unlocks:

- core workflow
- customers
- jobs
- photos
- work logs
- inventory purchasing basics
- scheduling
- Photo Editor
- Team Members

Shop subscriptions and Shop trials use the original FretTrack emblem with labels such as `Trial: Shop`, `Shop Monthly`, or `Shop Yearly`. When a period-end timestamp is available later from Stripe sync, the UI can show renewal or access-ending countdowns without assuming a fixed month length.

Team Members is backend-enforced. Existing staff memberships are preserved when trial access expires, but non-owner staff access and member changes are inactive until Shop or Pro access is restored.

### Pro

Pro is the advanced reporting and automation tier. Phase 1 currently unlocks:

- Advanced Reporting

Pro subscriptions and Pro trials use the FretTrack Pro emblem and labels such as `Trial: Pro`, `Pro Monthly`, `Pro Yearly`, or `Pro, canceling`. Trial Pro access keeps Advanced Reporting unlocked through the existing entitlement snapshot; non-Pro shops continue to see the Pro locked state.

The current Pro reporting dashboard includes operational tables for shop overview counts, jobs by status, priority, overdue promise dates, ready-for-pickup work, waiting-on-parts work, job aging, recent work-log activity, low-stock inventory by desired stock level, open purchase orders, landed-cost purchase history, and upcoming schedule workload. These reports use existing shop data and do not add Stripe, billing automation, charts, PDF generation, or export workflows yet.

Future Pro candidates are documented only and are not implemented in this phase:

- CSV export boundary
- custom branding
- inventory alerts and forecasting
- scheduling reminders
- message templates
- automated email
- SMS messaging
- larger photo storage

### Business

Business is deferred. It is not part of the current app behavior.

The database still accepts the previously seeded `enterprise` plan identifier for compatibility with earlier premium-foundation work. That is not a new Business tier in this phase, and no pricing, billing, or self-service upgrade path is attached to it.

Future Business candidates:

- multi-shop support
- cross-shop reporting
- inventory transfer between shops
- location-level permissions
- higher staff limits

## Older Planning Notes

### Beta

Beta access is free controlled access for selected shops and testers.

Expected access states:

- `beta_bypass`
- `trialing`
- `active`
- `expired`
- `read_only`
- `canceled`

Beta testers should be expected to provide practical feedback on intake, job tracking, photo upload, job sheets, payments, reports, and day-to-day shop fit.

Beta should not be treated as a permanent unpaid production plan. It exists to improve the software and prove the workflow before paid launch.

### Solo Shop

Older planning used a Solo Shop tier. The active Phase 1 product model is now Trial, Shop, Pro, and deferred Business; keep this section as historical pricing research until pricing is finalized.

Included:

- Unlimited jobs and customers
- Job photos with a future storage policy
- Parts and services
- Measurements and setup details
- Print sheets
- Reports and basic accounting
- CSV export
- Email messaging
- Shop branding and logo
- Tax/VAT support
- Mobile and tablet access
- Backups and data export rights
- 1-2 users

Suggested limits:

- 5 GB storage
- No SMS or limited SMS
- No advanced inventory

Solo Shop should cover the needs of an independent repair tech or very small shop without making the basic workflow feel cramped.

### Shop Pro

Older pricing research treated Shop Pro as a higher-capacity paid tier. Current Phase 1 behavior defines Shop and Pro by feature entitlements, not price, storage cap, SMS allowance, or billing automation.

Included:

- 5 users included
- Larger storage allowance
- Advanced reporting
- Advanced employee permissions and staff roles
- SMS allowance
- Priority support
- Future advanced inventory automation
- Future advanced accounting access

Shop Pro should fit busier shops with multiple staff, heavier photo usage, higher message volume, and stronger reporting needs.

Advanced staff management is intended primarily for larger or multi-user paid shops. The current system now centralizes baseline role checks for operator, owner, admin, tech, and viewer behavior. Future work should expand this into owner/admin-managed granular permissions from an Admin or Staff Management page.

Planned capabilities include:

- Invite/remove employees
- Assign roles
- Granular permissions
- Restrict sensitive financial/accounting areas
- Restrict inventory, admin, and settings access
- Technician-only workflow access
- Reporting visibility controls
- Future audit visibility per employee

Potential roles:

- Owner
- Admin
- Technician
- Front Desk / Intake
- Accounting / Reports
- Read-only

Possible permissions:

- Create/edit jobs
- Delete jobs
- Manage customers
- Upload/delete images
- Edit or overwrite images
- Select photos for customer-facing reports
- Manage pricing
- Manage shop settings
- Manage billing/subscription
- Access accounting exports
- Manage employees
- Manage advanced inventory permissions later

Solo/basic tiers may continue using simplified role handling, while larger shops unlock advanced staff management.

## Planned Add-Ons

Possible add-ons:

- Additional storage
- SMS packs
- Additional users
- Advanced inventory operations
- Advanced accounting and reporting
- API and integrations
- Advanced branding or white-labeling later

Add-ons should be used for real cost or complexity, not to nickel-and-dime the normal repair workflow.

## Features Intentionally Not Gated

For paying shops, these should remain accessible:

- Creating jobs
- Customer records
- Basic photos
- Printing
- Exporting own data
- Core repair workflow

Read-only or canceled states may need restrictions, but active paying shops should not hit artificial walls while doing normal repair work.

## Storage Strategy

Storage cost should be managed carefully without making repair documentation worse.

Current strategy:

- Optimize images before upload
- Resize repair photos client-side
- Convert repair photos to optimized JPEG by default
- Strip most metadata through canvas-based processing
- Store optimized files instead of giant phone-camera originals
- Track useful image metadata where available
- Track storage by plan without enforcing hard quotas until pricing and limits are finalized

Future options:

- Higher-resolution archival originals for higher tiers
- Optional original upload/archive feature for Pro shops
- Additional paid storage blocks

The default should preserve repair usefulness. Photos still need to show cracks, dents, finish checks, fret wear, serial numbers, wiring cavities, bridge details, nut details, and other repair evidence.

## Messaging Cost Philosophy

Email is relatively inexpensive and should be included generously enough for normal shop communication.

SMS is infrastructure-cost sensitive. It will likely need to be metered, capped, or sold as an add-on because message volume can create real operating cost.

SMS pricing should be clear and boring. Shops should understand what is included and what happens when they go over.

## Future Billing Architecture

The intended billing architecture should stay server-side and entitlement-driven.

High-level pieces:

- Plans
- Subscriptions
- Entitlements
- Usage tracking
- Trial and grace states
- Stripe customer IDs later
- Stripe subscription IDs later
- Server-side enforcement for authoritative access decisions

The frontend can display billing state and react to entitlement snapshots, but it should not be the source of truth for access, plan, subscription, or bypass status.

## Guiding Principle

FretTrack should feel like software built by actual repair techs for real repair shops, not aggressive enterprise subscription software.
