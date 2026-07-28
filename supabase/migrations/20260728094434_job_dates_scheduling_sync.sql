alter table public.jobs
  add column if not exists drop_off_at timestamptz;

alter table public.schedule_events
  add column if not exists generated_event_kind text;

alter table public.schedule_events
  drop constraint if exists schedule_events_generated_event_kind_check;

alter table public.schedule_events
  add constraint schedule_events_generated_event_kind_check
  check (generated_event_kind is null or generated_event_kind in ('job_drop_off', 'job_due'));

alter table public.schedule_events
  drop constraint if exists schedule_events_generated_event_job_check;

alter table public.schedule_events
  add constraint schedule_events_generated_event_job_check
  check (generated_event_kind is null or job_id is not null);

create unique index if not exists schedule_events_generated_job_date_key
  on public.schedule_events (shop_id, job_id, generated_event_kind)
  where generated_event_kind is not null;

alter table public.jobs
  drop constraint if exists jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check
  check (status in ('Drop Off', 'Checked In', 'On Bench', 'Waiting Parts', 'Completed', 'Picked Up', 'Cancelled'));

create or replace function private.capture_job_drop_off_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- create_job_with_number already accepts tech_details JSON. This key carries the
  -- new value through that existing RPC while drop_off_at remains authoritative.
  if new.tech_details ? 'dropOffAt' then
    new.drop_off_at := nullif(new.tech_details->>'dropOffAt', '')::timestamptz;
  end if;
  return new;
end;
$$;

revoke all on function private.capture_job_drop_off_at() from public;
revoke all on function private.capture_job_drop_off_at() from anon;
revoke all on function private.capture_job_drop_off_at() from authenticated;

drop trigger if exists jobs_capture_drop_off_at on public.jobs;
create trigger jobs_capture_drop_off_at
  before insert or update of drop_off_at, tech_details
  on public.jobs
  for each row
  execute function private.capture_job_drop_off_at();

create or replace function private.sync_job_date_schedule_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_subject text;
  drop_off_title text;
  due_title text;
begin
  event_subject := concat_ws(
    ' – ',
    nullif(btrim(new.customer_name), ''),
    nullif(btrim(concat_ws(' ', nullif(new.guitar_brand, ''), nullif(new.model, ''))), '')
  );

  if event_subject = '' then
    event_subject := coalesce(nullif('Job #' || new.job_number, 'Job #'), 'Job');
  end if;

  drop_off_title := 'Drop Off: ' || event_subject;
  due_title := 'Due: ' || event_subject;

  if new.drop_off_at is null then
    delete from public.schedule_events
    where shop_id = new.shop_id
      and job_id = new.id
      and generated_event_kind = 'job_drop_off';
  else
    insert into public.schedule_events (
      shop_id,
      job_id,
      customer_id,
      title,
      event_type,
      starts_at,
      all_day,
      status,
      generated_event_kind,
      created_by
    )
    values (
      new.shop_id,
      new.id,
      new.customer_id,
      drop_off_title,
      'intake',
      new.drop_off_at,
      false,
      'scheduled',
      'job_drop_off',
      auth.uid()
    )
    on conflict (shop_id, job_id, generated_event_kind)
      where generated_event_kind is not null
    do update set
      customer_id = excluded.customer_id,
      title = excluded.title,
      event_type = excluded.event_type,
      starts_at = excluded.starts_at,
      all_day = excluded.all_day,
      updated_at = now();
  end if;

  if new.promise_date is null then
    delete from public.schedule_events
    where shop_id = new.shop_id
      and job_id = new.id
      and generated_event_kind = 'job_due';
  else
    insert into public.schedule_events (
      shop_id,
      job_id,
      customer_id,
      title,
      event_type,
      starts_at,
      all_day,
      status,
      generated_event_kind,
      created_by
    )
    values (
      new.shop_id,
      new.id,
      new.customer_id,
      due_title,
      'due',
      (new.promise_date + time '12:00') at time zone 'UTC',
      true,
      'scheduled',
      'job_due',
      auth.uid()
    )
    on conflict (shop_id, job_id, generated_event_kind)
      where generated_event_kind is not null
    do update set
      customer_id = excluded.customer_id,
      title = excluded.title,
      event_type = excluded.event_type,
      starts_at = excluded.starts_at,
      all_day = excluded.all_day,
      updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function private.sync_job_date_schedule_events() from public;
revoke all on function private.sync_job_date_schedule_events() from anon;
revoke all on function private.sync_job_date_schedule_events() from authenticated;

drop trigger if exists jobs_sync_date_schedule_events on public.jobs;
create trigger jobs_sync_date_schedule_events
  after insert or update of
    drop_off_at,
    promise_date,
    customer_id,
    customer_name,
    guitar_brand,
    model,
    job_number
  on public.jobs
  for each row
  execute function private.sync_job_date_schedule_events();

create or replace function private.delete_generated_job_schedule_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.schedule_events
  where shop_id = old.shop_id
    and job_id = old.id
    and generated_event_kind is not null;
  return old;
end;
$$;

revoke all on function private.delete_generated_job_schedule_events() from public;
revoke all on function private.delete_generated_job_schedule_events() from anon;
revoke all on function private.delete_generated_job_schedule_events() from authenticated;

drop trigger if exists jobs_delete_generated_schedule_events on public.jobs;
create trigger jobs_delete_generated_schedule_events
  before delete on public.jobs
  for each row
  execute function private.delete_generated_job_schedule_events();

insert into public.schedule_events (
  shop_id,
  job_id,
  customer_id,
  title,
  event_type,
  starts_at,
  all_day,
  status,
  generated_event_kind,
  created_by
)
select
  jobs.shop_id,
  jobs.id,
  jobs.customer_id,
  'Due: ' || coalesce(
    nullif(
      concat_ws(
        ' – ',
        nullif(btrim(jobs.customer_name), ''),
        nullif(btrim(concat_ws(' ', nullif(jobs.guitar_brand, ''), nullif(jobs.model, ''))), '')
      ),
      ''
    ),
    nullif('Job #' || jobs.job_number, 'Job #'),
    'Job'
  ),
  'due',
  (jobs.promise_date + time '12:00') at time zone 'UTC',
  true,
  'scheduled',
  'job_due',
  null
from public.jobs
where jobs.promise_date is not null
on conflict (shop_id, job_id, generated_event_kind)
  where generated_event_kind is not null
do update set
  customer_id = excluded.customer_id,
  title = excluded.title,
  event_type = excluded.event_type,
  starts_at = excluded.starts_at,
  all_day = excluded.all_day,
  updated_at = now();
