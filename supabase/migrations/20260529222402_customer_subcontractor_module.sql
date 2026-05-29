alter table customers
  add column if not exists is_active boolean not null default true,
  add column if not exists tax_id text;

update customers
set customer_type = 'business'
where customer_type = 'company';

alter table customers
  drop constraint if exists customers_customer_type_check;

alter table customers
  add constraint customers_customer_type_check
  check (customer_type in ('individual', 'business', 'subcontractor', 'vendor', 'company'));

create index if not exists customers_shop_active_idx on customers (shop_id, is_active);
create index if not exists customers_shop_type_idx on customers (shop_id, customer_type);
