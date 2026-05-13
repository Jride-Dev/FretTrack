create schema if not exists private;

create table if not exists shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'tech' check (role in ('owner', 'admin', 'tech', 'viewer')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, user_id)
);

create index if not exists shop_members_shop_id_idx on shop_members (shop_id);
create index if not exists shop_members_user_id_idx on shop_members (user_id);

alter table shop_members enable row level security;
alter table jobs enable row level security;
alter table job_daily_sequences enable row level security;
alter table job_parts enable row level security;
alter table job_services enable row level security;
alter table work_logs enable row level security;
alter table job_images enable row level security;
alter table customer_messages enable row level security;
alter table job_events enable row level security;

create or replace function private.is_shop_member(target_shop_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from shop_members
    where shop_id = target_shop_id
      and user_id = auth.uid()
  );
$$;

create or replace function private.has_shop_role(target_shop_id text, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from shop_members
    where shop_id = target_shop_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create or replace function private.shop_has_no_members(target_shop_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from shop_members
    where shop_id = target_shop_id
  );
$$;

create or replace function private.can_access_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs
    join public.shop_members
      on shop_members.shop_id = jobs.shop_id
     and shop_members.user_id = auth.uid()
    where jobs.id = target_job_id
  );
$$;

drop policy if exists "shop_members_select_member" on shop_members;
create policy "shop_members_select_member"
  on shop_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or private.has_shop_role(shop_id, array['owner', 'admin'])
  );

drop policy if exists "shop_members_insert_bootstrap_owner" on shop_members;
create policy "shop_members_insert_bootstrap_owner"
  on shop_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and private.shop_has_no_members(shop_id)
  );

drop policy if exists "shop_members_insert_admin" on shop_members;
create policy "shop_members_insert_admin"
  on shop_members
  for insert
  to authenticated
  with check (private.has_shop_role(shop_id, array['owner', 'admin']));

drop policy if exists "shop_members_update_admin" on shop_members;
create policy "shop_members_update_admin"
  on shop_members
  for update
  to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'admin']))
  with check (private.has_shop_role(shop_id, array['owner', 'admin']));

drop policy if exists "shop_members_delete_owner" on shop_members;
create policy "shop_members_delete_owner"
  on shop_members
  for delete
  to authenticated
  using (private.has_shop_role(shop_id, array['owner']));

drop policy if exists "jobs_select_shop_member" on jobs;
create policy "jobs_select_shop_member"
  on jobs
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "jobs_insert_shop_member" on jobs;
create policy "jobs_insert_shop_member"
  on jobs
  for insert
  to authenticated
  with check (private.is_shop_member(shop_id));

drop policy if exists "jobs_update_shop_member" on jobs;
create policy "jobs_update_shop_member"
  on jobs
  for update
  to authenticated
  using (private.is_shop_member(shop_id))
  with check (private.is_shop_member(shop_id));

drop policy if exists "jobs_delete_shop_admin" on jobs;
create policy "jobs_delete_shop_admin"
  on jobs
  for delete
  to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'admin']));

drop policy if exists "job_daily_sequences_member" on job_daily_sequences;
create policy "job_daily_sequences_member"
  on job_daily_sequences
  for all
  to authenticated
  using (private.is_shop_member(shop_id))
  with check (private.is_shop_member(shop_id));

drop policy if exists "job_parts_member" on job_parts;
create policy "job_parts_member"
  on job_parts
  for all
  to authenticated
  using (private.can_access_job(job_id))
  with check (private.can_access_job(job_id));

drop policy if exists "job_services_member" on job_services;
create policy "job_services_member"
  on job_services
  for all
  to authenticated
  using (private.can_access_job(job_id))
  with check (private.can_access_job(job_id));

drop policy if exists "work_logs_member" on work_logs;
create policy "work_logs_member"
  on work_logs
  for all
  to authenticated
  using (private.can_access_job(job_id))
  with check (private.can_access_job(job_id));

drop policy if exists "job_images_member" on job_images;
create policy "job_images_member"
  on job_images
  for all
  to authenticated
  using (private.can_access_job(job_id))
  with check (private.can_access_job(job_id));

drop policy if exists "customer_messages_select_public" on customer_messages;
drop policy if exists "customer_messages_insert_public" on customer_messages;
drop policy if exists "customer_messages_update_public" on customer_messages;
drop policy if exists "customer_messages_member" on customer_messages;
create policy "customer_messages_member"
  on customer_messages
  for all
  to authenticated
  using (private.can_access_job(job_id))
  with check (private.can_access_job(job_id));

drop policy if exists "job_events_select_public" on job_events;
drop policy if exists "job_events_insert_public" on job_events;
drop policy if exists "job_events_member" on job_events;
create policy "job_events_member"
  on job_events
  for all
  to authenticated
  using (private.can_access_job(job_id))
  with check (private.can_access_job(job_id));

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
grant select, insert, update, delete on shop_members to authenticated;
grant select, insert, update, delete on jobs to authenticated;
grant select, insert, update on job_daily_sequences to authenticated;
grant select, insert, update, delete on job_parts to authenticated;
grant select, insert, update, delete on job_services to authenticated;
grant select, insert, update, delete on work_logs to authenticated;
grant select, insert, update, delete on job_images to authenticated;
grant select, insert, update, delete on customer_messages to authenticated;
grant select, insert, update, delete on job_events to authenticated;

revoke execute on function create_job_with_number(jsonb) from anon;
grant execute on function create_job_with_number(jsonb) to authenticated;

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
