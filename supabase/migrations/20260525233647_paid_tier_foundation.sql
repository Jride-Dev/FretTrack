create table if not exists public.plans (
  id text primary key,
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  description text not null default '',
  monthly_price_cents integer check (monthly_price_cents is null or monthly_price_cents >= 0),
  currency_code text not null default 'USD',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_entitlements (
  plan_id text not null references public.plans(id) on delete cascade,
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, key)
);

create table if not exists public.shop_subscriptions (
  shop_id text primary key references public.shop_profiles(shop_id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null check (status in ('trialing', 'active', 'grace', 'read_only', 'canceled', 'beta_bypass')),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  grace_ends_at timestamptz,
  billing_email text not null default '',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_entitlement_overrides (
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  key text not null,
  value jsonb not null,
  reason text not null default '',
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shop_id, key)
);

create table if not exists public.shop_usage_snapshots (
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  measured_at timestamptz not null default now(),
  user_count integer not null default 0 check (user_count >= 0),
  storage_bytes bigint not null default 0 check (storage_bytes >= 0),
  job_count integer not null default 0 check (job_count >= 0),
  email_count_month integer not null default 0 check (email_count_month >= 0),
  sms_count_month integer not null default 0 check (sms_count_month >= 0),
  primary key (shop_id, measured_at)
);

create index if not exists plan_entitlements_key_idx
  on public.plan_entitlements (key);

create index if not exists shop_subscriptions_status_idx
  on public.shop_subscriptions (status);

create index if not exists shop_entitlement_overrides_expires_idx
  on public.shop_entitlement_overrides (expires_at);

create index if not exists shop_usage_snapshots_latest_idx
  on public.shop_usage_snapshots (shop_id, measured_at desc);

alter table public.plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.shop_subscriptions enable row level security;
alter table public.shop_entitlement_overrides enable row level security;
alter table public.shop_usage_snapshots enable row level security;

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row
  execute function public.set_updated_at();

drop trigger if exists plan_entitlements_set_updated_at on public.plan_entitlements;
create trigger plan_entitlements_set_updated_at
  before update on public.plan_entitlements
  for each row
  execute function public.set_updated_at();

drop trigger if exists shop_subscriptions_set_updated_at on public.shop_subscriptions;
create trigger shop_subscriptions_set_updated_at
  before update on public.shop_subscriptions
  for each row
  execute function public.set_updated_at();

drop trigger if exists shop_entitlement_overrides_set_updated_at on public.shop_entitlement_overrides;
create trigger shop_entitlement_overrides_set_updated_at
  before update on public.shop_entitlement_overrides
  for each row
  execute function public.set_updated_at();

drop policy if exists "plans_select_admin_subscribed" on public.plans;
create policy "plans_select_admin_subscribed"
  on public.plans
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.shop_subscriptions
      where shop_subscriptions.plan_id = plans.id
        and private.can_admin_shop(shop_subscriptions.shop_id)
    )
  );

drop policy if exists "plan_entitlements_select_admin_subscribed" on public.plan_entitlements;
create policy "plan_entitlements_select_admin_subscribed"
  on public.plan_entitlements
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.shop_subscriptions
      where shop_subscriptions.plan_id = plan_entitlements.plan_id
        and private.can_admin_shop(shop_subscriptions.shop_id)
    )
  );

drop policy if exists "shop_subscriptions_select_admin" on public.shop_subscriptions;
create policy "shop_subscriptions_select_admin"
  on public.shop_subscriptions
  for select
  to authenticated
  using (private.can_admin_shop(shop_id));

drop policy if exists "shop_entitlement_overrides_select_admin" on public.shop_entitlement_overrides;
create policy "shop_entitlement_overrides_select_admin"
  on public.shop_entitlement_overrides
  for select
  to authenticated
  using (private.can_admin_shop(shop_id));

drop policy if exists "shop_usage_snapshots_select_admin" on public.shop_usage_snapshots;
create policy "shop_usage_snapshots_select_admin"
  on public.shop_usage_snapshots
  for select
  to authenticated
  using (private.can_admin_shop(shop_id));

revoke all on public.plans from anon, public;
revoke all on public.plan_entitlements from anon, public;
revoke all on public.shop_subscriptions from anon, public;
revoke all on public.shop_entitlement_overrides from anon, public;
revoke all on public.shop_usage_snapshots from anon, public;

grant select on public.plans to authenticated;
grant select on public.plan_entitlements to authenticated;
grant select on public.shop_subscriptions to authenticated;
grant select on public.shop_entitlement_overrides to authenticated;
grant select on public.shop_usage_snapshots to authenticated;

insert into public.plans (id, name, status, description, monthly_price_cents, currency_code, sort_order)
values
  ('trial', 'Beta / Trial', 'active', 'Controlled trial access for repair shops evaluating FretTrack.', 0, 'USD', 10),
  ('solo', 'Solo Shop', 'active', 'Core repair workflow for one-owner and very small shops.', null, 'USD', 20),
  ('pro', 'Shop Pro', 'active', 'Expanded users, storage, reporting, and future paid modules.', null, 'USD', 30)
on conflict (id) do update
set
  name = excluded.name,
  status = excluded.status,
  description = excluded.description,
  monthly_price_cents = excluded.monthly_price_cents,
  currency_code = excluded.currency_code,
  sort_order = excluded.sort_order,
  updated_at = now();

