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

create table if not exists jobs (
  id uuid primary key,
  customer_id uuid references customers(id) on delete restrict,
  shop_id text not null default 'default-shop',
  customer_name text not null default '',
  customer_first_name text not null default '',
  customer_last_name text not null default '',
  phone text not null default '',
  email text not null default '',
  guitar_brand text not null default '',
  model text not null default '',
  serial text not null default '',
  color text not null default '',
  reason_for_visit text not null default '',
  date_received date not null,
  job_date date not null,
  job_day_code text not null,
  daily_sequence integer not null check (daily_sequence > 0),
  job_number text not null,
  email_opt_in boolean not null default false,
  sms_opt_in boolean not null default false,
  preferred_contact_method text not null default 'email' check (preferred_contact_method in ('email', 'sms', 'none')),
  tech_details jsonb not null default '{}'::jsonb,
  status text not null default 'Checked In' check (status in ('Checked In', 'On Bench', 'Waiting Parts', 'Completed', 'Picked Up', 'Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, job_number),
  unique (shop_id, job_date, daily_sequence)
);

create table if not exists job_daily_sequences (
  shop_id text not null,
  job_date date not null,
  last_sequence integer not null check (last_sequence > 0),
  primary key (shop_id, job_date)
);

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
begin
  assigned_shop_id := coalesce(nullif(job_payload->>'shop_id', ''), 'default-shop');
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
    assigned_day_code || '-' || lpad(assigned_sequence::text, 3, '0'),
    coalesce(nullif(job_payload->>'status', ''), 'Checked In'),
    coalesce(job_payload->'tech_details', '{}'::jsonb),
    coalesce(nullif(job_payload->>'created_at', '')::timestamptz, now()),
    coalesce(nullif(job_payload->>'updated_at', '')::timestamptz, now())
  )
  returning * into assigned_job;

  return assigned_job;
end;
$$;

grant execute on function create_job_with_number(jsonb) to anon, authenticated;
grant select, insert, update on job_daily_sequences to anon, authenticated;

create table if not exists job_parts (
  id uuid primary key,
  job_id uuid not null references jobs(id) on delete cascade,
  name text not null default '',
  quantity numeric(10, 2) not null default 1,
  cost numeric(10, 2) not null default 0,
  retail numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists job_services (
  id uuid primary key,
  job_id uuid not null references jobs(id) on delete cascade,
  description text not null default '',
  quantity numeric(10, 2) not null default 1,
  cost numeric(10, 2) not null default 0,
  retail numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists work_logs (
  id uuid primary key,
  job_id uuid not null references jobs(id) on delete cascade,
  entry text not null default '',
  text text not null default '',
  created_at timestamptz not null default now()
);

alter table work_logs
add column if not exists text text not null default '';

create table if not exists job_images (
  id uuid primary key,
  job_id uuid not null references jobs(id) on delete cascade,
  url text not null default '',
  public_url text not null default '',
  storage_path text not null default '',
  file_name text not null default '',
  original_filename text not null default '',
  uploaded_at timestamptz not null default now(),
  category text not null default 'job',
  created_at timestamptz not null default now()
);

create index if not exists job_images_job_id_uploaded_at_idx on job_images (job_id, uploaded_at desc);

create table if not exists customer_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  customer_id uuid,
  channel text not null check (channel in ('email', 'sms')),
  recipient text not null default '',
  subject text,
  body text not null default '',
  template_key text not null default '',
  status text not null default 'failed' check (status in ('sent', 'failed')),
  provider text not null default '',
  provider_message_id text not null default '',
  error_message text not null default '',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_messages_job_id_created_at_idx on customer_messages (job_id, created_at desc);
create index if not exists customer_messages_job_id_sent_at_idx on customer_messages (job_id, sent_at desc);
create index if not exists customer_messages_customer_id_idx on customer_messages (customer_id);
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

create table if not exists job_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null default 'default-shop',
  job_id uuid not null references jobs(id) on delete cascade,
  event_type text not null,
  event_label text not null,
  event_note text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists job_events_job_id_created_at_idx on job_events (job_id, created_at desc);
create index if not exists job_events_shop_id_created_at_idx on job_events (shop_id, created_at desc);

create index if not exists jobs_customer_first_name_idx on jobs (lower(customer_first_name));
create index if not exists jobs_customer_last_name_idx on jobs (lower(customer_last_name));
create index if not exists jobs_customer_last_first_name_idx on jobs (lower(customer_last_name), lower(customer_first_name));
create index if not exists jobs_customer_full_name_idx on jobs (lower(customer_name));

alter table customer_messages enable row level security;
alter table customers enable row level security;
alter table job_events enable row level security;

create policy "customer_messages_select_public"
  on customer_messages
  for select
  to anon, authenticated
  using (true);

create policy "customer_messages_insert_public"
  on customer_messages
  for insert
  to anon, authenticated
  with check (true);

create policy "customer_messages_update_public"
  on customer_messages
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "job_events_select_public"
  on job_events
  for select
  to anon, authenticated
  using (true);

create policy "job_events_insert_public"
  on job_events
  for insert
  to anon, authenticated
  with check (true);

insert into storage.buckets (id, name, public)
values ('job-images', 'job-images', true)
on conflict (id) do update set public = true;
