# FretTrack Paid-Tier Readiness Audit

Date: 2026-05-25

Scope: audit and planning only. No billing implementation is included here.

Current note, 2026-06-16: this audit is historical planning context. Paid Access Lifecycle Phase 1 supersedes the earlier unpaid fallback recommendation. Beta access approval and paid trial access are separate systems; expired trials preserve data and memberships, block writes, and require restored access. Later 0.2.8 inventory work also supersedes the old no-inventory-module gap statements: the current foundation covers parts, vendors, purchase orders, receiving, barcode labels, purchase history, inbound PO shipping, and landed-cost allocation, while deeper inventory automation remains future work.

## Executive Summary

FretTrack is strong enough to support a paid private beta or early Solo Shop tier for a small guitar repair shop that understands it is buying a focused repair workflow, not a mature accounting suite. The core value is real: authenticated shop workspaces, customer records, job tracking, inspection notes, damage/photo documentation, parts/services, payments, print sheets, reports, shop profile settings, and CSV/job exports are already present.

The app is not yet ready for broad self-serve paid SaaS launch. The biggest blockers are not Stripe itself; they are subscription state, entitlement enforcement, billing/admin UX, formal export/deletion policies, storage quotas, and money/audit hardening. The current multi-tenant and RLS foundation is a good starting point, but paid-tier access must be enforced in the database and Edge Functions, not just hidden in React.

Recommended path: launch a controlled paid beta with manual billing or Stripe links only after adding subscription/entitlement tables, expired-trial read-only lifecycle behavior, an admin billing/settings page, storage/member quota decisions, and a clean support/export story. Keep the repair workflow generous for active paid access; gate higher-cost or premium features such as additional users, storage, exports, reports, SMS, inventory, advanced branding, and future API access.

## Current Strengths

### Core Paid Value

FretTrack already has enough operational value for small shops:

- Customer records: standalone customer module, duplicate detection by phone/email/name, job-linked customer history, contact details, source/external reference fields, and import-ready mapping helpers.
- Job tracking: work orders with shop-scoped job numbers, statuses, intake source, customer/instrument details, inspection notes, work logs, activity timeline, and restore-last-workspace behavior.
- Photos: job image upload/delete, damage-map images, marker photos, work-order photo selection, private `job-images` bucket policies, and object-url download for display.
- Parts/services: billable parts, included parts, labor/services, quantity/cost/retail fields, remove controls, and totals.
- Print sheets: Job Sheet and Customer Damage Acknowledgment exist, with recent fix to avoid printing unwanted setup measurements.
- Payments: payment entries by date/method/note, paid total, balance due, payment timeline events, and till summary.
- Reports: Accounting / Reports screen provides date ranges, summary cards, payments by method, tax/VAT collected, open balances, monthly totals, print/PDF, and CSV export.
- Shop profile: remote `shop_profiles`, logo storage, print footer, tax defaults, USD/GBP, locale/date format, measurement preferences, and onboarding requirement.
- Search/filtering: current jobs search across job/customer/instrument/status fields, show/hide picked-up jobs, customer lookup search.
- Exports: job JSON export for support/debugging and accounting CSV export for bookkeeping handoff.

### Multi-Tenant Foundation

- Supabase Auth gates configured builds.
- `shop_members` supports `owner`, `admin`, `tech`, and `viewer`.
- Shop selection works for users with multiple memberships.
- RLS is enabled across core app tables.
- Later migrations revoke `anon` grants from app tables and remove public job image storage policies.
- Shop assets and job images use private buckets with member/role-aware storage policies.
- Edge Functions validate signed-in user access to the job before sending email/SMS.

### Operational Foundation

- Beta operations docs already call out database backups, Storage export gaps, recovery procedure, and minimum export packet.
- Trial readiness docs list required environment variables, storage setup, auth test, job creation test, image upload test, print test, and known limitations.
- Feedback reporter and system announcements provide a basic customer-support loop during beta.

## Payment Blockers

These should be resolved before broad paid launch.

1. No subscription or entitlement model exists.
   There are no `plans`, `subscriptions`, `entitlements`, usage counters, `trial_ends_at`, `subscription_status`, Stripe IDs, or billing roles. Paid state cannot currently be represented in the database.

2. Entitlements are not enforced server-side.
   The app has role checks for shop writes, but no paid-plan checks at RLS/RPC/Edge Function boundaries. Any future gating must be based on database state and helper functions, not frontend state.

