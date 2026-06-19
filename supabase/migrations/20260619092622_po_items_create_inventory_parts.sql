-- Hotfix: purchase order line items must link to real inventory parts before stock is received.
-- Existing nullable purchase_order_items.part_id rows remain compatible; receive repairs them when possible.

create or replace function public.receive_purchase_order_items(
  p_purchase_order_id uuid,
  p_items jsonb,
  p_note text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  target_order public.purchase_orders%rowtype;
  target_item public.purchase_order_items%rowtype;
  target_part public.parts%rowtype;
  receipt_row public.inventory_receipts%rowtype;
  receipt_item_row public.inventory_receipt_items%rowtype;
  item_payload jsonb;
  item_id uuid;
  safe_quantity integer;
  raw_unit_cost text;
  safe_unit_cost numeric(10, 2);
  remaining_quantity integer;
  received_rows integer := 0;
  received_units integer := 0;
  linked_parts_created integer := 0;
  current_quantity_for_average integer;
  current_average_cost numeric;
  next_average_cost numeric(10, 2);
  next_status text;
  safe_description text;
  safe_vendor_sku text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Receipt items must be a non-empty JSON array.';
  end if;

  select *
  into target_order
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;

  if target_order.id is null or not private.can_write_shop(target_order.shop_id) then
    raise exception 'Not allowed to receive this purchase order.'
      using errcode = '42501';
  end if;

  if target_order.status = 'cancelled' then
    raise exception 'Cancelled purchase orders cannot be received.';
  end if;

  insert into public.inventory_receipts (
    shop_id,
    purchase_order_id,
    vendor_id,
    received_by,
    notes
  )
  values (
    target_order.shop_id,
    target_order.id,
    target_order.vendor_id,
    auth.uid(),
    nullif(left(btrim(coalesce(p_note, '')), 500), '')
  )
  returning * into receipt_row;

  for item_payload in select value from jsonb_array_elements(p_items)
  loop
    item_id := nullif(coalesce(item_payload->>'purchaseOrderItemId', item_payload->>'purchase_order_item_id', item_payload->>'id'), '')::uuid;
    safe_quantity := coalesce(nullif(coalesce(item_payload->>'quantityReceived', item_payload->>'quantity_received', item_payload->>'quantity'), '')::integer, 0);
    raw_unit_cost := nullif(coalesce(item_payload->>'unitCost', item_payload->>'unit_cost'), '');

    if item_id is null then
      raise exception 'Purchase order item id is required.';
    end if;

    if safe_quantity < 1 or safe_quantity > 999999 then
      raise exception 'Receipt quantity must be between 1 and 999999.';
    end if;

    if raw_unit_cost is not null and raw_unit_cost !~ '^[0-9]+(\.[0-9]{1,2})?$' then
      raise exception 'Unit cost must be a non-negative amount with up to two decimals.';
    end if;

    select *
    into target_item
    from public.purchase_order_items
    where id = item_id
      and purchase_order_id = target_order.id
      and shop_id = target_order.shop_id
    for update;

    if target_item.id is null then
      raise exception 'Purchase order item was not found for this shop.'
        using errcode = '42501';
    end if;

    remaining_quantity := target_item.quantity_ordered - target_item.quantity_received;
    if safe_quantity > remaining_quantity then
      raise exception 'Receipt quantity cannot exceed remaining ordered quantity.';
    end if;

    safe_unit_cost := round(coalesce(raw_unit_cost::numeric, target_item.unit_cost, 0), 2);
    if safe_unit_cost < 0 or safe_unit_cost > 999999.99 then
      raise exception 'Unit cost must be between 0 and 999999.99.';
    end if;

    if target_item.part_id is not null then
      select *
      into target_part
      from public.parts
      where id = target_item.part_id
        and shop_id = target_order.shop_id
      for update;

      if target_part.id is null then
        raise exception 'Purchase order part is not available for this shop.'
          using errcode = '42501';
      end if;
    else
      safe_description := left(btrim(coalesce(target_item.description, '')), 240);
      safe_vendor_sku := nullif(left(btrim(coalesce(target_item.vendor_sku, '')), 120), '');

      if safe_description = '' then
        raise exception 'Purchase order item must be linked to an inventory part before receiving.';
      end if;

      insert into public.parts (
        shop_id,
        vendor_id,
        name,
        vendor_sku,
        unit_cost,
        retail_price,
        quantity_on_hand,
        reorder_point,
        desired_stock_level,
        last_cost,
        average_cost,
        is_active
      )
      values (
        target_order.shop_id,
        target_order.vendor_id,
        safe_description,
        safe_vendor_sku,
        safe_unit_cost,
        0,
        0,
        0,
        0,
        safe_unit_cost,
        safe_unit_cost,
        true
      )
      returning * into target_part;

      update public.purchase_order_items
      set
        part_id = target_part.id,
        vendor_sku = coalesce(nullif(btrim(vendor_sku), ''), target_part.vendor_sku),
        unit_cost = safe_unit_cost
      where id = target_item.id
      returning * into target_item;

      linked_parts_created := linked_parts_created + 1;
    end if;

    insert into public.inventory_receipt_items (
      shop_id,
      inventory_receipt_id,
      purchase_order_id,
      purchase_order_item_id,
      part_id,
      description,
      vendor_sku,
      quantity_received,
      unit_cost
    )
    values (
      target_order.shop_id,
      receipt_row.id,
      target_order.id,
      target_item.id,
      target_part.id,
      target_item.description,
      coalesce(target_item.vendor_sku, target_part.vendor_sku),
      safe_quantity,
      safe_unit_cost
    )
    returning * into receipt_item_row;

    current_quantity_for_average := greatest(coalesce(target_part.quantity_on_hand, 0), 0);
    current_average_cost := coalesce(target_part.average_cost, target_part.last_cost, target_part.unit_cost, safe_unit_cost, 0);
    next_average_cost := round(
      ((current_quantity_for_average * current_average_cost) + (safe_quantity * safe_unit_cost))
        / nullif(current_quantity_for_average + safe_quantity, 0),
      2
    );

    update public.parts
    set
      quantity_on_hand = coalesce(quantity_on_hand, 0) + safe_quantity,
      unit_cost = safe_unit_cost,
      last_cost = safe_unit_cost,
      average_cost = next_average_cost
    where id = target_part.id;

    insert into public.part_movements (
      shop_id,
      part_id,
      purchase_order_id,
      inventory_receipt_id,
      inventory_receipt_item_id,
      movement_type,
      quantity,
      unit_cost,
      retail_price,
      note,
      created_by
    )
    values (
      target_order.shop_id,
      target_part.id,
      target_order.id,
      receipt_row.id,
      receipt_item_row.id,
      'receive',
      safe_quantity,
      safe_unit_cost,
      target_part.retail_price,
      coalesce(nullif(left(btrim(coalesce(p_note, '')), 500), ''), 'Purchase order receive ' || target_order.po_number),
      auth.uid()
    );

    update public.purchase_order_items
    set
      quantity_received = quantity_received + safe_quantity,
      unit_cost = safe_unit_cost,
      part_id = target_part.id
    where id = target_item.id;

    received_rows := received_rows + 1;
    received_units := received_units + safe_quantity;
  end loop;

  next_status := private.recalculate_purchase_order_status(target_order.id);

  return jsonb_build_object(
    'receiptId', receipt_row.id,
    'receiptNumber', receipt_row.receipt_number,
    'purchaseOrderId', target_order.id,
    'status', next_status,
    'receivedRows', received_rows,
    'receivedUnits', received_units,
    'linkedPartsCreated', linked_parts_created
  );
end;
$$;

revoke all on function public.receive_purchase_order_items(uuid, jsonb, text) from public;
revoke all on function public.receive_purchase_order_items(uuid, jsonb, text) from anon;
revoke all on function public.receive_purchase_order_items(uuid, jsonb, text) from authenticated;
grant execute on function public.receive_purchase_order_items(uuid, jsonb, text) to authenticated;