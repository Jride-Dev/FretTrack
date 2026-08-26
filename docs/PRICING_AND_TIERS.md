# FretTrack Pricing and Tiers

## Philosophy

FretTrack is operational workflow software for guitar repair shops. It is meant to help a shop move cleanly from intake to repair notes, photos, parts, services, payment, reporting, and pickup without forcing repair techs into generic business software that was not built for the bench.

FretTrack is not QuickBooks. It should support lightweight accounting, payments, balances, tax/VAT tracking, and exports, but it should not try to become a full accounting system.

FretTrack is also not enterprise CRM bloat. The product should stay practical, fast, and understandable for small repair shops.

The core repair workflow should remain generous. Pricing should mostly gate infrastructure cost and operational scale, not the basic ability to run a repair shop. A paying shop should not feel punished for creating jobs, serving customers, printing paperwork, or accessing its own records.

FretTrack is a business-use software service operated by Jeffrey Russell d/b/a Torrance Guitar Repair.

## Approved Launch Pricing and Commercial Policy

| Plan | Monthly | Yearly | Annual savings |
| --- | ---: | ---: | ---: |
| Shop | $29.99 | $299.99 | $59.89 |
| Pro | $39.99 | $399.99 | $79.89 |

Prices are in United States dollars. Applicable taxes, if any, are determined from billing details and shown at Stripe Checkout.

The standard evaluation is a 14-day Pro trial. It requires no card and does not automatically convert. A paid period begins only after an authorized shop owner/admin completes Checkout. Operator-granted extensions remain available for controlled beta support.

Subscriptions renew for their selected interval until canceled. Cancellation is available through the Stripe Billing Portal, has no cancellation fee, and takes effect at the end of the current paid period. Annual subscribers should receive a renewal notice approximately 30 days before renewal.

The first annual subscription purchase has a 14-calendar-day full-refund window. Monthly payments, annual renewals, partial periods, and unused time are otherwise non-refundable except for duplicate charges, confirmed billing errors, or when required by law.

## Current Beta Status

FretTrack is in a controlled beta rollout.

During beta, beta access approval and premium trial access are separate systems. Beta approval controls whether a tester can enter the product. Premium trial state controls premium feature access for an approved shop.

The standard onboarding path creates a 14-day Pro trial. Operators can additionally manage controlled trial exceptions:

- Start a 7-day, 14-day, or 30-day Shop or Pro trial.
- Extend an active Shop or Pro trial by 7, 14, or 30 days.
- End a trial and mark the lifecycle expired without deleting shop data or staff memberships.

When an unpaid trial expires, login and safe viewing remain available, but writes, uploads, customer messages, member management, and premium features are blocked until access is restored. Explicit administrative read-only/canceled states remain available when intentionally configured.

Stripe Checkout, signed billing webhooks, and the Stripe Billing Portal implement paid enrollment, lifecycle synchronization, payment recovery, plan changes, invoices, and period-end cancellation. A server-authoritative launch switch can limit new Checkout sessions to approved pilot shops while existing subscribers retain portal access.

Beta tester feedback should directly shape pricing, included features, limits, and the order of future modules.

The plan-status UI shows Trial / Shop / Pro / Expired labels, Pro emblem branding for Pro-enabled shops, trial and renewal countdowns, and Shop Settings and Billing status. Pro and Trial Pro accounts use the Pro emblem and Pro labels as their primary identity; they do not display the regular Shop identity except in comparison copy.

The `0.2.9-beta.3` usage-cap foundation server-enforces 1,000 email recipients, 2,000 source-photo uploads, and 5 GiB repair-photo storage for Shop; Pro receives 5,000 recipients, 10,000 uploads, and 25 GiB. Shop and Pro trials inherit the selected tier. See [Email and Photo Usage Caps](EMAIL_AND_PHOTO_USAGE_CAPS.md). No paid overages exist at launch.

The 0.2.9-F customer import work is parser/template foundation only. It prepares CSV mapping, preview validation, duplicate warnings, and skipped/error CSV output, but does not expose an import UI or write customer records yet. Owner/Admin import UI, write-enabled import, XLSX support, vendor import, and inventory import remain later work.

## Current Trial / Shop / Pro Split

The launch boundary includes the approved prices, Stripe Checkout, Billing Portal, signed webhook lifecycle, email-recipient limits, and repair-photo limits. SMS and multi-shop subscriptions remain outside the launch scope.

