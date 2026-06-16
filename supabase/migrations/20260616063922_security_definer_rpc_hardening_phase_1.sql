-- SECURITY DEFINER RPC hardening Phase 1.
--
-- This pass keeps current app RPC entry points working while making grants and
-- search paths explicit for the Supabase Security Advisor review.

create or replace function public.submit_beta_access_request(
  applicant_email text,
  applicant_name text default '',
  applicant_shop_name text default '',
  applicant_notes text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, private, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(applicant_email, '')));
  clean_name text := left(trim(coalesce(applicant_name, '')), 120);
  clean_shop_name text := left(trim(coalesce(applicant_shop_name, '')), 160);
  clean_notes text := left(trim(coalesce(applicant_notes, '')), 1500);
  matching_user_id uuid;
  request_row public.beta_access_requests%rowtype;
  next_notes text;
begin
  if normalized_email = ''
    or length(normalized_email) > 180
    or normalized_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'Please enter a valid email address.';
  end if;

  select id
  into matching_user_id
  from auth.users
  where lower(email) = normalized_email
  order by created_at desc
  limit 1;

  next_notes := trim(concat_ws(E'\n',
    nullif('Applicant: ' || clean_name, 'Applicant: '),
    nullif('Shop: ' || clean_shop_name, 'Shop: '),
    nullif(clean_notes, '')
  ));

  select *
  into request_row
  from public.beta_access_requests
  where lower(email) = normalized_email
     or (matching_user_id is not null and user_id = matching_user_id)
  order by requested_at desc
  limit 1;

  if request_row.id is null then
    insert into public.beta_access_requests (
      user_id,
      email,
      status,
      requested_at,
      notes
    )
    values (
      matching_user_id,
      normalized_email,
      'pending',
      now(),
      next_notes
    )
    returning * into request_row;
  else
    update public.beta_access_requests
    set
      user_id = coalesce(user_id, matching_user_id),
      email = normalized_email,
      requested_at = case when status = 'pending' then now() else requested_at end,
      notes = case
        when next_notes = '' then notes
        when notes = '' then next_notes
        else left(notes || E'\n\nUpdated application:\n' || next_notes, 5000)
      end
    where id = request_row.id
    returning * into request_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', request_row.status,
    'email', request_row.email,
    'requestedAt', request_row.requested_at
  );
end;
$$;

create or replace function public.add_inventory_part_to_job(
  p_job_id uuid,
  p_part_id uuid,
  p_quantity integer default 1
)
returns public.job_parts
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_job public.jobs%rowtype;
  target_part public.parts%rowtype;
  inserted_part public.job_parts%rowtype;
  safe_quantity integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  safe_quantity := coalesce(p_quantity, 1);
  if safe_quantity < 1 or safe_quantity > 9999 then
    raise exception 'Quantity must be between 1 and 9999.';
  end if;

  select * into target_job
  from public.jobs
  where id = p_job_id;

  if not found or not private.can_write_job(p_job_id) then
    raise exception 'Not allowed to add parts to this job.'
      using errcode = '42501';
  end if;

  select * into target_part
  from public.parts
  where id = p_part_id
    and shop_id = target_job.shop_id
    and is_active = true
  for update;

  if not found or not private.can_write_shop(target_job.shop_id) then
    raise exception 'Inventory part is not available for this shop.'
      using errcode = '42501';
  end if;

  update public.parts
  set quantity_on_hand = quantity_on_hand - safe_quantity
  where id = target_part.id;

  insert into public.job_parts (
    id,
    shop_id,
    job_id,
    part_id,
    name,
    sku,
    quantity,
    cost,
    retail,
    unit_cost,
    retail_price,
    created_at
  )
  values (
    gen_random_uuid(),
    target_job.shop_id,
    target_job.id,
    target_part.id,
    target_part.name,
    target_part.sku,
    safe_quantity,
    target_part.unit_cost,
    target_part.retail_price,
    target_part.unit_cost,
    target_part.retail_price,
    now()
  )
  returning * into inserted_part;

  insert into public.part_movements (
    shop_id,
    part_id,
    job_id,
    movement_type,
    quantity,
    unit_cost,
    retail_price,
    note,
    created_by
  )
  values (
    target_job.shop_id,
    target_part.id,
    target_job.id,
    'use',
    -safe_quantity,
    target_part.unit_cost,
    target_part.retail_price,
    'Added to job',
    auth.uid()
  );

  return inserted_part;
end;
$$;

