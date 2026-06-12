# FretTrack Pricing and Tiers

## Philosophy

FretTrack is operational workflow software for guitar repair shops. It is meant to help a shop move cleanly from intake to repair notes, photos, parts, services, payment, reporting, and pickup without forcing repair techs into generic business software that was not built for the bench.

FretTrack is not QuickBooks. It should support lightweight accounting, payments, balances, tax/VAT tracking, and exports, but it should not try to become a full accounting system.

FretTrack is also not enterprise CRM bloat. The product should stay practical, fast, and understandable for small repair shops.

The core repair workflow should remain generous. Pricing should mostly gate infrastructure cost and operational scale, not the basic ability to run a repair shop. A paying shop should not feel punished for creating jobs, serving customers, printing paperwork, or accessing its own records.

## Current Beta Status

FretTrack is in a controlled beta rollout.

During beta, beta access approval and premium trial access are separate systems. Beta approval controls whether a tester can enter the product. Premium trial state controls premium feature access for an approved shop.

Operators can currently manage Pro premium trials manually:

- Start a 7-day, 14-day, or 30-day Pro trial.
- Extend an active Pro trial by 7, 14, or 30 days.
- End a premium trial and return the shop to Free-tier entitlements.

Free-tier core workflow remains operational after a premium trial expires. Premium features lock, and explicit administrative read-only/canceled states remain available when intentionally configured.

Billing during beta can still be handled manually while real subscription automation is planned and tested.

Stripe and automated subscription management are planned later. The current goal is to validate the product, pricing assumptions, storage behavior, reporting needs, and real shop workflows before locking in automated billing.

Beta tester feedback should directly shape pricing, included features, limits, and the order of future modules.

## Current Free vs Pro Split

Phase 1 defines the product boundary without adding pricing, plan caps, Stripe, billing webhooks, payment forms, SMS limits, storage enforcement, or multi-shop restrictions.

### Free

Free is a permanent usable solo-shop tier. It keeps an owner-led shop writable for the core workflow:

- one owner account
- customers
- jobs and status workflow
- Damage Map and neck inspection
- job parts and services
- work logs
- basic events
- basic inventory
- basic scheduling
- photo uploads, gallery, and customer-report toggles
- job sheets and customer reports
- totals, tax/VAT, and manual payments
- manual customer email/document sending
- mobile/PWA access

Free remains operational after a premium trial expires or is ended. Premium trial expiry must not make the core shop workflow read-only.

### Pro

Pro is the working-shop plan. Phase 1 currently unlocks:

- Photo Editor
- Advanced Reporting
- Team Members

Team Members is backend-enforced. Existing staff memberships are preserved on downgrade, but non-owner staff access is inactive while the shop is on Free. Restoring Pro restores those preserved memberships without deleting customer-owned data.

Future Pro candidates are documented only and are not implemented in this phase:

- CSV export boundary
- custom branding
- inventory alerts
- scheduling reminders
- message templates
- automated email
- SMS messaging
- larger photo storage

### Business

Business is deferred. It is not part of the current app behavior.

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

Beta should not be treated as a permanent free production tier. It exists to improve the software and prove the workflow before paid launch.

### Solo Shop

Older planning used a Solo Shop tier. The active Phase 1 product model is now Free, Pro, and deferred Business; keep this section as historical pricing research until pricing is finalized.

Included:

- Unlimited jobs and customers
- Job photos with a storage cap
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

Older pricing research treated Shop Pro as a higher-capacity paid tier. Current Phase 1 behavior defines Pro by feature entitlements, not price, storage cap, SMS allowance, or billing automation.

Included:

- 5 users included
- Larger storage allowance
- Advanced reporting
- Advanced employee permissions and staff roles
- SMS allowance
- Priority support
- Future inventory access
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
- Manage inventory later

Solo/basic tiers may continue using simplified role handling, while larger shops unlock advanced staff management.

## Planned Add-Ons

Possible add-ons:

- Additional storage
- SMS packs
- Additional users
- Inventory module
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
- Enforce storage quotas by plan

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
