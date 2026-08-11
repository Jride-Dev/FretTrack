alter table public.shop_subscriptions
  add column if not exists stripe_price_id text,
  add column if not exists billing_interval text,
  add column if not exists current_period_starts_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists provider_status text;

alter table public.shop_subscriptions
  drop constraint if exists shop_subscriptions_billing_interval_check;

alter table public.shop_subscriptions
  add constraint shop_subscriptions_billing_interval_check
  check (billing_interval is null or billing_interval in ('monthly', 'yearly'));

alter table public.shop_subscriptions
  drop constraint if exists shop_subscriptions_status_check;

alter table public.shop_subscriptions
  add constraint shop_subscriptions_status_check
  check (status in ('trialing', 'active', 'grace', 'read_only', 'canceled', 'cancelled', 'expired', 'past_due', 'incomplete', 'beta_bypass'));

create index if not exists shop_subscriptions_stripe_customer_idx
  on public.shop_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists shop_subscriptions_stripe_subscription_idx
  on public.shop_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  livemode boolean not null default false,
  processed_at timestamptz not null default now(),
  shop_id text references public.shop_profiles(shop_id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'processed' check (status in ('processed', 'ignored', 'failed')),
  error_message text not null default ''
);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists "stripe_webhook_events_operator_select" on public.stripe_webhook_events;
create policy "stripe_webhook_events_operator_select"
  on public.stripe_webhook_events
  for select
  to authenticated
  using (private.is_operator());

revoke all on public.stripe_webhook_events from public, anon, authenticated;
grant select on public.stripe_webhook_events to authenticated;

