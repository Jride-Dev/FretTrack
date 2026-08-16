-- Make provider email operations durable and idempotent before any external
-- side effect occurs. Nullable columns preserve all historical message rows.

alter table public.customer_messages
  add column if not exists request_id uuid,
  add column if not exists quota_request_id uuid,
  add column if not exists operation_key text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists provider_last_event text,
  add column if not exists provider_event_at timestamptz;

alter table public.customer_messages
  drop constraint if exists customer_messages_status_check;

alter table public.customer_messages
  add constraint customer_messages_status_check
  check (status in ('pending', 'sent', 'failed', 'scheduled', 'canceling', 'canceled'));

alter table public.customer_messages
  drop constraint if exists customer_messages_schedule_state_check;

alter table public.customer_messages
  add constraint customer_messages_schedule_state_check
  check (
    (status = 'pending' and sent_at is null and canceled_at is null)
    or
    (status = 'scheduled' and scheduled_at is not null and sent_at is null and canceled_at is null and cancel_requested_at is null)
    or
    (status = 'canceling' and scheduled_at is not null and sent_at is null and canceled_at is null and cancel_requested_at is not null)
    or
    (status = 'canceled' and scheduled_at is not null and sent_at is null and canceled_at is not null and cancel_requested_at is not null)
    or
    (status = 'sent' and canceled_at is null)
    or
    (status = 'failed' and canceled_at is null)
  );

create unique index if not exists customer_messages_email_request_id_uidx
  on public.customer_messages (request_id)
  where channel = 'email' and request_id is not null;

create unique index if not exists customer_messages_scheduled_operation_uidx
  on public.customer_messages (job_id, operation_key)
  where channel = 'email'
    and scheduled_at is not null
    and operation_key is not null
    and status in ('pending', 'scheduled', 'canceling', 'sent');

create index if not exists customer_messages_provider_reconciliation_idx
  on public.customer_messages (job_id, provider, status, scheduled_at)
  where channel = 'email' and status in ('scheduled', 'canceling');

-- Provider-operation fields remain service-owned. Authenticated writers may
-- retain ordinary sent/failed history behavior but cannot claim request IDs,
-- in-flight states, or provider reconciliation metadata.
drop policy if exists "customer_messages_insert_writer" on public.customer_messages;
create policy "customer_messages_insert_writer"
  on public.customer_messages
  for insert
  to authenticated
  with check (
    private.can_write_job(job_id)
    and status in ('sent', 'failed')
    and scheduled_at is null
    and canceled_at is null
    and request_id is null
    and quota_request_id is null
    and operation_key is null
    and processing_started_at is null
    and cancel_requested_at is null
    and provider_last_event is null
    and provider_event_at is null
  );

drop policy if exists "customer_messages_update_writer" on public.customer_messages;
create policy "customer_messages_update_writer"
  on public.customer_messages
  for update
  to authenticated
  using (
    private.can_write_job(job_id)
    and status in ('sent', 'failed')
    and scheduled_at is null
    and canceled_at is null
    and request_id is null
    and operation_key is null
  )
  with check (
    private.can_write_job(job_id)
    and status in ('sent', 'failed')
    and scheduled_at is null
    and canceled_at is null
    and request_id is null
    and quota_request_id is null
    and operation_key is null
    and processing_started_at is null
    and cancel_requested_at is null
    and provider_last_event is null
    and provider_event_at is null
  );

comment on column public.customer_messages.request_id is
  'Stable client operation ID used for provider and history idempotency.';
comment on column public.customer_messages.quota_request_id is
  'Usage reservation associated with the current provider attempt.';
comment on column public.customer_messages.operation_key is
  'Server-computed fingerprint that prevents concurrent duplicate scheduled messages.';
comment on column public.customer_messages.processing_started_at is
  'Start of the current provider attempt; pending rows survive indeterminate provider outcomes.';
comment on column public.customer_messages.cancel_requested_at is
  'Durable cancellation intent written before the provider cancellation request.';
