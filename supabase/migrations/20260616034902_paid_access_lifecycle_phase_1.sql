-- Paid access lifecycle Phase 1.
--
-- Public product language is Trial / Shop / Pro. The internal `free`, `solo`,
-- and `enterprise` values remain compatibility values during migration.
-- Existing `free + active` shops are intentionally preserved as writable legacy
-- compatibility rows. Expired unpaid trials preserve data and membership rows
-- but block writes and premium entitlements.

create or replace function private.shop_has_entitlement(target_shop_id text, entitlement_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_row public.shop_profiles%rowtype;
  subscription_row public.shop_subscriptions%rowtype;
  stored_status text;
  stored_tier text;
  entitlement_plan_id text;
  entitlement_value jsonb;
  profile_override jsonb;
  override_value jsonb;
  trial_expired boolean := false;
begin
  select *
  into profile_row
  from public.shop_profiles
  where shop_id = target_shop_id;

  if profile_row.shop_id is null then
    return false;
  end if;

  select *
  into subscription_row
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  stored_status := coalesce(nullif(subscription_row.status, ''), nullif(profile_row.subscription_status, ''), 'active');
  stored_tier := coalesce(nullif(subscription_row.plan_id, ''), nullif(profile_row.subscription_tier, ''), 'free');
  trial_expired := stored_status = 'expired'
    or (
      stored_status = 'trialing'
      and coalesce(subscription_row.trial_ends_at, profile_row.trial_ends_at) is not null
      and coalesce(subscription_row.trial_ends_at, profile_row.trial_ends_at) < now()
    );

  entitlement_plan_id := case
    when trial_expired then 'free'
    when stored_tier in ('free', 'solo', 'shop', 'pro', 'enterprise', 'trial') then stored_tier
    else 'free'
  end;

  select value
  into entitlement_value
  from public.plan_entitlements
  where plan_id = entitlement_plan_id
    and key = entitlement_key;

  if trial_expired then
    return coalesce((entitlement_value::text)::boolean, false);
  end if;

  profile_override := profile_row.feature_overrides -> entitlement_key;

  select value
  into override_value
  from public.shop_entitlement_overrides
  where shop_id = target_shop_id
    and key = entitlement_key
    and (expires_at is null or expires_at > now());

  if override_value is not null then
    return coalesce((override_value::text)::boolean, false);
  end if;

  if profile_override is not null then
    return coalesce((profile_override::text)::boolean, false);
  end if;

  return coalesce((entitlement_value::text)::boolean, false);
end;
$$;

create or replace function private.shop_lifecycle_allows_write(target_shop_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_row public.shop_profiles%rowtype;
  subscription_row public.shop_subscriptions%rowtype;
  stored_status text;
  trial_expired boolean := false;
begin
  select *
  into profile_row
  from public.shop_profiles
  where shop_id = target_shop_id;

  if profile_row.shop_id is null then
    return false;
  end if;

  select *
  into subscription_row
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  stored_status := coalesce(nullif(subscription_row.status, ''), nullif(profile_row.subscription_status, ''), 'active');
  trial_expired := stored_status = 'expired'
    or (
      stored_status = 'trialing'
      and coalesce(subscription_row.trial_ends_at, profile_row.trial_ends_at) is not null
      and coalesce(subscription_row.trial_ends_at, profile_row.trial_ends_at) < now()
    );

  if trial_expired then
    return false;
  end if;

  return stored_status not in ('read_only', 'canceled', 'cancelled');
end;
$$;

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

  select *
  into profile_row
  from public.shop_profiles
  where shop_id = target_shop_id;

  if profile_row.shop_id is null then
    raise exception 'Shop not found.';
  end if;

  profile_override_values := coalesce(profile_row.feature_overrides, '{}'::jsonb);

  select *
  into subscription_row
  from public.shop_subscriptions
  where shop_id = target_shop_id;

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

  select *
  into plan_row
  from public.plans
  where id = entitlement_plan_id;

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

  can_write := effective_status not in ('read_only', 'canceled', 'cancelled', 'expired');

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
      'id', coalesce(plan_row.id, entitlement_plan_id, 'free'),
      'name', coalesce(plan_row.name, initcap(coalesce(entitlement_plan_id, 'free'))),
      'status', coalesce(plan_row.status, 'active')
    ),
    'subscription', jsonb_build_object(
      'tier', stored_tier,
      'status', stored_status,
      'profileStatus', coalesce(profile_row.subscription_status, 'active'),
      'effectiveStatus', effective_status,
      'effectiveTier', effective_tier,
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
      'canUsePhotoEditor', coalesce((effective_entitlements->>'photo_editor')::boolean, false),
      'canUseAdvancedReporting', coalesce((effective_entitlements->>'advanced_reporting')::boolean, false),
      'canManageTeamMembers', coalesce((effective_entitlements->>'team_members')::boolean, false),
      'canUseCustomerPortal', coalesce((effective_entitlements->>'customer_portal')::boolean, false),
      'canUseApi', coalesce((effective_entitlements->>'api_access')::boolean, false),
      'canUseCustomBranding', coalesce((effective_entitlements->>'custom_branding')::boolean, false),
      'canUseMultiLocation', coalesce((effective_entitlements->>'multi_location')::boolean, false)
    )
  );
