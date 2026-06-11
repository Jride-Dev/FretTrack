insert into public.plans (id, name, status, description, monthly_price_cents, currency_code, sort_order)
values
  ('free', 'Free', 'active', 'Core shop operations for small repair shops.', 0, 'USD', 0),
  ('enterprise', 'Enterprise', 'active', 'Multi-location and enterprise administration foundation.', null, 'USD', 40)
on conflict (id) do update
set
  name = excluded.name,
  status = excluded.status,
  description = excluded.description,
  monthly_price_cents = excluded.monthly_price_cents,
  currency_code = excluded.currency_code,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.plan_entitlements (plan_id, key, value)
values
  ('free', 'core_jobs', 'true'::jsonb),
  ('free', 'customers', 'true'::jsonb),
  ('free', 'photos', 'true'::jsonb),
  ('free', 'reports', 'true'::jsonb),
  ('free', 'csv_export', 'true'::jsonb),
  ('free', 'email_messages', 'true'::jsonb),
  ('free', 'sms_messages', 'false'::jsonb),
  ('free', 'scheduling', 'true'::jsonb),
  ('free', 'damage_maps', 'true'::jsonb),
  ('free', 'work_logs', 'true'::jsonb),
  ('free', 'printing', 'true'::jsonb),
  ('free', 'mobile_pwa', 'true'::jsonb),
  ('free', 'inventory', 'true'::jsonb),
  ('free', 'advanced_accounting', 'false'::jsonb),
  ('free', 'advanced_reporting', 'false'::jsonb),
  ('free', 'business_analytics', 'false'::jsonb),
  ('free', 'inventory_analytics', 'false'::jsonb),
  ('free', 'revenue_dashboards', 'false'::jsonb),
  ('free', 'backup_tools', 'false'::jsonb),
  ('free', 'additional_storage', 'false'::jsonb),
  ('free', 'customer_portal', 'false'::jsonb),
  ('free', 'public_job_status_links', 'false'::jsonb),
  ('free', 'public_invoice_links', 'false'::jsonb),
  ('free', 'api_access', 'false'::jsonb),
  ('free', 'advanced_branding', 'false'::jsonb),
  ('free', 'custom_branding', 'false'::jsonb),
  ('free', 'advanced_inventory_workflows', 'false'::jsonb),
  ('free', 'multi_location', 'false'::jsonb),
  ('free', 'cross_location_inventory', 'false'::jsonb),
  ('free', 'centralized_reporting', 'false'::jsonb),
  ('free', 'enterprise_administration', 'false'::jsonb),
  ('free', 'max_users', '2'::jsonb),
  ('free', 'max_storage_bytes', '5368709120'::jsonb),
  ('free', 'monthly_email_limit', '1000'::jsonb),
  ('free', 'monthly_sms_limit', '0'::jsonb),
  ('enterprise', 'core_jobs', 'true'::jsonb),
  ('enterprise', 'customers', 'true'::jsonb),
  ('enterprise', 'photos', 'true'::jsonb),
  ('enterprise', 'reports', 'true'::jsonb),
  ('enterprise', 'csv_export', 'true'::jsonb),
  ('enterprise', 'email_messages', 'true'::jsonb),
  ('enterprise', 'sms_messages', 'true'::jsonb),
  ('enterprise', 'scheduling', 'true'::jsonb),
  ('enterprise', 'damage_maps', 'true'::jsonb),
  ('enterprise', 'work_logs', 'true'::jsonb),
  ('enterprise', 'printing', 'true'::jsonb),
  ('enterprise', 'mobile_pwa', 'true'::jsonb),
  ('enterprise', 'inventory', 'true'::jsonb),
  ('enterprise', 'advanced_accounting', 'true'::jsonb),
  ('enterprise', 'advanced_reporting', 'true'::jsonb),
  ('enterprise', 'business_analytics', 'true'::jsonb),
  ('enterprise', 'inventory_analytics', 'true'::jsonb),
  ('enterprise', 'revenue_dashboards', 'true'::jsonb),
  ('enterprise', 'backup_tools', 'true'::jsonb),
  ('enterprise', 'additional_storage', 'true'::jsonb),
  ('enterprise', 'customer_portal', 'true'::jsonb),
  ('enterprise', 'public_job_status_links', 'true'::jsonb),
  ('enterprise', 'public_invoice_links', 'true'::jsonb),
  ('enterprise', 'api_access', 'true'::jsonb),
  ('enterprise', 'advanced_branding', 'true'::jsonb),
  ('enterprise', 'custom_branding', 'true'::jsonb),
  ('enterprise', 'advanced_inventory_workflows', 'true'::jsonb),
  ('enterprise', 'multi_location', 'true'::jsonb),
  ('enterprise', 'cross_location_inventory', 'true'::jsonb),
  ('enterprise', 'centralized_reporting', 'true'::jsonb),
  ('enterprise', 'enterprise_administration', 'true'::jsonb),
  ('enterprise', 'max_users', '100'::jsonb),
  ('enterprise', 'max_storage_bytes', '1099511627776'::jsonb),
  ('enterprise', 'monthly_email_limit', '10000'::jsonb),
  ('enterprise', 'monthly_sms_limit', '5000'::jsonb)
