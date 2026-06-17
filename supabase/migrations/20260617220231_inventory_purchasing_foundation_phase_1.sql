-- Inventory Purchasing Foundation Phase 1.
--
-- Adds shop-scoped vendors, purchase orders, receiving history, barcode
-- identity fields, and transactional receiving RPCs without renaming or
-- replacing the existing parts / part_movements / job_parts model.

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parts
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null,
  add column if not exists vendor_sku text,
  add column if not exists barcode_code text,
  add column if not exists desired_stock_level integer not null default 0,
  add column if not exists last_cost numeric(10, 2),
  add column if not exists average_cost numeric(10, 2);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  po_number text not null default (
    'PO-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  ),
  status text not null default 'draft' check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  ordered_at date,
  expected_at date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  part_id uuid references public.parts(id) on delete set null,
  description text not null,
  vendor_sku text,
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0 check (quantity_received >= 0),
  unit_cost numeric(10, 2) not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_received <= quantity_ordered)
);

create table if not exists public.inventory_receipts (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  receipt_number text not null default (
    'RCV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  ),
  received_at timestamptz not null default now(),
  received_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_receipt_items (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  inventory_receipt_id uuid not null references public.inventory_receipts(id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  purchase_order_item_id uuid references public.purchase_order_items(id) on delete set null,
  part_id uuid references public.parts(id) on delete set null,
  description text not null,
  vendor_sku text,
  quantity_received integer not null check (quantity_received > 0),
  unit_cost numeric(10, 2) not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now()
);

alter table public.part_movements
  add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  add column if not exists inventory_receipt_id uuid references public.inventory_receipts(id) on delete set null,
  add column if not exists inventory_receipt_item_id uuid references public.inventory_receipt_items(id) on delete set null;

update public.parts
set
  barcode_code = coalesce(nullif(barcode_code, ''), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  desired_stock_level = coalesce(desired_stock_level, 0),
  last_cost = coalesce(last_cost, unit_cost),
  average_cost = coalesce(average_cost, unit_cost)
where barcode_code is null
   or barcode_code = ''
   or desired_stock_level is null
   or last_cost is null
   or average_cost is null;

create unique index if not exists vendors_shop_name_idx on public.vendors (shop_id, lower(name));
create index if not exists vendors_shop_active_idx on public.vendors (shop_id, is_active);
create index if not exists parts_shop_vendor_idx on public.parts (shop_id, vendor_id);
create index if not exists parts_shop_vendor_sku_idx on public.parts (shop_id, vendor_sku);
create unique index if not exists parts_shop_barcode_code_unique on public.parts (shop_id, barcode_code) where barcode_code is not null;
create index if not exists purchase_orders_shop_status_idx on public.purchase_orders (shop_id, status);
create unique index if not exists purchase_orders_shop_number_unique on public.purchase_orders (shop_id, po_number);
create index if not exists purchase_order_items_order_idx on public.purchase_order_items (purchase_order_id);
create index if not exists purchase_order_items_part_idx on public.purchase_order_items (shop_id, part_id);
create index if not exists inventory_receipts_shop_created_idx on public.inventory_receipts (shop_id, created_at desc);
create index if not exists inventory_receipts_po_idx on public.inventory_receipts (purchase_order_id);
create index if not exists inventory_receipt_items_part_idx on public.inventory_receipt_items (shop_id, part_id);
create index if not exists part_movements_receipt_idx on public.part_movements (inventory_receipt_id);

create or replace function public.ensure_part_barcode_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  candidate_code text;
begin
  if new.barcode_code is not null then
    new.barcode_code := upper(left(regexp_replace(new.barcode_code, '[^A-Za-z0-9_-]', '', 'g'), 64));
  end if;

  if new.barcode_code is null or btrim(new.barcode_code) = '' then
    loop
      candidate_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
      exit when not exists (
        select 1
        from public.parts
        where shop_id = new.shop_id
          and barcode_code = candidate_code
          and (new.id is null or id <> new.id)
      );
    end loop;
    new.barcode_code := candidate_code;
  end if;

  new.desired_stock_level := greatest(coalesce(new.desired_stock_level, 0), 0);
  new.last_cost := coalesce(new.last_cost, new.unit_cost);
  new.average_cost := coalesce(new.average_cost, new.unit_cost);

  return new;
end;
$$;

drop trigger if exists parts_ensure_barcode_code on public.parts;
create trigger parts_ensure_barcode_code
  before insert or update on public.parts
  for each row
  execute function public.ensure_part_barcode_code();

create or replace function public.validate_purchase_order_item_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_order public.purchase_orders%rowtype;
  parent_part public.parts%rowtype;
begin
  select *
  into parent_order
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
    select *
    into parent_part
    from public.parts
    where id = new.part_id;

    if parent_part.id is null or parent_part.shop_id <> new.shop_id then
      raise exception 'Purchase order item part must belong to the purchase order shop.'
        using errcode = '42501';
    end if;

    new.description := coalesce(nullif(btrim(new.description), ''), parent_part.name);
    new.vendor_sku := coalesce(nullif(btrim(new.vendor_sku), ''), parent_part.vendor_sku);
  end if;

  new.description := left(btrim(coalesce(new.description, '')), 240);
  if new.description = '' then
    raise exception 'Purchase order item description is required.';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_order_items_validate_scope on public.purchase_order_items;
create trigger purchase_order_items_validate_scope
  before insert or update on public.purchase_order_items
  for each row
  execute function public.validate_purchase_order_item_scope();

create or replace function public.validate_inventory_receipt_item_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_receipt public.inventory_receipts%rowtype;
  parent_order_item public.purchase_order_items%rowtype;
  parent_part public.parts%rowtype;
begin
  select *
  into parent_receipt
  from public.inventory_receipts
  where id = new.inventory_receipt_id;

  if parent_receipt.id is null then
    raise exception 'Inventory receipt not found.';
  end if;

  new.shop_id := parent_receipt.shop_id;
  new.purchase_order_id := coalesce(new.purchase_order_id, parent_receipt.purchase_order_id);
  new.quantity_received := coalesce(new.quantity_received, 0);
  new.unit_cost := greatest(coalesce(new.unit_cost, 0), 0);

  if new.quantity_received < 1 then
    raise exception 'Receipt quantity must be at least 1.';
  end if;

  if new.purchase_order_item_id is not null then
    select *
    into parent_order_item
    from public.purchase_order_items
    where id = new.purchase_order_item_id;

    if parent_order_item.id is null or parent_order_item.shop_id <> new.shop_id then
      raise exception 'Receipt item purchase order row must belong to the receipt shop.'
        using errcode = '42501';
    end if;

    if parent_receipt.purchase_order_id is not null
      and parent_order_item.purchase_order_id <> parent_receipt.purchase_order_id then
      raise exception 'Receipt item purchase order row does not belong to this purchase order.';
    end if;

    new.purchase_order_id := parent_order_item.purchase_order_id;
    new.part_id := coalesce(new.part_id, parent_order_item.part_id);
    new.description := coalesce(nullif(btrim(new.description), ''), parent_order_item.description);
    new.vendor_sku := coalesce(nullif(btrim(new.vendor_sku), ''), parent_order_item.vendor_sku);
  end if;

  if new.part_id is not null then
    select *
    into parent_part
    from public.parts
    where id = new.part_id;

    if parent_part.id is null or parent_part.shop_id <> new.shop_id then
      raise exception 'Receipt item part must belong to the receipt shop.'
        using errcode = '42501';
    end if;

    new.description := coalesce(nullif(btrim(new.description), ''), parent_part.name);
    new.vendor_sku := coalesce(nullif(btrim(new.vendor_sku), ''), parent_part.vendor_sku);
  end if;

  new.description := left(btrim(coalesce(new.description, '')), 240);
  if new.description = '' then
    raise exception 'Receipt item description is required.';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_receipt_items_validate_scope on public.inventory_receipt_items;
create trigger inventory_receipt_items_validate_scope
  before insert or update on public.inventory_receipt_items
  for each row
  execute function public.validate_inventory_receipt_item_scope();

drop trigger if exists vendors_set_updated_at on public.vendors;
create trigger vendors_set_updated_at
  before update on public.vendors
  for each row
  execute function public.set_updated_at();

drop trigger if exists purchase_orders_set_updated_at on public.purchase_orders;
create trigger purchase_orders_set_updated_at
  before update on public.purchase_orders
  for each row
  execute function public.set_updated_at();

drop trigger if exists purchase_order_items_set_updated_at on public.purchase_order_items;
create trigger purchase_order_items_set_updated_at
  before update on public.purchase_order_items
  for each row
  execute function public.set_updated_at();

create or replace function private.recalculate_purchase_order_status(target_purchase_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  total_ordered integer := 0;
  total_received integer := 0;
  next_status text;
begin
  select status
  into current_status
  from public.purchase_orders
  where id = target_purchase_order_id;

  if current_status is null then
    raise exception 'Purchase order not found.';
  end if;

  if current_status = 'cancelled' then
    return current_status;
  end if;

  select
    coalesce(sum(quantity_ordered), 0)::integer,
    coalesce(sum(quantity_received), 0)::integer
  into total_ordered, total_received
  from public.purchase_order_items
  where purchase_order_id = target_purchase_order_id;

  next_status := case
    when total_ordered = 0 then 'draft'
    when total_received = 0 and current_status = 'ordered' then 'ordered'
    when total_received = 0 then 'draft'
    when total_received < total_ordered then 'partially_received'
    else 'received'
  end;

  update public.purchase_orders
  set status = next_status
  where id = target_purchase_order_id;

  return next_status;
end;
$$;

create or replace function public.receive_inventory_part(
  p_part_id uuid,
  p_quantity integer,
  p_unit_cost numeric default null,
  p_note text default ''
)
returns public.parts
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare
  target_part public.parts%rowtype;
  saved_part public.parts%rowtype;
  receipt_row public.inventory_receipts%rowtype;
  receipt_item_row public.inventory_receipt_items%rowtype;
  safe_quantity integer;
  safe_unit_cost numeric(10, 2);
  current_quantity_for_average integer;
  current_average_cost numeric;
  next_average_cost numeric(10, 2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  safe_quantity := coalesce(p_quantity, 0);
  if safe_quantity < 1 or safe_quantity > 999999 then
    raise exception 'Quantity must be between 1 and 999999.';
  end if;

  select *
  into target_part
  from public.parts
  where id = p_part_id
  for update;

  if target_part.id is null or not private.can_write_shop(target_part.shop_id) then
    raise exception 'Not allowed to receive stock for this part.'
      using errcode = '42501';
  end if;

  safe_unit_cost := round(greatest(coalesce(p_unit_cost, target_part.unit_cost, 0), 0), 2);
  current_quantity_for_average := greatest(coalesce(target_part.quantity_on_hand, 0), 0);
  current_average_cost := coalesce(target_part.average_cost, target_part.last_cost, target_part.unit_cost, safe_unit_cost, 0);
  next_average_cost := round(
    ((current_quantity_for_average * current_average_cost) + (safe_quantity * safe_unit_cost))
      / nullif(current_quantity_for_average + safe_quantity, 0),
    2
  );

  insert into public.inventory_receipts (
    shop_id,
    vendor_id,
    received_by,
    notes
  )
  values (
    target_part.shop_id,
    target_part.vendor_id,
    auth.uid(),
    nullif(left(btrim(coalesce(p_note, '')), 500), '')
  )
  returning * into receipt_row;

  insert into public.inventory_receipt_items (
    shop_id,
    inventory_receipt_id,
    part_id,
    description,
    vendor_sku,
    quantity_received,
    unit_cost
  )
  values (
    target_part.shop_id,
    receipt_row.id,
    target_part.id,
    target_part.name,
    target_part.vendor_sku,
    safe_quantity,
    safe_unit_cost
  )
  returning * into receipt_item_row;

  update public.parts
  set
    quantity_on_hand = quantity_on_hand + safe_quantity,
    unit_cost = safe_unit_cost,
    last_cost = safe_unit_cost,
    average_cost = next_average_cost
  where id = target_part.id
  returning * into saved_part;

  insert into public.part_movements (
    shop_id,
    part_id,
    movement_type,
    quantity,
    unit_cost,
    retail_price,
    note,
    created_by,
    inventory_receipt_id,
    inventory_receipt_item_id
  )
  values (
    saved_part.shop_id,
    saved_part.id,
    'receive',
    safe_quantity,
    safe_unit_cost,
    saved_part.retail_price,
    coalesce(nullif(left(btrim(coalesce(p_note, '')), 500), ''), 'Manual stock receive'),
    auth.uid(),
    receipt_row.id,
    receipt_item_row.id
  );

  return saved_part;
end;
$$;

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
  safe_unit_cost numeric(10, 2);
  remaining_quantity integer;
  received_rows integer := 0;
  received_units integer := 0;
  current_quantity_for_average integer;
  current_average_cost numeric;
  next_average_cost numeric(10, 2);
  next_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Receipt items must be a JSON array.';
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

    if item_id is null then
      raise exception 'Purchase order item id is required.';
    end if;

    if safe_quantity < 1 or safe_quantity > 999999 then
      raise exception 'Receipt quantity must be between 1 and 999999.';
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

    safe_unit_cost := round(greatest(coalesce(nullif(coalesce(item_payload->>'unitCost', item_payload->>'unit_cost'), '')::numeric, target_item.unit_cost, 0), 0), 2);

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
      target_item.part_id,
      target_item.description,
      target_item.vendor_sku,
      safe_quantity,
      safe_unit_cost
    )
    returning * into receipt_item_row;

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

      current_quantity_for_average := greatest(coalesce(target_part.quantity_on_hand, 0), 0);
      current_average_cost := coalesce(target_part.average_cost, target_part.last_cost, target_part.unit_cost, safe_unit_cost, 0);
      next_average_cost := round(
        ((current_quantity_for_average * current_average_cost) + (safe_quantity * safe_unit_cost))
          / nullif(current_quantity_for_average + safe_quantity, 0),
        2
      );

      update public.parts
      set
        quantity_on_hand = quantity_on_hand + safe_quantity,
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
    end if;

    update public.purchase_order_items
    set
      quantity_received = quantity_received + safe_quantity,
      unit_cost = safe_unit_cost
    where id = target_item.id;

    received_rows := received_rows + 1;
    received_units := received_units + safe_quantity;
  end loop;

  if received_rows = 0 then
    raise exception 'At least one receipt item is required.';
  end if;

  next_status := private.recalculate_purchase_order_status(target_order.id);

  return jsonb_build_object(
    'receiptId', receipt_row.id,
    'receiptNumber', receipt_row.receipt_number,
    'purchaseOrderId', target_order.id,
    'status', next_status,
    'receivedRows', received_rows,
    'receivedUnits', received_units
  );
end;
$$;

alter table public.vendors enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.inventory_receipts enable row level security;
alter table public.inventory_receipt_items enable row level security;

drop policy if exists "vendors_select_member" on public.vendors;
create policy "vendors_select_member"
  on public.vendors
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "vendors_insert_writer" on public.vendors;
create policy "vendors_insert_writer"
  on public.vendors
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "vendors_update_writer" on public.vendors;
create policy "vendors_update_writer"
  on public.vendors
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (private.can_write_shop(shop_id));

drop policy if exists "purchase_orders_select_member" on public.purchase_orders;
create policy "purchase_orders_select_member"
  on public.purchase_orders
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "purchase_orders_insert_writer" on public.purchase_orders;
create policy "purchase_orders_insert_writer"
  on public.purchase_orders
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "purchase_orders_update_writer" on public.purchase_orders;
create policy "purchase_orders_update_writer"
  on public.purchase_orders
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (private.can_write_shop(shop_id));

drop policy if exists "purchase_order_items_select_member" on public.purchase_order_items;
create policy "purchase_order_items_select_member"
  on public.purchase_order_items
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "purchase_order_items_insert_writer" on public.purchase_order_items;
create policy "purchase_order_items_insert_writer"
  on public.purchase_order_items
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "purchase_order_items_update_writer" on public.purchase_order_items;
create policy "purchase_order_items_update_writer"
  on public.purchase_order_items
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (private.can_write_shop(shop_id));

drop policy if exists "inventory_receipts_select_member" on public.inventory_receipts;
create policy "inventory_receipts_select_member"
  on public.inventory_receipts
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "inventory_receipts_insert_writer" on public.inventory_receipts;
create policy "inventory_receipts_insert_writer"
  on public.inventory_receipts
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "inventory_receipt_items_select_member" on public.inventory_receipt_items;
create policy "inventory_receipt_items_select_member"
  on public.inventory_receipt_items
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "inventory_receipt_items_insert_writer" on public.inventory_receipt_items;
create policy "inventory_receipt_items_insert_writer"
  on public.inventory_receipt_items
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

revoke all on public.vendors from anon;
revoke all on public.purchase_orders from anon;
revoke all on public.purchase_order_items from anon;
revoke all on public.inventory_receipts from anon;
revoke all on public.inventory_receipt_items from anon;
revoke all on function public.receive_inventory_part(uuid, integer, numeric, text) from public;
revoke all on function public.receive_inventory_part(uuid, integer, numeric, text) from anon;
revoke all on function public.receive_inventory_part(uuid, integer, numeric, text) from authenticated;
revoke all on function public.receive_purchase_order_items(uuid, jsonb, text) from public;
revoke all on function public.receive_purchase_order_items(uuid, jsonb, text) from anon;
revoke all on function public.receive_purchase_order_items(uuid, jsonb, text) from authenticated;

grant select, insert, update on public.vendors to authenticated;
grant select, insert, update on public.purchase_orders to authenticated;
grant select, insert, update on public.purchase_order_items to authenticated;
grant select, insert on public.inventory_receipts to authenticated;
grant select, insert on public.inventory_receipt_items to authenticated;
grant execute on function public.receive_inventory_part(uuid, integer, numeric, text) to authenticated;
grant execute on function public.receive_purchase_order_items(uuid, jsonb, text) to authenticated;
