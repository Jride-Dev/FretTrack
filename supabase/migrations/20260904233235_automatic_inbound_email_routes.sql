-- Give every shop one private inbound reply address. The address is derived
-- from a random UUID so it does not expose or depend on a mutable shop name.

with ranked_active_routes as (
  select
    id,
    row_number() over (
      partition by shop_id
      order by created_at, id
    ) as route_rank
  from public.customer_inbound_email_routes
  where active
)
update public.customer_inbound_email_routes as routes
set active = false
from ranked_active_routes
where routes.id = ranked_active_routes.id
  and ranked_active_routes.route_rank > 1;

-- Rotate any pre-release manual route so no active shop keeps a shared or
-- human-chosen address from the setup period.
update public.customer_inbound_email_routes
set email_address =
  'reply+' || pg_catalog.replace(id::text, '-', '') || '@rexaaechae.resend.app'
where active;

create unique index customer_inbound_email_routes_active_shop_uidx
  on public.customer_inbound_email_routes (shop_id)
  where active;

create or replace function private.provision_customer_inbound_email_route()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  route_id uuid := gen_random_uuid();
begin
  insert into public.customer_inbound_email_routes (
    id,
    shop_id,
    email_address,
    active
  )
  values (
    route_id,
    new.shop_id,
    'reply+' || pg_catalog.replace(route_id::text, '-', '') || '@rexaaechae.resend.app',
    true
  )
  on conflict (shop_id) where active do nothing;

  return new;
end;
$$;

revoke all on function private.provision_customer_inbound_email_route()
  from public, anon, authenticated;

drop trigger if exists shop_profiles_provision_inbound_email_route
  on public.shop_profiles;
create trigger shop_profiles_provision_inbound_email_route
  after insert on public.shop_profiles
  for each row
  execute function private.provision_customer_inbound_email_route();

with missing_routes as materialized (
  select
    gen_random_uuid() as route_id,
    shop_profiles.shop_id
  from public.shop_profiles
  where not exists (
    select 1
    from public.customer_inbound_email_routes
    where customer_inbound_email_routes.shop_id = shop_profiles.shop_id
      and customer_inbound_email_routes.active
  )
)
insert into public.customer_inbound_email_routes (
  id,
  shop_id,
  email_address,
  active
)
select
  route_id,
  shop_id,
  'reply+' || pg_catalog.replace(route_id::text, '-', '') || '@rexaaechae.resend.app',
  true
from missing_routes
on conflict do nothing;

comment on function private.provision_customer_inbound_email_route() is
  'Creates one opaque Resend receiving address whenever a shop profile is created.';