on conflict (plan_id, key) do update
set
  value = excluded.value,
  updated_at = now();

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

  stored_status := coalesce(nullif(subscription_row.status, ''), 'active');
  stored_tier := coalesce(nullif(subscription_row.plan_id, ''), nullif(profile_row.subscription_tier, ''), 'free');
  trial_expired := stored_status = 'trialing'
    and subscription_row.trial_ends_at is not null
    and subscription_row.trial_ends_at < now();

  if stored_status = 'trialing' and trial_expired then
    effective_status := 'expired';
    effective_tier := 'free';
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

  if effective_tier not in ('free', 'solo', 'pro', 'enterprise') then
    effective_tier := 'free';
  end if;

  if entitlement_plan_id not in ('free', 'solo', 'pro', 'enterprise', 'trial') then
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
  can_write := effective_status not in ('read_only', 'canceled', 'cancelled');

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
  if normalized_tier <> 'pro' then
    raise exception 'Trial tier must be pro.';
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

revoke all on function public.set_shop_premium_trial(text, integer, text) from public, anon;
grant execute on function public.set_shop_premium_trial(text, integer, text) to authenticated;

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
  if resolved_tier <> 'pro' then
    raise exception 'Only an active Pro premium trial can be extended.';
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

revoke all on function public.extend_shop_premium_trial(text, integer) from public, anon;
grant execute on function public.extend_shop_premium_trial(text, integer) to authenticated;

create or replace function public.end_shop_premium_trial(target_shop_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  current_subscription public.shop_subscriptions%rowtype;
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
    'free',
    'active',
    null,
    null,
    coalesce(current_subscription.billing_email, '')
  )
  on conflict (shop_id) do update
  set
    plan_id = 'free',
    status = 'active',
    trial_ends_at = null,
    grace_ends_at = null,
    updated_at = now();

  update public.shop_profiles
  set
    subscription_tier = 'free',
    subscription_status = 'active',
    trial_ends_at = null,
    updated_at = now()
  where shop_id = target_shop_id;

  return public.get_shop_entitlement_snapshot(target_shop_id);
end;
$$;

revoke all on function public.end_shop_premium_trial(text) from public, anon;
grant execute on function public.end_shop_premium_trial(text) to authenticated;

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
    and next_status not in ('trialing', 'active', 'grace', 'read_only', 'canceled', 'beta_bypass') then
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
    if resolved_tier <> 'pro' then
      raise exception 'Legacy trial extension is only available for active Pro premium trials.';
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

revoke all on function public.update_beta_shop_subscription(text, text, integer, boolean) from public, anon;
grant execute on function public.update_beta_shop_subscription(text, text, integer, boolean) to authenticated;