3. Trial expiration is undefined.
   The current onboarding flow creates/signs into shops, but there is no expired-trial state, read-only grace period, upgrade prompt, or beta bypass flag.

4. Member administration is incomplete.
   The schema supports shop members, but the app does not yet expose an owner/admin member management screen or invite flow. This blocks paid limits such as `max_users`.

5. Storage quota tracking is absent.
   Photos are a high-cost feature. The app stores images privately, but there is no per-shop storage usage accounting, max storage, quota warning, or upload block.

6. Money controls are not ready for paid accounting expectations.
   Discounts, taxes, parts/services totals, and payments remain editable in operational JSON/state. Known issues already call out the need to lock applied totals and allow employees to add payments without broad monetary edit rights.

7. Function key is public-client exposed.
   `VITE_FRETTRACK_FUNCTION_KEY` is in the frontend and Edge Functions still require `x-frettrack-key`. The functions also validate the user's JWT and shop role, which is good, but the function key should not be treated as a secret once exposed to the browser. For paid tiers, remove this as an auth boundary and rely on JWT plus server-side shop/entitlement checks.

8. Email/SMS rate limits are global, not shop-scoped.
   Current Edge Function rate limiting counts all messages across the table within an hour. Paid plans need per-shop limits and/or provider-cost controls.

9. Formal legal/account lifecycle screens are missing.
   Paying shops need Terms, Privacy, support contact, billing contact, cancellation/deletion/export expectations, and basic account ownership language.

10. App source and docs disagree in places.
   `KNOWN_ISSUES.md` still says shop settings are local trial settings, while the current code persists `shop_profiles` remotely. Before launch, stale docs need cleanup so support and sales copy match reality.

## Important But Non-Blocking Improvements

- Improve mobile/tablet ergonomics. The app is usable as a desktop/tablet shop tool, but dense tabs, sidebars, tables, and forms need more tablet-first polish before expecting bench use on small screens.
- Add clearer save-state handling. Job Detail tracks `Unsaved Changes`, and global `Save Job` works, but automatic saves for some actions and manual saves for others can confuse paying users.
- Improve job workflow guidance. Statuses exist, but there is no workflow board, pipeline count, overdue/promised-date view, or closeout checklist.
- Expand customer communication UX. Templates are useful, but email/SMS configuration, preview, opt-in handling, and error recovery need product polish.
- Add import/export UI. Mapping helpers exist for customer import, but bulk import, preview, duplicate merge, and rollback are not built.
- Add operator/admin feedback dashboard. Beta feedback is collected, but triage still requires database access.
- Improve reporting drill-down. Current summaries are useful, but paid shops will want clickable rows, daily closeout details, and date presets.
- Add data health screens. Shops need to see sync errors, local-only records, failed uploads, and failed message sends without opening dev tools.

## Recommended Initial Tiers

### Beta / Trial

Purpose: controlled acquisition and validation.

Included:

- 14 or 30 day free trial.
- Full repair workflow: jobs, customers, inspection, photos, parts/services, payments, print sheets.
- 1 shop, up to 2 users.
- Limited photo storage, for example 1 GB.
- Accounting / Reports enabled, with CSV export allowed during beta.
- Email enabled if configured; SMS disabled unless explicitly approved.
- Feedback reporter and beta announcements.

Limits:

- No API access.
- Historical 2026-05-25 gap: no inventory module at the time. Superseded by the 0.2.8 inventory purchasing foundation.
- No advanced accounting ledger UI.
- No custom domain.
- Beta tester bypass available only through an operator-controlled database flag.

### Solo Shop

Purpose: single owner/operator or very small bench.

Suggested price band: low monthly SaaS tier.

Included:

- 1 shop.
- 1 owner/admin plus 1 helper/tech, or 2 total users.
- Core jobs/customers/photos/parts/services/payments/print sheets.
- Basic shop branding: logo, footer, contact info.
- Basic reports and CSV export.
- Email messaging.
- Standard storage, for example 5 GB.

Limits:

- No SMS or SMS add-on only.
- Historical 2026-05-25 gap: no inventory/purchasing module at the time. Superseded by the 0.2.8 inventory purchasing foundation.
- Limited exports/reporting history only if necessary, but avoid blocking access to shop data.

### Shop Pro

Purpose: busier shop with employees and more reporting.

Suggested price band: higher monthly SaaS tier.

Included:

