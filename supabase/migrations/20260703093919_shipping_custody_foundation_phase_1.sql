-- Shipping / Receiving / Chain of Custody Foundation Phase 1.
--
-- Extends the earlier job_shipments foundation into a manual operational
-- shipping/custody system. This does not buy labels, rate-shop carriers,
-- call carrier APIs, automate Stripe payments, or replace inventory PO
-- receiving.

alter table public.job_shipments
  alter column job_id drop not null,
  alter column direction set default 'customer_outbound',
  alter column status set default 'pending_arrival',
  add column if not exists shipping_reference text,
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null,
  add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  add column if not exists label_reference text,
  add column if not exists label_url text,
  add column if not exists declared_value numeric(10, 2),
  add column if not exists insurance_required boolean not null default false,
  add column if not exists signature_required boolean not null default false,
  add column if not exists packing_notes text,
  add column if not exists condition_notes text,
  add column if not exists received_condition text,
  add column if not exists assigned_location text,
  add column if not exists assigned_category text,
  add column if not exists assigned_to_user_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_notified boolean not null default false,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.job_shipments
set
  shipping_reference = coalesce(
    nullif(shipping_reference, ''),
    'SHIP-' || to_char(created_at, 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 6))
  ),
  direction = case
    when direction = 'inbound' then 'customer_inbound'
    when direction = 'outbound' then 'customer_outbound'
    when direction = 'customer_return' then 'customer_outbound'
    else coalesce(nullif(direction, ''), 'customer_outbound')
  end,
  status = case
    when status = 'not_ready' then 'pending_arrival'
    when status = 'label_needed' then 'ready_to_pack'
    when status = 'shipped' then 'in_transit'
    when status = 'problem' then 'exception'
    when status = 'void' then 'cancelled'
    else coalesce(nullif(status, ''), 'pending_arrival')
  end
where shipping_reference is null
   or shipping_reference = ''
   or direction in ('inbound', 'outbound', 'customer_return')
   or status in ('not_ready', 'label_needed', 'shipped', 'problem', 'void');

alter table public.job_shipments
  alter column shipping_reference set not null;

alter table public.job_shipments
  drop constraint if exists job_shipments_direction_check,
  drop constraint if exists job_shipments_status_check,
  drop constraint if exists job_shipments_shipping_cost_nonnegative,
  drop constraint if exists job_shipments_shipping_charge_nonnegative;

alter table public.job_shipments
  add constraint job_shipments_direction_check
    check (direction in (
      'vendor_inbound',
      'customer_inbound',
      'customer_outbound',
      'vendor_return',
      'inventory_outbound',
      'internal_transfer',
      'inbound',
      'outbound',
      'customer_return'
    )),
  add constraint job_shipments_status_check
    check (status in (
      'pending_arrival',
      'arrived',
      'checked_in',
      'triage',
      'at_bench',
      'ready_to_pack',
      'packed',
      'ready_to_ship',
      'in_transit',
      'delivered',
      'delayed',
      'exception',
      'returned',
      'cancelled',
      'not_ready',
      'label_needed',
      'shipped',
      'problem',
      'void'
    )),
  add constraint job_shipments_shipping_cost_nonnegative
    check (shipping_cost is null or shipping_cost >= 0),
  add constraint job_shipments_shipping_charge_nonnegative
    check (shipping_charge is null or shipping_charge >= 0),
  add constraint job_shipments_declared_value_nonnegative
    check (declared_value is null or declared_value >= 0);

create unique index if not exists job_shipments_shop_reference_unique
  on public.job_shipments (shop_id, shipping_reference);

create index if not exists job_shipments_vendor_id_idx
  on public.job_shipments (shop_id, vendor_id)
  where vendor_id is not null;

create index if not exists job_shipments_purchase_order_id_idx
  on public.job_shipments (shop_id, purchase_order_id)
  where purchase_order_id is not null;

create index if not exists job_shipments_direction_status_idx
  on public.job_shipments (shop_id, direction, status);

create index if not exists job_shipments_assigned_location_idx
  on public.job_shipments (shop_id, assigned_location)
  where assigned_location is not null and assigned_location <> '';

