-- Connect Pro amplifier/keyboard work orders to the existing inventory purchasing flow.
-- Receiving remains an inventory action; adding a received part to billing remains an
-- explicit, idempotent action so package quantities are never billed accidentally.

alter table public.purchase_order_items
  add column job_id uuid references public.jobs(id) on delete set null,
  add column job_quantity integer check (job_quantity is null or job_quantity between 1 and 999999),
  add column job_part_id uuid references public.job_parts(id) on delete set null,
  add column specialist_request_key uuid;

alter table public.keyboard_part_requests
  add column purchase_order_item_id uuid references public.purchase_order_items(id) on delete set null;

create index purchase_order_items_job_idx
  on public.purchase_order_items (job_id, created_at desc)
  where job_id is not null;

create unique index purchase_order_items_specialist_request_key_uidx
  on public.purchase_order_items (specialist_request_key)
  where specialist_request_key is not null;

create unique index purchase_order_items_job_part_uidx
  on public.purchase_order_items (job_part_id)
  where job_part_id is not null;

create unique index keyboard_part_requests_purchase_order_item_uidx
  on public.keyboard_part_requests (purchase_order_item_id)
  where purchase_order_item_id is not null;

create or replace function public.validate_purchase_order_item_scope()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  parent_order public.purchase_orders%rowtype;
  parent_part public.parts%rowtype;
  parent_job public.jobs%rowtype;
  parent_job_part public.job_parts%rowtype;
  specialist_type text;
begin
  select * into parent_order
  from public.purchase_orders
  where id = new.purchase_order_id;

  if parent_order.id is null then
    raise exception 'Purchase order not found.';
  end if;

  new.shop_id := parent_order.shop_id;
  new.quantity_ordered := coalesce(new.quantity_ordered, 0);
  new.quantity_received := coalesce(new.quantity_received, 0);
  new.unit_cost := greatest(coalesce(new.unit_cost, 0), 0);

  if new.quantity_ordered < 1 then
    raise exception 'Quantity ordered must be at least 1.';
  end if;

  if new.quantity_received < 0 or new.quantity_received > new.quantity_ordered then
    raise exception 'Quantity received cannot exceed quantity ordered.';
  end if;

  if new.part_id is not null then
    select * into parent_part
    from public.parts
    where id = new.part_id;

    if parent_part.id is null or parent_part.shop_id <> new.shop_id then
      raise exception 'Purchase order item part must belong to the purchase order shop.'
        using errcode = '42501';
    end if;

    new.description := coalesce(nullif(btrim(new.description), ''), parent_part.name);
    new.vendor_sku := coalesce(nullif(btrim(new.vendor_sku), ''), parent_part.vendor_sku);
  end if;

  if new.job_id is not null then
    select * into parent_job
    from public.jobs
    where id = new.job_id;

    if parent_job.id is null or parent_job.shop_id <> new.shop_id then
      raise exception 'Linked work order must belong to the purchase order shop.'
        using errcode = '42501';
    end if;

    specialist_type := lower(coalesce(parent_job.tech_details ->> 'instrumentType', ''));
    if specialist_type not in ('amplifier', 'keyboard') then
      raise exception 'Only amplifier and keyboard work orders can use the specialist purchasing bridge.'
        using errcode = '22023';
    end if;

    if not private.shop_has_entitlement(parent_job.shop_id, specialist_type || '_repair') then
      raise exception 'The specialist repair module is not enabled for this shop.'
        using errcode = '42501';
    end if;

    new.job_quantity := coalesce(new.job_quantity, new.quantity_ordered);
  elsif new.job_quantity is not null or new.job_part_id is not null or new.specialist_request_key is not null then
    raise exception 'Specialist purchase metadata requires a linked work order.'
      using errcode = '22023';
  end if;

  if new.job_part_id is not null then
    select * into parent_job_part
    from public.job_parts
    where id = new.job_part_id;

    if parent_job_part.id is null
      or parent_job_part.shop_id <> new.shop_id
      or parent_job_part.job_id <> new.job_id
      or (new.part_id is not null and parent_job_part.part_id is distinct from new.part_id) then
      raise exception 'Billed job part must match the linked purchase order item.'
        using errcode = '42501';
    end if;
  end if;

  new.description := left(btrim(coalesce(new.description, '')), 240);
  if new.description = '' then
    raise exception 'Purchase order item description is required.';
  end if;

  return new;
