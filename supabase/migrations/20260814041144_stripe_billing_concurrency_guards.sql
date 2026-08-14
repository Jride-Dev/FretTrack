alter table public.stripe_webhook_events
  add column if not exists stripe_event_created_at timestamptz;

create table if not exists public.stripe_subscription_sync_cursors (
  shop_id text primary key references public.shop_profiles(shop_id) on delete cascade,
  generation bigint not null default 0 check (generation >= 0),
  last_started_event_id text not null default '',
  last_started_event_created_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.stripe_subscription_sync_cursors enable row level security;

revoke all on public.stripe_subscription_sync_cursors from public, anon, authenticated;
grant select, insert, update on public.stripe_subscription_sync_cursors to service_role;

create or replace function public.begin_stripe_subscription_sync(
  p_shop_id text,
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_generation bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the Stripe webhook service may begin subscription synchronization.'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_shop_id), '') is null or nullif(btrim(p_stripe_event_id), '') is null then
    raise exception 'Shop id and Stripe event id are required.';
  end if;

  perform 1
  from public.shop_profiles
  where shop_id = p_shop_id
  for update;

  if not found then
    raise exception 'Shop not found.';
  end if;

  insert into public.stripe_subscription_sync_cursors (
    shop_id,
    generation,
    last_started_event_id,
    last_started_event_created_at,
    updated_at
  )
  values (
    p_shop_id,
    1,
    p_stripe_event_id,
    p_stripe_event_created_at,
    pg_catalog.now()
  )
  on conflict (shop_id) do update
  set generation = public.stripe_subscription_sync_cursors.generation + 1,
      last_started_event_id = excluded.last_started_event_id,
      last_started_event_created_at = excluded.last_started_event_created_at,
      updated_at = pg_catalog.now()
  returning generation into next_generation;

  return next_generation;
end;
$$;

create or replace function public.apply_stripe_subscription_state(
  p_shop_id text,
  p_sync_generation bigint,
  p_stripe_event_id text,
  p_plan_id text,
  p_status text,
  p_trial_ends_at timestamptz,
  p_current_period_starts_at timestamptz,
  p_current_period_ends_at timestamptz,
  p_grace_ends_at timestamptz,
  p_billing_email text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_billing_interval text,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz,
  p_provider_status text,
  p_profile_subscription_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  cursor_row public.stripe_subscription_sync_cursors%rowtype;
  stored_subscription public.shop_subscriptions%rowtype;
  stored_provider_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the Stripe webhook service may apply subscription state.'
      using errcode = '42501';
  end if;

  select *
  into cursor_row
  from public.stripe_subscription_sync_cursors
  where shop_id = p_shop_id
  for update;

  if cursor_row.shop_id is null
    or cursor_row.generation <> p_sync_generation
    or cursor_row.last_started_event_id <> p_stripe_event_id then
    return false;
  end if;

  select *
  into stored_subscription
  from public.shop_subscriptions
  where shop_id = p_shop_id
  for update;

  stored_provider_status := lower(coalesce(
    nullif(stored_subscription.provider_status, ''),
    nullif(stored_subscription.status, ''),
    ''
  ));

  if stored_subscription.shop_id is not null
    and nullif(stored_subscription.stripe_subscription_id, '') is not null
    and stored_subscription.stripe_subscription_id <> p_stripe_subscription_id
    and not (
      stored_provider_status in ('canceled', 'cancelled', 'incomplete_expired')
      and lower(coalesce(p_provider_status, '')) not in ('canceled', 'cancelled', 'incomplete_expired')
    ) then
    return false;
  end if;

  insert into public.shop_subscriptions (
    shop_id,
    plan_id,
    status,
    trial_ends_at,
    current_period_starts_at,
    current_period_ends_at,
    grace_ends_at,
    billing_email,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    billing_interval,
    cancel_at_period_end,
    canceled_at,
    provider_status,
    updated_at
  )
  values (
    p_shop_id,
    p_plan_id,
    p_status,
    p_trial_ends_at,
    p_current_period_starts_at,
    p_current_period_ends_at,
    p_grace_ends_at,
    coalesce(p_billing_email, ''),
    nullif(p_stripe_customer_id, ''),
    nullif(p_stripe_subscription_id, ''),
    nullif(p_stripe_price_id, ''),
    p_billing_interval,
    coalesce(p_cancel_at_period_end, false),
    p_canceled_at,
    p_provider_status,
    pg_catalog.now()
  )
  on conflict (shop_id) do update
  set plan_id = excluded.plan_id,
      status = excluded.status,
      trial_ends_at = excluded.trial_ends_at,
      current_period_starts_at = excluded.current_period_starts_at,
      current_period_ends_at = excluded.current_period_ends_at,
      grace_ends_at = excluded.grace_ends_at,
      billing_email = excluded.billing_email,
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      stripe_price_id = excluded.stripe_price_id,
      billing_interval = excluded.billing_interval,
      cancel_at_period_end = excluded.cancel_at_period_end,
      canceled_at = excluded.canceled_at,
      provider_status = excluded.provider_status,
      updated_at = pg_catalog.now();

  update public.shop_profiles
  set subscription_tier = p_plan_id,
      subscription_status = p_profile_subscription_status,
      trial_ends_at = p_trial_ends_at,
      updated_at = pg_catalog.now()
  where shop_id = p_shop_id;

  return true;
end;
$$;

revoke all on function public.begin_stripe_subscription_sync(text, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.apply_stripe_subscription_state(
  text, bigint, text, text, text, timestamptz, timestamptz, timestamptz,
  timestamptz, text, text, text, text, text, boolean, timestamptz, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.begin_stripe_subscription_sync(text, text, timestamptz)
  to service_role;
grant execute on function public.apply_stripe_subscription_state(
  text, bigint, text, text, text, timestamptz, timestamptz, timestamptz,
  timestamptz, text, text, text, text, text, boolean, timestamptz, text, text
) to service_role;