create or replace function public.update_inventory_job_part_quantity(
  p_job_part_id uuid,
  p_quantity integer
)
returns public.job_parts
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_job_part public.job_parts%rowtype;
  target_part public.parts%rowtype;
  updated_job_part public.job_parts%rowtype;
  safe_quantity integer;
  quantity_delta integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  safe_quantity := coalesce(p_quantity, 1);
  if safe_quantity < 1 or safe_quantity > 9999 then
    raise exception 'Quantity must be between 1 and 9999.';
  end if;

  select * into target_job_part
  from public.job_parts
  where id = p_job_part_id
  for update;

  if not found or target_job_part.part_id is null then
    raise exception 'Inventory-backed job part not found.'
      using errcode = 'P0002';
  end if;

  if not private.can_write_job(target_job_part.job_id) or not private.can_write_shop(target_job_part.shop_id) then
    raise exception 'Not allowed to update this job part.'
      using errcode = '42501';
  end if;

  select * into target_part
  from public.parts
  where id = target_job_part.part_id
    and shop_id = target_job_part.shop_id
  for update;

  if not found then
    raise exception 'Inventory part is not available for this shop.'
      using errcode = '42501';
  end if;

  quantity_delta := safe_quantity - coalesce(target_job_part.quantity, 0)::integer;

  if quantity_delta <> 0 then
    update public.parts
    set quantity_on_hand = quantity_on_hand - quantity_delta
    where id = target_part.id;

    insert into public.part_movements (
      shop_id,
      part_id,
      job_id,
      movement_type,
      quantity,
      unit_cost,
      retail_price,
      note,
      created_by
    )
    values (
      target_job_part.shop_id,
      target_job_part.part_id,
      target_job_part.job_id,
      case when quantity_delta > 0 then 'use' else 'return' end,
      case when quantity_delta > 0 then -quantity_delta else abs(quantity_delta) end,
      coalesce(target_job_part.unit_cost, target_job_part.cost),
      coalesce(target_job_part.retail_price, target_job_part.retail),
      'Job part quantity changed',
      auth.uid()
    );
  end if;

  update public.job_parts
  set quantity = safe_quantity
  where id = target_job_part.id
  returning * into updated_job_part;

  return updated_job_part;
end;
$$;

create or replace function public.create_transaction_event(transaction_payload jsonb)
returns public.transaction_events
language plpgsql
security definer
set search_path = public, private
as $$
declare
  inserted_event public.transaction_events;
  assigned_shop_id text;
  assigned_location_id text;
  assigned_number bigint;
  assigned_customer_id uuid;
  assigned_employee_id uuid;
  assigned_reversed_transaction_id uuid;
  event_type_value text;
  source_type_value text;
  source_id_value text;
  currency_code_value text;
  subtotal_minor_value bigint;
  tax_minor_value bigint;
  total_minor_value bigint;
  metadata_value jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if transaction_payload is null or jsonb_typeof(transaction_payload) <> 'object' then
    raise exception 'Transaction payload must be a JSON object.';
  end if;

  assigned_shop_id := nullif(transaction_payload->>'shop_id', '');
  if assigned_shop_id is null then
    raise exception 'Transaction shop is required.';
  end if;

  if not private.can_write_shop(assigned_shop_id) then
    raise exception 'Not allowed to create commerce events for this shop.'
      using errcode = '42501';
  end if;

  assigned_location_id := nullif(left(coalesce(transaction_payload->>'location_id', ''), 80), '');
  assigned_customer_id := nullif(transaction_payload->>'customer_id', '')::uuid;
  assigned_employee_id := nullif(transaction_payload->>'employee_id', '')::uuid;
  assigned_reversed_transaction_id := nullif(transaction_payload->>'reversed_transaction_id', '')::uuid;
  event_type_value := left(coalesce(nullif(transaction_payload->>'event_type', ''), 'generic'), 80);
  source_type_value := left(coalesce(nullif(transaction_payload->>'source_type', ''), 'manual'), 80);
  source_id_value := nullif(left(coalesce(transaction_payload->>'source_id', ''), 120), '');
  currency_code_value := upper(left(coalesce(nullif(transaction_payload->>'currency_code', ''), 'USD'), 3));
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

  if metadata_value is null or jsonb_typeof(metadata_value) <> 'object' then
    raise exception 'Transaction metadata must be a JSON object.';
  end if;

  if assigned_customer_id is not null and not exists (
    select 1 from public.customers
    where customers.id = assigned_customer_id
      and customers.shop_id = assigned_shop_id
  ) then
    raise exception 'Customer does not belong to this shop.'
      using errcode = '42501';
  end if;

  if assigned_employee_id is not null and not exists (
    select 1 from public.shop_members
    where shop_members.user_id = assigned_employee_id
      and shop_members.shop_id = assigned_shop_id
  ) then
    raise exception 'Employee does not belong to this shop.'
      using errcode = '42501';
  end if;

  if assigned_reversed_transaction_id is not null and not exists (
    select 1 from public.transaction_events
    where transaction_events.id = assigned_reversed_transaction_id
      and transaction_events.shop_id = assigned_shop_id
  ) then
    raise exception 'Reversed transaction does not belong to this shop.'
      using errcode = '42501';
  end if;

  assigned_number := public.next_transaction_number(assigned_shop_id, assigned_location_id);

  insert into public.transaction_events (
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
    event_type_value,
    source_type_value,
    source_id_value,
    assigned_customer_id,
    assigned_employee_id,
    currency_code_value,
    subtotal_minor_value,
    tax_minor_value,
    total_minor_value,
    metadata_value,
    assigned_reversed_transaction_id,
    auth.uid()::text
  )
  returning * into inserted_event;

  return inserted_event;
