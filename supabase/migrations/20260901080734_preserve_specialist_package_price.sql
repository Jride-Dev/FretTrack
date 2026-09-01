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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request_key::text, 0)
  );

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
      purchase_unit_cost, unit_cost, retail_price, quantity_on_hand, reorder_point,
      desired_stock_level, last_cost, average_cost, special_order, is_active
    ) values (
      target_job.shop_id, target_vendor.id, safe_description,
      nullif(left(btrim(coalesce(p_vendor_sku, '')), 120), ''), safe_purchase_unit, safe_units,
      safe_unit_cost, round(safe_unit_cost / safe_units, 2), safe_retail_price, 0, 0, 0,
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

revoke all on function public.create_specialist_purchase_order(uuid, uuid, uuid, uuid, uuid, text, text, integer, integer, text, integer, numeric, numeric, date, text) from public, anon, authenticated;
grant execute on function public.create_specialist_purchase_order(uuid, uuid, uuid, uuid, uuid, text, text, integer, integer, text, integer, numeric, numeric, date, text) to authenticated;

comment on function public.create_specialist_purchase_order(uuid, uuid, uuid, uuid, uuid, text, text, integer, integer, text, integer, numeric, numeric, date, text) is
  'Atomically and idempotently creates one job-linked PO line while preserving the exact whole-package vendor price on newly created specialist parts.';
