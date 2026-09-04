-- Give finalized work orders a durable, database-assigned invoice number.
-- Invoice revisions keep the same number; reopening and re-finalizing is a
-- correction to the same invoice record, not a new invoice identity.
alter table public.jobs
  add column if not exists invoice_number bigint;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'jobs_invoice_number_positive_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_invoice_number_positive_check
      check (invoice_number is null or invoice_number > 0);
  end if;
end;
$$;

create unique index if not exists jobs_shop_invoice_number_key
  on public.jobs (shop_id, invoice_number)
  where invoice_number is not null;

create table if not exists public.invoice_number_sequences (
  shop_id text primary key,
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.invoice_number_sequences enable row level security;
revoke all on public.invoice_number_sequences from public, anon, authenticated;

-- Existing finalized invoices need an identity before new finalizations start
-- allocating numbers. The migration runs as the database owner, so this
-- deterministic backfill does not depend on an authenticated request.
with shop_bases as (
  select shop_id, coalesce(max(invoice_number), 0)::bigint as base_number
  from public.jobs
  group by shop_id
), numbered_existing as (
  select
    jobs.id,
    shop_bases.base_number
      + pg_catalog.row_number() over (
        partition by jobs.shop_id
        order by jobs.invoice_finalized_at, jobs.id
      )::bigint as assigned_number
  from public.jobs
  join shop_bases on shop_bases.shop_id = jobs.shop_id
  where jobs.invoice_finalized_at is not null
    and jobs.invoice_number is null
)
update public.jobs
set invoice_number = numbered_existing.assigned_number,
    invoice_snapshot = case
      when pg_catalog.jsonb_typeof(public.jobs.invoice_snapshot) = 'object'
        then pg_catalog.jsonb_set(public.jobs.invoice_snapshot, '{invoiceNumber}', pg_catalog.to_jsonb(numbered_existing.assigned_number), true)
      else public.jobs.invoice_snapshot
    end
from numbered_existing
where public.jobs.id = numbered_existing.id;

insert into public.invoice_number_sequences (shop_id, last_number)
select shop_id, max(invoice_number)::bigint
from public.jobs
where invoice_number is not null
group by shop_id
on conflict (shop_id) do update
set last_number = greatest(public.invoice_number_sequences.last_number, excluded.last_number),
    updated_at = pg_catalog.now();

create or replace function private.next_invoice_number(p_shop_id text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  scoped_shop_id text := nullif(btrim(coalesce(p_shop_id, '')), '');
  next_number bigint;
begin
  if scoped_shop_id is null then
    raise exception 'Invoice shop is required.' using errcode = '22023';
  end if;
  if not private.can_write_shop(scoped_shop_id) then
    raise exception 'Not allowed to create invoice numbers for this shop.'
      using errcode = '42501';
  end if;

  insert into public.invoice_number_sequences (shop_id, last_number)
  values (scoped_shop_id, 1)
  on conflict (shop_id) do update
  set last_number = public.invoice_number_sequences.last_number + 1,
      updated_at = pg_catalog.now()
  returning last_number into next_number;

  return next_number;
end;
$$;

revoke all on function private.next_invoice_number(text) from public, anon, authenticated, service_role;

create or replace function private.guard_invoice_number_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.invoice_number is not null
      and pg_catalog.current_setting('frettrack.invoice_finalization_rpc', true) is distinct from 'on' then
      raise exception 'Invoice numbering must use the guarded invoice action.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.invoice_number is distinct from old.invoice_number
    and pg_catalog.current_setting('frettrack.invoice_finalization_rpc', true) is distinct from 'on' then
    raise exception 'Invoice numbering must use the guarded invoice action.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_guard_invoice_number_mutation on public.jobs;
create trigger jobs_guard_invoice_number_mutation
before insert or update on public.jobs
for each row execute function private.guard_invoice_number_mutation();

create or replace function public.set_job_invoice_finalization(
  p_job_id uuid,
  p_finalize boolean,
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
  clean_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  snapshot jsonb;
  assigned_invoice_number bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into target_job
  from public.jobs
  where id = p_job_id
  for update;

  if target_job.id is null then
    raise exception 'Work order not found.' using errcode = 'P0002';
  end if;
  if not private.has_shop_role(target_job.shop_id, array['owner', 'admin']) then
    raise exception 'Only a shop owner or admin can finalize or reopen an invoice.' using errcode = '42501';
  end if;
  if not private.shop_lifecycle_allows_write(target_job.shop_id) then
    raise exception 'This shop is read-only.' using errcode = '42501';
  end if;
  if target_job.accounting_voided_at is not null then
    raise exception 'An accounting-excluded work order cannot be finalized.' using errcode = '55000';
  end if;
  if pg_catalog.char_length(clean_reason) < 8 or pg_catalog.char_length(clean_reason) > 500 then
    raise exception 'Enter an audit reason between 8 and 500 characters.' using errcode = '22023';
  end if;
  if p_finalize and target_job.invoice_finalized_at is not null then
    return target_job;
  end if;
  if not p_finalize and target_job.invoice_finalized_at is null then
    return target_job;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_job.id::text, 0));
  perform pg_catalog.set_config('frettrack.invoice_finalization_rpc', 'on', true);
  if p_finalize then
    assigned_invoice_number := target_job.invoice_number;
    if assigned_invoice_number is null then
      assigned_invoice_number := private.next_invoice_number(target_job.shop_id);
    end if;
    snapshot := private.calculate_job_invoice_snapshot(target_job.id);
    snapshot := pg_catalog.jsonb_set(snapshot, '{invoiceNumber}', pg_catalog.to_jsonb(assigned_invoice_number), true);
    update public.jobs
    set invoice_finalized_at = pg_catalog.now(),
        invoice_finalized_by = (select auth.uid()),
        invoice_snapshot = snapshot,
        invoice_number = assigned_invoice_number,
        invoice_revision = invoice_revision + 1,
        invoice_finalization_reason = clean_reason,
        updated_at = pg_catalog.now()
    where id = target_job.id
    returning * into saved_job;
  else
    update public.jobs
    set invoice_finalized_at = null,
        invoice_finalized_by = null,
        invoice_snapshot = null,
        invoice_finalization_reason = null,
        updated_at = pg_catalog.now()
    where id = target_job.id
    returning * into saved_job;
  end if;
  perform pg_catalog.set_config('frettrack.invoice_finalization_rpc', 'off', true);

  insert into public.job_events (
    shop_id, job_id, event_type, event_label, event_note, event_data, created_by
  ) values (
    saved_job.shop_id,
    saved_job.id,
    case when p_finalize then 'invoice_finalized' else 'invoice_reopened' end,
    case when p_finalize then 'Invoice finalized' else 'Invoice reopened' end,
    clean_reason,
    case when p_finalize then snapshot else pg_catalog.jsonb_build_object('previousSnapshot', target_job.invoice_snapshot) end,
    (select auth.uid())::text
  );

  return saved_job;
end;
$$;

revoke all on function public.set_job_invoice_finalization(uuid, boolean, text) from public, anon;
grant execute on function public.set_job_invoice_finalization(uuid, boolean, text) to authenticated;

-- Transaction operations can be retried after a lost response. Persisting the
-- caller's request identity lets the database replay the original event and
-- number instead of allocating a second transaction number.
alter table public.transaction_events
  add column if not exists request_id text;

create unique index if not exists transaction_events_shop_request_id_key
  on public.transaction_events (shop_id, request_id)
  where request_id is not null;

create or replace function public.create_transaction_event(transaction_payload jsonb)
returns public.transaction_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_event public.transaction_events;
  replayed_event public.transaction_events;
  assigned_shop_id text;
  assigned_location_id text;
  assigned_number bigint;
  assigned_customer_id uuid;
  assigned_employee_id uuid;
  assigned_reversed_transaction_id uuid;
  request_id_value text;
  event_type_value text;
  source_type_value text;
  source_id_value text;
  currency_code_value text;
  subtotal_minor_value bigint;
  tax_minor_value bigint;
  total_minor_value bigint;
  metadata_value jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if transaction_payload is null or pg_catalog.jsonb_typeof(transaction_payload) <> 'object' then
    raise exception 'Transaction payload must be a JSON object.';
  end if;

  assigned_shop_id := nullif(transaction_payload->>'shop_id', '');
  if assigned_shop_id is null then
    raise exception 'Transaction shop is required.';
  end if;
  if not private.can_write_shop(assigned_shop_id) then
    raise exception 'Not allowed to create commerce events for this shop.' using errcode = '42501';
  end if;

  assigned_location_id := nullif(pg_catalog.left(coalesce(transaction_payload->>'location_id', ''), 80), '');
  request_id_value := nullif(pg_catalog.left(pg_catalog.btrim(coalesce(transaction_payload->>'request_id', '')), 120), '');

  if request_id_value is null then
    raise exception 'Transaction request_id is required for safe retries.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(assigned_shop_id || ':' || request_id_value, 0));
  select * into replayed_event
  from public.transaction_events
  where shop_id = assigned_shop_id
    and request_id = request_id_value
  limit 1;
  if replayed_event.id is not null then
    return replayed_event;
  end if;

  assigned_customer_id := nullif(transaction_payload->>'customer_id', '')::uuid;
  assigned_employee_id := nullif(transaction_payload->>'employee_id', '')::uuid;
  assigned_reversed_transaction_id := nullif(transaction_payload->>'reversed_transaction_id', '')::uuid;
  event_type_value := pg_catalog.left(coalesce(nullif(transaction_payload->>'event_type', ''), 'generic'), 80);
  source_type_value := pg_catalog.left(coalesce(nullif(transaction_payload->>'source_type', ''), 'manual'), 80);
  source_id_value := nullif(pg_catalog.left(coalesce(transaction_payload->>'source_id', ''), 120), '');
  currency_code_value := upper(pg_catalog.left(coalesce(nullif(transaction_payload->>'currency_code', ''), 'USD'), 3));
  subtotal_minor_value := coalesce((transaction_payload->>'subtotal_minor')::bigint, 0);
  tax_minor_value := coalesce((transaction_payload->>'tax_minor')::bigint, 0);
  total_minor_value := coalesce((transaction_payload->>'total_minor')::bigint, 0);
  metadata_value := coalesce(transaction_payload->'metadata', '{}'::jsonb);

  if currency_code_value !~ '^[A-Z]{3}$' then
    raise exception 'Currency code must be a 3-letter ISO code.';
  end if;
  if abs(subtotal_minor_value) > 99999999999
    or abs(tax_minor_value) > 99999999999
    or abs(total_minor_value) > 99999999999 then
    raise exception 'Transaction amount is outside the allowed range.';
  end if;
  if metadata_value is null or pg_catalog.jsonb_typeof(metadata_value) <> 'object' then
    raise exception 'Transaction metadata must be a JSON object.';
  end if;
  if assigned_customer_id is not null and not exists (
    select 1 from public.customers
    where customers.id = assigned_customer_id and customers.shop_id = assigned_shop_id
  ) then
    raise exception 'Customer does not belong to this shop.' using errcode = '42501';
  end if;
  if assigned_employee_id is not null and not exists (
    select 1 from public.shop_members
    where shop_members.user_id = assigned_employee_id and shop_members.shop_id = assigned_shop_id
  ) then
    raise exception 'Employee does not belong to this shop.' using errcode = '42501';
  end if;
  if assigned_reversed_transaction_id is not null and not exists (
    select 1 from public.transaction_events
    where transaction_events.id = assigned_reversed_transaction_id and transaction_events.shop_id = assigned_shop_id
  ) then
    raise exception 'Reversed transaction does not belong to this shop.' using errcode = '42501';
  end if;

  assigned_number := public.next_transaction_number(assigned_shop_id, assigned_location_id);
  insert into public.transaction_events (
    shop_id, location_id, location_scope, transaction_number, request_id,
    event_type, source_type, source_id, customer_id, employee_id,
    currency_code, subtotal_minor, tax_minor, total_minor, metadata,
    reversed_transaction_id, created_by
  ) values (
    assigned_shop_id, assigned_location_id, coalesce(assigned_location_id, ''), assigned_number, request_id_value,
    event_type_value, source_type_value, source_id_value, assigned_customer_id, assigned_employee_id,
    currency_code_value, subtotal_minor_value, tax_minor_value, total_minor_value, metadata_value,
    assigned_reversed_transaction_id, (select auth.uid())::text
  ) returning * into inserted_event;
  return inserted_event;
end;
$$;

revoke all on function public.create_transaction_event(jsonb) from public, anon;
grant execute on function public.create_transaction_event(jsonb) to authenticated;

comment on column public.jobs.invoice_number is
  'Database-assigned invoice identity, preserved across invoice revisions.';
comment on column public.transaction_events.request_id is
  'Optional caller operation identity used to replay a transaction creation after an ambiguous response.';