end;
$$;

alter function public.get_or_create_beta_access_request()
  set search_path = public, private, auth;
alter function public.get_beta_access_requests()
  set search_path = public, private, auth;
alter function public.update_beta_access_request(uuid, text, text)
  set search_path = public, private, auth;
alter function public.get_beta_operator_dashboard()
  set search_path = public, private, auth;
alter function public.is_current_operator()
  set search_path = public, private;
alter function public.get_current_user_shop_memberships()
  set search_path = public, private, auth;
alter function public.set_shop_premium_trial(text, integer, text)
  set search_path = public, private;
alter function public.extend_shop_premium_trial(text, integer)
  set search_path = public, private;
alter function public.end_shop_premium_trial(text)
  set search_path = public, private;
alter function public.update_beta_shop_subscription(text, text, integer, boolean)
  set search_path = public, private;

revoke all on function public.submit_beta_access_request(text, text, text, text) from public;
revoke all on function public.submit_beta_access_request(text, text, text, text) from anon;
revoke all on function public.submit_beta_access_request(text, text, text, text) from authenticated;
grant execute on function public.submit_beta_access_request(text, text, text, text) to anon, authenticated;

revoke all on function public.get_or_create_beta_access_request() from public;
revoke all on function public.get_or_create_beta_access_request() from anon;
revoke all on function public.get_or_create_beta_access_request() from authenticated;
grant execute on function public.get_or_create_beta_access_request() to authenticated;

revoke all on function public.get_current_user_shop_memberships() from public;
revoke all on function public.get_current_user_shop_memberships() from anon;
revoke all on function public.get_current_user_shop_memberships() from authenticated;
grant execute on function public.get_current_user_shop_memberships() to authenticated;

revoke all on function public.is_current_operator() from public;
revoke all on function public.is_current_operator() from anon;
revoke all on function public.is_current_operator() from authenticated;
grant execute on function public.is_current_operator() to authenticated;

revoke all on function public.get_beta_access_requests() from public;
revoke all on function public.get_beta_access_requests() from anon;
revoke all on function public.get_beta_access_requests() from authenticated;
grant execute on function public.get_beta_access_requests() to authenticated;

revoke all on function public.get_beta_operator_dashboard() from public;
revoke all on function public.get_beta_operator_dashboard() from anon;
revoke all on function public.get_beta_operator_dashboard() from authenticated;
grant execute on function public.get_beta_operator_dashboard() to authenticated;

revoke all on function public.update_beta_access_request(uuid, text, text) from public;
revoke all on function public.update_beta_access_request(uuid, text, text) from anon;
revoke all on function public.update_beta_access_request(uuid, text, text) from authenticated;
grant execute on function public.update_beta_access_request(uuid, text, text) to authenticated;

revoke all on function public.update_beta_shop_subscription(text, text, integer, boolean) from public;
revoke all on function public.update_beta_shop_subscription(text, text, integer, boolean) from anon;
revoke all on function public.update_beta_shop_subscription(text, text, integer, boolean) from authenticated;
grant execute on function public.update_beta_shop_subscription(text, text, integer, boolean) to authenticated;

revoke all on function public.set_shop_premium_trial(text, integer, text) from public;
revoke all on function public.set_shop_premium_trial(text, integer, text) from anon;
revoke all on function public.set_shop_premium_trial(text, integer, text) from authenticated;
grant execute on function public.set_shop_premium_trial(text, integer, text) to authenticated;

revoke all on function public.extend_shop_premium_trial(text, integer) from public;
revoke all on function public.extend_shop_premium_trial(text, integer) from anon;
revoke all on function public.extend_shop_premium_trial(text, integer) from authenticated;
grant execute on function public.extend_shop_premium_trial(text, integer) to authenticated;

revoke all on function public.end_shop_premium_trial(text) from public;
revoke all on function public.end_shop_premium_trial(text) from anon;
revoke all on function public.end_shop_premium_trial(text) from authenticated;
grant execute on function public.end_shop_premium_trial(text) to authenticated;

revoke all on function public.add_inventory_part_to_job(uuid, uuid, integer) from public;
revoke all on function public.add_inventory_part_to_job(uuid, uuid, integer) from anon;
revoke all on function public.add_inventory_part_to_job(uuid, uuid, integer) from authenticated;
grant execute on function public.add_inventory_part_to_job(uuid, uuid, integer) to authenticated;

revoke all on function public.update_inventory_job_part_quantity(uuid, integer) from public;
revoke all on function public.update_inventory_job_part_quantity(uuid, integer) from anon;
revoke all on function public.update_inventory_job_part_quantity(uuid, integer) from authenticated;
grant execute on function public.update_inventory_job_part_quantity(uuid, integer) to authenticated;

revoke all on function public.create_transaction_event(jsonb) from public;
revoke all on function public.create_transaction_event(jsonb) from anon;
revoke all on function public.create_transaction_event(jsonb) from authenticated;
grant execute on function public.create_transaction_event(jsonb) to authenticated;