### Trial

Trial is a lifecycle state, not a permanent public plan. New approved shops receive the standard 14-day Pro trial; operators may grant Shop/Pro trial exceptions:

- Active Shop trial: paid core workflow is writable.
- Active Pro trial: everything in Shop plus Photo Editor, Team Members, and Advanced Reporting.
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

Shop subscriptions and Shop trials use the original FretTrack emblem with labels such as `Trial: Shop`, `Shop Monthly`, or `Shop Yearly`. Stripe synchronization supplies authoritative period timestamps for renewal or access-ending countdowns without assuming a fixed month length.

Shop is currently single-user in the entitlement snapshot. Existing staff memberships are preserved when trial access expires, but non-owner staff access and member changes remain inactive until Pro access is restored.

### Pro

Pro is the advanced reporting and automation tier. Phase 1 currently unlocks:

- Photo Editor
- Team Members
- Advanced Reporting
- Team Assignment and workload visibility
- Amplifier Repair
- Keyboard Repair
- Scheduled Email for transactional job messages up to 30 days ahead
- Automated Service Reminders with separate customer consent, shop-configurable timing/template, and nightly long-horizon delivery
- Loyalty Program with qualifying-work-order stamps and staff-recorded reward redemption

Pro subscriptions and Pro trials use the FretTrack Pro emblem and labels such as `Trial: Pro`, `Pro Monthly`, `Pro Yearly`, or `Pro, canceling`. Trial Pro access keeps Advanced Reporting unlocked through the existing entitlement snapshot; non-Pro shops continue to see the Pro locked state.

Team Members is backend-enforced. Existing staff memberships are preserved when trial access expires, but non-owner staff access and member changes are inactive until Pro access is restored.

The `0.2.9-beta.2` Team Assignment Foundation adds an independent `team_assignment` entitlement for advanced multi-user workflow. It does not change existing `team_members` rows or membership access rules. Pro and active beta/trial paths can assign active same-shop members, filter Current Jobs by assignee, and view active/unassigned/overdue workload counts. Shop/non-Pro states keep historical assignments readable but do not expose assignment writes or workload controls. These counts are workload coordination only, not employee performance scoring.

The current Pro reporting dashboard includes operational tables for shop overview counts, jobs by status, priority, overdue promise dates, ready-for-pickup work, waiting-on-parts work, job aging, recent work-log activity, low-stock inventory by desired stock level, open purchase orders, landed-cost purchase history, and upcoming schedule workload. These reports use existing shop data and do not add Stripe, billing automation, charts, PDF generation, or export workflows yet.

The 0.2.9-D Reports hardening pass adds Pro report browser printing, per-section CSV exports, a summary CSV export, simple job-status/date filters, 25-row previews, 250-row show-all safety, 1,000-row export caps, and section-level error containment. Browser print / Save as PDF is the current printable output path; direct PDF generation and server-side report aggregation remain future work.

The Pro Scheduled Email foundation schedules already-composed transactional job emails through Resend for delivery up to 30 days ahead. It snapshots the recipient and message, requires transactional email opt-in, supports provider cancellation before delivery, and continues to count recipients against the existing monthly email cap.

Automated Service Reminders are a separate Pro/Enterprise workflow for long-horizon follow-up after a completed recurring service. They use an independent customer opt-in, a shop-configurable month interval and template, a durable Supabase queue, and one nightly dispatcher rather than stretching Resend scheduling beyond 30 days. Reminder recipients use the same monthly email quota and Message History foundation. The initial release is one rule per shop, not a general marketing-campaign system.

The Pro/Enterprise Loyalty Program is a stamp and redemption ledger tied to linked, fully paid, completed work orders. It does not automatically discount invoices, create store credit, or take payment. Staff deliberately apply any promised service or discount through the existing work-order billing controls after recording a redemption.

Future Pro candidates are documented only and are not implemented in this phase:

- CSV export boundary
- custom branding
- inventory alerts and forecasting
- scheduling reminders
- message templates
- multi-rule marketing campaigns and broader recurring-email automation beyond the shipped service-reminder workflow
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

Older planning used a Solo Shop tier. The active product model is now Trial, Shop, Pro, and deferred Business; the remainder of this section is historical pricing research and does not override the approved launch pricing above.

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
- Historical research allowed 1-2 users; the current Shop entitlement is single-user, and Team Members is Pro-only.

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
