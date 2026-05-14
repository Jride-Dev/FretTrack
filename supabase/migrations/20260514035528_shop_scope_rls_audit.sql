create or replace function private.can_write_shop(target_shop_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_shop_role(target_shop_id, array['owner', 'admin', 'tech']);
$$;

create or replace function private.can_admin_shop(target_shop_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_shop_role(target_shop_id, array['owner', 'admin']);
$$;

create or replace function private.can_write_job(target_job_id uuid)
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
     and shop_members.role = any(array['owner', 'admin', 'tech'])
    where jobs.id = target_job_id
  );
$$;

create or replace function private.can_admin_job(target_job_id uuid)
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
     and shop_members.role = any(array['owner', 'admin'])
    where jobs.id = target_job_id
  );
$$;

grant execute on function private.can_write_shop(text) to authenticated;
grant execute on function private.can_admin_shop(text) to authenticated;
grant execute on function private.can_write_job(uuid) to authenticated;
grant execute on function private.can_admin_job(uuid) to authenticated;

create or replace function next_transaction_number(
  p_shop_id text default 'default-shop',
  p_location_id text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  scoped_shop_id text;
  scoped_location text;
  next_number bigint;
begin
  scoped_shop_id := coalesce(nullif(p_shop_id, ''), 'default-shop');
  scoped_location := coalesce(p_location_id, '');

  if not private.can_write_shop(scoped_shop_id) then
    raise exception 'Not allowed to create transaction numbers for this shop.'
      using errcode = '42501';
  end if;

  insert into transaction_number_sequences (shop_id, location_scope, last_number)
  values (scoped_shop_id, scoped_location, 1)
  on conflict (shop_id, location_scope) do update
  set
    last_number = transaction_number_sequences.last_number + 1,
    updated_at = now()
  returning last_number into next_number;

  return next_number;
end;
$$;

create or replace function create_transaction_event(transaction_payload jsonb)
returns transaction_events
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_event transaction_events;
  assigned_shop_id text;
  assigned_location_id text;
  assigned_number bigint;
  assigned_customer_id uuid;
begin
  assigned_shop_id := coalesce(nullif(transaction_payload->>'shop_id', ''), 'default-shop');
  assigned_location_id := nullif(transaction_payload->>'location_id', '');
  assigned_customer_id := nullif(transaction_payload->>'customer_id', '')::uuid;

  if not private.can_write_shop(assigned_shop_id) then
    raise exception 'Not allowed to create commerce events for this shop.'
      using errcode = '42501';
  end if;

  if assigned_customer_id is not null and not exists (
    select 1 from customers
    where customers.id = assigned_customer_id
      and customers.shop_id = assigned_shop_id
  ) then
    raise exception 'Customer does not belong to this shop.'
      using errcode = '42501';
  end if;

  assigned_number := next_transaction_number(assigned_shop_id, assigned_location_id);

  insert into transaction_events (
    shop_id,
    location_id,
    location_scope,
    transaction_number,
    event_type,
    source_type,
    source_id,
    customer_id,
    employee_id,
    currency_code,
    subtotal_minor,
    tax_minor,
    total_minor,
    metadata,
    reversed_transaction_id,
    created_by
  )
  values (
    assigned_shop_id,
    assigned_location_id,
    coalesce(assigned_location_id, ''),
    assigned_number,
    coalesce(nullif(transaction_payload->>'event_type', ''), 'generic'),
    coalesce(nullif(transaction_payload->>'source_type', ''), 'manual'),
    nullif(transaction_payload->>'source_id', ''),
    assigned_customer_id,
    nullif(transaction_payload->>'employee_id', '')::uuid,
    upper(coalesce(nullif(transaction_payload->>'currency_code', ''), 'USD')),
    coalesce((transaction_payload->>'subtotal_minor')::bigint, 0),
    coalesce((transaction_payload->>'tax_minor')::bigint, 0),
    coalesce((transaction_payload->>'total_minor')::bigint, 0),
    coalesce(transaction_payload->'metadata', '{}'::jsonb),
    nullif(transaction_payload->>'reversed_transaction_id', '')::uuid,
    nullif(transaction_payload->>'created_by', '')
  )
  returning * into inserted_event;

  return inserted_event;
end;
$$;

drop policy if exists "jobs_select_shop_member" on jobs;
create policy "jobs_select_shop_member"
  on jobs
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "jobs_insert_shop_member" on jobs;
create policy "jobs_insert_shop_writer"
  on jobs
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "jobs_update_shop_member" on jobs;
create policy "jobs_update_shop_writer"
  on jobs
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (private.can_write_shop(shop_id));

drop policy if exists "jobs_delete_shop_admin" on jobs;
create policy "jobs_delete_shop_admin"
  on jobs
  for delete
  to authenticated
  using (private.can_admin_shop(shop_id));

drop policy if exists "customers_member" on customers;
create policy "customers_select_member"
  on customers
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

create policy "customers_insert_writer"
  on customers
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

create policy "customers_update_writer"
  on customers
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (private.can_write_shop(shop_id));

drop policy if exists "customers_delete_admin" on customers;
drop policy if exists "customers_delete_admin_without_jobs" on customers;
create policy "customers_delete_admin_without_jobs"
  on customers
  for delete
  to authenticated
  using (
    private.can_admin_shop(shop_id)
    and not exists (
      select 1
      from jobs
      where jobs.customer_id = customers.id
    )
  );

drop policy if exists "job_daily_sequences_member" on job_daily_sequences;
create policy "job_daily_sequences_select_member"
  on job_daily_sequences
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

create policy "job_daily_sequences_insert_writer"
  on job_daily_sequences
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

create policy "job_daily_sequences_update_writer"
  on job_daily_sequences
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (private.can_write_shop(shop_id));

drop policy if exists "job_parts_member" on job_parts;
create policy "job_parts_select_member"
  on job_parts
  for select
  to authenticated
  using (private.can_access_job(job_id));

create policy "job_parts_insert_writer"
  on job_parts
  for insert
  to authenticated
  with check (private.can_write_job(job_id));

create policy "job_parts_update_writer"
  on job_parts
  for update
  to authenticated
  using (private.can_write_job(job_id))
  with check (private.can_write_job(job_id));

create policy "job_parts_delete_writer"
  on job_parts
  for delete
  to authenticated
  using (private.can_write_job(job_id));

drop policy if exists "job_services_member" on job_services;
create policy "job_services_select_member"
  on job_services
  for select
  to authenticated
  using (private.can_access_job(job_id));

create policy "job_services_insert_writer"
  on job_services
  for insert
  to authenticated
  with check (private.can_write_job(job_id));

create policy "job_services_update_writer"
  on job_services
  for update
  to authenticated
  using (private.can_write_job(job_id))
  with check (private.can_write_job(job_id));

create policy "job_services_delete_writer"
  on job_services
  for delete
  to authenticated
  using (private.can_write_job(job_id));

drop policy if exists "work_logs_member" on work_logs;
create policy "work_logs_select_member"
  on work_logs
  for select
  to authenticated
  using (private.can_access_job(job_id));

create policy "work_logs_insert_writer"
  on work_logs
  for insert
  to authenticated
  with check (private.can_write_job(job_id));

create policy "work_logs_update_writer"
  on work_logs
  for update
  to authenticated
  using (private.can_write_job(job_id))
  with check (private.can_write_job(job_id));

create policy "work_logs_delete_writer"
  on work_logs
  for delete
  to authenticated
  using (private.can_write_job(job_id));

drop policy if exists "job_images_member" on job_images;
create policy "job_images_select_member"
  on job_images
  for select
  to authenticated
  using (private.can_access_job(job_id));

create policy "job_images_insert_writer"
  on job_images
  for insert
  to authenticated
  with check (private.can_write_job(job_id));

create policy "job_images_update_writer"
  on job_images
  for update
  to authenticated
  using (private.can_write_job(job_id))
  with check (private.can_write_job(job_id));

create policy "job_images_delete_writer"
  on job_images
  for delete
  to authenticated
  using (private.can_write_job(job_id));

drop policy if exists "job_images_storage_select_member" on storage.objects;
create policy "job_images_storage_select_member"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'job-images'
    and private.can_access_job(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "job_images_storage_insert_writer" on storage.objects;
create policy "job_images_storage_insert_writer"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'job-images'
    and private.can_write_job(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "job_images_storage_update_writer" on storage.objects;
create policy "job_images_storage_update_writer"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'job-images'
    and private.can_write_job(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'job-images'
    and private.can_write_job(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "job_images_storage_delete_writer" on storage.objects;
create policy "job_images_storage_delete_writer"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'job-images'
    and private.can_write_job(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "customer_messages_member" on customer_messages;
create policy "customer_messages_select_member"
  on customer_messages
  for select
  to authenticated
  using (private.can_access_job(job_id));

create policy "customer_messages_insert_writer"
  on customer_messages
  for insert
  to authenticated
  with check (private.can_write_job(job_id));

create policy "customer_messages_update_writer"
  on customer_messages
  for update
  to authenticated
  using (private.can_write_job(job_id))
  with check (private.can_write_job(job_id));

create policy "customer_messages_delete_admin"
  on customer_messages
  for delete
  to authenticated
  using (private.can_admin_job(job_id));

drop policy if exists "job_events_member" on job_events;
create policy "job_events_select_member"
  on job_events
  for select
  to authenticated
  using (private.is_shop_member(shop_id) and private.can_access_job(job_id));

create policy "job_events_insert_writer"
  on job_events
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id) and private.can_write_job(job_id));

drop policy if exists "currencies_read_public" on currencies;
create policy "currencies_select_authenticated"
  on currencies
  for select
  to authenticated
  using (true);

drop policy if exists "tax_profiles_read_public" on tax_profiles;
create policy "tax_profiles_select_member"
  on tax_profiles
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

create policy "tax_profiles_insert_admin"
  on tax_profiles
  for insert
  to authenticated
  with check (private.can_admin_shop(shop_id));

create policy "tax_profiles_update_admin"
  on tax_profiles
  for update
  to authenticated
  using (private.can_admin_shop(shop_id))
  with check (private.can_admin_shop(shop_id));

create policy "tax_profiles_delete_admin"
  on tax_profiles
  for delete
  to authenticated
  using (private.can_admin_shop(shop_id));

drop policy if exists "payment_methods_read_public" on payment_methods;
create policy "payment_methods_select_member"
  on payment_methods
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

create policy "payment_methods_insert_admin"
  on payment_methods
  for insert
  to authenticated
  with check (private.can_admin_shop(shop_id));

create policy "payment_methods_update_admin"
  on payment_methods
  for update
  to authenticated
  using (private.can_admin_shop(shop_id))
  with check (private.can_admin_shop(shop_id));

create policy "payment_methods_delete_admin"
  on payment_methods
  for delete
  to authenticated
  using (private.can_admin_shop(shop_id));

drop policy if exists "transaction_events_read_public" on transaction_events;
create policy "transaction_events_select_member"
  on transaction_events
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

create policy "transaction_events_insert_writer"
  on transaction_events
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "payment_events_read_public" on payment_events;
create policy "payment_events_select_member"
  on payment_events
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

create policy "payment_events_insert_writer"
  on payment_events
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "inventory_movements_read_public" on inventory_movements;
create policy "inventory_movements_select_member"
  on inventory_movements
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

create policy "inventory_movements_insert_writer"
  on inventory_movements
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "transaction_number_sequences_member" on transaction_number_sequences;
create policy "transaction_number_sequences_select_member"
  on transaction_number_sequences
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

create policy "transaction_number_sequences_insert_writer"
  on transaction_number_sequences
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

create policy "transaction_number_sequences_update_writer"
  on transaction_number_sequences
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (private.can_write_shop(shop_id));

revoke all on currencies, tax_profiles, payment_methods, transaction_events, payment_events, inventory_movements from anon;
revoke execute on function create_transaction_event(jsonb) from anon;
revoke execute on function next_transaction_number(text, text) from anon;

grant select on currencies to authenticated;
grant select, insert, update, delete on tax_profiles, payment_methods to authenticated;
grant select, insert on transaction_events, payment_events, inventory_movements to authenticated;
grant select, insert, update on transaction_number_sequences to authenticated;
grant execute on function create_transaction_event(jsonb) to authenticated;
grant execute on function next_transaction_number(text, text) to authenticated;