create table if not exists public.shipping_items (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  shipment_id uuid not null references public.job_shipments(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  purchase_order_item_id uuid references public.purchase_order_items(id) on delete set null,
  part_id uuid references public.parts(id) on delete set null,
  item_type text not null default 'instrument',
  description text not null,
  quantity integer not null default 1,
  disposition text not null default 'hold_quarantine',
  assigned_location text,
  assigned_category text,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  received_condition text,
  condition_notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_items_quantity_positive check (quantity > 0),
  constraint shipping_items_item_type_check
    check (item_type in ('instrument', 'part', 'accessory', 'package', 'other')),
  constraint shipping_items_disposition_check
    check (disposition in (
      'stock',
      'specific_job',
      'tech_bench',
      'hold_quarantine',
      'return_to_vendor',
      'customer_return',
      'outbound_package',
      'internal_transfer'
    ))
);

create table if not exists public.custody_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  shipment_id uuid references public.job_shipments(id) on delete cascade,
  shipping_item_id uuid references public.shipping_items(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  event_type text not null,
  event_label text not null,
  event_status text,
  event_note text,
  from_location text,
  to_location text,
  from_category text,
  to_category text,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  event_data jsonb not null default '{}'::jsonb,
  constraint custody_events_type_check
    check (event_type in (
      'shipment_created',
      'item_received',
      'location_assigned',
      'category_assigned',
      'assigned_to_user',
      'status_changed',
      'packed',
      'shipped',
      'delivered',
      'exception_recorded',
      'cancelled',
      'note'
    ))
);

create index if not exists shipping_items_shop_shipment_idx
  on public.shipping_items (shop_id, shipment_id);

create index if not exists shipping_items_job_idx
  on public.shipping_items (shop_id, job_id)
  where job_id is not null;

create index if not exists shipping_items_part_idx
  on public.shipping_items (shop_id, part_id)
  where part_id is not null;

create index if not exists shipping_items_location_idx
  on public.shipping_items (shop_id, assigned_location)
  where assigned_location is not null and assigned_location <> '';

create index if not exists custody_events_shop_created_idx
  on public.custody_events (shop_id, created_at desc);

create index if not exists custody_events_shipment_created_idx
  on public.custody_events (shipment_id, created_at desc)
  where shipment_id is not null;

create index if not exists custody_events_item_created_idx
  on public.custody_events (shipping_item_id, created_at desc)
  where shipping_item_id is not null;

create or replace function public.ensure_job_shipment_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_job public.jobs%rowtype;
  target_customer public.customers%rowtype;
  target_vendor public.vendors%rowtype;
  target_purchase_order public.purchase_orders%rowtype;
  candidate_reference text;
begin
  new.direction := lower(coalesce(nullif(btrim(new.direction), ''), 'customer_outbound'));
  new.fulfillment_method := lower(coalesce(nullif(btrim(new.fulfillment_method), ''), 'pickup'));
  new.status := lower(coalesce(nullif(btrim(new.status), ''), 'pending_arrival'));

  if new.job_id is not null then
    select *
    into target_job
    from public.jobs
    where id = new.job_id
      and shop_id = new.shop_id;

    if target_job.id is null then
      raise exception 'Shipment job must belong to the shipment shop.';
    end if;

    new.customer_id := coalesce(new.customer_id, target_job.customer_id);
  end if;

  if new.customer_id is not null then
    select *
    into target_customer
    from public.customers
    where id = new.customer_id
      and shop_id = new.shop_id;

    if target_customer.id is null then
      raise exception 'Shipment customer must belong to the shipment shop.';
    end if;
  end if;

  if new.purchase_order_id is not null then
    select *
    into target_purchase_order
    from public.purchase_orders
    where id = new.purchase_order_id
      and shop_id = new.shop_id;

    if target_purchase_order.id is null then
      raise exception 'Shipment purchase order must belong to the shipment shop.';
    end if;

    new.vendor_id := coalesce(new.vendor_id, target_purchase_order.vendor_id);
  end if;

  if new.vendor_id is not null then
    select *
    into target_vendor
    from public.vendors
    where id = new.vendor_id
      and shop_id = new.shop_id;

    if target_vendor.id is null then
      raise exception 'Shipment vendor must belong to the shipment shop.';
    end if;
  end if;

  if new.assigned_to_user_id is not null
    and not exists (
      select 1
      from public.shop_members
      where shop_id = new.shop_id
        and user_id = new.assigned_to_user_id
    ) then
    raise exception 'Assigned user must be a member of this shop.';
  end if;

  if new.shipping_reference is null or btrim(new.shipping_reference) = '' then
    loop
      candidate_reference := 'SHIP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      exit when not exists (
        select 1
        from public.job_shipments
        where shop_id = new.shop_id
          and shipping_reference = candidate_reference
      );
    end loop;
    new.shipping_reference := candidate_reference;
  else
    new.shipping_reference := left(btrim(new.shipping_reference), 80);
  end if;

  if new.ship_to_country is null or btrim(new.ship_to_country) = '' then
    new.ship_to_country := 'US';
  end if;

  new.carrier := nullif(btrim(new.carrier), '');
  new.service_level := nullif(btrim(new.service_level), '');
  new.tracking_number := nullif(btrim(new.tracking_number), '');
  new.tracking_url := nullif(btrim(new.tracking_url), '');
  new.label_reference := nullif(btrim(new.label_reference), '');
  new.label_url := nullif(btrim(new.label_url), '');
  new.ship_to_name := nullif(btrim(new.ship_to_name), '');
  new.ship_to_address_line1 := nullif(btrim(new.ship_to_address_line1), '');
  new.ship_to_address_line2 := nullif(btrim(new.ship_to_address_line2), '');
  new.ship_to_city := nullif(btrim(new.ship_to_city), '');
  new.ship_to_state := nullif(btrim(new.ship_to_state), '');
  new.ship_to_postal_code := nullif(btrim(new.ship_to_postal_code), '');
  new.ship_to_country := nullif(btrim(new.ship_to_country), '');
  new.notes := nullif(btrim(new.notes), '');
  new.packing_notes := nullif(btrim(new.packing_notes), '');
  new.condition_notes := nullif(btrim(new.condition_notes), '');
  new.received_condition := nullif(btrim(new.received_condition), '');
  new.assigned_location := nullif(btrim(new.assigned_location), '');
  new.assigned_category := nullif(btrim(new.assigned_category), '');

  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
  elsif TG_OP = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  new.updated_by := auth.uid();

  return new;
