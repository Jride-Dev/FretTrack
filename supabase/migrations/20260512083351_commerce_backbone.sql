create table if not exists currencies (
  code text primary key,
  name text not null,
  symbol text,
  minor_unit integer not null default 2 check (minor_unit >= 0 and minor_unit <= 4),
  locale_hint text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tax_profiles (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null default 'default-shop',
  location_id text,
  name text not null,
  jurisdiction text,
  tax_rate_basis_points integer not null default 0 check (tax_rate_basis_points >= 0),
  currency_code text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null default 'default-shop',
  location_id text,
  code text not null,
  label text not null,
  tender_type text not null default 'other',
  active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, location_id, code)
);

create table if not exists transaction_number_sequences (
  shop_id text not null default 'default-shop',
  location_scope text not null default '',
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now(),
  primary key (shop_id, location_scope)
);

create table if not exists transaction_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null default 'default-shop',
  location_id text,
  location_scope text not null default '',
  transaction_number bigint not null check (transaction_number > 0),
  event_type text not null,
  source_type text not null,
  source_id text,
  customer_id uuid,
  employee_id uuid,
  currency_code text not null,
  subtotal_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  total_minor bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  reversed_transaction_id uuid references transaction_events(id),
  created_at timestamptz not null default now(),
  created_by text,
  unique (shop_id, location_scope, transaction_number)
);

create index if not exists transaction_events_shop_created_at_idx
on transaction_events (shop_id, created_at desc);

create index if not exists transaction_events_source_idx
on transaction_events (source_type, source_id);

create index if not exists transaction_events_customer_idx
on transaction_events (customer_id, created_at desc);

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  transaction_event_id uuid not null references transaction_events(id) on delete restrict,
  shop_id text not null default 'default-shop',
  location_id text,
  payment_method_id uuid references payment_methods(id),
  payment_method_code text,
  payment_status text not null default 'recorded',
  amount_minor bigint not null,
  currency_code text not null,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists payment_events_transaction_idx
on payment_events (transaction_event_id);

create index if not exists payment_events_shop_created_at_idx
on payment_events (shop_id, created_at desc);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null default 'default-shop',
  location_id text,
  transaction_event_id uuid references transaction_events(id) on delete restrict,
  movement_type text not null check (movement_type in ('IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'DAMAGED', 'LOST', 'FOUND')),
  item_id text,
  item_name text not null default '',
  source_type text,
  source_id text,
  quantity numeric(12, 3) not null,
  unit_cost_minor bigint,
  currency_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists inventory_movements_shop_created_at_idx
on inventory_movements (shop_id, created_at desc);

create index if not exists inventory_movements_item_idx
on inventory_movements (item_id, created_at desc);

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
begin
  assigned_shop_id := coalesce(nullif(transaction_payload->>'shop_id', ''), 'default-shop');
  assigned_location_id := nullif(transaction_payload->>'location_id', '');
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
    nullif(transaction_payload->>'customer_id', '')::uuid,
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

create or replace function prevent_commerce_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Commerce event tables are append-only. Create a compensating event instead.';
end;
$$;

drop trigger if exists transaction_events_prevent_update on transaction_events;
create trigger transaction_events_prevent_update
before update or delete on transaction_events
for each row execute function prevent_commerce_event_mutation();

drop trigger if exists payment_events_prevent_update on payment_events;
create trigger payment_events_prevent_update
before update or delete on payment_events
for each row execute function prevent_commerce_event_mutation();

drop trigger if exists inventory_movements_prevent_update on inventory_movements;
create trigger inventory_movements_prevent_update
before update or delete on inventory_movements
for each row execute function prevent_commerce_event_mutation();

alter table currencies enable row level security;
alter table tax_profiles enable row level security;
alter table payment_methods enable row level security;
alter table transaction_number_sequences enable row level security;
alter table transaction_events enable row level security;
alter table payment_events enable row level security;
alter table inventory_movements enable row level security;

drop policy if exists "currencies_read_public" on currencies;
create policy "currencies_read_public"
  on currencies for select to anon, authenticated using (true);

drop policy if exists "tax_profiles_read_public" on tax_profiles;
create policy "tax_profiles_read_public"
  on tax_profiles for select to anon, authenticated using (true);

drop policy if exists "payment_methods_read_public" on payment_methods;
create policy "payment_methods_read_public"
  on payment_methods for select to anon, authenticated using (true);

drop policy if exists "transaction_events_read_public" on transaction_events;
create policy "transaction_events_read_public"
  on transaction_events for select to anon, authenticated using (true);

drop policy if exists "payment_events_read_public" on payment_events;
create policy "payment_events_read_public"
  on payment_events for select to anon, authenticated using (true);

drop policy if exists "inventory_movements_read_public" on inventory_movements;
create policy "inventory_movements_read_public"
  on inventory_movements for select to anon, authenticated using (true);

grant execute on function create_transaction_event(jsonb) to anon, authenticated;
grant execute on function next_transaction_number(text, text) to anon, authenticated;
grant select on currencies, tax_profiles, payment_methods, transaction_events, payment_events, inventory_movements to anon, authenticated;
