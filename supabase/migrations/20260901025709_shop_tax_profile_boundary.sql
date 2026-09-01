alter table public.shop_profiles
  add column if not exists tax_calculation_mode text not null default 'disabled',
  add column if not exists default_tax_profile_id uuid not null default gen_random_uuid(),
  add column if not exists tax_profile_revision integer not null default 1;

update public.shop_profiles
set tax_calculation_mode = 'manual'
where coalesce(sales_tax_rate, 0) > 0
   or nullif(btrim(coalesce(tax_registration_number, '')), '') is not null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'shop_profiles_tax_calculation_mode_check'
      and conrelid = 'public.shop_profiles'::regclass
  ) then
    alter table public.shop_profiles
      add constraint shop_profiles_tax_calculation_mode_check
      check (tax_calculation_mode in ('disabled', 'manual'));
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'shop_profiles_tax_profile_revision_check'
      and conrelid = 'public.shop_profiles'::regclass
  ) then
    alter table public.shop_profiles
      add constraint shop_profiles_tax_profile_revision_check
      check (tax_profile_revision > 0);
  end if;
end;
$$;

alter table public.tax_profiles
  add column if not exists tax_label text not null default 'Sales Tax',
  add column if not exists tax_registration_number text not null default '',
  add column if not exists taxable_parts boolean not null default true,
  add column if not exists taxable_services boolean not null default false,
  add column if not exists calculation_mode text not null default 'disabled',
  add column if not exists is_default boolean not null default false,
  add column if not exists revision integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'tax_profiles_calculation_mode_check'
      and conrelid = 'public.tax_profiles'::regclass
  ) then
    alter table public.tax_profiles
      add constraint tax_profiles_calculation_mode_check
      check (calculation_mode in ('disabled', 'manual'));
  end if;
end;
$$;

create unique index if not exists tax_profiles_one_default_per_shop
  on public.tax_profiles (shop_id)
  where is_default;

create or replace function private.prepare_shop_tax_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tax_fields_changed boolean := false;
begin
  if new.tax_calculation_mode = 'manual'
    and nullif(btrim(coalesce(new.tax_state, '')), '') is null then
    raise exception 'A tax jurisdiction is required when manual tax calculation is enabled.' using errcode = '22023';
  end if;
  if new.sales_tax_rate < 0 or new.sales_tax_rate > 100 then
    raise exception 'The default tax rate must be between 0 and 100 percent.' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    new.default_tax_profile_id := pg_catalog.gen_random_uuid();
    new.tax_profile_revision := 1;
  else
    if new.default_tax_profile_id is distinct from old.default_tax_profile_id then
      raise exception 'Default tax profile identity cannot be changed directly.' using errcode = '42501';
    end if;
    tax_fields_changed := (
      new.tax_calculation_mode is distinct from old.tax_calculation_mode
    or new.tax_state is distinct from old.tax_state
    or new.sales_tax_rate is distinct from old.sales_tax_rate
    or new.tax_label is distinct from old.tax_label
    or new.tax_registration_number is distinct from old.tax_registration_number
    or new.taxable_parts_default is distinct from old.taxable_parts_default
    or new.taxable_services_default is distinct from old.taxable_services_default
      or new.currency_code is distinct from old.currency_code
    );
    if tax_fields_changed then
      new.tax_profile_revision := old.tax_profile_revision + 1;
    elsif new.tax_profile_revision is distinct from old.tax_profile_revision then
      raise exception 'Tax profile revision is maintained by FretTrack.' using errcode = '42501';
    else
      new.tax_profile_revision := old.tax_profile_revision;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists shop_profiles_prepare_tax_profile_insert on public.shop_profiles;
create trigger shop_profiles_prepare_tax_profile_insert
  before insert on public.shop_profiles
  for each row execute function private.prepare_shop_tax_profile();