end;
$$;

create or replace function private.sync_keyboard_request_from_purchase_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.job_id is null then
    return new;
  end if;

  update public.keyboard_part_requests
  set inventory_part_id = coalesce(new.part_id, inventory_part_id),
      request_status = case
        when job_part_id is not null then 'installed'
        when new.quantity_received > 0 then 'received'
        else request_status
      end
  where purchase_order_item_id = new.id;

  return new;
end;
$$;

drop trigger if exists purchase_order_items_sync_keyboard_request on public.purchase_order_items;
create trigger purchase_order_items_sync_keyboard_request
  after update of part_id, quantity_received, job_part_id on public.purchase_order_items
  for each row execute function private.sync_keyboard_request_from_purchase_item();

create or replace function private.release_cancelled_keyboard_purchase_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status and new.status = 'cancelled' then
    update public.keyboard_part_requests as request
    set purchase_order_item_id = null,
        request_status = case when request.job_part_id is null then 'requested' else request.request_status end
    from public.purchase_order_items as item
    where item.purchase_order_id = new.id
      and request.purchase_order_item_id = item.id
      and request.job_part_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists purchase_orders_release_cancelled_keyboard_link on public.purchase_orders;
create trigger purchase_orders_release_cancelled_keyboard_link
  after update of status on public.purchase_orders
  for each row execute function private.release_cancelled_keyboard_purchase_link();

