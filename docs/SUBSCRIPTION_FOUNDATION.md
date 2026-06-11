# Subscription Foundation

Date: 2026-05-25

This sprint added paid-readiness infrastructure only. Stripe, Checkout, webhooks, real payments, and billing portal actions are intentionally not implemented yet.

## Current Premium Trial Rule

Beta access approval and premium trial entitlement are separate systems.

- Beta access controls whether a user may enter the beta application workspace.
- Premium trial state controls premium feature availability for an approved shop.
- Free-tier shops remain writable after a premium trial expires.
- Expired premium trials fall back to Free-tier entitlements instead of making the shop read-only.
- Expired premium trials ignore feature overrides until the premium lifecycle is started, extended, or otherwise restored by an operator.
- Explicit administrative `read_only` or cancellation states can still pause core write operations.
- Stripe, billing webhooks, and payment collection are still not connected.

## Implemented

### Database

Migration:

- `supabase/migrations/20260525233647_paid_tier_foundation.sql`

New tables:

- `plans`
- `plan_entitlements`
- `shop_subscriptions`
- `shop_entitlement_overrides`
- `shop_usage_snapshots`

Seeded plans:

- `free`
- `trial`
- `solo`
- `pro`
- `enterprise`

Seeded entitlement keys:

- `core_jobs`
- `customers`
- `photos`
- `reports`
- `csv_export`
- `email_messages`
- `sms_messages`
- `inventory`
- `advanced_accounting`
- `advanced_branding`
- `api_access`
- `max_users`
- `max_storage_bytes`
- `monthly_email_limit`
- `monthly_sms_limit`

Supported subscription states:

- `trialing`
- `active`
- `grace`
- `read_only`
- `canceled`
- `beta_bypass`

Premium trial management now adds operator-only RPCs in `20260611120000_premium_trial_management_phase_1.sql`:

- `public.set_shop_premium_trial(target_shop_id text, trial_days integer, trial_tier text default 'pro')`
- `public.extend_shop_premium_trial(target_shop_id text, extend_days integer)`
- `public.end_shop_premium_trial(target_shop_id text)`

The start/extend durations are limited to 7, 14, or 30 days. Premium trial start and extension are currently limited to the `pro` tier. These RPCs update authoritative `shop_subscriptions` rows and mirror tier/status/trial end into `shop_profiles`.

RLS is enabled on all new tables. Authenticated owners/admins can read billing tables for their own shops. Normal authenticated users cannot update plan, subscription, Stripe ID, entitlement override, or authoritative usage state.

New database helpers:

- `public.get_shop_entitlement_snapshot(target_shop_id text)`
- `public.create_trial_subscription_for_shop_profile()`

The snapshot helper is a `security definer` function that checks shop membership before returning a shop-scoped access object. New `shop_profiles` inserts automatically receive a `trialing` subscription row through the trigger.

### App Services

Added:

- `src/modules/billing/entitlementService.js`

This centralizes entitlement state, billing status labels, writable/read-only checks, feature labels, and storage formatting. Local/non-Supabase mode receives a permissive development fallback.

### UI

Added:

- `src/modules/billing/BillingPage.jsx`

The Billing page is owner/admin only and shows:

- Current plan
- Effective/stored status
- Trial end date
- Grace end date
- Billing email
- User count
- Storage usage
- Job count
- Enabled features
- Upgrade/contact support placeholder

The app shell now fetches an entitlement snapshot when shop access loads and shows a banner for `grace`, `read_only`, and `canceled` states. Premium trial expiry alone should not trigger the read-only banner.

### Gating

High-cost writes now check the central entitlement/access snapshot:

- Photo uploads
- Customer email sends
- Customer SMS sends
- General write access when the shop is read-only/canceled

The following remain available:

- Viewing existing jobs and customers
- Basic job sheet/customer report printing
- Job JSON export
- Accounting screen access and basic export while the shop data is visible

Member invite gating is not wired because member management UI does not exist yet.

## Not Implemented Yet

- Stripe Checkout
- Stripe Customer Portal
- Stripe webhooks
- Real payment collection
- Automated subscription updates from a provider
- Scheduled usage snapshots
- Member invite/manage UI
- Storage quota hard block by exact byte count
- Advanced export/report tier separation
- Operator admin billing dashboard

## Smoke Checklist

After applying the migration:

1. Sign in as an existing shop owner/admin.
2. Confirm the app loads the shop normally.
3. Open `Billing`.
4. Confirm plan/status/usage/features render without errors.
5. Confirm `trialing`, `active`, `grace`, and `beta_bypass` shops can create jobs and upload photos.
6. Start a 7-day, 14-day, or 30-day Pro trial from the operator dashboard and confirm the shop receives Pro premium features.
7. End the premium trial from the operator dashboard and confirm the shop falls back to Free-tier entitlements while jobs, customers, inventory, scheduling, photos, printing, and email documents remain writable for write-role users.
8. Set a test shop subscription to `grace`; reload and confirm the warning banner appears while normal work remains available.
9. Set a test shop subscription to `read_only`; reload and confirm:
   - Existing jobs and customers are visible.
   - New jobs are disabled.
   - Save Job is disabled.
   - Photo upload is blocked.
   - Email/SMS send returns a billing/read-only message.
   - Print/export actions remain available from an existing job.
10. Set a test shop subscription to `canceled`; confirm it behaves like read-only.
11. Create a brand-new shop profile; confirm a `shop_subscriptions` row is created automatically with `trialing`.
12. Confirm non-owner/non-admin users do not see the Billing nav item.

## Next Steps

1. Add member management and enforce `max_users` before inserts.
2. Add trusted storage usage reconciliation and quota warnings.
3. Add Edge Function entitlement checks for email/SMS so provider-cost actions are server-gated too.
4. Keep operator tools for trial/status support separate from future customer self-service billing.
5. Add data export and account deletion/cancellation policy screens.
6. Integrate Stripe only after the entitlement/trial/read-only behavior is stable.
