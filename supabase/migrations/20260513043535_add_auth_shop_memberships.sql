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