create or replace function public.get_beta_operator_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  payload jsonb;
begin
  if not private.is_operator() then
    raise exception 'Not allowed to view operator dashboard.';
  end if;

  with latest_usage as (
    select distinct on (shop_id)
      shop_id,
      user_count,
      storage_bytes,
      job_count,
      email_count_month,
      sms_count_month,
      measured_at
    from public.shop_usage_snapshots
    order by shop_id, measured_at desc
  ),
  image_usage as (
    select
      jobs.shop_id,
      count(job_images.id)::integer as image_count,
      coalesce(sum(job_images.optimized_size_bytes), 0)::bigint as image_storage_bytes
    from public.job_images
    join public.jobs on jobs.id = job_images.job_id
    group by jobs.shop_id
  ),
  job_counts as (
    select shop_id, count(*)::integer as job_count, max(updated_at) as last_job_at
    from public.jobs
    group by shop_id
  ),
  member_counts as (
    select
      shop_members.shop_id,
      count(*)::integer as user_count,
      coalesce(
        jsonb_agg(auth.users.email order by auth.users.email) filter (
          where shop_members.role in ('owner', 'admin')
            and auth.users.email is not null
        ),
        '[]'::jsonb
      ) as admin_emails
    from public.shop_members
    left join auth.users on auth.users.id = shop_members.user_id
    group by shop_members.shop_id
  ),
  message_counts as (
    select
      jobs.shop_id,
      count(*) filter (
        where customer_messages.channel = 'email'
          and customer_messages.created_at >= date_trunc('month', now())
      )::integer as email_count_month,
      count(*) filter (
        where customer_messages.channel = 'sms'
          and customer_messages.created_at >= date_trunc('month', now())
      )::integer as sms_count_month,
      max(customer_messages.created_at) as last_message_at
    from public.customer_messages
    join public.jobs on jobs.id = customer_messages.job_id
    group by jobs.shop_id
  ),
  event_counts as (
    select
      shop_id,
      max(created_at) as last_event_at,
      count(*) filter (where event_type in ('image_upload_failed', 'image_optimization_blocked'))::integer as failed_upload_count
    from public.job_events
    group by shop_id
  ),
  payment_counts as (
    select shop_id, max(created_at) as last_payment_at
    from public.payment_events
    group by shop_id
  ),
  shop_rows as (
    select
      shop_profiles.shop_id,
      shop_profiles.shop_name,
      shop_profiles.email as shop_email,
      shop_profiles.created_at,
      shop_profiles.updated_at,
      shop_profiles.onboarded_at,
      coalesce(shop_subscriptions.plan_id, shop_profiles.subscription_tier, 'free') as plan_id,
      coalesce(plans.name, initcap(coalesce(shop_subscriptions.plan_id, shop_profiles.subscription_tier, 'free'))) as plan_name,
      coalesce(shop_subscriptions.status, shop_profiles.subscription_status, 'active') as subscription_status,
      case
        when coalesce(shop_subscriptions.status, shop_profiles.subscription_status, 'active') = 'trialing'
          and coalesce(shop_subscriptions.trial_ends_at, shop_profiles.trial_ends_at) is not null
          and coalesce(shop_subscriptions.trial_ends_at, shop_profiles.trial_ends_at) < now()
          then 'expired'
        when coalesce(shop_subscriptions.status, shop_profiles.subscription_status, 'active') in ('read_only', 'canceled', 'cancelled')
          then 'read_only'
        else coalesce(shop_subscriptions.status, shop_profiles.subscription_status, 'active')
      end as effective_status,
      case
        when coalesce(shop_subscriptions.status, shop_profiles.subscription_status, 'active') = 'trialing'
          and coalesce(shop_subscriptions.trial_ends_at, shop_profiles.trial_ends_at) is not null
          and coalesce(shop_subscriptions.trial_ends_at, shop_profiles.trial_ends_at) < now()
          then 'free'
        else coalesce(shop_subscriptions.plan_id, shop_profiles.subscription_tier, 'free')
      end as effective_tier,
      coalesce(shop_subscriptions.trial_ends_at, shop_profiles.trial_ends_at) as trial_ends_at,
      case
        when coalesce(shop_subscriptions.trial_ends_at, shop_profiles.trial_ends_at) is null then null
        else ceil(extract(epoch from (coalesce(shop_subscriptions.trial_ends_at, shop_profiles.trial_ends_at) - now())) / 86400)::integer
      end as days_remaining,
      shop_subscriptions.grace_ends_at,
      shop_subscriptions.current_period_ends_at,
      shop_subscriptions.billing_email,
      coalesce(member_counts.user_count, latest_usage.user_count, 0) as user_count,
      coalesce(job_counts.job_count, latest_usage.job_count, 0) as job_count,
      coalesce(image_usage.image_count, 0) as image_count,
      greatest(coalesce(image_usage.image_storage_bytes, 0), coalesce(latest_usage.storage_bytes, 0)) as storage_bytes,
      coalesce(message_counts.email_count_month, latest_usage.email_count_month, 0) as email_count_month,
      coalesce(message_counts.sms_count_month, latest_usage.sms_count_month, 0) as sms_count_month,
      coalesce(event_counts.failed_upload_count, 0) as failed_upload_count,
      member_counts.admin_emails,
      latest_usage.measured_at as usage_measured_at,
      greatest(
        coalesce(shop_profiles.updated_at, shop_profiles.created_at),
        coalesce(job_counts.last_job_at, shop_profiles.created_at),
        coalesce(message_counts.last_message_at, shop_profiles.created_at),
        coalesce(event_counts.last_event_at, shop_profiles.created_at),
        coalesce(payment_counts.last_payment_at, shop_profiles.created_at)
      ) as last_activity_at
    from public.shop_profiles
    left join public.shop_subscriptions on shop_subscriptions.shop_id = shop_profiles.shop_id
    left join public.plans on plans.id = coalesce(shop_subscriptions.plan_id, shop_profiles.subscription_tier, 'free')
    left join latest_usage on latest_usage.shop_id = shop_profiles.shop_id
    left join image_usage on image_usage.shop_id = shop_profiles.shop_id
    left join job_counts on job_counts.shop_id = shop_profiles.shop_id
    left join member_counts on member_counts.shop_id = shop_profiles.shop_id
    left join message_counts on message_counts.shop_id = shop_profiles.shop_id
    left join event_counts on event_counts.shop_id = shop_profiles.shop_id
    left join payment_counts on payment_counts.shop_id = shop_profiles.shop_id
  ),
  member_rows as (
    select
      shop_members.id,
      shop_members.shop_id,
      shop_profiles.shop_name,
      shop_members.user_id,
      coalesce(auth.users.email, shop_members.display_name, '') as email,
      shop_members.display_name,
      shop_members.role,
      auth.users.last_sign_in_at,
      case
        when auth.users.email_confirmed_at is null then 'unconfirmed'
        when auth.users.banned_until is not null and auth.users.banned_until > now() then 'blocked'
        else 'active'
      end as status,
      shop_members.created_at,
      shop_members.updated_at
    from public.shop_members
    left join public.shop_profiles on shop_profiles.shop_id = shop_members.shop_id
    left join auth.users on auth.users.id = shop_members.user_id
  ),
  activity_rows as (
    select
      job_events.created_at,
      job_events.shop_id,
      shop_profiles.shop_name,
      job_events.job_id::text as subject_id,
      job_events.event_type,
      job_events.event_label,
      coalesce(job_events.event_note, '') as event_note,
      job_events.event_data
    from public.job_events
    left join public.shop_profiles on shop_profiles.shop_id = job_events.shop_id

    union all

    select
      payment_events.created_at,
      payment_events.shop_id,
      shop_profiles.shop_name,
      payment_events.id::text as subject_id,
      'payment_added',
      'Payment added',
      coalesce(payment_events.payment_method_code, ''),
      jsonb_build_object(
        'amountMinor', payment_events.amount_minor,
        'currencyCode', payment_events.currency_code,
        'status', payment_events.payment_status
      )
    from public.payment_events
    left join public.shop_profiles on shop_profiles.shop_id = payment_events.shop_id

    union all

    select
      customer_messages.created_at,
      jobs.shop_id,
      shop_profiles.shop_name,
      customer_messages.id::text as subject_id,
      'customer_message_sent',
      initcap(customer_messages.channel) || ' message ' || customer_messages.status,
      coalesce(customer_messages.recipient, ''),
      jsonb_build_object(
        'channel', customer_messages.channel,
        'status', customer_messages.status,
        'templateKey', customer_messages.template_key
      )
    from public.customer_messages
    join public.jobs on jobs.id = customer_messages.job_id
    left join public.shop_profiles on shop_profiles.shop_id = jobs.shop_id

    union all

    select
      shop_profiles.onboarded_at,
      shop_profiles.shop_id,
      shop_profiles.shop_name,
      shop_profiles.shop_id,
      'onboarding_completed',
      'Onboarding completed',
      coalesce(shop_profiles.shop_name, ''),
      '{}'::jsonb
    from public.shop_profiles
    where shop_profiles.onboarded_at is not null
  ),
  limited_activity as (
    select *
    from activity_rows
    order by created_at desc
    limit 50
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'totalBetaShops', (select count(*) from shop_rows),
      'activeUsers', (select count(distinct user_id) from member_rows where status = 'active'),
      'trialingShops', (select count(*) from shop_rows where subscription_status = 'trialing'),
      'betaBypassShops', (select count(*) from shop_rows where subscription_status = 'beta_bypass'),
      'graceOrReadOnlyShops', (select count(*) from shop_rows where subscription_status in ('grace', 'read_only', 'canceled')),
      'totalStorageBytes', coalesce((select sum(storage_bytes) from shop_rows), 0),
      'totalJobs', coalesce((select sum(job_count) from shop_rows), 0),
      'recentActivityCount', (select count(*) from limited_activity),
      'failedUploadCount', coalesce((select sum(failed_upload_count) from shop_rows), 0)
    ),
    'shops', coalesce((
      select jsonb_agg(to_jsonb(shop_rows) order by last_activity_at desc nulls last)
      from shop_rows
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(to_jsonb(member_rows) order by last_sign_in_at desc nulls last, created_at desc)
      from member_rows
    ), '[]'::jsonb),
    'usage', coalesce((
      select jsonb_agg(to_jsonb(shop_rows) order by storage_bytes desc, job_count desc)
      from shop_rows
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(to_jsonb(limited_activity) order by created_at desc)
      from limited_activity
    ), '[]'::jsonb)
  )
  into payload;

  return payload;
end;
$$;

revoke all on function public.get_beta_operator_dashboard() from public, anon;
grant execute on function public.get_beta_operator_dashboard() to authenticated;