end;
$$;

create or replace function public.ensure_shipping_item_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_shipment public.job_shipments%rowtype;
  target_job public.jobs%rowtype;
  target_customer public.customers%rowtype;
  target_vendor public.vendors%rowtype;
  target_purchase_order public.purchase_orders%rowtype;
  target_order_item public.purchase_order_items%rowtype;
  target_part public.parts%rowtype;
begin
  select *
  into target_shipment
  from public.job_shipments
  where id = new.shipment_id;

  if target_shipment.id is null then
    raise exception 'Shipping item shipment not found.';
  end if;

  new.shop_id := target_shipment.shop_id;
  new.job_id := coalesce(new.job_id, target_shipment.job_id);
  new.customer_id := coalesce(new.customer_id, target_shipment.customer_id);
  new.vendor_id := coalesce(new.vendor_id, target_shipment.vendor_id);
  new.purchase_order_id := coalesce(new.purchase_order_id, target_shipment.purchase_order_id);
  new.item_type := lower(coalesce(nullif(btrim(new.item_type), ''), 'instrument'));
  new.disposition := lower(coalesce(nullif(btrim(new.disposition), ''), 'hold_quarantine'));
  new.quantity := greatest(coalesce(new.quantity, 1), 1);

  if new.job_id is not null then
    select *
    into target_job
    from public.jobs
    where id = new.job_id
      and shop_id = new.shop_id;

    if target_job.id is null then
      raise exception 'Shipping item job must belong to this shop.';
    end if;
  end if;

  if new.customer_id is not null then
    select *
    into target_customer
    from public.customers
    where id = new.customer_id
      and shop_id = new.shop_id;

    if target_customer.id is null then
      raise exception 'Shipping item customer must belong to this shop.';
    end if;
  end if;

  if new.vendor_id is not null then
    select *
    into target_vendor
    from public.vendors
    where id = new.vendor_id
      and shop_id = new.shop_id;

    if target_vendor.id is null then
      raise exception 'Shipping item vendor must belong to this shop.';
    end if;
  end if;

  if new.purchase_order_id is not null then
    select *
    into target_purchase_order
    from public.purchase_orders
    where id = new.purchase_order_id
      and shop_id = new.shop_id;

    if target_purchase_order.id is null then
      raise exception 'Shipping item purchase order must belong to this shop.';
    end if;
  end if;

  if new.purchase_order_item_id is not null then
    select *
    into target_order_item
    from public.purchase_order_items
    where id = new.purchase_order_item_id
      and shop_id = new.shop_id;

    if target_order_item.id is null then
      raise exception 'Shipping item purchase order line must belong to this shop.';
    end if;

    new.purchase_order_id := coalesce(new.purchase_order_id, target_order_item.purchase_order_id);
    new.part_id := coalesce(new.part_id, target_order_item.part_id);
    new.description := coalesce(nullif(btrim(new.description), ''), target_order_item.description);
  end if;

  if new.part_id is not null then
    select *
    into target_part
    from public.parts
    where id = new.part_id
      and shop_id = new.shop_id;

    if target_part.id is null then
      raise exception 'Shipping item part must belong to this shop.';
    end if;

    new.description := coalesce(nullif(btrim(new.description), ''), target_part.name);
    new.item_type := case when new.item_type = 'instrument' then 'part' else new.item_type end;
  end if;

  if new.assigned_to_user_id is not null
    and not exists (
      select 1
      from public.shop_members
      where shop_id = new.shop_id
        and user_id = new.assigned_to_user_id
    ) then
    raise exception 'Assigned user must be a member of this shop.';
  end if;

  new.description := left(btrim(coalesce(new.description, '')), 240);
  if new.description = '' then
    raise exception 'Shipping item description is required.';
  end if;

  new.assigned_location := nullif(btrim(new.assigned_location), '');
  new.assigned_category := nullif(btrim(new.assigned_category), '');
  new.received_condition := nullif(btrim(new.received_condition), '');
  new.condition_notes := nullif(btrim(new.condition_notes), '');

  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
  elsif TG_OP = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  new.updated_by := auth.uid();

  return new;
