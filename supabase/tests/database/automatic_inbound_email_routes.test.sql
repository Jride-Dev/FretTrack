begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_function(
  'private',
  'provision_customer_inbound_email_route',
  array[]::text[],
  'inbound reply routing has an internal provisioning function'
);

select has_trigger(
  'public',
  'shop_profiles',
  'shop_profiles_provision_inbound_email_route',
  'new shops automatically provision an inbound reply route'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'private.provision_customer_inbound_email_route()',
    'execute'
  ),
  'browser clients cannot invoke route provisioning directly'
);

select is(
  (
    select count(*)::integer
    from public.shop_profiles
    where not exists (
      select 1
      from public.customer_inbound_email_routes
      where customer_inbound_email_routes.shop_id = shop_profiles.shop_id
        and customer_inbound_email_routes.active
    )
  ),
  0,
  'every existing shop is backfilled with an active route'
);

select is(
  (
    select count(*)::integer
    from (
      select shop_id
      from public.customer_inbound_email_routes
      where active
      group by shop_id
      having count(*) <> 1
    ) invalid_route_counts
  ),
  0,
  'every shop has at most one active route'
);

select is(
  (
    select count(*)::integer
    from public.customer_inbound_email_routes
    where active
      and email_address !~ '^reply\+[0-9a-f]{32}@rexaaechae\.resend\.app$'
  ),
  0,
  'automatically provisioned addresses use opaque UUID tokens'
);

select is(
  (
    select count(*)::integer
    from (
      select lower(btrim(email_address))
      from public.customer_inbound_email_routes
      where active
      group by lower(btrim(email_address))
      having count(*) > 1
    ) duplicate_addresses
  ),
  0,
  'active receiving addresses are globally unique'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '8a000000-0000-4000-a000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'automatic-route-owner@frettrack.local',
  crypt('FretTrackTest123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

set local role authenticated;
set local "request.jwt.claim.sub" = '8a000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select lives_ok(
  $$select public.bootstrap_current_user_as_owner('automatic-route-pgtap', 'Automatic Route pgTAP')$$,
  'normal self-service signup succeeds with automatic route provisioning'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.customer_inbound_email_routes
    where shop_id = 'automatic-route-pgtap'
      and active
  ),
  1,
  'self-service signup creates exactly one active route'
);

select matches(
  (
    select email_address
    from public.customer_inbound_email_routes
    where shop_id = 'automatic-route-pgtap'
      and active
  ),
  '^reply\+[0-9a-f]{32}@rexaaechae\.resend\.app$',
  'the new shop receives an opaque reply address'
);

select throws_like(
  $$
    insert into public.customer_inbound_email_routes (shop_id, email_address, active)
    values ('automatic-route-pgtap', 'second-route@rexaaechae.resend.app', true)
  $$,
  '%customer_inbound_email_routes_active_shop_uidx%',
  'the database rejects a second active route for one shop'
);

select throws_like(
  $$
    insert into public.customer_inbound_email_routes (shop_id, email_address, active)
    select 'default-shop', email_address, true
    from public.customer_inbound_email_routes
    where shop_id = 'automatic-route-pgtap'
      and active
  $$,
  '%customer_inbound_email_routes_active_address_uidx%',
  'the database rejects assigning one active address to another shop'
);

select lives_ok(
  $$delete from public.shop_profiles where shop_id = 'automatic-route-pgtap'$$,
  'a shop can still be removed normally'
);

select is(
  (
    select count(*)::integer
    from public.customer_inbound_email_routes
    where shop_id = 'automatic-route-pgtap'
  ),
  0,
  'deleting a shop removes its private route'
);

select * from finish();
rollback;
