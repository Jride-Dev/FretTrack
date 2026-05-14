create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  display_name text not null,
  first_name text,
  last_name text,
  company_name text,
  customer_type text not null default 'individual' check (customer_type in ('individual', 'company')),
  email text,
  email_normalized text,
  phone text,
  phone_normalized text,
  secondary_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  notes text,
  source text,
  external_ref text,
  import_source text,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table jobs
add column if not exists customer_id uuid references customers(id) on delete restrict;

create index if not exists customers_shop_updated_idx on customers (shop_id, updated_at desc);
create index if not exists customers_display_name_idx on customers (shop_id, lower(display_name));
create index if not exists customers_first_last_name_idx on customers (shop_id, lower(last_name), lower(first_name));
create index if not exists customers_phone_normalized_idx on customers (shop_id, phone_normalized) where phone_normalized is not null and phone_normalized <> '';
create index if not exists customers_email_normalized_idx on customers (shop_id, email_normalized) where email_normalized is not null and email_normalized <> '';
create index if not exists customers_company_email_idx on customers (shop_id, lower(company_name), email_normalized) where company_name is not null and email_normalized is not null;
create index if not exists customers_display_phone_idx on customers (shop_id, lower(display_name), phone_normalized) where phone_normalized is not null and phone_normalized <> '';
create index if not exists customers_external_ref_idx on customers (shop_id, external_ref) where external_ref is not null and external_ref <> '';
create index if not exists customers_import_batch_idx on customers (shop_id, import_batch_id) where import_batch_id is not null;
create index if not exists jobs_customer_id_idx on jobs (customer_id);

alter table customers enable row level security;

drop policy if exists "customers_member" on customers;
create policy "customers_member"
  on customers
  for all
  to authenticated
  using (private.is_shop_member(shop_id))
  with check (private.is_shop_member(shop_id));

grant select, insert, update, delete on customers to authenticated;

insert into customers (
  shop_id,
  display_name,
  first_name,
  last_name,
  email,
  email_normalized,
  phone,
  phone_normalized,
  source,
  created_at,
  updated_at
)
select
  job_customers.shop_id,
  max(job_customers.display_name),
  max(job_customers.first_name),
  max(job_customers.last_name),
  max(job_customers.email),
  max(job_customers.email_normalized),
  max(job_customers.phone),
  max(job_customers.phone_normalized),
  'work_order',
  min(job_customers.created_at),
  max(job_customers.updated_at)
from (
  select
    shop_id,
    coalesce(nullif(customer_name, ''), nullif(trim(customer_first_name || ' ' || customer_last_name), ''), nullif(email, ''), nullif(phone, ''), 'Unnamed Customer') as display_name,
    nullif(customer_first_name, '') as first_name,
    nullif(customer_last_name, '') as last_name,
    nullif(email, '') as email,
    nullif(lower(trim(email)), '') as email_normalized,
    nullif(phone, '') as phone,
    nullif(regexp_replace(phone, '\D', '', 'g'), '') as phone_normalized,
    created_at,
    updated_at,
    coalesce(nullif(lower(trim(email)), ''), nullif(regexp_replace(phone, '\D', '', 'g'), ''), nullif(lower(customer_name), '')) as customer_key
  from jobs
  where coalesce(customer_name, phone, email, '') <> ''
) job_customers
where job_customers.customer_key is not null
group by job_customers.shop_id, job_customers.customer_key
on conflict (id) do nothing;

update jobs
set customer_id = matched_customer.id
from (
  select distinct on (jobs.id)
    jobs.id as job_id,
    customers.id
  from jobs
  join customers
    on customers.shop_id = jobs.shop_id
   and (
    (jobs.phone <> '' and customers.phone_normalized = nullif(regexp_replace(jobs.phone, '\D', '', 'g'), ''))
    or (jobs.email <> '' and customers.email_normalized = lower(trim(jobs.email)))
    or (jobs.customer_name <> '' and lower(customers.display_name) = lower(jobs.customer_name))
   )
  order by jobs.id, customers.updated_at desc
) matched_customer
where jobs.id = matched_customer.job_id
  and jobs.customer_id is null;

create or replace function create_job_with_number(job_payload jsonb)
returns jobs
language plpgsql
as $$
declare
  assigned_job jobs;
  assigned_shop_id text;
  assigned_job_date date;
  assigned_day_code text;
  assigned_sequence integer;
  requested_job_number text;
begin
  assigned_shop_id := coalesce(nullif(job_payload->>'shop_id', ''), 'default-shop');
  requested_job_number := nullif(job_payload->>'job_number', '');

  if requested_job_number is not null then
    select *
    into assigned_job
    from jobs
    where shop_id = assigned_shop_id
      and job_number = requested_job_number
    limit 1;

    if found then
      return assigned_job;
    end if;
  end if;

  assigned_job_date := coalesce(
    nullif(job_payload->>'job_date', '')::date,
    nullif(job_payload->>'date_received', '')::date,
    current_date
  );
  assigned_day_code := to_char(assigned_job_date, 'YY') ||
    lpad(extract(doy from assigned_job_date)::integer::text, 3, '0');

  insert into job_daily_sequences (shop_id, job_date, last_sequence)
  values (assigned_shop_id, assigned_job_date, 1)
  on conflict (shop_id, job_date) do update
  set last_sequence = job_daily_sequences.last_sequence + 1
  returning last_sequence into assigned_sequence;

  insert into jobs (
    id,
    customer_id,
    customer_name,
    customer_first_name,
    customer_last_name,
    phone,
    email,
    email_opt_in,
    sms_opt_in,
    preferred_contact_method,
    guitar_brand,
    model,
    serial,
    color,
    reason_for_visit,
    date_received,
    job_date,
    job_day_code,
    daily_sequence,
    shop_id,
    job_number,
    status,
    tech_details,
    created_at,
    updated_at
  )
  values (
    coalesce(nullif(job_payload->>'id', '')::uuid, gen_random_uuid()),
    nullif(job_payload->>'customer_id', '')::uuid,
    coalesce(job_payload->>'customer_name', ''),
    coalesce(job_payload->>'customer_first_name', ''),
    coalesce(job_payload->>'customer_last_name', ''),
    coalesce(job_payload->>'phone', ''),
    coalesce(job_payload->>'email', ''),
    coalesce((job_payload->>'email_opt_in')::boolean, false),
    coalesce((job_payload->>'sms_opt_in')::boolean, false),
    coalesce(nullif(job_payload->>'preferred_contact_method', ''), 'email'),
    coalesce(job_payload->>'guitar_brand', ''),
    coalesce(job_payload->>'model', ''),
    coalesce(job_payload->>'serial', ''),
    coalesce(job_payload->>'color', ''),
    coalesce(job_payload->>'reason_for_visit', ''),
    assigned_job_date,
    assigned_job_date,
    assigned_day_code,
    assigned_sequence,
    assigned_shop_id,
    coalesce(requested_job_number, assigned_day_code || '-' || lpad(assigned_sequence::text, 3, '0')),
    coalesce(nullif(job_payload->>'status', ''), 'Checked In'),
    coalesce(job_payload->'tech_details', '{}'::jsonb),
    coalesce(nullif(job_payload->>'created_at', '')::timestamptz, now()),
    coalesce(nullif(job_payload->>'updated_at', '')::timestamptz, now())
  )
  on conflict (shop_id, job_number) do update
  set updated_at = jobs.updated_at
  returning * into assigned_job;

  return assigned_job;
end;
$$;

grant execute on function create_job_with_number(jsonb) to authenticated;
