# FretTrack Pricing and Tiers

Current release: **FretTrack 0.3.0**

FretTrack is operational workflow software for instrument repair shops. It handles intake, bench work, condition records, customer communication, parts, payments, scheduling, and shop records without presenting itself as full accounting, tax, payroll, or legal software.

## Approved catalog

| Plan | Monthly | Annual | Annual savings |
| --- | ---: | ---: | ---: |
| Shop | $29.99 | $299.99 | $59.89 compared with 12 monthly payments |
| Pro | $39.99 | $399.99 | $80.89 compared with 12 monthly payments |

Prices are in USD. Annual plans are billed once per year. There are no usage-based overage charges in 0.3.0.

## Trial

New approved workspaces receive a 14-day Pro trial. The trial requires no card and does not automatically convert into a paid subscription. A paid term begins only after an authorized owner or admin completes Stripe Checkout.

Operator-granted extensions may be used for legitimate support needs. Account approval and subscription entitlement are separate: approval permits a user to enter FretTrack, while the trial or paid plan controls shop features and write access.

## Shop

Shop is the core single-user operating plan. It includes:

- customer and work-order management
- guitar, amplifier, and keyboard repair workflows
- intake, inspection, bench notes, work logs, parts, services, payments, estimates, and receipts
- photos, condition documentation, damage maps, and isolated print documents
- inventory, vendors, purchasing, receiving, and job-cost links
- scheduling, status tracking, pickup, shipping/custody records, and operational reports
- email delivery and shop records within Shop usage limits
- Stripe Checkout and Billing Portal access for owners and admins

Shop limits are 1,000 email recipients per UTC month, 2,000 source-photo uploads per UTC month, and 5 GiB of current repair-photo storage.

## Pro

Pro includes everything in Shop plus:

- Team Members and technician assignment
- Advanced Reporting and report exports
- Photo Editor
- Amplifier Repair and Keyboard Repair specialist workspaces
- Scheduled Email
- Automated Service Reminders
- Loyalty Program
- higher email and photo limits

Pro limits are 5,000 email recipients per UTC month, 10,000 source-photo uploads per UTC month, and 25 GiB of current repair-photo storage.

Specialist modules are included with Pro in 0.3.0. Future packaging may offer them as separately marketable add-ons, but no separate add-on price or entitlement is active in this release.

## Billing lifecycle

Subscriptions renew on the selected monthly or annual interval until canceled. Owners and admins can use the Stripe Billing Portal to manage the subscription. Cancellation has no cancellation fee and takes effect at the end of the current paid period unless applicable law or a documented support remedy requires otherwise.

FretTrack does not silently change plans when Checkout is opened, abandoned, canceled, or fails. Subscription access changes only after signature-verified Stripe events are processed. Failed-payment and cancellation states follow the server-owned lifecycle described in [Stripe Self-Serve Billing](STRIPE_SELF_SERVE_BILLING.md).

Automatic tax is not enabled merely by selecting a Stripe tax category. Tax collection must remain disabled until the business has confirmed applicable registrations and obligations. Shops remain responsible for their own customer charges, tax setup, bookkeeping, and legal compliance.

Refund and cancellation terms are published in the current [Terms of Service](https://frettrack-app.com/terms). Customer-data handling is described in the [Privacy Policy](https://frettrack-app.com/privacy).

## Entitlement and compatibility rules

The database is authoritative for plan, lifecycle, entitlements, and usage. Hiding a control in the browser is not an authorization boundary.

Internal compatibility values such as `free`, `solo`, `enterprise`, and `beta_bypass` may remain in database history or migration logic. They are not public plans. Existing compatibility records must be migrated or handled deliberately rather than marketed as permanent free access.

When a Shop or Pro subscription loses writable access, FretTrack preserves existing records and uses the documented grace/read-only lifecycle. It does not delete shop data or silently remove historical team assignments.

## Current product boundaries

- SMS is not active in 0.3.0.
- FretTrack is not a general ledger, payment processor, tax advisor, or payroll system.
- Customer CSV import remains parser/template foundation and is not exposed as a production write workflow.
- Public invoice/customer portal links are future work and require a fresh security review.
- Full multi-shop organizations, separate specialist-module add-on billing, paid overages, and enterprise contracts are not active offers.

Implementation details are documented in [Subscription Foundation](SUBSCRIPTION_FOUNDATION.md), [Email and Photo Usage Caps](EMAIL_AND_PHOTO_USAGE_CAPS.md), and [Deployment Notes](DEPLOYMENT_NOTES.md).