end;
$$;

create or replace function public.log_shipping_shipment_custody_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  next_event_type text;
  next_event_label text;
begin
  if TG_OP = 'INSERT' then
    insert into public.custody_events (
      shop_id,
      shipment_id,
      job_id,
      customer_id,
      vendor_id,
      purchase_order_id,
      event_type,
      event_label,
      event_status,
      event_note,
      to_location,
      to_category,
      assigned_to_user_id,
      created_by,
      event_data
    )
    values (
      new.shop_id,
      new.id,
      new.job_id,
      new.customer_id,
      new.vendor_id,
      new.purchase_order_id,
      'shipment_created',
      'Shipment created',
      new.status,
      coalesce(new.notes, new.condition_notes, new.packing_notes),
      new.assigned_location,
      new.assigned_category,
      new.assigned_to_user_id,
      auth.uid(),
      jsonb_build_object('direction', new.direction, 'shippingReference', new.shipping_reference)
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    next_event_type := case new.status
      when 'packed' then 'packed'
      when 'ready_to_ship' then 'status_changed'
      when 'in_transit' then 'shipped'
      when 'delivered' then 'delivered'
      when 'exception' then 'exception_recorded'
      when 'delayed' then 'exception_recorded'
      when 'cancelled' then 'cancelled'
      else 'status_changed'
    end;
    next_event_label := case next_event_type
      when 'packed' then 'Packed'
      when 'shipped' then 'Shipped'
      when 'delivered' then 'Delivered'
      when 'exception_recorded' then 'Exception recorded'
      when 'cancelled' then 'Cancelled'
      else 'Status changed'
    end;

    insert into public.custody_events (
      shop_id,
      shipment_id,
      job_id,
      customer_id,
      vendor_id,
      purchase_order_id,
      event_type,
      event_label,
      event_status,
      event_note,
      from_location,
      to_location,
      from_category,
      to_category,
      assigned_to_user_id,
      created_by,
      event_data
    )
    values (
      new.shop_id,
      new.id,
      new.job_id,
      new.customer_id,
      new.vendor_id,
      new.purchase_order_id,
      next_event_type,
      next_event_label,
      new.status,
      coalesce(new.notes, new.condition_notes, new.packing_notes),
      old.assigned_location,
      new.assigned_location,
      old.assigned_category,
      new.assigned_category,
      new.assigned_to_user_id,
      auth.uid(),
      jsonb_build_object('previousStatus', old.status, 'nextStatus', new.status)
    );
  end if;

  if old.assigned_location is distinct from new.assigned_location then
    insert into public.custody_events (
      shop_id,
      shipment_id,
      job_id,
      customer_id,
      vendor_id,
      purchase_order_id,
      event_type,
      event_label,
      event_status,
      from_location,
      to_location,
      assigned_to_user_id,
      created_by
    )
    values (
      new.shop_id,
      new.id,
      new.job_id,
      new.customer_id,
      new.vendor_id,
      new.purchase_order_id,
      'location_assigned',
      'Location assigned',
      new.status,
      old.assigned_location,
      new.assigned_location,
      new.assigned_to_user_id,
      auth.uid()
    );
  end if;

  if old.assigned_category is distinct from new.assigned_category then
    insert into public.custody_events (
      shop_id,
      shipment_id,
      job_id,
      customer_id,
      vendor_id,
      purchase_order_id,
      event_type,
      event_label,
      event_status,
      from_category,
      to_category,
      assigned_to_user_id,
      created_by
    )
    values (
      new.shop_id,
      new.id,
      new.job_id,
      new.customer_id,
      new.vendor_id,
      new.purchase_order_id,
      'category_assigned',
      'Category assigned',
      new.status,
      old.assigned_category,
      new.assigned_category,
      new.assigned_to_user_id,
      auth.uid()
    );
  end if;

  if old.assigned_to_user_id is distinct from new.assigned_to_user_id then
    insert into public.custody_events (
      shop_id,
      shipment_id,
      job_id,
      customer_id,
      vendor_id,
      purchase_order_id,
      event_type,
      event_label,
      event_status,
      assigned_to_user_id,
      created_by
    )
    values (
      new.shop_id,
      new.id,
      new.job_id,
      new.customer_id,
      new.vendor_id,
      new.purchase_order_id,
      'assigned_to_user',
      'Assigned to user or bench',
      new.status,
      new.assigned_to_user_id,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

create or replace function public.log_shipping_item_custody_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.custody_events (
      shop_id,
      shipment_id,
      shipping_item_id,
      job_id,
      customer_id,
      vendor_id,
      purchase_order_id,
      event_type,
      event_label,
      event_status,
      event_note,
      to_location,
      to_category,
      assigned_to_user_id,
      created_by,
      event_data
    )
    values (
      new.shop_id,
      new.shipment_id,
      new.id,
      new.job_id,
      new.customer_id,
      new.vendor_id,
      new.purchase_order_id,
      'item_received',
      'Item received',
      new.disposition,
      coalesce(new.condition_notes, new.received_condition),
      new.assigned_location,
      new.assigned_category,
      new.assigned_to_user_id,
      auth.uid(),
      jsonb_build_object('itemType', new.item_type, 'quantity', new.quantity, 'description', new.description)
    );
    return new;
  end if;

  if old.assigned_location is distinct from new.assigned_location then
    insert into public.custody_events (
      shop_id,
      shipment_id,
      shipping_item_id,
      job_id,
      customer_id,
      vendor_id,
      purchase_order_id,
      event_type,
      event_label,
      event_status,
      from_location,
      to_location,
      assigned_to_user_id,
      created_by
    )
    values (
      new.shop_id,
      new.shipment_id,
      new.id,
      new.job_id,
      new.customer_id,
      new.vendor_id,
      new.purchase_order_id,
      'location_assigned',
      'Item location assigned',
      new.disposition,
      old.assigned_location,
      new.assigned_location,
      new.assigned_to_user_id,
      auth.uid()
    );
  end if;

  if old.assigned_category is distinct from new.assigned_category then
    insert into public.custody_events (
      shop_id,
      shipment_id,
      shipping_item_id,
      job_id,
      customer_id,
      vendor_id,
      purchase_order_id,
      event_type,
      event_label,
      event_status,
      from_category,
      to_category,
      assigned_to_user_id,
      created_by
    )
    values (
      new.shop_id,
      new.shipment_id,
      new.id,
      new.job_id,
      new.customer_id,
      new.vendor_id,
      new.purchase_order_id,
      'category_assigned',
      'Item category assigned',
      new.disposition,
      old.assigned_category,
      new.assigned_category,
      new.assigned_to_user_id,
      auth.uid()
    );
  end if;

  if old.assigned_to_user_id is distinct from new.assigned_to_user_id then
    insert into public.custody_events (
      shop_id,
      shipment_id,
      shipping_item_id,
      job_id,
      customer_id,
      vendor_id,
      purchase_order_id,
      event_type,
      event_label,
      event_status,
      assigned_to_user_id,
      created_by
    )
    values (
      new.shop_id,
      new.shipment_id,
      new.id,
      new.job_id,
      new.customer_id,
      new.vendor_id,
      new.purchase_order_id,
      'assigned_to_user',
      'Item assigned to user or bench',
      new.disposition,
      new.assigned_to_user_id,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists job_shipments_ensure_scope on public.job_shipments;
create trigger job_shipments_ensure_scope
  before insert or update on public.job_shipments
  for each row
  execute function public.ensure_job_shipment_scope();

drop trigger if exists job_shipments_log_custody on public.job_shipments;
create trigger job_shipments_log_custody
  after insert or update on public.job_shipments
  for each row
  execute function public.log_shipping_shipment_custody_event();

drop trigger if exists shipping_items_ensure_scope on public.shipping_items;
create trigger shipping_items_ensure_scope
  before insert or update on public.shipping_items
  for each row
  execute function public.ensure_shipping_item_scope();

drop trigger if exists shipping_items_set_updated_at on public.shipping_items;
create trigger shipping_items_set_updated_at
  before update on public.shipping_items
  for each row
  execute function public.set_updated_at();

drop trigger if exists shipping_items_log_custody on public.shipping_items;
create trigger shipping_items_log_custody
  after insert or update on public.shipping_items
  for each row
  execute function public.log_shipping_item_custody_event();

alter table public.shipping_items enable row level security;
alter table public.custody_events enable row level security;

drop policy if exists "shipping_items_select_member" on public.shipping_items;
create policy "shipping_items_select_member"
  on public.shipping_items
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "shipping_items_insert_writer" on public.shipping_items;
create policy "shipping_items_insert_writer"
  on public.shipping_items
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "shipping_items_update_writer" on public.shipping_items;
create policy "shipping_items_update_writer"
  on public.shipping_items
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (private.can_write_shop(shop_id));

drop policy if exists "custody_events_select_member" on public.custody_events;
create policy "custody_events_select_member"
  on public.custody_events
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "custody_events_insert_writer" on public.custody_events;
create policy "custody_events_insert_writer"
  on public.custody_events
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

revoke all on public.shipping_items from anon;
revoke all on public.custody_events from anon;
revoke all on function public.ensure_job_shipment_scope() from public;
revoke all on function public.ensure_job_shipment_scope() from anon;
revoke all on function public.ensure_job_shipment_scope() from authenticated;
revoke all on function public.ensure_shipping_item_scope() from public;
revoke all on function public.ensure_shipping_item_scope() from anon;
revoke all on function public.ensure_shipping_item_scope() from authenticated;
revoke all on function public.log_shipping_shipment_custody_event() from public;
revoke all on function public.log_shipping_shipment_custody_event() from anon;
revoke all on function public.log_shipping_shipment_custody_event() from authenticated;
revoke all on function public.log_shipping_item_custody_event() from public;
revoke all on function public.log_shipping_item_custody_event() from anon;
revoke all on function public.log_shipping_item_custody_event() from authenticated;

grant select, insert, update on public.shipping_items to authenticated;
grant select, insert on public.custody_events to authenticated;