drop trigger if exists shop_profiles_prepare_tax_profile_update on public.shop_profiles;
create trigger shop_profiles_prepare_tax_profile_update
  before update of tax_calculation_mode, tax_state, sales_tax_rate, tax_label,
    tax_registration_number, taxable_parts_default, taxable_services_default, currency_code,
    default_tax_profile_id, tax_profile_revision
  on public.shop_profiles
  for each row execute function private.prepare_shop_tax_profile();

create or replace function private.sync_shop_default_tax_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.tax_profiles
    where id = new.default_tax_profile_id and shop_id <> new.shop_id
  ) then
    raise exception 'Default tax profile identity belongs to another shop.' using errcode = '42501';
  end if;
  insert into public.tax_profiles (
    id, shop_id, name, jurisdiction, tax_rate_basis_points, currency_code, active,
    tax_label, tax_registration_number, taxable_parts, taxable_services,
    calculation_mode, is_default, revision, metadata
  ) values (
    new.default_tax_profile_id,
    new.shop_id,
    'Shop default tax profile',
    coalesce(new.tax_state, ''),
    case when new.tax_calculation_mode = 'manual' then round(coalesce(new.sales_tax_rate, 0) * 100)::integer else 0 end,
    upper(coalesce(nullif(new.currency_code, ''), 'USD')),
    true,
    coalesce(nullif(new.tax_label, ''), 'Sales Tax'),
    coalesce(new.tax_registration_number, ''),
    case when new.tax_calculation_mode = 'manual' then new.taxable_parts_default else false end,
    case when new.tax_calculation_mode = 'manual' then new.taxable_services_default else false end,
    new.tax_calculation_mode,
    true,
    new.tax_profile_revision,
    pg_catalog.jsonb_build_object('source', 'shop_profiles')
  )
  on conflict (id) do update set
    jurisdiction = excluded.jurisdiction,
    tax_rate_basis_points = excluded.tax_rate_basis_points,
    currency_code = excluded.currency_code,
    active = excluded.active,
    tax_label = excluded.tax_label,
    tax_registration_number = excluded.tax_registration_number,
    taxable_parts = excluded.taxable_parts,
    taxable_services = excluded.taxable_services,
    calculation_mode = excluded.calculation_mode,
    is_default = excluded.is_default,
    revision = excluded.revision,
    metadata = excluded.metadata,
    updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists shop_profiles_sync_default_tax_profile_insert on public.shop_profiles;
create trigger shop_profiles_sync_default_tax_profile_insert
  after insert on public.shop_profiles
  for each row execute function private.sync_shop_default_tax_profile();
drop trigger if exists shop_profiles_sync_default_tax_profile_update on public.shop_profiles;
create trigger shop_profiles_sync_default_tax_profile_update
  after update of tax_calculation_mode, tax_state, sales_tax_rate, tax_label,
    tax_registration_number, taxable_parts_default, taxable_services_default, currency_code
  on public.shop_profiles
  for each row execute function private.sync_shop_default_tax_profile();

update public.shop_profiles
set tax_calculation_mode = tax_calculation_mode;

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
  taxable_before_discount_minor bigint := 0;
  taxable_discount_minor bigint := 0;
  taxable_minor bigint := 0;
  tax_minor bigint := 0;
  total_minor bigint := 0;
  discount_type text;
  discount_value numeric := 0;
  tax_rate numeric := 0;
  taxable_parts boolean := true;
  taxable_services boolean := false;
  currency_code text := 'USD';
  calculation_mode text;