with entitlement_seed(plan_id, key, value) as (
  values
    ('trial', 'core_jobs', 'true'::jsonb),
    ('trial', 'customers', 'true'::jsonb),
    ('trial', 'photos', 'true'::jsonb),
    ('trial', 'reports', 'true'::jsonb),
    ('trial', 'csv_export', 'true'::jsonb),
    ('trial', 'email_messages', 'true'::jsonb),
    ('trial', 'sms_messages', 'false'::jsonb),
    ('trial', 'inventory', 'false'::jsonb),
    ('trial', 'advanced_accounting', 'false'::jsonb),
    ('trial', 'advanced_branding', 'false'::jsonb),
    ('trial', 'api_access', 'false'::jsonb),
    ('trial', 'max_users', '2'::jsonb),
    ('trial', 'max_storage_bytes', '1073741824'::jsonb),
    ('trial', 'monthly_email_limit', '250'::jsonb),
    ('trial', 'monthly_sms_limit', '0'::jsonb),
    ('solo', 'core_jobs', 'true'::jsonb),
    ('solo', 'customers', 'true'::jsonb),
    ('solo', 'photos', 'true'::jsonb),
    ('solo', 'reports', 'true'::jsonb),
    ('solo', 'csv_export', 'true'::jsonb),
    ('solo', 'email_messages', 'true'::jsonb),
    ('solo', 'sms_messages', 'false'::jsonb),
    ('solo', 'inventory', 'false'::jsonb),
    ('solo', 'advanced_accounting', 'false'::jsonb),
    ('solo', 'advanced_branding', 'false'::jsonb),
    ('solo', 'api_access', 'false'::jsonb),
    ('solo', 'max_users', '2'::jsonb),
    ('solo', 'max_storage_bytes', '5368709120'::jsonb),
    ('solo', 'monthly_email_limit', '1000'::jsonb),
    ('solo', 'monthly_sms_limit', '0'::jsonb),
    ('pro', 'core_jobs', 'true'::jsonb),
    ('pro', 'customers', 'true'::jsonb),
    ('pro', 'photos', 'true'::jsonb),
    ('pro', 'reports', 'true'::jsonb),
    ('pro', 'csv_export', 'true'::jsonb),
    ('pro', 'email_messages', 'true'::jsonb),
    ('pro', 'sms_messages', 'false'::jsonb),
    ('pro', 'inventory', 'false'::jsonb),
    ('pro', 'advanced_accounting', 'false'::jsonb),
    ('pro', 'advanced_branding', 'true'::jsonb),
    ('pro', 'api_access', 'false'::jsonb),
    ('pro', 'max_users', '5'::jsonb),
    ('pro', 'max_storage_bytes', '26843545600'::jsonb),
    ('pro', 'monthly_email_limit', '5000'::jsonb),
    ('pro', 'monthly_sms_limit', '0'::jsonb)
)
insert into public.plan_entitlements (plan_id, key, value)
select plan_id, key, value
from entitlement_seed
on conflict (plan_id, key) do update
set value = excluded.value,
    updated_at = now();

insert into public.shop_subscriptions (
  shop_id,
  plan_id,
  status,
  trial_ends_at,
  grace_ends_at,
  billing_email
)
select
  shop_profiles.shop_id,
  'trial',
  'trialing',
  now() + interval '30 days',
  now() + interval '44 days',
  shop_profiles.email
from public.shop_profiles
left join public.shop_subscriptions existing
  on existing.shop_id = shop_profiles.shop_id
where existing.shop_id is null;

create or replace function public.get_shop_entitlement_snapshot(target_shop_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  subscription_row public.shop_subscriptions%rowtype;
  plan_row public.plans%rowtype;
  entitlement_values jsonb := '{}'::jsonb;
  override_values jsonb := '{}'::jsonb;
  effective_entitlements jsonb := '{}'::jsonb;
  effective_status text;
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
  into subscription_row
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  if subscription_row.shop_id is null then
    subscription_row.shop_id := target_shop_id;
    subscription_row.plan_id := 'trial';
    subscription_row.status := 'trialing';
    subscription_row.trial_ends_at := now() + interval '30 days';
    subscription_row.grace_ends_at := now() + interval '44 days';
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

  effective_entitlements := entitlement_values || override_values;
  effective_status := subscription_row.status;

  if effective_status = 'trialing' and subscription_row.trial_ends_at is not null and subscription_row.trial_ends_at < now() then
    if subscription_row.grace_ends_at is not null and subscription_row.grace_ends_at > now() then
      effective_status := 'grace';
    else
      effective_status := 'read_only';
    end if;
  end if;

  if effective_status = 'canceled' then
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
      'id', coalesce(plan_row.id, subscription_row.plan_id),
      'name', coalesce(plan_row.name, initcap(subscription_row.plan_id)),
      'status', coalesce(plan_row.status, 'active')
    ),
    'subscription', jsonb_build_object(
      'status', subscription_row.status,
      'effectiveStatus', effective_status,
      'trialEndsAt', subscription_row.trial_ends_at,
      'currentPeriodEndsAt', subscription_row.current_period_ends_at,
      'graceEndsAt', subscription_row.grace_ends_at,
      'billingEmail', subscription_row.billing_email
    ),
    'entitlements', effective_entitlements,
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
      'canUploadPhotos', can_write and coalesce((effective_entitlements->>'photos')::boolean, false),
      'canSendEmail', can_write and coalesce((effective_entitlements->>'email_messages')::boolean, false),
      'canSendSms', can_write and coalesce((effective_entitlements->>'sms_messages')::boolean, false),
      'canUseReports', coalesce((effective_entitlements->>'reports')::boolean, false),
      'canExportCsv', coalesce((effective_entitlements->>'csv_export')::boolean, false)
    )
  );
end;
$$;

revoke all on function public.get_shop_entitlement_snapshot(text) from public, anon;
grant execute on function public.get_shop_entitlement_snapshot(text) to authenticated;
