alter table public.jobs
  add column if not exists accounting_voided_at timestamptz,
  add column if not exists accounting_voided_by uuid,
  add column if not exists accounting_void_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'jobs_accounting_void_state_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_accounting_void_state_check
      check (
        (accounting_voided_at is null and accounting_voided_by is null and accounting_void_reason is null)
        or (
          accounting_voided_at is not null
          and accounting_voided_by is not null
          and char_length(btrim(accounting_void_reason)) between 8 and 500
        )
      );
  end if;
end;
$$;

create index if not exists jobs_shop_accounting_active_idx
  on public.jobs (shop_id, created_at desc)
  where accounting_voided_at is null;

create or replace function private.guard_job_accounting_void_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('frettrack.accounting_void_rpc', true) is distinct from 'on' then
    if new.accounting_voided_at is distinct from old.accounting_voided_at
      or new.accounting_voided_by is distinct from old.accounting_voided_by
      or new.accounting_void_reason is distinct from old.accounting_void_reason then
      raise exception 'Accounting exclusion must use the guarded work-order void action.'
        using errcode = '42501';
    end if;

    if old.accounting_voided_at is not null then
      raise exception 'Accounting-excluded work orders are read-only. Restore the work order before editing it.'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_guard_accounting_void_mutation on public.jobs;
create trigger jobs_guard_accounting_void_mutation
  before update on public.jobs
  for each row execute function private.guard_job_accounting_void_mutation();

create or replace function private.reconcile_job_accounting_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.accounting_voided_at is not null then
    update public.loyalty_job_awards
    set active = false,
        reversed_at = coalesce(reversed_at, pg_catalog.now()),
        reversal_reason = 'Work order is excluded from accounting.'
    where source_job_id = new.id
      and active;

    update public.service_reminder_queue
    set status = 'canceled',
        processing_token = null,
        processing_started_at = null,
        error_message = 'Source work order is excluded from accounting.'
    where source_job_id = new.id
      and status <> 'sent';
  else
    perform private.refresh_job_loyalty_award(new.id);
    perform private.refresh_service_reminder_for_job(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_reconcile_accounting_void on public.jobs;
create trigger jobs_reconcile_accounting_void
  after update of accounting_voided_at on public.jobs
  for each row
  when (old.accounting_voided_at is distinct from new.accounting_voided_at)
  execute function private.reconcile_job_accounting_void();

create or replace function public.set_job_accounting_void(
  p_job_id uuid,
  p_void boolean,
  p_reason text
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.jobs%rowtype;
  saved_job public.jobs%rowtype;
  clean_reason text := btrim(coalesce(p_reason, ''));
  net_payment numeric := 0;
  historical_payment_count integer := 0;
  explicit_adjustment_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select *
  into target_job
  from public.jobs
  where id = p_job_id
  for update;

  if target_job.id is null then
    raise exception 'Work order not found.' using errcode = 'P0002';
  end if;

  if not private.has_shop_role(target_job.shop_id, array['owner', 'admin']) then
    raise exception 'Only a shop owner or admin can change accounting exclusion.' using errcode = '42501';
  end if;

  if not private.shop_lifecycle_allows_write(target_job.shop_id) then
    raise exception 'This shop is read-only.' using errcode = '42501';
  end if;

  if char_length(clean_reason) < 8 or char_length(clean_reason) > 500 then
    raise exception 'Enter an audit reason between 8 and 500 characters.' using errcode = '22023';
  end if;

  if p_void and target_job.accounting_voided_at is not null then
    return target_job;
  end if;

  if not p_void and target_job.accounting_voided_at is null then
    return target_job;
  end if;

  if p_void then
    with payment_rows as (
      select
        lower(coalesce(payment.value ->> 'type', payment.value ->> 'eventType', 'payment')) as payment_type,
        case
          when coalesce(payment.value ->> 'amount', '') ~ '^-?[0-9]+([.][0-9]+)?$'
            then (payment.value ->> 'amount')::numeric
          else 0::numeric
        end as amount
      from pg_catalog.jsonb_array_elements(
        case
          when pg_catalog.jsonb_typeof(target_job.tech_details -> 'payments') = 'array'
            then target_job.tech_details -> 'payments'
          else '[]'::jsonb
        end
      ) payment(value)
    )
    select
      coalesce(sum(
        case
          when payment_type in ('refund', 'void') then -abs(amount)
          else amount
        end
      ), 0),
      count(*) filter (where payment_type in ('refund', 'void'))
    into net_payment, explicit_adjustment_count
    from payment_rows;

    select count(*)::integer
    into historical_payment_count
    from public.job_events
    where job_id = target_job.id
      and shop_id = target_job.shop_id
      and event_type = 'payment_added';

    if abs(net_payment) > 0.005
      or (historical_payment_count > 0 and explicit_adjustment_count = 0) then
      raise exception 'Recorded payments must be explicitly refunded or voided before excluding this work order from accounting.'
        using errcode = '23514';
    end if;
  end if;

  perform pg_catalog.set_config('frettrack.accounting_void_rpc', 'on', true);

  if p_void then
    update public.jobs
    set accounting_voided_at = pg_catalog.now(),
        accounting_voided_by = (select auth.uid()),
        accounting_void_reason = clean_reason,
        updated_at = pg_catalog.now()
    where id = target_job.id
    returning * into saved_job;

    insert into public.job_events (
      shop_id, job_id, event_type, event_label, event_note, event_data, created_by
    ) values (
      saved_job.shop_id,
      saved_job.id,
      'job_accounting_voided',
      'Work order excluded from accounting',
      clean_reason,
      pg_catalog.jsonb_build_object(
        'previousStatus', target_job.status,
        'netPayment', net_payment,
        'invoiceHandling', 'voided_with_work_order'
      ),
      (select auth.uid())::text
    );
  else
    update public.jobs
    set accounting_voided_at = null,
        accounting_voided_by = null,
        accounting_void_reason = null,
        updated_at = pg_catalog.now()
    where id = target_job.id
    returning * into saved_job;

    insert into public.job_events (
      shop_id, job_id, event_type, event_label, event_note, event_data, created_by
    ) values (
      saved_job.shop_id,
      saved_job.id,
      'job_accounting_restored',
      'Work order restored to accounting',
      clean_reason,
      pg_catalog.jsonb_build_object('previousVoidReason', target_job.accounting_void_reason),
      (select auth.uid())::text
    );
  end if;

  perform pg_catalog.set_config('frettrack.accounting_void_rpc', 'off', true);

  return saved_job;
end;
$$;

revoke all on function public.set_job_accounting_void(uuid, boolean, text) from public, anon;
grant execute on function public.set_job_accounting_void(uuid, boolean, text) to authenticated;

revoke all on function private.guard_job_accounting_void_mutation() from public, anon, authenticated, service_role;
revoke all on function private.reconcile_job_accounting_void() from public, anon, authenticated, service_role;

comment on column public.jobs.accounting_voided_at is
  'When set, the work order remains auditable but is excluded from operational accounting and job metrics.';
comment on function public.set_job_accounting_void(uuid, boolean, text) is
  'Owner/admin-only accounting exclusion with payment safety, lifecycle enforcement, and audit history.';