- 1 shop.
- 5 users included, additional users later as add-ons.
- Larger photo storage, for example 25 GB.
- Advanced reports/date presets/yearly export packet.
- More branding controls.
- Email messaging.
- SMS as metered add-on or included allowance after carrier registration.
- Priority support.
- Future advanced inventory automation and accounting modules can attach here first.

Limits:

- API access remains future/enterprise.
- Multi-location remains future module.

### Optional Future Modules

- SMS messaging add-on: per-shop monthly allowance plus overage.
- Advanced inventory automation: expand beyond the current parts/vendors/POs/receiving foundation into forecasting, vendor returns, supplier integrations, and deeper movement workflows.
- Advanced accounting module: committed closeout, immutable transaction events, refunds/voids, bookkeeper exports.
- Multi-location module: locations, tills, users per location, location-scoped reports.
- API/Webhooks module: partner integrations and external reporting.
- White-label/advanced branding: stronger print branding, custom templates, custom domain later.

## Recommended Entitlement Model

Use database-owned subscription state. The frontend can read a summarized entitlement snapshot, but it should not be the source of truth.

Recommended objects:

- `plans`: product/tier definitions.
- `plan_entitlements`: defaults for limits and feature flags per plan.
- `shop_subscriptions`: one current subscription/trial state per shop.
- `shop_entitlement_overrides`: operator-controlled exceptions, beta bypasses, custom limits.
- `shop_usage_snapshots`: periodically calculated usage such as users, storage bytes, jobs, messages.
- Optional `billing_customers`: Stripe customer/subscription mapping if you want to keep billing-provider IDs separate.

Recommended status values:

- `trialing`
- `active`
- `past_due`
- `grace`
- `read_only`
- `canceled`
- `beta_bypass`

Recommended enforcement pattern:

- Create a private SQL helper such as `private.shop_entitlements(target_shop_id text)` or targeted helpers like `private.can_write_shop_data(target_shop_id text)`.
- For core tables, preserve member RLS but add paid-state checks only where appropriate.
- Do not over-gate read access. Expired shops should usually be able to view/export data during a grace period.
- Gate expensive or premium writes first: adding users, uploading photos, sending SMS, exporting advanced reports, and enabling advanced inventory/accounting automation.
- Edge Functions must re-check entitlements server-side before sending email/SMS or performing any provider-cost action.

## Suggested Database Additions

```sql
create table plans (
  id text primary key,
  name text not null,
  status text not null default 'active',
  stripe_price_id text,
  monthly_price_cents integer,
  currency_code text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plan_entitlements (
  plan_id text not null references plans(id) on delete cascade,
  key text not null,
  value jsonb not null,
  primary key (plan_id, key)
);

create table shop_subscriptions (
  shop_id text primary key references shop_profiles(shop_id) on delete cascade,
  plan_id text not null references plans(id),
  status text not null,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  grace_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  billing_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shop_entitlement_overrides (
  shop_id text not null references shop_profiles(shop_id) on delete cascade,
  key text not null,
  value jsonb not null,
  reason text not null default '',
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (shop_id, key)
);

create table shop_usage_snapshots (
  shop_id text not null references shop_profiles(shop_id) on delete cascade,
  measured_at timestamptz not null default now(),
  user_count integer not null default 0,
  storage_bytes bigint not null default 0,
  job_count integer not null default 0,
  email_count_month integer not null default 0,
  sms_count_month integer not null default 0,
  primary key (shop_id, measured_at)
);
```

Initial entitlement keys:

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

RLS guidance:

- Enable RLS on every new table.
- Owners/admins should read their own shop subscription and usage.
- Only service-role/operator flows should update subscription status, Stripe IDs, entitlement overrides, and authoritative usage.
- Avoid using user-editable JWT metadata for subscription or role decisions.

## Suggested UI Additions

### Billing / Plan Page

Owner/admin only.

- Current plan and subscription status.
- Trial end date and grace end date.
- User count and storage usage against plan limits.
- Billing email.
- Upgrade/manage billing button placeholder.
- Contact support link.
- Clear copy for `trialing`, `past_due`, `grace`, and `read_only`.

### Expired Trial / Grace UX

- Banner for owner/admin: "Trial ended. Upgrade to keep adding work."
- Banner for tech/viewer: "Shop billing needs attention. Contact an owner/admin."
- Read-only grace mode where existing jobs/customers/photos/reports remain visible.
- Block new jobs, new uploads, new members, SMS, and premium exports after grace ends.
- Always allow data export during a reasonable post-cancel window.

