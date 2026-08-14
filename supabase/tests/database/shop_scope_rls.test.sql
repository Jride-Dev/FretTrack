begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-owner-a@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-viewer-a@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-owner-b@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status)
values
  ('pgtap-shop-a', 'pgTAP Shop A', '10000000-0000-4000-a000-000000000001', 'pro', 'active'),
  ('pgtap-shop-b', 'pgTAP Shop B', '20000000-0000-4000-a000-000000000001', 'pro', 'active');

update public.shop_subscriptions
set plan_id = 'pro',
    status = 'active',
    trial_ends_at = null,
    grace_ends_at = null
where shop_id in ('pgtap-shop-a', 'pgtap-shop-b');

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('pgtap-shop-a', '10000000-0000-4000-a000-000000000001', 'owner', 'Shop A Owner'),
  ('pgtap-shop-a', '10000000-0000-4000-a000-000000000002', 'viewer', 'Shop A Viewer'),
  ('pgtap-shop-b', '20000000-0000-4000-a000-000000000001', 'owner', 'Shop B Owner');

insert into public.customers (id, shop_id, display_name)
values
  ('a0000000-0000-4000-a000-000000000001', 'pgtap-shop-a', 'Shop A Customer'),
  ('b0000000-0000-4000-a000-000000000001', 'pgtap-shop-b', 'Shop B Customer');

select ok(
  not exists (
    select 1
    from pg_class table_class
    join pg_namespace table_schema on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relkind = 'r'
      and not table_class.relrowsecurity
  ),
  'every public table has row-level security enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.customers'::regclass),
  'customers has row-level security enabled'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is(
  (select count(*)::integer from public.customers where shop_id = 'pgtap-shop-a'),
  1,
  'an owner can read customers in their own shop'
);

select is(
  (select count(*)::integer from public.customers where shop_id = 'pgtap-shop-b'),
  0,
  'an owner cannot read customers in another shop'
);

select is(
  (select count(*)::integer from public.shop_members where shop_id = 'pgtap-shop-a'),
  2,
  'an owner can read memberships in their own shop'
);

select is(
  (select count(*)::integer from public.shop_members where shop_id = 'pgtap-shop-b'),
  0,
  'an owner cannot read memberships in another shop'
);

select is_empty(
  $$
    update public.customers
    set notes = 'blocked cross-shop update'
    where shop_id = 'pgtap-shop-b'
    returning 1
  $$,
  'an owner cannot update customers in another shop'
);

select isnt_empty(
  $$
    update public.customers
    set notes = 'allowed same-shop update'
    where shop_id = 'pgtap-shop-a'
    returning 1
  $$,
  'an owner can update customers in their own shop'
);

select throws_like(
  $$insert into public.customers (shop_id, display_name) values ('pgtap-shop-b', 'Blocked Customer')$$,
  '%row-level security policy%',
  'an owner cannot insert a customer into another shop'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select is(
  (select count(*)::integer from public.customers where shop_id = 'pgtap-shop-a'),
  1,
  'a viewer can read customers in their assigned shop'
);

select is_empty(
  $$
    update public.customers
    set notes = 'blocked viewer update'
    where shop_id = 'pgtap-shop-a'
    returning 1
  $$,
  'a viewer cannot update customers in their assigned shop'
);

select throws_like(
  $$insert into public.customers (shop_id, display_name) values ('pgtap-shop-a', 'Blocked Viewer Customer')$$,
  '%row-level security policy%',
  'a viewer cannot insert customers into their assigned shop'
);

reset role;
select * from finish();
rollback;
