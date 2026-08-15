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
  cursor_row public.stripe_subscription_sync_cursors%rowtype;
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

  select *
  into cursor_row
  from public.stripe_subscription_sync_cursors
  where shop_id = p_shop_id
  for update;

  if cursor_row.shop_id is not null then
    if cursor_row.last_started_event_created_at is not null
      and (
        p_stripe_event_created_at is null
        or p_stripe_event_created_at < cursor_row.last_started_event_created_at
      ) then
      return 0;
    end if;

    update public.stripe_subscription_sync_cursors
    set generation = generation + 1,
        last_started_event_id = p_stripe_event_id,
        last_started_event_created_at = p_stripe_event_created_at,
        updated_at = pg_catalog.now()
    where shop_id = p_shop_id
    returning generation into next_generation;

    return next_generation;
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
  returning generation into next_generation;

  return next_generation;
end;
$$;

revoke all on function public.begin_stripe_subscription_sync(text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.begin_stripe_subscription_sync(text, text, timestamptz)
  to service_role;