### Member Management

- Invite user by email.
- Assign role.
- Deactivate/remove user.
- Show plan user limit.
- Block invite when `max_users` is reached, with upgrade prompt for owner/admin.

### Usage and Export

- Storage usage card.
- Shop data export request/download flow.
- CSV export for customers/jobs, not only accounting.
- Support packet export for a job or shop.

### Plan-Gated Module Surfaces

- Reports: keep basic summary available; gate advanced yearly/detail exports if needed.
- SMS: show configured/disabled/plan-required states.
- Advanced inventory/accounting automation: visible as locked future modules only if useful, otherwise keep hidden.
- Advanced branding/API: settings placeholders only after the user has a reason to care.

## Feature Gating Points

Avoid gating the basic repair workflow too hard. Paid shops should feel trusted, not trapped.

Gate or limit:

- User count: before inserting into `shop_members`.
- Shop members UI: only owner/admin can invite/manage; `max_users` enforced server-side.
- Photo uploads: before Storage upload and `job_images` insert; warn near quota, block over quota.
- Reports/exports: basic reports included; advanced yearly/export packets can be Pro.
- SMS/email: Edge Functions must check plan and monthly limits; SMS should be paid or metered.
- Advanced inventory/accounting automation: gate module entry points and database writes.
- Advanced branding: extra print template controls, custom logos/templates, later custom domain.
- API access: future token/table/RPC access only for a plan that explicitly includes it.

Do not gate aggressively:

- Viewing existing jobs/customers.
- Printing core job sheets for active/grace shops.
- Adding work logs and updating active jobs for paying shops.
- Exporting own data after cancellation or during grace.

## Trial Flow Recommendations

Current onboarding creates a shop membership and requires shop profile completion. Extend it with:

1. On shop creation, insert `shop_subscriptions` with `status = 'trialing'`, `plan_id = 'trial'`, and `trial_ends_at`.
2. On every app load, fetch a shop access snapshot that includes membership, profile, subscription, and entitlements.
3. If trial is active, show subtle days-left copy to owner/admin only.
4. If trial expired, enter `grace` for a short period; allow normal use or read/write with prominent upgrade prompt depending on sales strategy.
5. After grace, set `read_only`; allow viewing, printing, and export, but block new jobs/uploads/messages.
6. Add `beta_bypass` through `shop_entitlement_overrides` or `shop_subscriptions.status`, not through frontend flags.
7. Add admin-only Billing page to Shop Settings or a separate header action.
8. Keep non-admin users out of billing mechanics; show only a plain "billing needs attention" message.

## Security Checklist

### Good Current Signals

- Supabase Auth is required in configured builds.
- Core tables have RLS and shop-member checks.
- Later migrations revoke `anon` and `public` grants from app tables.
- Private schema helpers centralize membership/role checks.
- Private Storage policies exist for job images and shop assets.
- Edge Functions validate JWT user access to the job before sending customer messages.
- Service-role keys appear confined to Edge Function secrets, not Vite env vars.

### Risks To Address Before Paid Launch

- Treat `VITE_FRETTRACK_FUNCTION_KEY` as public. Remove it from the security model or replace with non-secret request labeling while JWT and entitlement checks do the real work.
- Add entitlement checks to Edge Functions. Email/SMS cost money and must be server-gated.
- Make rate limits shop-scoped and plan-aware.
- Ensure all future subscription tables have RLS and cannot be updated by normal authenticated users.
- Do not use user-editable metadata for roles, billing, or entitlements.
- Verify final remote schema matches migration intent; `supabase-schema.sql` contains historical public grants/policies that are superseded by migrations, so release checks should rely on the applied migration state.
- Add a recurring storage audit because Supabase database backups do not cover Storage objects.
- Avoid trusting frontend-computed usage values. Usage should be calculated server-side or by trusted scheduled jobs.
- Consider shorter JWT/session expectations or explicit session revocation procedure for removed employees.
- Add operator-only access path for support/admin without broad service-role use in the app.

No severe immediately exploitable issue was found in this audit pass that warranted a tiny emergency code fix. The biggest security concern is architectural: do not build paid entitlements in the frontend only.

## Operational Readiness

Before taking broad paid shops:

