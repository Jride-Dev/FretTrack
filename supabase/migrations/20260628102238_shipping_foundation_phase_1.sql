-- Shipping Foundation Phase 1.
--
-- Adds the database foundation for outbound/customer job shipping without
-- adding UI, carrier APIs, label/rate purchasing, Stripe, or notification
-- automation. Inbound vendor purchase-order shipping remains in the
-- inventory purchasing tables.

create table if not exists public.job_shipments (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,

  direction text not null default 'outbound',
  fulfillment_method text not null default 'pickup',
  status text not null default 'not_ready',

  carrier text,
  service_level text,
  tracking_number text,
  tracking_url text,

  ship_to_name text,
  ship_to_address_line1 text,
  ship_to_address_line2 text,
  ship_to_city text,
  ship_to_state text,
  ship_to_postal_code text,
  ship_to_country text default 'US',

  shipping_cost numeric(10, 2),
  shipping_charge numeric(10, 2),

  notes text,
  shipped_at timestamptz,
  delivered_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint job_shipments_direction_check
    check (direction in ('inbound', 'outbound', 'customer_return')),
  constraint job_shipments_fulfillment_method_check
    check (fulfillment_method in ('pickup', 'ship')),
  constraint job_shipments_status_check
    check (status in ('not_ready', 'ready_to_ship', 'label_needed', 'shipped', 'delivered', 'returned', 'problem', 'void')),
  constraint job_shipments_shipping_cost_nonnegative
    check (shipping_cost is null or shipping_cost >= 0),
  constraint job_shipments_shipping_charge_nonnegative
    check (shipping_charge is null or shipping_charge >= 0)
);

create index if not exists job_shipments_shop_id_idx
  on public.job_shipments (shop_id);

create index if not exists job_shipments_job_id_idx
  on public.job_shipments (job_id);

create index if not exists job_shipments_customer_id_idx
  on public.job_shipments (customer_id);

create index if not exists job_shipments_status_idx
  on public.job_shipments (shop_id, status);

create index if not exists job_shipments_tracking_number_idx
  on public.job_shipments (shop_id, tracking_number)
  where tracking_number is not null and tracking_number <> '';

create index if not exists job_shipments_shipped_at_idx
  on public.job_shipments (shop_id, shipped_at desc)
  where shipped_at is not null;

create index if not exists job_shipments_delivered_at_idx
  on public.job_shipments (shop_id, delivered_at desc)
  where delivered_at is not null;

create or replace function public.ensure_job_shipment_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_job public.jobs%rowtype;
  target_customer public.customers%rowtype;
begin
  select *
  into target_job
  from public.jobs
  where id = new.job_id
    and shop_id = new.shop_id;

  if target_job.id is null then
    raise exception 'Shipment job must belong to the shipment shop.';
  end if;

  if new.customer_id is null then
    new.customer_id := target_job.customer_id;
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

  if new.ship_to_country is null or btrim(new.ship_to_country) = '' then
    new.ship_to_country := 'US';
  end if;

  new.direction := lower(coalesce(nullif(btrim(new.direction), ''), 'outbound'));
  new.fulfillment_method := lower(coalesce(nullif(btrim(new.fulfillment_method), ''), 'pickup'));
  new.status := lower(coalesce(nullif(btrim(new.status), ''), 'not_ready'));
  new.carrier := nullif(btrim(new.carrier), '');
  new.service_level := nullif(btrim(new.service_level), '');
  new.tracking_number := nullif(btrim(new.tracking_number), '');
  new.tracking_url := nullif(btrim(new.tracking_url), '');
  new.ship_to_name := nullif(btrim(new.ship_to_name), '');
  new.ship_to_address_line1 := nullif(btrim(new.ship_to_address_line1), '');
  new.ship_to_address_line2 := nullif(btrim(new.ship_to_address_line2), '');
  new.ship_to_city := nullif(btrim(new.ship_to_city), '');
  new.ship_to_state := nullif(btrim(new.ship_to_state), '');
  new.ship_to_postal_code := nullif(btrim(new.ship_to_postal_code), '');
  new.ship_to_country := nullif(btrim(new.ship_to_country), '');
  new.notes := nullif(btrim(new.notes), '');

  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
  elsif TG_OP = 'UPDATE' then
    new.created_by := old.created_by;
  end if;

  return new;
end;
$$;

drop trigger if exists job_shipments_ensure_scope on public.job_shipments;
create trigger job_shipments_ensure_scope
  before insert or update on public.job_shipments
  for each row
  execute function public.ensure_job_shipment_scope();

drop trigger if exists job_shipments_set_updated_at on public.job_shipments;
create trigger job_shipments_set_updated_at
  before update on public.job_shipments
  for each row
  execute function public.set_updated_at();

alter table public.job_shipments enable row level security;

drop policy if exists "job_shipments_select_member" on public.job_shipments;
create policy "job_shipments_select_member"
  on public.job_shipments
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "job_shipments_insert_writer" on public.job_shipments;
create policy "job_shipments_insert_writer"
  on public.job_shipments
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "job_shipments_update_writer" on public.job_shipments;
create policy "job_shipments_update_writer"
  on public.job_shipments
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (private.can_write_shop(shop_id));

revoke all on public.job_shipments from anon;
revoke all on function public.ensure_job_shipment_scope() from public;
revoke all on function public.ensure_job_shipment_scope() from anon;
revoke all on function public.ensure_job_shipment_scope() from authenticated;

grant select, insert, update on public.job_shipments to authenticated;
