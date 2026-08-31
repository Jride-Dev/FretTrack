alter table public.jobs
  add column if not exists invoice_finalized_at timestamptz,
  add column if not exists invoice_finalized_by uuid,
  add column if not exists invoice_snapshot jsonb,
  add column if not exists invoice_revision integer not null default 0,
  add column if not exists invoice_finalization_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'jobs_invoice_finalization_state_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_invoice_finalization_state_check
      check (
        (
          invoice_finalized_at is null
          and invoice_finalized_by is null
          and invoice_snapshot is null
          and invoice_finalization_reason is null
        )
        or (
          invoice_finalized_at is not null
          and invoice_finalized_by is not null
          and pg_catalog.jsonb_typeof(invoice_snapshot) = 'object'
          and char_length(btrim(invoice_finalization_reason)) between 8 and 500
        )
      );
  end if;
end;
$$;

create or replace function private.calculate_job_invoice_snapshot(target_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.jobs%rowtype;
  parts_minor bigint := 0;
  included_parts_minor bigint := 0;
  services_minor bigint := 0;
  subtotal_minor bigint := 0;
  discount_minor bigint := 0;
  taxable_minor bigint := 0;
  tax_minor bigint := 0;
  total_minor bigint := 0;
  discount_type text;
  discount_value numeric := 0;
  tax_rate numeric := 0;
  taxable_parts boolean := true;
  taxable_services boolean := false;
  currency_code text := 'USD';
begin
  select * into target_job
  from public.jobs
  where id = target_job_id;

  if target_job.id is null then
    raise exception 'Work order not found.' using errcode = 'P0002';
  end if;

  select
    coalesce(sum(case when included.part_id is not null then 0 else round(coalesce(part.retail, part.retail_price, 0) * coalesce(part.quantity, 1) * 100)::bigint end), 0),
    coalesce(sum(case when included.part_id is not null then round(coalesce(part.retail, part.retail_price, 0) * coalesce(part.quantity, 1) * 100)::bigint else 0 end), 0)
  into parts_minor, included_parts_minor
  from public.job_parts part
  left join lateral (
    select included_id as part_id
    from pg_catalog.jsonb_array_elements_text(
      case
        when pg_catalog.jsonb_typeof(target_job.tech_details -> 'includedPartIds') = 'array'
          then target_job.tech_details -> 'includedPartIds'
        else '[]'::jsonb
      end
    ) included_id
    where included_id = part.id::text
    limit 1
  ) included on true
  where part.job_id = target_job.id;

  select coalesce(sum(round(coalesce(service.retail, 0) * coalesce(service.quantity, 1) * 100)::bigint), 0)
  into services_minor
  from public.job_services service
  where service.job_id = target_job.id;

  subtotal_minor := parts_minor + services_minor;
  discount_type := lower(coalesce(target_job.tech_details ->> 'discountType', 'none'));
  if coalesce(target_job.tech_details ->> 'discountValue', '') ~ '^-?[0-9]+([.][0-9]+)?$' then
    discount_value := (target_job.tech_details ->> 'discountValue')::numeric;
  end if;

  if discount_type = 'percent' then
    discount_minor := round(subtotal_minor * least(greatest(discount_value, 0), 100) / 100)::bigint;
  elsif discount_type = 'dollar' then
    discount_minor := least(greatest(round(discount_value * 100)::bigint, 0), subtotal_minor);
  end if;

  if coalesce(target_job.tech_details #>> '{tax,salesTaxRate}', '') ~ '^-?[0-9]+([.][0-9]+)?$' then
    tax_rate := greatest((target_job.tech_details #>> '{tax,salesTaxRate}')::numeric, 0);
  end if;
  taxable_parts := case lower(coalesce(target_job.tech_details #>> '{tax,taxableParts}', 'true'))
    when 'false' then false
    else true
  end;
  taxable_services := case lower(coalesce(target_job.tech_details #>> '{tax,taxableServices}', 'false'))
    when 'true' then true
    else false
  end;
  currency_code := upper(coalesce(nullif(target_job.tech_details #>> '{tax,currencyCode}', ''), 'USD'));
  taxable_minor := (case when taxable_parts then parts_minor else 0 end)
    + (case when taxable_services then services_minor else 0 end);
  tax_minor := round(taxable_minor * tax_rate / 100)::bigint;
  total_minor := greatest(subtotal_minor - discount_minor, 0) + tax_minor;

  return pg_catalog.jsonb_build_object(
    'version', 1,
    'currencyCode', currency_code,
    'partsMinor', parts_minor,
    'includedPartsMinor', included_parts_minor,
    'servicesMinor', services_minor,
    'subtotalMinor', subtotal_minor,
    'discountType', discount_type,
    'discountValue', discount_value,
    'discountMinor', discount_minor,
    'taxableMinor', taxable_minor,
    'taxRate', tax_rate,
    'taxState', coalesce(target_job.tech_details #>> '{tax,state}', ''),
    'taxLabel', coalesce(nullif(target_job.tech_details #>> '{tax,taxLabel}', ''), 'Sales Tax'),
    'taxableParts', taxable_parts,
    'taxableServices', taxable_services,
    'taxMinor', tax_minor,
    'totalMinor', total_minor,
    'calculatedAt', pg_catalog.now()
  );
end;
$$;

create or replace function private.guard_job_commerce_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  monetary_fields_changed boolean;
  payments_changed boolean;
begin
  monetary_fields_changed :=
    coalesce(new.tech_details ->> 'discountType', 'none') is distinct from coalesce(old.tech_details ->> 'discountType', 'none')
    or coalesce(new.tech_details ->> 'discountValue', '') is distinct from coalesce(old.tech_details ->> 'discountValue', '')
    or coalesce(new.tech_details -> 'tax', '{}'::jsonb) is distinct from coalesce(old.tech_details -> 'tax', '{}'::jsonb);
  payments_changed := coalesce(new.tech_details -> 'payments', '[]'::jsonb)
    is distinct from coalesce(old.tech_details -> 'payments', '[]'::jsonb);

  if pg_catalog.current_setting('frettrack.invoice_finalization_rpc', true) is distinct from 'on'
    and (
      new.invoice_finalized_at is distinct from old.invoice_finalized_at
      or new.invoice_finalized_by is distinct from old.invoice_finalized_by
      or new.invoice_snapshot is distinct from old.invoice_snapshot
      or new.invoice_revision is distinct from old.invoice_revision
      or new.invoice_finalization_reason is distinct from old.invoice_finalization_reason
    ) then
    raise exception 'Invoice finalization must use the guarded invoice action.' using errcode = '42501';
  end if;

  if old.invoice_finalized_at is not null and monetary_fields_changed then
    raise exception 'Finalized invoice charges and tax settings are locked. Reopen the invoice before changing them.' using errcode = '55000';
  end if;

  if monetary_fields_changed
    and pg_catalog.current_setting('role', true) = 'authenticated'
    and (select auth.uid()) is not null
    and not private.has_shop_role(old.shop_id, array['owner', 'admin']) then
    raise exception 'Only a shop owner or admin can change prices, discounts, or tax settings.' using errcode = '42501';
  end if;

  if payments_changed
    and pg_catalog.current_setting('role', true) = 'authenticated'
    and (select auth.uid()) is not null
    and pg_catalog.current_setting('frettrack.payment_rpc', true) is distinct from 'on' then
    raise exception 'Payment history is append-only and must use the guarded payment action.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_guard_commerce_mutation on public.jobs;
create trigger jobs_guard_commerce_mutation
  before update on public.jobs
  for each row execute function private.guard_job_commerce_mutation();

create or replace function private.guard_finalized_job_charge_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job_id uuid := coalesce(new.job_id, old.job_id);
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_job_id::text, 0));
  if pg_catalog.current_setting('role', true) = 'authenticated'
    and (select auth.uid()) is not null
    and not exists (
      select 1
      from public.jobs
      where id = target_job_id
        and private.has_shop_role(shop_id, array['owner', 'admin'])
    ) then
    raise exception 'Only a shop owner or admin can change invoice parts or services.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.jobs
    where id = target_job_id
      and invoice_finalized_at is not null
  ) then
    raise exception 'Finalized invoice parts and services are locked. Reopen the invoice before changing them.' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists job_parts_guard_finalized_invoice on public.job_parts;
create trigger job_parts_guard_finalized_invoice
  before insert or update or delete on public.job_parts
  for each row execute function private.guard_finalized_job_charge_mutation();

drop trigger if exists job_services_guard_finalized_invoice on public.job_services;
create trigger job_services_guard_finalized_invoice
  before insert or update or delete on public.job_services
  for each row execute function private.guard_finalized_job_charge_mutation();

create or replace function public.record_job_payment(
  p_job_id uuid,
  p_payment_id uuid,
  p_amount_minor bigint,
  p_payment_type text,
  p_method text,
  p_note text,
  p_payment_date date,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.jobs%rowtype;
  clean_type text := lower(btrim(coalesce(p_payment_type, 'payment')));
  clean_method text := left(btrim(coalesce(p_method, 'Other')), 80);
  clean_note text := left(btrim(coalesce(p_note, '')), 500);
  payment_entry jsonb;
  existing_payment jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_payment_id is null or p_amount_minor <= 0 then
    raise exception 'A positive payment amount and request ID are required.' using errcode = '22023';
  end if;
  if clean_type not in ('payment', 'refund', 'void') then
    raise exception 'Unsupported payment entry type.' using errcode = '22023';
  end if;

  select * into target_job
  from public.jobs
  where id = p_job_id
  for update;

  if target_job.id is null then
    raise exception 'Work order not found.' using errcode = 'P0002';
  end if;
  if not private.has_shop_role(target_job.shop_id, array['owner', 'admin', 'tech'])
    or not private.shop_lifecycle_allows_write(target_job.shop_id) then
    raise exception 'You cannot record payments for this shop.' using errcode = '42501';
  end if;
  if clean_type in ('refund', 'void')
    and not private.has_shop_role(target_job.shop_id, array['owner', 'admin']) then
    raise exception 'Only a shop owner or admin can record refunds or payment voids.' using errcode = '42501';
  end if;
  if target_job.accounting_voided_at is not null then
    raise exception 'Accounting-excluded work orders are read-only.' using errcode = '55000';
  end if;

  select value into existing_payment
  from pg_catalog.jsonb_array_elements(coalesce(target_job.tech_details -> 'payments', '[]'::jsonb)) payment(value)
  where payment.value ->> 'id' = p_payment_id::text
  limit 1;
  if existing_payment is not null then
    return pg_catalog.jsonb_build_object(
      'payment', existing_payment,
      'updatedAt', target_job.updated_at,
      'replayed', true
    );
  end if;

  if p_expected_updated_at is not null and target_job.updated_at is distinct from p_expected_updated_at then
    raise exception 'This job changed in another session. Reload it before recording the payment.' using errcode = '40001';
  end if;

  payment_entry := pg_catalog.jsonb_build_object(
    'id', p_payment_id,
    'amount', p_amount_minor::numeric / 100,
    'type', clean_type,
    'method', clean_method,
    'note', clean_note,
    'date', coalesce(p_payment_date, current_date),
    'recordedAt', pg_catalog.now(),
    'recordedBy', (select auth.uid())
  );

  perform pg_catalog.set_config('frettrack.payment_rpc', 'on', true);
  update public.jobs
  set tech_details = pg_catalog.jsonb_set(
        coalesce(tech_details, '{}'::jsonb),
        '{payments}',
        coalesce(tech_details -> 'payments', '[]'::jsonb) || pg_catalog.jsonb_build_array(payment_entry),
        true
      ),
      updated_at = pg_catalog.now()
  where id = target_job.id
  returning * into target_job;
  perform pg_catalog.set_config('frettrack.payment_rpc', 'off', true);

  insert into public.job_events (
    shop_id, job_id, event_type, event_label, event_note, event_data, created_by
  ) values (
    target_job.shop_id,
    target_job.id,
    case clean_type when 'refund' then 'payment_refunded' when 'void' then 'payment_voided' else 'payment_added' end,
    case clean_type when 'refund' then 'Payment refunded' when 'void' then 'Payment voided' else 'Payment added' end,
    clean_method,
    payment_entry,
    (select auth.uid())::text
  );

  return pg_catalog.jsonb_build_object(
    'payment', payment_entry,
    'updatedAt', target_job.updated_at,
    'replayed', false
  );
end;
$$;

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
  clean_reason text := btrim(coalesce(p_reason, ''));
  snapshot jsonb;
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
  if char_length(clean_reason) < 8 or char_length(clean_reason) > 500 then
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
    snapshot := private.calculate_job_invoice_snapshot(target_job.id);
    update public.jobs
    set invoice_finalized_at = pg_catalog.now(),
        invoice_finalized_by = (select auth.uid()),
        invoice_snapshot = snapshot,
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

revoke all on function public.record_job_payment(uuid, uuid, bigint, text, text, text, date, timestamptz) from public, anon;
grant execute on function public.record_job_payment(uuid, uuid, bigint, text, text, text, date, timestamptz) to authenticated;
revoke all on function public.set_job_invoice_finalization(uuid, boolean, text) from public, anon;
grant execute on function public.set_job_invoice_finalization(uuid, boolean, text) to authenticated;

revoke all on function private.calculate_job_invoice_snapshot(uuid) from public, anon, authenticated, service_role;
revoke all on function private.guard_job_commerce_mutation() from public, anon, authenticated, service_role;
revoke all on function private.guard_finalized_job_charge_mutation() from public, anon, authenticated, service_role;

comment on column public.jobs.invoice_snapshot is
  'Server-calculated immutable charge and tax snapshot for the current finalized invoice revision.';
comment on function public.record_job_payment(uuid, uuid, bigint, text, text, text, date, timestamptz) is
  'Append-only work-order payment boundary. Technicians may record payments; refunds and voids require owner/admin.';
comment on function public.set_job_invoice_finalization(uuid, boolean, text) is
  'Owner/admin boundary that locks invoice charges and stores a server-calculated totals snapshot.';
