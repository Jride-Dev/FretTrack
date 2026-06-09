alter table public.shop_profiles
  add column if not exists subscription_tier text not null default 'free',
  add column if not exists subscription_status text not null default 'active',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists feature_overrides jsonb not null default '{}'::jsonb;

update public.shop_profiles
set
  subscription_tier = coalesce(nullif(subscription_tier, ''), 'free'),
  subscription_status = coalesce(nullif(subscription_status, ''), 'active'),
  feature_overrides = coalesce(feature_overrides, '{}'::jsonb);

alter table public.shop_profiles
  alter column subscription_tier set default 'free',
  alter column subscription_tier set not null,
  alter column subscription_status set default 'active',
  alter column subscription_status set not null,
  alter column feature_overrides set default '{}'::jsonb,
  alter column feature_overrides set not null;

alter table public.shop_profiles
  drop constraint if exists shop_profiles_subscription_tier_check;

alter table public.shop_profiles
  add constraint shop_profiles_subscription_tier_check
  check (subscription_tier in ('free', 'solo', 'pro', 'enterprise'));

alter table public.shop_profiles
  drop constraint if exists shop_profiles_subscription_status_check;

alter table public.shop_profiles
  add constraint shop_profiles_subscription_status_check
  check (subscription_status in ('active', 'trialing', 'expired', 'cancelled', 'canceled'));

alter table public.shop_profiles
  drop constraint if exists shop_profiles_feature_overrides_object_check;

alter table public.shop_profiles
  add constraint shop_profiles_feature_overrides_object_check
  check (jsonb_typeof(feature_overrides) = 'object');

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
  profile_effective_status text;
  can_write boolean;
  user_count_value integer := 0;
  job_count_value integer := 0;
  email_count_value integer := 0;
  sms_count_value integer := 0;
  storage_bytes_value bigint := 0;
  latest_usage public.shop_usage_snapshots%rowtype;
begin
  if not private.is_shop_member(target_shop_id) then
    raise exception 'Not allowed to read shop entitlements.';
  end if;

  select *
  into profile_row
  from public.shop_profiles
  where shop_id = target_shop_id;

  profile_override_values := coalesce(profile_row.feature_overrides, '{}'::jsonb);
  profile_effective_status := coalesce(nullif(profile_row.subscription_status, ''), 'active');

  if profile_effective_status = 'trialing' and profile_row.trial_ends_at is not null and profile_row.trial_ends_at < now() then
    profile_effective_status := 'expired';
  end if;

  select *
  into subscription_row
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  if subscription_row.shop_id is null then
    subscription_row.shop_id := target_shop_id;
    subscription_row.plan_id := coalesce(nullif(profile_row.subscription_tier, ''), 'free');
    subscription_row.status := profile_effective_status;
    subscription_row.trial_ends_at := profile_row.trial_ends_at;
    subscription_row.grace_ends_at := null;
    subscription_row.billing_email := '';
  end if;

  select *
  into plan_row
  from public.plans
  where id = subscription_row.plan_id;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  into entitlement_values
  from public.plan_entitlements
  where plan_id = subscription_row.plan_id;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  into override_values
  from public.shop_entitlement_overrides
  where shop_id = target_shop_id
    and (expires_at is null or expires_at > now());

  effective_entitlements := entitlement_values || profile_override_values || override_values;
  effective_status := subscription_row.status;

  if effective_status = 'trialing' and subscription_row.trial_ends_at is not null and subscription_row.trial_ends_at < now() then
    if subscription_row.grace_ends_at is not null and subscription_row.grace_ends_at > now() then
      effective_status := 'grace';
    else
      effective_status := 'read_only';
    end if;
  end if;

  if effective_status in ('canceled', 'cancelled', 'expired') then
    effective_status := 'read_only';
  end if;

  can_write := effective_status in ('trialing', 'active', 'grace', 'beta_bypass');

  select count(*)::integer
  into user_count_value
  from public.shop_members
  where shop_id = target_shop_id;

  select count(*)::integer
  into job_count_value
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
      'id', coalesce(plan_row.id, subscription_row.plan_id, profile_row.subscription_tier, 'free'),
      'name', coalesce(plan_row.name, initcap(coalesce(subscription_row.plan_id, profile_row.subscription_tier, 'free'))),
      'status', coalesce(plan_row.status, 'active')
    ),
    'subscription', jsonb_build_object(
      'tier', coalesce(profile_row.subscription_tier, subscription_row.plan_id, 'free'),
      'status', subscription_row.status,
      'profileStatus', coalesce(profile_row.subscription_status, 'active'),
      'effectiveStatus', effective_status,
      'trialEndsAt', coalesce(subscription_row.trial_ends_at, profile_row.trial_ends_at),
      'currentPeriodEndsAt', subscription_row.current_period_ends_at,
      'graceEndsAt', subscription_row.grace_ends_at,
      'billingEmail', subscription_row.billing_email
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
      'canUseAdvancedReporting', coalesce((effective_entitlements->>'advanced_reporting')::boolean, false),
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
