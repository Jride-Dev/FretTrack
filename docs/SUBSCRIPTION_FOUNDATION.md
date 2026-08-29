# Subscription Foundation

Current release: **FretTrack 0.3.0**

FretTrack uses database-owned subscription state and entitlements. Stripe is the payment and billing provider; the browser is never authoritative for plan access.

## Access, trial, and paid state

Account approval controls whether a new user may enter FretTrack. Subscription lifecycle controls whether an approved shop may write data and which features it may use. These are separate systems.

New approved workspaces receive a non-converting 14-day Pro trial with no card required. Owners and admins may start a paid Shop or Pro subscription through Stripe Checkout. Only signature-verified Stripe events update the saved subscription state.

The supported customer-facing plan names are Shop and Pro. Trial is a lifecycle, not a third feature tier. Internal values including `free`, `solo`, `enterprise`, and `beta_bypass` remain only where compatibility with older records or migrations requires them.

## Authoritative data

The foundation is built around:

- `plans`
- `plan_entitlements`
- `shop_subscriptions`
- `shop_entitlement_overrides`
- `shop_usage_snapshots`
- `stripe_webhook_events`

`shop_subscriptions` is the current source for lifecycle, plan, recurring interval, Stripe customer/subscription identity, trial dates, and paid-period boundaries. The app reads an effective entitlement snapshot generated from current plan data and explicit operator overrides.

## Lifecycle behavior

- `trialing` and `active` permit normal work according to the effective plan.
- `grace` preserves normal access temporarily while showing the billing warning.
- `read_only`, expired unpaid trial, and terminal cancellation preserve records while blocking protected writes.
- Period-end cancellation retains paid access through the recorded current-period end.
- Failed and recovered payment events update lifecycle only through the signed webhook path.
- Opening, abandoning, canceling, or failing Checkout does not change the saved plan.

Entitlement and lifecycle enforcement exists in the database and Edge Functions as well as the app. A hidden button or client feature flag is never treated as authorization.

## Plan boundaries

Shop contains the complete core repair workflow and is single-user. Pro adds Team Members, team assignment, Photo Editor, Advanced Reporting, Amplifier Repair, Keyboard Repair, Scheduled Email, Automated Service Reminders, Loyalty Program, and higher usage limits.

Current prices, annual savings, limits, and customer-facing boundaries are documented in [Pricing and Tiers](PRICING_AND_TIERS.md).

## Stripe integration

- `create-checkout-session` creates authenticated Shop/Pro monthly or annual subscription Checkout sessions for eligible owners/admins.
- `create-billing-portal-session` opens Stripe Billing Portal for an existing Stripe customer.
- `stripe-webhook` verifies the raw-body Stripe signature, atomically claims an event, synchronizes ordered subscription state, records the outcome, and safely supports retry after a failed or expired processing lease.
- Price mapping uses the four configured Stripe Price IDs rather than product names or browser values.
- The launch switch defaults closed unless hosted configuration explicitly enables billing for the requested shop.

The annual sandbox validator covers Checkout, signed lifecycle events, Billing Portal, Shop-to-Pro change, period-end cancellation, final cancellation, payment failure/recovery, duplicate delivery, older-event rejection, and cleanup.

## Usage enforcement

Shop receives 1,000 email recipients per UTC month, 2,000 source-photo uploads per UTC month, and 5 GiB of current repair-photo storage. Pro receives 5,000 recipients, 10,000 uploads, and 25 GiB. No paid overages are offered in 0.3.0.

Reservation/release, deletion, downgrade, storage accounting, and operator override behavior are documented in [Email and Photo Usage Caps](EMAIL_AND_PHOTO_USAGE_CAPS.md).

## Operational checks

Before a billing release or hosted configuration change:

1. Confirm repository and hosted migration history match.
2. Confirm Checkout, Portal, webhook, and launch-status functions are deployed from the reviewed commit.
3. Confirm all four Price IDs, API key, signing secret, app URL, and launch flags belong to the intended Stripe account and environment without printing secret values.
4. Run `npm run test:stripe-sandbox` in the isolated Stripe sandbox.
5. Verify owner/admin access and tech/viewer denial.
6. Verify trialing, active, grace, expired, read-only, and canceled UI behavior.
7. Verify duplicate and failed webhook retries leave one trustworthy ledger result.

Deployment state and live identifiers are maintained in [Deployment Notes](DEPLOYMENT_NOTES.md).
