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
    and (
      status = 'failed'
      or (
        status = 'processing'
        and coalesce(processing_started_at, '-infinity'::timestamptz)
          <= pg_catalog.now() - interval '5 minutes'
      )
    );

  get diagnostics affected_rows = row_count;
  claimed := affected_rows = 1;
  return claimed;
end;
$$;

create or replace function public.get_stripe_webhook_event_claim_state(
  p_stripe_event_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the Stripe webhook service may inspect event claims.'
      using errcode = '42501';
  end if;

  if nullif(pg_catalog.btrim(p_stripe_event_id), '') is null then
    raise exception 'Stripe event id is required.';
  end if;

  select status
  into event_status
  from public.stripe_webhook_events
  where stripe_event_id = p_stripe_event_id;

  return coalesce(event_status, 'missing');
end;
$$;

create or replace function public.release_stripe_webhook_event_claim(
  p_stripe_event_id text,
  p_processing_token uuid,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows bigint := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the Stripe webhook service may release event claims.'
      using errcode = '42501';
  end if;

  if nullif(pg_catalog.btrim(p_stripe_event_id), '') is null
    or p_processing_token is null then
    raise exception 'Stripe event id and processing token are required.';
  end if;

  update public.stripe_webhook_events
  set processed_at = pg_catalog.now(),
      status = 'failed',
      error_message = coalesce(p_error_message, 'Webhook finalization failed.'),
      processing_token = null,
      processing_started_at = null
  where stripe_event_id = p_stripe_event_id
    and status = 'processing'
    and processing_token = p_processing_token;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, timestamptz, boolean, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_stripe_webhook_event_claim_state(text)
  from public, anon, authenticated, service_role;
revoke all on function public.release_stripe_webhook_event_claim(text, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.claim_stripe_webhook_event(text, text, timestamptz, boolean, uuid)
  to service_role;
grant execute on function public.get_stripe_webhook_event_claim_state(text)
  to service_role;
grant execute on function public.release_stripe_webhook_event_claim(text, uuid, text)
  to service_role;