begin
  select * into target_job from public.jobs where id = target_job_id;
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
      case when pg_catalog.jsonb_typeof(target_job.tech_details -> 'includedPartIds') = 'array'
        then target_job.tech_details -> 'includedPartIds' else '[]'::jsonb end
    ) included_id
    where included_id = part.id::text limit 1
  ) included on true
  where part.job_id = target_job.id;

  select coalesce(sum(round(coalesce(service.retail, 0) * coalesce(service.quantity, 1) * 100)::bigint), 0)
  into services_minor from public.job_services service where service.job_id = target_job.id;

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
    tax_rate := least(greatest((target_job.tech_details #>> '{tax,salesTaxRate}')::numeric, 0), 100);
  end if;
  calculation_mode := lower(coalesce(
    nullif(target_job.tech_details #>> '{tax,calculationMode}', ''),
    case when tax_rate > 0 then 'manual' else 'disabled' end
  ));
  if calculation_mode not in ('disabled', 'manual') then
    calculation_mode := 'disabled';
  end if;
  taxable_parts := lower(coalesce(target_job.tech_details #>> '{tax,taxableParts}', 'true')) <> 'false';
  taxable_services := lower(coalesce(target_job.tech_details #>> '{tax,taxableServices}', 'false')) = 'true';
  if calculation_mode = 'disabled' then
    tax_rate := 0;
    taxable_parts := false;
    taxable_services := false;
  end if;
  currency_code := upper(coalesce(nullif(target_job.tech_details #>> '{tax,currencyCode}', ''), 'USD'));
  taxable_before_discount_minor := (case when taxable_parts then parts_minor else 0 end)
    + (case when taxable_services then services_minor else 0 end);
  if subtotal_minor > 0 and discount_minor > 0 and taxable_before_discount_minor > 0 then
    taxable_discount_minor := round(
      discount_minor::numeric * taxable_before_discount_minor::numeric / subtotal_minor::numeric
    )::bigint;
  end if;
  taxable_minor := greatest(taxable_before_discount_minor - taxable_discount_minor, 0);
  tax_minor := round(taxable_minor * tax_rate / 100)::bigint;
  total_minor := greatest(subtotal_minor - discount_minor, 0) + tax_minor;

  return pg_catalog.jsonb_build_object(
    'version', 2,
    'currencyCode', currency_code,
    'partsMinor', parts_minor,
    'includedPartsMinor', included_parts_minor,
    'servicesMinor', services_minor,
    'subtotalMinor', subtotal_minor,
    'discountType', discount_type,
    'discountValue', discount_value,
    'discountMinor', discount_minor,
    'taxCalculationMode', calculation_mode,
    'taxRateSource', coalesce(nullif(target_job.tech_details #>> '{tax,rateSource}', ''), 'job'),
    'taxProfileId', coalesce(target_job.tech_details #>> '{tax,profileId}', ''),
    'taxProfileRevision', coalesce(nullif(target_job.tech_details #>> '{tax,profileRevision}', '')::integer, 0),
    'taxableMinor', taxable_minor,
    'taxRate', tax_rate,
    'taxState', coalesce(target_job.tech_details #>> '{tax,state}', ''),
    'taxLabel', coalesce(nullif(target_job.tech_details #>> '{tax,taxLabel}', ''), 'Sales Tax'),
    'taxRegistrationNumber', coalesce(target_job.tech_details #>> '{tax,taxRegistrationNumber}', ''),
    'taxableParts', taxable_parts,
    'taxableServices', taxable_services,
    'taxableBeforeDiscountMinor', taxable_before_discount_minor,
    'taxableDiscountMinor', taxable_discount_minor,
    'taxMinor', tax_minor,
    'totalMinor', total_minor,
    'calculatedAt', pg_catalog.now()
  );
end;
$$;

revoke all on function private.prepare_shop_tax_profile() from public, anon, authenticated, service_role;
revoke all on function private.sync_shop_default_tax_profile() from public, anon, authenticated, service_role;
revoke insert, update, delete on public.tax_profiles from authenticated;

comment on column public.shop_profiles.tax_calculation_mode is
  'Manual means the shop intentionally configured its own tax defaults; disabled means FretTrack calculates no tax for new jobs.';
comment on column public.shop_profiles.default_tax_profile_id is
  'Stable identity copied into new work orders and immutable estimate/invoice snapshots for calculation provenance.';