create or replace function public.create_specialist_purchase_order(
  p_job_id uuid,
  p_request_key uuid,
  p_vendor_id uuid,
  p_part_id uuid,
  p_keyboard_part_request_id uuid,
  p_description text,
  p_vendor_sku text,
  p_quantity_ordered integer,
  p_job_quantity integer,
  p_purchase_unit text,
  p_units_per_purchase_unit integer,
  p_unit_cost numeric,
  p_retail_price numeric,
  p_expected_at date default null,
  p_notes text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_job public.jobs%rowtype;
  target_vendor public.vendors%rowtype;
  target_part public.parts%rowtype;
  target_request public.keyboard_part_requests%rowtype;
  existing_item public.purchase_order_items%rowtype;
  existing_order public.purchase_orders%rowtype;
  created_order public.purchase_orders%rowtype;
  created_item public.purchase_order_items%rowtype;
  specialist_type text;
  safe_description text := left(btrim(coalesce(p_description, '')), 240);
  safe_purchase_unit text := lower(btrim(coalesce(p_purchase_unit, 'each')));
  safe_units integer := coalesce(p_units_per_purchase_unit, 1);
  safe_order_quantity integer := coalesce(p_quantity_ordered, 0);
  safe_job_quantity integer := coalesce(p_job_quantity, 0);
  safe_unit_cost numeric(10,2) := round(coalesce(p_unit_cost, 0), 2);
  safe_retail_price numeric(10,2) := round(coalesce(p_retail_price, 0), 2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'A request key is required.' using errcode = '22023';
  end if;

  select * into existing_item
  from public.purchase_order_items
  where specialist_request_key = p_request_key;

  if found then
    if existing_item.job_id <> p_job_id or not private.can_write_job(existing_item.job_id) then
      raise exception 'The request key is already used by another work order.' using errcode = '23505';
    end if;
    select * into existing_order from public.purchase_orders where id = existing_item.purchase_order_id;
    return jsonb_build_object('purchaseOrder', to_jsonb(existing_order), 'item', to_jsonb(existing_item), 'replayed', true);
  end if;

  select * into target_job
  from public.jobs
  where id = p_job_id
  for update;

  if target_job.id is null or not private.can_write_job(target_job.id) then
    raise exception 'Not allowed to order parts for this work order.' using errcode = '42501';
  end if;

  specialist_type := lower(coalesce(target_job.tech_details ->> 'instrumentType', ''));
  if specialist_type not in ('amplifier', 'keyboard')
    or not private.shop_has_entitlement(target_job.shop_id, specialist_type || '_repair') then
    raise exception 'This Pro specialist repair module is not enabled for the shop.' using errcode = '42501';
  end if;

  select * into target_vendor
  from public.vendors
  where id = p_vendor_id and shop_id = target_job.shop_id and is_active = true;
  if target_vendor.id is null then
    raise exception 'Choose an active vendor from this shop.' using errcode = '22023';
  end if;

  if safe_order_quantity < 1 or safe_order_quantity > 999999
    or safe_job_quantity < 1 or safe_job_quantity > 999999 then
    raise exception 'Order and work-order quantities must be between 1 and 999999.' using errcode = '22023';
  end if;
  if safe_units < 1 or safe_units > 999999 then
    raise exception 'Units per purchase unit must be between 1 and 999999.' using errcode = '22023';
  end if;
  if safe_purchase_unit not in ('each', 'pack', 'box', 'bag', 'case', 'set', 'roll', 'bottle') then
    raise exception 'Purchase unit is not supported.' using errcode = '22023';
  end if;
  if safe_unit_cost < 0 or safe_unit_cost > 999999.99 or safe_retail_price < 0 or safe_retail_price > 999999.99 then
    raise exception 'Cost and customer price must be between 0 and 999999.99.' using errcode = '22023';
  end if;

  if p_keyboard_part_request_id is not null then
    if specialist_type <> 'keyboard' then
      raise exception 'Keyboard parts requests can only be linked to keyboard work orders.' using errcode = '22023';
    end if;
    select * into target_request
    from public.keyboard_part_requests
    where id = p_keyboard_part_request_id and job_id = target_job.id
    for update;
    if target_request.id is null then
      raise exception 'Keyboard parts request was not found for this work order.' using errcode = '22023';
    end if;
    if target_request.job_part_id is not null or target_request.request_status in ('installed', 'not_needed') then
      raise exception 'This keyboard parts request is already closed.' using errcode = '22023';
    end if;
    if target_request.purchase_order_item_id is not null then
      raise exception 'This keyboard parts request already has a purchase order.' using errcode = '23505';
    end if;
    safe_description := coalesce(nullif(safe_description, ''), target_request.requested_part);
    safe_job_quantity := target_request.quantity;
  end if;

  if p_part_id is not null then
    select * into target_part
    from public.parts
    where id = p_part_id and shop_id = target_job.shop_id and is_active = true;
    if target_part.id is null then
      raise exception 'The selected inventory part is not available for this shop.' using errcode = '22023';
    end if;
    safe_description := coalesce(nullif(safe_description, ''), target_part.name);
    safe_purchase_unit := target_part.purchase_unit;
    safe_units := target_part.units_per_purchase_unit;
  else
    if safe_description = '' then
      raise exception 'Enter a part name.' using errcode = '22023';
    end if;
    insert into public.parts (
      shop_id, vendor_id, name, vendor_sku, purchase_unit, units_per_purchase_unit,
      unit_cost, retail_price, quantity_on_hand, reorder_point, desired_stock_level,
      last_cost, average_cost, special_order, is_active
    ) values (
      target_job.shop_id, target_vendor.id, safe_description,
      nullif(left(btrim(coalesce(p_vendor_sku, '')), 120), ''), safe_purchase_unit, safe_units,
      round(safe_unit_cost / safe_units, 2), safe_retail_price, 0, 0, 0,
      round(safe_unit_cost / safe_units, 2), round(safe_unit_cost / safe_units, 2), true, true
    ) returning * into target_part;
  end if;

  insert into public.purchase_orders (
    shop_id, vendor_id, status, ordered_at, expected_at, notes, created_by
  ) values (
    target_job.shop_id, target_vendor.id, 'ordered', current_date, p_expected_at,
    nullif(left(btrim(coalesce(p_notes, '')), 500), ''), auth.uid()
  ) returning * into created_order;

  insert into public.purchase_order_items (
    shop_id, purchase_order_id, part_id, description, vendor_sku,
    quantity_ordered, quantity_received, purchase_unit, units_per_purchase_unit,
    unit_cost, job_id, job_quantity, specialist_request_key
  ) values (
    target_job.shop_id, created_order.id, target_part.id, safe_description,
    coalesce(nullif(left(btrim(coalesce(p_vendor_sku, '')), 120), ''), target_part.vendor_sku),
    safe_order_quantity, 0, safe_purchase_unit, safe_units, safe_unit_cost,
    target_job.id, safe_job_quantity, p_request_key
  ) returning * into created_item;

  if target_request.id is not null then
    update public.keyboard_part_requests
    set inventory_part_id = target_part.id,
        purchase_order_item_id = created_item.id,
        request_status = 'ordered'
    where id = target_request.id;
  end if;

  return jsonb_build_object('purchaseOrder', to_jsonb(created_order), 'item', to_jsonb(created_item), 'replayed', false);
end;
$$;

create or replace function public.fulfill_specialist_purchase_order_item(p_purchase_order_item_id uuid)
returns public.job_parts
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  target_item public.purchase_order_items%rowtype;
  target_request public.keyboard_part_requests%rowtype;
  fulfilled_part public.job_parts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into target_item
  from public.purchase_order_items
  where id = p_purchase_order_item_id
  for update;

  if target_item.id is null or target_item.job_id is null or not private.can_write_job(target_item.job_id) then
    raise exception 'Linked purchase order item was not found or is not writable.' using errcode = '42501';
  end if;
  if target_item.job_part_id is not null then
    select * into fulfilled_part from public.job_parts where id = target_item.job_part_id;
    if found then return fulfilled_part; end if;
  end if;
  if target_item.part_id is null or target_item.quantity_received < 1 then
    raise exception 'Receive this purchase order item before adding it to the work order.' using errcode = '22023';
  end if;

  select * into target_request
  from public.keyboard_part_requests
  where purchase_order_item_id = target_item.id
  for update;

  if target_request.id is not null then
    fulfilled_part := public.fulfill_keyboard_part_request(target_request.id);
  else
    fulfilled_part := public.add_inventory_part_to_job(target_item.job_id, target_item.part_id, target_item.job_quantity);
  end if;

  update public.purchase_order_items
  set job_part_id = fulfilled_part.id
  where id = target_item.id;

  return fulfilled_part;
end;
$$;

revoke all on function private.sync_keyboard_request_from_purchase_item() from public, anon, authenticated, service_role;
revoke all on function private.release_cancelled_keyboard_purchase_link() from public, anon, authenticated, service_role;
revoke all on function public.create_specialist_purchase_order(uuid, uuid, uuid, uuid, uuid, text, text, integer, integer, text, integer, numeric, numeric, date, text) from public, anon, authenticated;
revoke all on function public.fulfill_specialist_purchase_order_item(uuid) from public, anon, authenticated;
grant execute on function public.create_specialist_purchase_order(uuid, uuid, uuid, uuid, uuid, text, text, integer, integer, text, integer, numeric, numeric, date, text) to authenticated;
grant execute on function public.fulfill_specialist_purchase_order_item(uuid) to authenticated;

comment on column public.purchase_order_items.job_id is 'Specialist work order that requested this purchase line, when applicable.';
comment on column public.purchase_order_items.job_quantity is 'Inventory units to add to the linked work order after receipt; separate from vendor package quantity.';
comment on column public.purchase_order_items.job_part_id is 'Billing part created by explicit specialist purchase fulfillment.';
comment on column public.purchase_order_items.specialist_request_key is 'Client idempotency key for one specialist purchase request.';
comment on column public.keyboard_part_requests.purchase_order_item_id is 'Current purchase order line fulfilling this keyboard request.';
comment on function public.create_specialist_purchase_order(uuid, uuid, uuid, uuid, uuid, text, text, integer, integer, text, integer, numeric, numeric, date, text) is
  'Atomically and idempotently creates one job-linked PO line for a Pro amplifier or keyboard work order.';
comment on function public.fulfill_specialist_purchase_order_item(uuid) is
  'Idempotently adds a received specialist PO line to the linked work order and inventory billing flow.';
