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
- Free vs Pro Tier Split Phase 1 now makes `photo_editor`, `advanced_reporting`, and `team_members` explicit entitlements.
- Free keeps owner-led core workflow writable. Pro unlocks Photo Editor, Advanced Reporting, and Team Members.
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
- `photo_editor`
- `reports`
- `advanced_reporting`
- `team_members`
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

Free vs Pro Tier Split Phase 1 adds migration `20260611133000_free_pro_tier_split_phase_1.sql`:

- Seeds explicit `photo_editor`, `advanced_reporting`, and `team_members` entitlements.
- Adds `private.shop_has_entitlement(target_shop_id, entitlement_key)`.
- Adds `public.get_current_user_shop_memberships()` so the app can show preserved-but-locked staff memberships.
- Updates membership helpers so owners retain Free access, while admin/tech/viewer access requires the `team_members` entitlement.
- Hardens member-management RPCs and direct `shop_members` insert/update/delete policies so Free shops cannot add, activate, restore, remove, or role-change staff.
- Hardens customer email/SMS Edge Function access checks so service-role validation also respects effective team-member access.
- Extends entitlement snapshots with `canUsePhotoEditor` and `canManageTeamMembers`.

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

Pro-only feature gates:

- Photo Editor
- Advanced Reporting
- Team Members

The following remain available:

- Viewing existing jobs and customers
- Photo upload, gallery viewing, and customer-report photo selection
- Basic job sheet/customer report printing
- Job JSON export
- Accounting screen access and basic export while the shop data is visible

Team-member gating is enforced both in the app and in database RPC/RLS paths. Existing non-owner staff memberships are preserved on Free but cannot access the shop until Pro entitlement is restored.

Customer email/SMS Edge Functions also validate effective staff access because they use service-role database reads and cannot rely on browser RLS alone.

## Not Implemented Yet

- Stripe Checkout
- Stripe Customer Portal
- Stripe webhooks
- Real payment collection
- Automated subscription updates from a provider
- Scheduled usage snapshots
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

1. Decide final Free/Pro/Business pricing and any caps before enforcing storage, SMS, or user-count limits.
2. Add trusted storage usage reconciliation and quota warnings.
3. Add Edge Function entitlement checks for email/SMS before enabling provider-cost automation.
4. Keep operator tools for trial/status support separate from future customer self-service billing.
5. Add data export and account deletion/cancellation policy screens.
6. Integrate Stripe only after the entitlement/trial/read-only behavior is stable.
