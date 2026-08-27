alter table public.stripe_webhook_events
  add column if not exists processing_token uuid,
  add column if not exists processing_started_at timestamptz,
  add column if not exists attempt_count integer not null default 0;

alter table public.stripe_webhook_events
  alter column processed_at drop not null,
  alter column processed_at drop default;

alter table public.stripe_webhook_events
  drop constraint if exists stripe_webhook_events_status_check;

alter table public.stripe_webhook_events
  add constraint stripe_webhook_events_status_check
  check (status in ('processing', 'processed', 'ignored', 'failed'));

alter table public.stripe_webhook_events
  drop constraint if exists stripe_webhook_events_attempt_count_check;

alter table public.stripe_webhook_events
  add constraint stripe_webhook_events_attempt_count_check
  check (attempt_count >= 0);

create or replace function public.claim_stripe_webhook_event(
  p_stripe_event_id text,
  p_event_type text,
  p_stripe_event_created_at timestamptz,
  p_livemode boolean,
  p_processing_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
  affected_rows bigint := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the Stripe webhook service may claim events.'
      using errcode = '42501';
  end if;

  if nullif(pg_catalog.btrim(p_stripe_event_id), '') is null
    or nullif(pg_catalog.btrim(p_event_type), '') is null
    or p_processing_token is null then
    raise exception 'Stripe event id, event type, and processing token are required.';
  end if;

  insert into public.stripe_webhook_events (
    stripe_event_id,
    event_type,
    stripe_event_created_at,
    livemode,
    processed_at,
    status,
    error_message,
    processing_token,
    processing_started_at,
    attempt_count
  )
  values (
    p_stripe_event_id,
    p_event_type,
    p_stripe_event_created_at,
    coalesce(p_livemode, false),
    null,
    'processing',
    '',
    p_processing_token,
    pg_catalog.now(),
    1
  )
  on conflict (stripe_event_id) do nothing;

  get diagnostics affected_rows = row_count;
  if affected_rows = 1 then
    return true;
  end if;

  update public.stripe_webhook_events
  set event_type = p_event_type,
      stripe_event_created_at = p_stripe_event_created_at,
      livemode = coalesce(p_livemode, false),
      processed_at = null,
      status = 'processing',
      error_message = '',
      processing_token = p_processing_token,
      processing_started_at = pg_catalog.now(),
      attempt_count = attempt_count + 1
  where stripe_event_id = p_stripe_event_id
    and status = 'failed';

  get diagnostics affected_rows = row_count;
  claimed := affected_rows = 1;
  return claimed;
end;
$$;

create or replace function public.finalize_stripe_webhook_event(
  p_stripe_event_id text,
  p_processing_token uuid,
  p_status text,
  p_shop_id text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  finalized boolean := false;
  affected_rows bigint := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the Stripe webhook service may finalize events.'
      using errcode = '42501';
  end if;

  if nullif(pg_catalog.btrim(p_stripe_event_id), '') is null
    or p_processing_token is null
    or p_status not in ('processed', 'ignored', 'failed') then
    raise exception 'Stripe event id, processing token, and a terminal status are required.';
  end if;

  update public.stripe_webhook_events
  set processed_at = pg_catalog.now(),
      shop_id = nullif(p_shop_id, ''),
      stripe_customer_id = nullif(p_stripe_customer_id, ''),
      stripe_subscription_id = nullif(p_stripe_subscription_id, ''),
      status = p_status,
      error_message = coalesce(p_error_message, ''),
      processing_token = null,
      processing_started_at = null
  where stripe_event_id = p_stripe_event_id
    and status = 'processing'
    and processing_token = p_processing_token;

  get diagnostics affected_rows = row_count;
  finalized := affected_rows = 1;
  return finalized;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, timestamptz, boolean, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.finalize_stripe_webhook_event(text, uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.claim_stripe_webhook_event(text, text, timestamptz, boolean, uuid)
  to service_role;
grant execute on function public.finalize_stripe_webhook_event(text, uuid, text, text, text, text, text)
  to service_role;
