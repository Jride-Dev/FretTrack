-- Payment adjustments are linked to the original payment so the shop can see
-- what was refunded/voided and the database can prevent over-adjustment.
create or replace function private.guard_payment_adjustment_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invalid_adjustment boolean;
begin
  if pg_catalog.current_setting('frettrack.payment_rpc', true) is distinct from 'on'
    or coalesce(new.tech_details -> 'payments', '[]'::jsonb)
      is not distinct from coalesce(old.tech_details -> 'payments', '[]'::jsonb) then
    return new;
  end if;

  select exists (
    select 1
    from pg_catalog.jsonb_array_elements(coalesce(new.tech_details -> 'payments', '[]'::jsonb)) entry(value)
    where lower(coalesce(entry.value ->> 'type', 'payment')) in ('refund', 'void')
      and nullif(btrim(entry.value ->> 'appliesToPaymentId'), '') is null
      and not exists (
        select 1
        from pg_catalog.jsonb_array_elements(coalesce(old.tech_details -> 'payments', '[]'::jsonb)) previous(value)
        where previous.value ->> 'id' = entry.value ->> 'id'
      )
  ) into invalid_adjustment;

  if invalid_adjustment then
    raise exception 'Refunds and payment voids must identify the original payment.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_guard_payment_adjustment_metadata on public.jobs;
create trigger jobs_guard_payment_adjustment_metadata
  before update on public.jobs
  for each row execute function private.guard_payment_adjustment_metadata();

create or replace function public.record_job_payment_adjustment(
  p_job_id uuid,
  p_adjustment_id uuid,
  p_original_payment_id uuid,
  p_amount_minor bigint,
  p_adjustment_type text,
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
  clean_type text := lower(btrim(coalesce(p_adjustment_type, '')));
  clean_method text := left(btrim(coalesce(p_method, 'Other')), 80);
  clean_note text := left(btrim(coalesce(p_note, '')), 500);
  original_payment jsonb;
  existing_adjustment jsonb;
  original_minor bigint;
  applied_minor bigint;
  remaining_minor bigint;
  adjustment_entry jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_adjustment_id is null or p_original_payment_id is null or p_amount_minor <= 0 then
    raise exception 'A positive adjustment amount and payment identities are required.' using errcode = '22023';
  end if;
  if clean_type not in ('refund', 'void') then
    raise exception 'Only refund or payment void adjustments are supported.' using errcode = '22023';
  end if;
  if char_length(clean_note) < 3 then
    raise exception 'A refund or payment void reason is required.' using errcode = '22023';
  end if;

  select * into target_job
  from public.jobs
  where id = p_job_id
  for update;

  if target_job.id is null then
    raise exception 'Work order not found.' using errcode = 'P0002';
  end if;
  if not private.has_shop_role(target_job.shop_id, array['owner', 'admin'])
    or not private.shop_lifecycle_allows_write(target_job.shop_id) then
    raise exception 'Only a shop owner or admin can record payment adjustments.' using errcode = '42501';
  end if;
  if target_job.accounting_voided_at is not null then
    raise exception 'Accounting-excluded work orders are read-only.' using errcode = '55000';
  end if;

  select value into existing_adjustment
  from pg_catalog.jsonb_array_elements(coalesce(target_job.tech_details -> 'payments', '[]'::jsonb)) payment(value)
  where payment.value ->> 'id' = p_adjustment_id::text
  limit 1;
  if existing_adjustment is not null then
    return pg_catalog.jsonb_build_object('payment', existing_adjustment, 'updatedAt', target_job.updated_at, 'replayed', true);
  end if;

  if p_expected_updated_at is not null and target_job.updated_at is distinct from p_expected_updated_at then
    raise exception 'This job changed in another session. Reload it before recording the adjustment.' using errcode = '40001';
  end if;

  select value into original_payment
  from pg_catalog.jsonb_array_elements(coalesce(target_job.tech_details -> 'payments', '[]'::jsonb)) payment(value)
  where payment.value ->> 'id' = p_original_payment_id::text
    and lower(coalesce(payment.value ->> 'type', 'payment')) = 'payment'
  limit 1;
  if original_payment is null then
    raise exception 'Select an existing payment as the adjustment target.' using errcode = '22023';
  end if;

  original_minor := round(coalesce(nullif(original_payment ->> 'amount', '')::numeric, 0) * 100)::bigint;
  if original_minor <= 0 then
    raise exception 'The original payment has no refundable balance.' using errcode = '22023';
  end if;

  select coalesce(sum(round(coalesce(nullif(value ->> 'amount', '')::numeric, 0) * 100)::bigint), 0)
    into applied_minor
  from pg_catalog.jsonb_array_elements(coalesce(target_job.tech_details -> 'payments', '[]'::jsonb)) payment(value)
  where payment.value ->> 'appliesToPaymentId' = p_original_payment_id::text
    and lower(coalesce(payment.value ->> 'type', '')) in ('refund', 'void');

  remaining_minor := greatest(original_minor - applied_minor, 0);
  if p_amount_minor > remaining_minor then
    raise exception 'The adjustment exceeds the remaining refundable balance of %.', remaining_minor::numeric / 100 using errcode = '22023';
  end if;
  if clean_type = 'void' and p_amount_minor <> remaining_minor then
    raise exception 'A payment void must close the full remaining payment balance.' using errcode = '22023';
  end if;

  adjustment_entry := pg_catalog.jsonb_build_object(
    'id', p_adjustment_id,
    'amount', p_amount_minor::numeric / 100,
    'type', clean_type,
    'method', clean_method,
    'note', clean_note,
    'date', coalesce(p_payment_date, current_date),
    'recordedAt', pg_catalog.now(),
    'recordedBy', (select auth.uid()),
    'appliesToPaymentId', p_original_payment_id,
    'originalAmount', original_minor::numeric / 100,
    'remainingAfter', (remaining_minor - p_amount_minor)::numeric / 100
  );

  perform pg_catalog.set_config('frettrack.payment_rpc', 'on', true);
  update public.jobs
  set tech_details = pg_catalog.jsonb_set(
        coalesce(tech_details, '{}'::jsonb),
        '{payments}',
        coalesce(tech_details -> 'payments', '[]'::jsonb) || pg_catalog.jsonb_build_array(adjustment_entry),
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
    case clean_type when 'refund' then 'payment_refunded' else 'payment_voided' end,
    case clean_type when 'refund' then 'Payment refunded' else 'Payment voided' end,
    clean_note,
    adjustment_entry,
    (select auth.uid())::text
  );

  return pg_catalog.jsonb_build_object('payment', adjustment_entry, 'updatedAt', target_job.updated_at, 'replayed', false);
end;
$$;

revoke all on function public.record_job_payment_adjustment(uuid, uuid, uuid, bigint, text, text, text, date, timestamptz) from public, anon;
grant execute on function public.record_job_payment_adjustment(uuid, uuid, uuid, bigint, text, text, text, date, timestamptz) to authenticated;
revoke all on function private.guard_payment_adjustment_metadata() from public, anon, authenticated, service_role;

comment on function public.record_job_payment_adjustment(uuid, uuid, uuid, bigint, text, text, text, date, timestamptz) is
  'Owner/admin-only append-only refund and payment-void boundary linked to an original payment and capped at its remaining balance.';
