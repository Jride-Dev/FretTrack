-- Pro email scheduling foundation.
-- Resend owns delivery timing for this initial, transactional-email slice.

insert into public.plan_entitlements (plan_id, key, value)
values
  ('free', 'scheduled_email', 'false'::jsonb),
  ('solo', 'scheduled_email', 'false'::jsonb),
  ('shop', 'scheduled_email', 'false'::jsonb),
  ('pro', 'scheduled_email', 'true'::jsonb),
  ('enterprise', 'scheduled_email', 'true'::jsonb),
  ('trial', 'scheduled_email', 'false'::jsonb)
on conflict (plan_id, key) do update
set value = excluded.value,
    updated_at = now();

alter table public.customer_messages
  add column if not exists scheduled_at timestamptz,
  add column if not exists canceled_at timestamptz;

alter table public.customer_messages
  drop constraint if exists customer_messages_status_check;

alter table public.customer_messages
  add constraint customer_messages_status_check
  check (status in ('sent', 'failed', 'scheduled', 'canceled'));

alter table public.customer_messages
  drop constraint if exists customer_messages_schedule_state_check;

alter table public.customer_messages
  add constraint customer_messages_schedule_state_check
  check (
    (status = 'scheduled' and scheduled_at is not null and sent_at is null and canceled_at is null)
    or
    (status = 'canceled' and scheduled_at is not null and sent_at is null and canceled_at is not null)
    or
    (status in ('sent', 'failed') and canceled_at is null)
  );

create index if not exists customer_messages_scheduled_at_idx
  on public.customer_messages (scheduled_at)
  where status = 'scheduled';

-- Scheduled/canceled provider state is written only by the service-role Edge
-- Function. Authenticated clients retain their existing access to ordinary
-- sent/failed message records and cannot forge provider scheduling state.
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
  )
  with check (
    private.can_write_job(job_id)
    and status in ('sent', 'failed')
    and scheduled_at is null
    and canceled_at is null
  );
