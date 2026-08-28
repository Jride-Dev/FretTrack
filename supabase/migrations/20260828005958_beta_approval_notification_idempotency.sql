create table if not exists private.beta_approval_notification_deliveries (
  request_id uuid primary key references public.beta_access_requests(id) on delete cascade,
  state text not null default 'sending'
    check (state in ('sending', 'sent', 'failed', 'indeterminate')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  idempotency_key text not null unique,
  recipient_email text not null,
  from_email text not null,
  subject text not null,
  body_text text not null,
  attempt_started_at timestamptz not null default pg_catalog.now(),
  completed_at timestamptz,
  provider_message_id text not null default '',
  last_error text not null default ''
);

alter table private.beta_approval_notification_deliveries enable row level security;

revoke all on table private.beta_approval_notification_deliveries
  from public, anon, authenticated, service_role;

create or replace function public.begin_beta_approval_notification(
  p_request_id uuid,
  p_recipient_email text,
  p_from_email text,
  p_subject text,
  p_body_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.beta_access_requests%rowtype;
  delivery_row private.beta_approval_notification_deliveries%rowtype;
  clean_recipient text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_recipient_email, '')));
  clean_from text := pg_catalog.btrim(coalesce(p_from_email, ''));
  clean_subject text := pg_catalog.btrim(coalesce(p_subject, ''));
  clean_body text := coalesce(p_body_text, '');
  next_attempt integer;
begin
  if p_request_id is null then
    raise exception 'Approval request id is required.';
  end if;

  if clean_recipient = '' or pg_catalog.length(clean_recipient) > 320
    or clean_from = '' or pg_catalog.length(clean_from) > 320
    or clean_subject = '' or pg_catalog.length(clean_subject) > 300
    or clean_body = '' or pg_catalog.length(clean_body) > 20000 then
    raise exception 'Approval notification snapshot is invalid.';
  end if;

  select *
  into request_row
  from public.beta_access_requests
  where id = p_request_id
  for update;

  if request_row.id is null then
    raise exception 'Approval request was not found.';
  end if;

  if request_row.status <> 'approved' then
    return pg_catalog.jsonb_build_object('action', 'skipped');
  end if;

  if request_row.approved_notified_at is not null then
    return pg_catalog.jsonb_build_object('action', 'sent');
  end if;

  select *
  into delivery_row
  from private.beta_approval_notification_deliveries
  where request_id = p_request_id
  for update;

  if delivery_row.request_id is null then
    insert into private.beta_approval_notification_deliveries (
      request_id,
      state,
      attempt_count,
      idempotency_key,
      recipient_email,
      from_email,
      subject,
      body_text,
      attempt_started_at
    )
    values (
      p_request_id,
      'sending',
      1,
      'frettrack-beta-approval/' || p_request_id::text || '/1',
      clean_recipient,
      clean_from,
      clean_subject,
      clean_body,
      pg_catalog.now()
    )
    returning * into delivery_row;

    return pg_catalog.jsonb_build_object(
      'action', 'send',
      'idempotencyKey', delivery_row.idempotency_key,
      'to', delivery_row.recipient_email,
      'from', delivery_row.from_email,
      'subject', delivery_row.subject,
      'text', delivery_row.body_text
    );
  end if;

  if delivery_row.state = 'sent' then
    return pg_catalog.jsonb_build_object('action', 'sent');
  end if;

  if delivery_row.state = 'indeterminate' then
    return pg_catalog.jsonb_build_object('action', 'indeterminate');
  end if;

  if delivery_row.state = 'sending' then
    if delivery_row.attempt_started_at < pg_catalog.now() - interval '23 hours' then
      update private.beta_approval_notification_deliveries
      set state = 'indeterminate',
          completed_at = pg_catalog.now(),
          last_error = 'Provider acceptance could not be confirmed inside the idempotency window.'
      where request_id = p_request_id
      returning * into delivery_row;

      return pg_catalog.jsonb_build_object('action', 'indeterminate');
    end if;

    return pg_catalog.jsonb_build_object(
      'action', 'resume',
      'idempotencyKey', delivery_row.idempotency_key,
      'to', delivery_row.recipient_email,
      'from', delivery_row.from_email,
      'subject', delivery_row.subject,
      'text', delivery_row.body_text
    );
  end if;

  next_attempt := delivery_row.attempt_count + 1;
  update private.beta_approval_notification_deliveries
  set state = 'sending',
      attempt_count = next_attempt,
      idempotency_key = 'frettrack-beta-approval/' || p_request_id::text || '/' || next_attempt::text,
      recipient_email = clean_recipient,
      from_email = clean_from,
      subject = clean_subject,
      body_text = clean_body,
      attempt_started_at = pg_catalog.now(),
      completed_at = null,
      provider_message_id = '',
      last_error = ''
  where request_id = p_request_id
  returning * into delivery_row;

  return pg_catalog.jsonb_build_object(
    'action', 'send',
    'idempotencyKey', delivery_row.idempotency_key,
    'to', delivery_row.recipient_email,
    'from', delivery_row.from_email,
    'subject', delivery_row.subject,
    'text', delivery_row.body_text
  );
end;
$$;

create or replace function public.finalize_beta_approval_notification(
  p_request_id uuid,
  p_idempotency_key text,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_row private.beta_approval_notification_deliveries%rowtype;
begin
  if p_request_id is null
    or nullif(pg_catalog.btrim(coalesce(p_idempotency_key, '')), '') is null
    or nullif(pg_catalog.btrim(coalesce(p_provider_message_id, '')), '') is null then
    raise exception 'Approval delivery identity is required.';
  end if;

  update private.beta_approval_notification_deliveries
  set state = 'sent',
      completed_at = pg_catalog.now(),
      provider_message_id = pg_catalog.btrim(p_provider_message_id),
      last_error = ''
  where request_id = p_request_id
    and idempotency_key = p_idempotency_key
    and state = 'sending'
  returning * into delivery_row;

  if delivery_row.request_id is null then
    select *
    into delivery_row
    from private.beta_approval_notification_deliveries
    where request_id = p_request_id
      and idempotency_key = p_idempotency_key
      and state = 'sent';
  end if;

  if delivery_row.request_id is null then
    return false;
  end if;

  update public.beta_access_requests
  set approved_notified_at = coalesce(approved_notified_at, delivery_row.completed_at, pg_catalog.now())
  where id = p_request_id;

  return found;
end;
$$;

create or replace function public.fail_beta_approval_notification(
  p_request_id uuid,
  p_idempotency_key text,
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
  update private.beta_approval_notification_deliveries
  set state = 'failed',
      completed_at = pg_catalog.now(),
      last_error = pg_catalog.left(coalesce(p_error_message, 'Approval notification was rejected.'), 1000)
  where request_id = p_request_id
    and idempotency_key = p_idempotency_key
    and state = 'sending';

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.begin_beta_approval_notification(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.finalize_beta_approval_notification(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.fail_beta_approval_notification(uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.begin_beta_approval_notification(uuid, text, text, text, text)
  to service_role;
grant execute on function public.finalize_beta_approval_notification(uuid, text, text)
  to service_role;
grant execute on function public.fail_beta_approval_notification(uuid, text, text)
  to service_role;