create or replace function public.get_shop_entitlement_snapshot(target_shop_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  profile_row public.shop_profiles%rowtype;
  subscription_row public.shop_subscriptions%rowtype;
  plan_row public.plans%rowtype;
  entitlement_values jsonb := '{}'::jsonb;
  profile_override_values jsonb := '{}'::jsonb;
  override_values jsonb := '{}'::jsonb;
  effective_entitlements jsonb := '{}'::jsonb;
  effective_status text;
  stored_status text;
  stored_tier text;
  effective_tier text;
  entitlement_plan_id text;
  can_write boolean;
  trial_expired boolean := false;
  user_count_value integer := 0;
  job_count_value integer := 0;
  email_count_value integer := 0;
  sms_count_value integer := 0;
  storage_bytes_value bigint := 0;
  latest_usage public.shop_usage_snapshots%rowtype;
begin
  if not private.is_shop_member(target_shop_id) and not private.is_operator() then
    raise exception 'Not allowed to read shop entitlements.';
  end if;

  select * into profile_row from public.shop_profiles where shop_id = target_shop_id;
  if profile_row.shop_id is null then
    raise exception 'Shop not found.';
  end if;

  profile_override_values := coalesce(profile_row.feature_overrides, '{}'::jsonb);

  select * into subscription_row from public.shop_subscriptions where shop_id = target_shop_id;
  if subscription_row.shop_id is null then
    subscription_row.shop_id := target_shop_id;
    subscription_row.plan_id := coalesce(nullif(profile_row.subscription_tier, ''), 'free');
    subscription_row.status := coalesce(nullif(profile_row.subscription_status, ''), 'active');
    subscription_row.trial_ends_at := profile_row.trial_ends_at;
    subscription_row.grace_ends_at := null;
    subscription_row.billing_email := '';
  end if;

  stored_status := coalesce(nullif(subscription_row.status, ''), nullif(profile_row.subscription_status, ''), 'active');
  stored_tier := coalesce(nullif(subscription_row.plan_id, ''), nullif(profile_row.subscription_tier, ''), 'free');
  trial_expired := stored_status = 'expired'
    or (
      stored_status = 'trialing'
      and coalesce(subscription_row.trial_ends_at, profile_row.trial_ends_at) is not null
      and coalesce(subscription_row.trial_ends_at, profile_row.trial_ends_at) < now()
    );

  if trial_expired then
    effective_status := 'expired';
    effective_tier := stored_tier;
    entitlement_plan_id := 'free';
  elsif stored_status in ('read_only', 'canceled', 'cancelled') then
    effective_status := 'read_only';
    effective_tier := stored_tier;
    entitlement_plan_id := stored_tier;
  elsif stored_status in ('past_due', 'incomplete') then
    effective_status := stored_status;
    effective_tier := stored_tier;
    entitlement_plan_id := stored_tier;
  else
    effective_status := stored_status;
    effective_tier := stored_tier;
    entitlement_plan_id := stored_tier;
  end if;

  if effective_tier not in ('free', 'solo', 'shop', 'pro', 'enterprise') then
    effective_tier := 'free';
  end if;

  if entitlement_plan_id not in ('free', 'solo', 'shop', 'pro', 'enterprise', 'trial') then
    entitlement_plan_id := 'free';
  end if;

  select * into plan_row from public.plans where id = entitlement_plan_id;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  into entitlement_values
  from public.plan_entitlements
  where plan_id = entitlement_plan_id;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  into override_values
  from public.shop_entitlement_overrides
  where shop_id = target_shop_id
    and (expires_at is null or expires_at > now());

  if trial_expired then
    effective_entitlements := entitlement_values;
  else
    effective_entitlements := entitlement_values || profile_override_values || override_values;
  end if;
  can_write := effective_status in ('trialing', 'active', 'grace', 'beta_bypass');

  select count(*)::integer into user_count_value
  from public.shop_members
  where shop_id = target_shop_id;

  select count(*)::integer into job_count_value
  from public.jobs
  where shop_id = target_shop_id;

  select count(*)::integer
  into email_count_value
  from public.customer_messages
  join public.jobs on jobs.id = customer_messages.job_id
  where jobs.shop_id = target_shop_id
    and customer_messages.channel = 'email'
    and customer_messages.created_at >= date_trunc('month', now());

  select count(*)::integer
  into sms_count_value
  from public.customer_messages
  join public.jobs on jobs.id = customer_messages.job_id
  where jobs.shop_id = target_shop_id
    and customer_messages.channel = 'sms'
    and customer_messages.created_at >= date_trunc('month', now());

  select coalesce(sum((storage.objects.metadata->>'size')::bigint), 0)
  into storage_bytes_value
  from storage.objects
  join public.job_images on job_images.storage_path = storage.objects.name
  join public.jobs on jobs.id = job_images.job_id
  where storage.objects.bucket_id = 'job-images'
    and jobs.shop_id = target_shop_id
    and storage.objects.metadata ? 'size';

  select *
  into latest_usage
  from public.shop_usage_snapshots
  where shop_id = target_shop_id
  order by measured_at desc
  limit 1;

  if latest_usage.shop_id is not null then
    storage_bytes_value := greatest(storage_bytes_value, latest_usage.storage_bytes);
  end if;

  return jsonb_build_object(
    'shopId', target_shop_id,
    'plan', jsonb_build_object(
      'id', coalesce(plan_row.id, entitlement_plan_id, 'free'),
      'name', coalesce(plan_row.name, initcap(coalesce(entitlement_plan_id, 'free'))),
      'status', coalesce(plan_row.status, 'active'),
      'billingInterval', subscription_row.billing_interval
    ),
    'subscription', jsonb_build_object(
      'tier', stored_tier,
      'effectiveTier', effective_tier,
      'status', stored_status,
      'profileStatus', coalesce(profile_row.subscription_status, 'active'),
      'effectiveStatus', effective_status,
      'trialEndsAt', coalesce(subscription_row.trial_ends_at, profile_row.trial_ends_at),
      'graceEndsAt', subscription_row.grace_ends_at,
      'currentPeriodStart', subscription_row.current_period_starts_at,
      'currentPeriodEnd', subscription_row.current_period_ends_at,
      'currentPeriodEndsAt', subscription_row.current_period_ends_at,
      'billingEmail', subscription_row.billing_email,
      'stripeCustomerId', subscription_row.stripe_customer_id,
      'stripeSubscriptionId', subscription_row.stripe_subscription_id,
      'stripePriceId', subscription_row.stripe_price_id,
      'billingInterval', subscription_row.billing_interval,
      'cancelAtPeriodEnd', subscription_row.cancel_at_period_end,
      'canceledAt', subscription_row.canceled_at,
      'providerStatus', subscription_row.provider_status
    ),
    'entitlements', effective_entitlements,
    'featureOverrides', profile_override_values,
    'usage', jsonb_build_object(
      'userCount', user_count_value,
      'storageBytes', storage_bytes_value,
      'jobCount', job_count_value,
      'emailCountMonth', email_count_value,
      'smsCountMonth', sms_count_value
    ),
    'access', jsonb_build_object(
      'canWrite', can_write,
      'readOnly', not can_write,
      'canUploadPhotos', can_write and coalesce((effective_entitlements->>'photos')::boolean, true),
      'canSendEmail', can_write and coalesce((effective_entitlements->>'email_messages')::boolean, true),
      'canSendSms', can_write and coalesce((effective_entitlements->>'sms_messages')::boolean, false),
      'canUseReports', coalesce((effective_entitlements->>'reports')::boolean, true),
      'canExportCsv', coalesce((effective_entitlements->>'csv_export')::boolean, true),
      'canUsePhotoEditor', coalesce((effective_entitlements->>'photo_editor')::boolean, false),
      'canUseAdvancedReporting', coalesce((effective_entitlements->>'advanced_reporting')::boolean, false),
      'canManageTeamMembers', coalesce((effective_entitlements->>'team_members')::boolean, false),
      'canUseTeamAssignment', coalesce((effective_entitlements->>'team_assignment')::boolean, false),
      'canUseCustomerPortal', coalesce((effective_entitlements->>'customer_portal')::boolean, false),
      'canUseApi', coalesce((effective_entitlements->>'api_access')::boolean, false),
      'canUseCustomBranding', coalesce((effective_entitlements->>'custom_branding')::boolean, false),
      'canUseMultiLocation', coalesce((effective_entitlements->>'multi_location')::boolean, false)
    )
  );
end;
$$;

revoke all on function public.get_shop_entitlement_snapshot(text) from public, anon;
grant execute on function public.get_shop_entitlement_snapshot(text) to authenticated;
