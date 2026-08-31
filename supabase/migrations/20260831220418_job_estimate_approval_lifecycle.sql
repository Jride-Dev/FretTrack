alter table public.jobs
  add column if not exists estimate_status text not null default 'draft',
  add column if not exists estimate_snapshot jsonb,
  add column if not exists estimate_revision integer not null default 0,
  add column if not exists estimate_sent_at timestamptz,
  add column if not exists estimate_sent_by uuid,
  add column if not exists estimate_decided_at timestamptz,
  add column if not exists estimate_decided_by uuid,
  add column if not exists estimate_status_note text,
  add column if not exists estimate_last_request_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'jobs_estimate_lifecycle_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_estimate_lifecycle_check
      check (
        (
          estimate_status = 'draft'
          and estimate_snapshot is null
          and estimate_sent_at is null
          and estimate_sent_by is null
          and estimate_decided_at is null
          and estimate_decided_by is null
          and estimate_status_note is null
        )
        or (
          estimate_status = 'sent'
          and pg_catalog.jsonb_typeof(estimate_snapshot) = 'object'
          and estimate_sent_at is not null
          and estimate_sent_by is not null
          and estimate_decided_at is null
          and estimate_decided_by is null
          and char_length(btrim(estimate_status_note)) between 8 and 500
        )
        or (
          estimate_status in ('approved', 'declined')
          and pg_catalog.jsonb_typeof(estimate_snapshot) = 'object'
          and estimate_sent_at is not null
          and estimate_sent_by is not null
          and estimate_decided_at is not null
          and estimate_decided_by is not null
          and char_length(btrim(estimate_status_note)) between 8 and 500
        )
      );
  end if;
end;
$$;

create or replace function private.guard_job_estimate_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  monetary_fields_changed boolean;
  estimate_fields_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.estimate_status <> 'draft'
      or new.estimate_snapshot is not null
      or new.estimate_revision <> 0
      or new.estimate_sent_at is not null
      or new.estimate_sent_by is not null
      or new.estimate_decided_at is not null
      or new.estimate_decided_by is not null
      or new.estimate_status_note is not null
      or new.estimate_last_request_id is not null then
      raise exception 'New work orders must begin with a draft estimate.' using errcode = '42501';
    end if;
    return new;
  end if;

  monetary_fields_changed :=
    coalesce(new.tech_details ->> 'discountType', 'none') is distinct from coalesce(old.tech_details ->> 'discountType', 'none')
    or coalesce(new.tech_details ->> 'discountValue', '') is distinct from coalesce(old.tech_details ->> 'discountValue', '')
    or coalesce(new.tech_details -> 'tax', '{}'::jsonb) is distinct from coalesce(old.tech_details -> 'tax', '{}'::jsonb);
  estimate_fields_changed :=
    new.estimate_status is distinct from old.estimate_status
    or new.estimate_snapshot is distinct from old.estimate_snapshot
    or new.estimate_revision is distinct from old.estimate_revision
    or new.estimate_sent_at is distinct from old.estimate_sent_at
    or new.estimate_sent_by is distinct from old.estimate_sent_by
    or new.estimate_decided_at is distinct from old.estimate_decided_at
    or new.estimate_decided_by is distinct from old.estimate_decided_by
    or new.estimate_status_note is distinct from old.estimate_status_note
    or new.estimate_last_request_id is distinct from old.estimate_last_request_id;

  if estimate_fields_changed
    and pg_catalog.current_setting('frettrack.estimate_rpc', true) is distinct from 'on' then
    raise exception 'Estimate state must use the guarded estimate action.' using errcode = '42501';
  end if;
  if old.estimate_status <> 'draft' and monetary_fields_changed then
    raise exception 'Sent or decided estimate charges are locked. Return the estimate to draft before changing them.' using errcode = '55000';
  end if;
  if old.estimate_status in ('sent', 'declined')
    and old.invoice_finalized_at is null
    and new.invoice_finalized_at is not null then
    raise exception 'Only an approved estimate can be finalized after it has been sent.' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_guard_estimate_mutation on public.jobs;
create trigger jobs_guard_estimate_mutation
  before insert or update on public.jobs
  for each row execute function private.guard_job_estimate_mutation();

create or replace function private.guard_estimate_charge_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job_id uuid := coalesce(new.job_id, old.job_id);
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_job_id::text, 0));
  if exists (
    select 1
    from public.jobs
    where id = target_job_id
      and estimate_status <> 'draft'
  ) then
    raise exception 'Sent or decided estimate parts and services are locked. Return the estimate to draft before changing them.' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists job_parts_guard_estimate on public.job_parts;
create trigger job_parts_guard_estimate
  before insert or update or delete on public.job_parts
  for each row execute function private.guard_estimate_charge_mutation();

drop trigger if exists job_services_guard_estimate on public.job_services;
create trigger job_services_guard_estimate
  before insert or update or delete on public.job_services
  for each row execute function private.guard_estimate_charge_mutation();