end;
$$;

create or replace function public.set_shop_premium_trial(
  target_shop_id text,
  trial_days integer,
  trial_tier text default 'pro'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  trial_end timestamptz;
  normalized_tier text;
  current_subscription public.shop_subscriptions%rowtype;
begin
  if not private.is_operator() then
    raise exception 'Not allowed to set premium trials.';
  end if;

  if trial_days not in (7, 14, 30) then
    raise exception 'Trial days must be one of 7, 14, or 30.';
  end if;

  normalized_tier := lower(coalesce(nullif(trial_tier, ''), 'pro'));
  if normalized_tier not in ('shop', 'pro') then
    raise exception 'Trial tier must be shop or pro.';
  end if;

  if not exists (select 1 from public.shop_profiles where shop_id = target_shop_id) then
    raise exception 'Shop not found.';
  end if;

  trial_end := now() + make_interval(days => trial_days);

  select *
  into current_subscription
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  insert into public.shop_subscriptions (
    shop_id,
    plan_id,
    status,
    trial_ends_at,
    grace_ends_at,
    billing_email
  )
  values (
    target_shop_id,
    normalized_tier,
    'trialing',
    trial_end,
    trial_end + interval '14 days',
    coalesce(current_subscription.billing_email, '')
  )
  on conflict (shop_id) do update
  set
    plan_id = excluded.plan_id,
    status = excluded.status,
    trial_ends_at = excluded.trial_ends_at,
    grace_ends_at = excluded.grace_ends_at,
    updated_at = now();

  update public.shop_profiles
  set
    subscription_tier = normalized_tier,
    subscription_status = 'trialing',
    trial_ends_at = trial_end,
    updated_at = now()
  where shop_id = target_shop_id;

  return public.get_shop_entitlement_snapshot(target_shop_id);
end;
$$;

create or replace function public.extend_shop_premium_trial(
  target_shop_id text,
  extend_days integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  current_subscription public.shop_subscriptions%rowtype;
  resolved_tier text;
  trial_end timestamptz;
begin
  if not private.is_operator() then
    raise exception 'Not allowed to extend premium trials.';
  end if;

  if extend_days not in (7, 14, 30) then
    raise exception 'Extend days must be one of 7, 14, or 30.';
  end if;

  select *
  into current_subscription
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  if current_subscription.shop_id is null then
    raise exception 'Shop subscription not found.';
  end if;

  resolved_tier := current_subscription.plan_id;
  if resolved_tier not in ('shop', 'pro') then
    raise exception 'Only active Shop or Pro trials can be extended.';
  end if;

  trial_end := greatest(coalesce(current_subscription.trial_ends_at, now()), now()) + make_interval(days => extend_days);

  update public.shop_subscriptions
  set
    status = 'trialing',
    trial_ends_at = trial_end,
    grace_ends_at = trial_end + interval '14 days',
    updated_at = now()
  where shop_id = target_shop_id;

  update public.shop_profiles
  set
    subscription_tier = resolved_tier,
    subscription_status = 'trialing',
    trial_ends_at = trial_end,
    updated_at = now()
  where shop_id = target_shop_id;

  return public.get_shop_entitlement_snapshot(target_shop_id);
end;
$$;

create or replace function public.end_shop_premium_trial(target_shop_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  current_subscription public.shop_subscriptions%rowtype;
  resolved_tier text;
  ended_at timestamptz := now();
begin
  if not private.is_operator() then
    raise exception 'Not allowed to end premium trials.';
  end if;

  if not exists (select 1 from public.shop_profiles where shop_id = target_shop_id) then
    raise exception 'Shop not found.';
  end if;

  select *
  into current_subscription
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  resolved_tier := coalesce(nullif(current_subscription.plan_id, ''), 'shop');
  if resolved_tier not in ('shop', 'pro') then
    resolved_tier := 'shop';
  end if;

  insert into public.shop_subscriptions (
    shop_id,
    plan_id,
    status,
    trial_ends_at,
    grace_ends_at,
    billing_email
  )
  values (
    target_shop_id,
    resolved_tier,
    'expired',
    ended_at,
    null,
    coalesce(current_subscription.billing_email, '')
  )
  on conflict (shop_id) do update
  set
    plan_id = excluded.plan_id,
    status = excluded.status,
    trial_ends_at = excluded.trial_ends_at,
    grace_ends_at = null,
    updated_at = now();

  update public.shop_profiles
  set
    subscription_tier = resolved_tier,
    subscription_status = 'expired',
    trial_ends_at = ended_at,
    updated_at = now()
  where shop_id = target_shop_id;

  return public.get_shop_entitlement_snapshot(target_shop_id);
end;
$$;

create or replace function public.update_beta_shop_subscription(
  target_shop_id text,
  next_status text default null,
  extend_trial_days integer default null,
  beta_bypass boolean default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  current_subscription public.shop_subscriptions%rowtype;
  resolved_status text;
  resolved_trial_ends_at timestamptz;
  resolved_grace_ends_at timestamptz;
  resolved_tier text;
begin
  if not private.is_operator() then
    raise exception 'Not allowed to update beta shop access.';
  end if;

  if not exists (select 1 from public.shop_profiles where shop_id = target_shop_id) then
    raise exception 'Shop not found.';
  end if;

  if next_status is not null
    and next_status not in ('trialing', 'active', 'grace', 'read_only', 'canceled', 'expired', 'beta_bypass') then
    raise exception 'Invalid subscription status.';
  end if;

  if extend_trial_days is not null
    and extend_trial_days <> 0
    and extend_trial_days not in (7, 14, 30) then
    raise exception 'Extend days must be one of 7, 14, or 30.';
  end if;

  select *
  into current_subscription
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  resolved_status := coalesce(current_subscription.status, 'active');
  resolved_tier := coalesce(current_subscription.plan_id, 'free');
  resolved_trial_ends_at := current_subscription.trial_ends_at;
  resolved_grace_ends_at := current_subscription.grace_ends_at;

  if beta_bypass is not null then
    resolved_status := case when beta_bypass then 'beta_bypass' else 'active' end;
  end if;

  if next_status is not null then
    resolved_status := next_status;
  end if;

  if extend_trial_days is not null and extend_trial_days <> 0 then
    if resolved_tier not in ('shop', 'pro') then
      raise exception 'Legacy trial extension is only available for active Shop or Pro trials.';
    end if;

    resolved_status := 'trialing';
    resolved_trial_ends_at := greatest(coalesce(resolved_trial_ends_at, now()), now()) + make_interval(days => extend_trial_days);
    resolved_grace_ends_at := resolved_trial_ends_at + interval '14 days';
  end if;

  insert into public.shop_subscriptions (
    shop_id,
    plan_id,
    status,
    trial_ends_at,
    grace_ends_at,
    billing_email
  )
  values (
    target_shop_id,
    resolved_tier,
    resolved_status,
    resolved_trial_ends_at,
    resolved_grace_ends_at,
    coalesce(current_subscription.billing_email, '')
  )
  on conflict (shop_id) do update
  set
    status = excluded.status,
    trial_ends_at = excluded.trial_ends_at,
    grace_ends_at = excluded.grace_ends_at,
    updated_at = now()
  returning * into current_subscription;

  update public.shop_profiles
  set
    subscription_tier = case
      when current_subscription.status = 'beta_bypass' then coalesce(nullif(subscription_tier, ''), 'free')
      else current_subscription.plan_id
    end,
    subscription_status = case
      when current_subscription.status in ('read_only', 'canceled', 'beta_bypass') then coalesce(nullif(subscription_status, ''), 'active')
      else current_subscription.status
    end,
    trial_ends_at = current_subscription.trial_ends_at,
    updated_at = now()
  where shop_id = target_shop_id;

  return jsonb_build_object(
    'shopId', current_subscription.shop_id,
    'planId', current_subscription.plan_id,
    'status', current_subscription.status,
    'trialEndsAt', current_subscription.trial_ends_at,
    'graceEndsAt', current_subscription.grace_ends_at,
    'updatedAt', current_subscription.updated_at
  );
end;
$$;

revoke all on function private.shop_has_entitlement(text, text) from public, anon;
revoke all on function private.shop_lifecycle_allows_write(text) from public, anon;
grant execute on function private.shop_has_entitlement(text, text) to authenticated;
grant execute on function private.shop_lifecycle_allows_write(text) to authenticated;

revoke all on function public.get_shop_entitlement_snapshot(text) from public, anon;
grant execute on function public.get_shop_entitlement_snapshot(text) to authenticated;
revoke all on function public.set_shop_premium_trial(text, integer, text) from public, anon;
grant execute on function public.set_shop_premium_trial(text, integer, text) to authenticated;
revoke all on function public.extend_shop_premium_trial(text, integer) from public, anon;
grant execute on function public.extend_shop_premium_trial(text, integer) to authenticated;
revoke all on function public.end_shop_premium_trial(text) from public, anon;
grant execute on function public.end_shop_premium_trial(text) to authenticated;
revoke all on function public.update_beta_shop_subscription(text, text, integer, boolean) from public, anon;
grant execute on function public.update_beta_shop_subscription(text, text, integer, boolean) to authenticated;
