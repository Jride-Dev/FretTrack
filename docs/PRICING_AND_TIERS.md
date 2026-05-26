# FretTrack Pricing and Tiers

## Philosophy

FretTrack is operational workflow software for guitar repair shops. It is meant to help a shop move cleanly from intake to repair notes, photos, parts, services, payment, reporting, and pickup without forcing repair techs into generic business software that was not built for the bench.

FretTrack is not QuickBooks. It should support lightweight accounting, payments, balances, tax/VAT tracking, and exports, but it should not try to become a full accounting system.

FretTrack is also not enterprise CRM bloat. The product should stay practical, fast, and understandable for small repair shops.

The core repair workflow should remain generous. Pricing should mostly gate infrastructure cost and operational scale, not the basic ability to run a repair shop. A paying shop should not feel punished for creating jobs, serving customers, printing paperwork, or accessing its own records.

## Current Beta Status

FretTrack is in a controlled beta rollout.

During beta, access can be managed manually through trial or beta bypass states. Billing during beta can also be handled manually while real subscription automation is planned and tested.

Stripe and automated subscription management are planned later. The current goal is to validate the product, pricing assumptions, storage behavior, reporting needs, and real shop workflows before locking in automated billing.

Beta tester feedback should directly shape pricing, included features, limits, and the order of future modules.

## Planned Initial Tiers

### Beta

Beta access is free controlled access for selected shops and testers.

Expected access states:

- `beta_bypass`
- `trialing`

Beta testers should be expected to provide practical feedback on intake, job tracking, photo upload, job sheets, payments, reports, and day-to-day shop fit.

Beta should not be treated as a permanent free production tier. It exists to improve the software and prove the workflow before paid launch.

### Solo Shop

Suggested target price: around `$20-30/month`.

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

Suggested target price: around `$50-75/month`.

Included:

- 5 users included
- Larger storage allowance
- Advanced reporting
- SMS allowance
- Priority support
- Future inventory access
- Future advanced accounting access

Shop Pro should fit busier shops with multiple staff, heavier photo usage, higher message volume, and stronger reporting needs.

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