- Confirm database backup tier and restore procedure.
- Define Storage backup/export process for `job-images` and `shop-assets`.
- Add shop data export UI or operator-run export procedure.
- Add account deletion and cancellation policy.
- Add Terms of Service and Privacy Policy placeholders at minimum.
- Add billing contact email to shop profile or subscription.
- Add support contact and expected response time.
- Update known beta limitations so stale items do not confuse support.
- Add a status/incident message path for app outages.
- Add error handling for local-only saves, sync failures, failed uploads, and failed message sends.
- Add release checklist covering migrations, Edge Functions, Cloudflare Pages, Worker landing page, Supabase secrets, and smoke tests.

## UX Readiness

Likely payment blockers:

- Dense screen layout. The app is functional but can feel like a lot of controls at once.
- Mixed save behavior. Some actions save immediately, some mark the job dirty, and some require global Save Job.
- Onboarding is functional but not yet self-explanatory for non-technical shop owners.
- Member invitations/admin screens are missing.
- Mobile/tablet flow needs testing and polish for real bench use.
- Job statuses are present but workflow is not strongly guided.
- Reports are useful but not drillable.
- Communication flow needs clearer configuration and failure handling.
- Print output has improved, but print sheets should remain a permanent smoke-test area.

Recommended UX priorities:

1. Make save state and sync errors impossible to miss.
2. Add member/billing/admin screens before self-serve paid onboarding.
3. Add date/status filters or a lightweight job pipeline view.
4. Add storage and trial usage cards.
5. Keep the first screen focused on active work, not settings.

## Accounting / Reporting Readiness

Current lightweight accounting is enough for operational paid beta:

- Daily closeout: mostly present in selectors, though the UI emphasizes summaries/monthly totals more than daily tables.
- Monthly summary: present.
- Yearly tax prep export: selector exists for yearly grouping, but UI should expose explicit yearly range/preset/export.
- Payments by method: present.
- Tax/VAT collected: present.
- Parts vs labor separation: present.
- Outstanding balances: present.
- CSV export: present.

Do not turn this into QuickBooks. Instead:

- Keep current reports as operational summaries.
- Add closeout/date presets and a yearly export packet.
- Lock or snapshot finalized totals before promising accounting reliability.
- Integrate the dormant commerce event backbone gradually, starting with committed payment/closeout events.
- Keep clear disclaimer copy: FretTrack helps prepare records for a bookkeeper/tax professional; it is not tax/accounting software.

## Launch Checklist

### Before Paid Beta

- Add subscription and entitlement tables.
- Add owner/admin Billing page.
- Add trial/grace/read-only state handling.
- Add beta bypass controlled by database override.
- Add member management or at least admin invite workflow.
- Add server-side entitlement checks for uploads, member creation, reports/exports, and message sends.
- Add per-shop usage tracking for storage and users.
- Add Terms/Privacy/support links.
- Update stale known-issues docs.
- Run RLS regression checks for cross-shop access.
- Verify Storage private access and export procedure.

### Before Public Self-Serve

- Integrate Stripe Checkout/Billing Portal/webhooks.
- Ensure webhook writes subscription state with service-role only.
- Add cancellation, past-due, and failed-payment UX.
- Add billing email receipts/support process.
- Add data deletion/export self-service or documented support SLA.
- Add production monitoring/alerts.
- Add admin/operator dashboard for beta feedback and subscription support.
- Add storage cleanup/reconciliation jobs.

## Prioritized Next Steps

1. Add subscription/entitlement schema and read-only entitlement snapshot helper.
2. Add trial state to onboarding and app shell.
3. Add owner/admin Billing page with plan/status/usage placeholders.
4. Add server-side checks for high-cost actions: uploads, SMS/email, member invites, advanced exports.
5. Build member management and enforce `max_users`.
6. Add storage usage calculation and photo quota warnings.
7. Harden money workflow: lock applied totals, separate payment entry from monetary edits, and start writing committed payment/closeout events.
8. Add shop data export packet flow.
9. Clean stale docs and add Terms/Privacy/support/billing-contact placeholders.
10. Only then implement Stripe Checkout, Customer Portal, and webhooks.

## Bottom Line

FretTrack has a credible paid product core for a focused repair-shop niche. The right next move is not to bolt Stripe onto the current app shell. The right next move is to add a small, boring entitlement layer, trial/read-only UX, usage limits, admin billing surfaces, and a data-safety story. After that, Stripe can be added cleanly without reshaping the repair workflow.