create or replace function public.set_job_estimate_state(
  p_job_id uuid,
  p_status text,
  p_note text,
  p_expected_updated_at timestamptz default null,
  p_request_id uuid default gen_random_uuid()
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.jobs%rowtype;
  saved_job public.jobs%rowtype;
  clean_status text := lower(btrim(coalesce(p_status, '')));
  clean_note text := btrim(coalesce(p_note, ''));
  snapshot jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if clean_status not in ('draft', 'sent', 'approved', 'declined') then
    raise exception 'Unsupported estimate state.' using errcode = '22023';
  end if;
  if char_length(clean_note) < 8 or char_length(clean_note) > 500 then
    raise exception 'Enter an estimate audit note between 8 and 500 characters.' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'An estimate request ID is required.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_job_id::text, 0));
  select * into target_job
  from public.jobs
  where id = p_job_id
  for update;

  if target_job.id is null then
    raise exception 'Work order not found.' using errcode = 'P0002';
  end if;
  if not private.has_shop_role(target_job.shop_id, array['owner', 'admin']) then
    raise exception 'Only a shop owner or admin can change estimate state.' using errcode = '42501';
  end if;
  if not private.shop_lifecycle_allows_write(target_job.shop_id) then
    raise exception 'This shop is read-only.' using errcode = '42501';
  end if;
  if target_job.accounting_voided_at is not null then
    raise exception 'An accounting-excluded work order cannot use estimates.' using errcode = '55000';
  end if;
  if target_job.invoice_finalized_at is not null then
    raise exception 'Reopen the finalized invoice before changing estimate state.' using errcode = '55000';
  end if;
  if target_job.estimate_last_request_id = p_request_id then
    return target_job;
  end if;
  if p_expected_updated_at is not null and target_job.updated_at is distinct from p_expected_updated_at then
    raise exception 'This job changed in another session. Reload it before changing the estimate.' using errcode = '40001';
  end if;
  if target_job.estimate_status = clean_status then
    return target_job;
  end if;
  if target_job.estimate_status = 'draft' and clean_status <> 'sent' then
    raise exception 'A draft estimate must be sent before it can be approved or declined.' using errcode = '55000';
  end if;
  if target_job.estimate_status = 'sent' and clean_status not in ('draft', 'approved', 'declined') then
    raise exception 'A sent estimate can only be approved, declined, or returned to draft.' using errcode = '55000';
  end if;
  if target_job.estimate_status in ('approved', 'declined') and clean_status <> 'draft' then
    raise exception 'Return the decided estimate to draft before starting another revision.' using errcode = '55000';
  end if;

  perform pg_catalog.set_config('frettrack.estimate_rpc', 'on', true);
  if clean_status = 'sent' then
    snapshot := private.calculate_job_invoice_snapshot(target_job.id);
    update public.jobs
    set estimate_status = 'sent',
        estimate_snapshot = snapshot,
        estimate_revision = estimate_revision + 1,
        estimate_sent_at = pg_catalog.now(),
        estimate_sent_by = (select auth.uid()),
        estimate_decided_at = null,
        estimate_decided_by = null,
        estimate_status_note = clean_note,
        estimate_last_request_id = p_request_id,
        updated_at = pg_catalog.now()
    where id = target_job.id
    returning * into saved_job;
  elsif clean_status in ('approved', 'declined') then
    update public.jobs
    set estimate_status = clean_status,
        estimate_decided_at = pg_catalog.now(),
        estimate_decided_by = (select auth.uid()),
        estimate_status_note = clean_note,
        estimate_last_request_id = p_request_id,
        updated_at = pg_catalog.now()
    where id = target_job.id
    returning * into saved_job;
  else
    update public.jobs
    set estimate_status = 'draft',
        estimate_snapshot = null,
        estimate_sent_at = null,
        estimate_sent_by = null,
        estimate_decided_at = null,
        estimate_decided_by = null,
        estimate_status_note = null,
        estimate_last_request_id = p_request_id,
        updated_at = pg_catalog.now()
    where id = target_job.id
    returning * into saved_job;
  end if;
  perform pg_catalog.set_config('frettrack.estimate_rpc', 'off', true);

  insert into public.job_events (
    shop_id, job_id, event_type, event_label, event_note, event_data, created_by
  ) values (
    saved_job.shop_id,
    saved_job.id,
    'estimate_' || clean_status,
    case clean_status
      when 'sent' then 'Estimate sent'
      when 'approved' then 'Estimate approved'
      when 'declined' then 'Estimate declined'
      else 'Estimate returned to draft'
    end,
    clean_note,
    pg_catalog.jsonb_build_object(
      'previousStatus', target_job.estimate_status,
      'status', clean_status,
      'revision', saved_job.estimate_revision,
      'requestId', p_request_id,
      'snapshot', coalesce(saved_job.estimate_snapshot, target_job.estimate_snapshot)
    ),
    (select auth.uid())::text
  );

  return saved_job;
end;
$$;

revoke all on function public.set_job_estimate_state(uuid, text, text, timestamptz, uuid) from public, anon;
grant execute on function public.set_job_estimate_state(uuid, text, text, timestamptz, uuid) to authenticated;

revoke all on function private.guard_job_estimate_mutation() from public, anon, authenticated, service_role;
revoke all on function private.guard_estimate_charge_mutation() from public, anon, authenticated, service_role;

comment on column public.jobs.estimate_snapshot is
  'Server-calculated immutable charge and tax snapshot for the currently sent estimate revision.';
comment on function public.set_job_estimate_state(uuid, text, text, timestamptz, uuid) is
  'Owner/admin estimate lifecycle boundary with version checks, locked sent totals, and audited decisions.';
