create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  sku text,
  name text not null,
  description text,
  category text,
  supplier text,
  manufacturer text,
  part_number text,
  unit_cost numeric(10, 2) not null default 0,
  retail_price numeric(10, 2) not null default 0,
  quantity_on_hand integer not null default 0,
  reorder_point integer not null default 0,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.part_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  movement_type text not null check (movement_type in ('receive', 'use', 'adjust', 'return', 'remove')),
  quantity integer not null,
  unit_cost numeric(10, 2),
  retail_price numeric(10, 2),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.job_parts
  add column if not exists shop_id text references public.shop_profiles(shop_id) on delete cascade,
  add column if not exists part_id uuid references public.parts(id) on delete set null,
  add column if not exists sku text,
  add column if not exists unit_cost numeric(10, 2),
  add column if not exists retail_price numeric(10, 2);

update public.job_parts
set
  shop_id = coalesce(job_parts.shop_id, jobs.shop_id),
  unit_cost = coalesce(job_parts.unit_cost, job_parts.cost),
  retail_price = coalesce(job_parts.retail_price, job_parts.retail)
from public.jobs
where job_parts.job_id = jobs.id;

alter table public.job_parts
  alter column shop_id set not null;

create index if not exists parts_shop_id_idx on public.parts (shop_id);
create index if not exists parts_shop_active_idx on public.parts (shop_id, is_active);
create index if not exists parts_shop_sku_idx on public.parts (shop_id, sku);
create index if not exists parts_shop_name_idx on public.parts (shop_id, lower(name));
create index if not exists part_movements_shop_part_idx on public.part_movements (shop_id, part_id);
create index if not exists part_movements_shop_job_idx on public.part_movements (shop_id, job_id);
create index if not exists job_parts_shop_job_idx on public.job_parts (shop_id, job_id);

drop trigger if exists parts_set_updated_at on public.parts;
create trigger parts_set_updated_at
  before update on public.parts
  for each row
  execute function public.set_updated_at();

alter table public.parts enable row level security;
alter table public.part_movements enable row level security;

drop policy if exists "parts_select_member" on public.parts;
create policy "parts_select_member"
  on public.parts
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "parts_insert_writer" on public.parts;
create policy "parts_insert_writer"
  on public.parts
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "parts_update_writer" on public.parts;
create policy "parts_update_writer"
  on public.parts
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (private.can_write_shop(shop_id));

drop policy if exists "parts_delete_admin" on public.parts;
create policy "parts_delete_admin"
  on public.parts
  for delete
  to authenticated
  using (private.can_admin_shop(shop_id));

drop policy if exists "part_movements_select_member" on public.part_movements;
create policy "part_movements_select_member"
  on public.part_movements
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "part_movements_insert_writer" on public.part_movements;
create policy "part_movements_insert_writer"
  on public.part_movements
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "job_parts_insert_writer" on public.job_parts;
create policy "job_parts_insert_writer"
  on public.job_parts
  for insert
  to authenticated
  with check (private.can_write_job(job_id) and private.can_write_shop(shop_id));

drop policy if exists "job_parts_update_writer" on public.job_parts;
create policy "job_parts_update_writer"
  on public.job_parts
  for update
  to authenticated
  using (private.can_write_job(job_id))
  with check (private.can_write_job(job_id) and private.can_write_shop(shop_id));

create or replace function public.add_inventory_part_to_job(
  p_job_id uuid,
  p_part_id uuid,
  p_quantity integer default 1
)
returns public.job_parts
language plpgsql
security definer
set search_path = public
as $$
declare
  target_job public.jobs%rowtype;
  target_part public.parts%rowtype;
  inserted_part public.job_parts%rowtype;
  safe_quantity integer;
begin
  safe_quantity := greatest(coalesce(p_quantity, 1), 1);

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
set search_path = public
as $$
declare
  target_job_part public.job_parts%rowtype;
  target_part public.parts%rowtype;
  updated_job_part public.job_parts%rowtype;
  safe_quantity integer;
  quantity_delta integer;
begin
  safe_quantity := greatest(coalesce(p_quantity, 1), 1);

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

revoke all on public.parts from anon;
revoke all on public.part_movements from anon;
revoke all on function public.add_inventory_part_to_job(uuid, uuid, integer) from public, anon;
revoke all on function public.update_inventory_job_part_quantity(uuid, integer) from public, anon;

grant select, insert, update, delete on public.parts to authenticated;
grant select, insert on public.part_movements to authenticated;
grant execute on function public.add_inventory_part_to_job(uuid, uuid, integer) to authenticated;
grant execute on function public.update_inventory_job_part_quantity(uuid, integer) to authenticated;
