begin;

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

select plan(8);

select extensions.dblink_connect('setup', 'host=/var/run/postgresql dbname=postgres user=supabase_admin password=postgres');
select extensions.dblink_connect('holder', 'host=/var/run/postgresql dbname=postgres user=supabase_admin password=postgres');
select extensions.dblink_connect('request_one', 'host=/var/run/postgresql dbname=postgres user=supabase_admin password=postgres');
select extensions.dblink_connect('request_two', 'host=/var/run/postgresql dbname=postgres user=supabase_admin password=postgres');

select extensions.dblink_exec('setup', $$
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '58000000-0000-4000-a000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'specialist-concurrency@frettrack.local',
    crypt('FretTrackTest123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  )
$$);
select extensions.dblink_exec('setup', $$
  insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status)
  values ('specialist-concurrency-shop', 'Specialist Concurrency Shop', '58000000-0000-4000-a000-000000000001', 'pro', 'active')
$$);
select extensions.dblink_exec('setup', $$
  update public.shop_subscriptions
  set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
  where shop_id = 'specialist-concurrency-shop'
$$);
select extensions.dblink_exec('setup', $$
  insert into public.shop_members (shop_id, user_id, role, display_name)
  values ('specialist-concurrency-shop', '58000000-0000-4000-a000-000000000001', 'owner', 'Concurrency Owner')
$$);
select extensions.dblink_exec('setup', $$
  insert into public.jobs (
    id, shop_id, customer_name, guitar_brand, job_number,
    date_received, job_date, job_day_code, daily_sequence, tech_details
  ) values (
    '58000000-0000-4000-a100-000000000001', 'specialist-concurrency-shop',
    'Concurrency Customer', 'Fender', 'AMP-CONCURRENCY',
    current_date, current_date, 'AMP-CONCURRENCY', 1, '{"instrumentType":"Amplifier"}'::jsonb
  )
$$);
select extensions.dblink_exec('setup', $$
  insert into public.vendors (id, shop_id, name, is_active)
  values ('58000000-0000-4000-a200-000000000001', 'specialist-concurrency-shop', 'Concurrency Vendor', true)
$$);
select extensions.dblink_exec('setup', $$
  insert into public.parts (
    id, shop_id, sku, name, quantity_on_hand, retail_price,
    purchase_unit, units_per_purchase_unit, is_active
  ) values (
    '58000000-0000-4000-a250-000000000001', 'specialist-concurrency-shop',
    'CONCURRENT-6L6', 'Concurrent matched 6L6 pair', 0, 89.00, 'set', 2, true
  )
$$);

-- Hold the exact request-key lock so both remote calls are proven to overlap
-- at the serialization point before either is allowed to create the order.
select *
from extensions.dblink(
  'holder',
  $$select true from (select pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('58000000-0000-4000-a400-000000000001', 0))) locked$$
) as lock_result(locked boolean);

select extensions.dblink_send_query('request_one', $$
  with claims as (
    select set_config('request.jwt.claim.sub', '58000000-0000-4000-a000-000000000001', false)
  )
  select public.create_specialist_purchase_order(
    '58000000-0000-4000-a100-000000000001', '58000000-0000-4000-a400-000000000001',
    '58000000-0000-4000-a200-000000000001', '58000000-0000-4000-a250-000000000001', null,
    'Concurrent matched 6L6 pair', 'CONCURRENT-6L6', 1, 1, 'set', 2,
    45.00, 89.00, current_date + 5, 'Concurrent request one'
  ) from claims
$$);
select extensions.dblink_send_query('request_two', $$
  with claims as (
    select set_config('request.jwt.claim.sub', '58000000-0000-4000-a000-000000000001', false)
  )
  select public.create_specialist_purchase_order(
    '58000000-0000-4000-a100-000000000001', '58000000-0000-4000-a400-000000000001',
    '58000000-0000-4000-a200-000000000001', '58000000-0000-4000-a250-000000000001', null,
    'Concurrent matched 6L6 pair', 'CONCURRENT-6L6', 1, 1, 'set', 2,
    45.00, 89.00, current_date + 5, 'Concurrent request two'
  ) from claims
$$);

select is(extensions.dblink_is_busy('request_one'), 1, 'first same-key request waits at the serialization lock');
select is(extensions.dblink_is_busy('request_two'), 1, 'second same-key request overlaps at the serialization lock');

select *
from extensions.dblink(
  'holder',
  $$select pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('58000000-0000-4000-a400-000000000001', 0))$$
) as unlock_result(unlocked boolean);

create temporary table specialist_concurrency_results (
  caller text not null,
  result jsonb not null
) on commit drop;

insert into specialist_concurrency_results (caller, result)
select 'one', result
from extensions.dblink_get_result('request_one') as response(result jsonb);
insert into specialist_concurrency_results (caller, result)
select 'two', result
from extensions.dblink_get_result('request_two') as response(result jsonb);

select is((select count(*)::integer from specialist_concurrency_results), 2, 'both concurrent callers return a purchase result');
select is((select count(*)::integer from specialist_concurrency_results where result ->> 'replayed' = 'false'), 1, 'one concurrent caller creates the purchase');
select is((select count(*)::integer from specialist_concurrency_results where result ->> 'replayed' = 'true'), 1, 'the losing concurrent caller returns the winner as a replay');
select is((select count(distinct result -> 'item' ->> 'id')::integer from specialist_concurrency_results), 1, 'both concurrent callers receive the same purchase item');
select is(
  (select item_count from extensions.dblink(
    'setup',
    $$select count(*)::integer from public.purchase_order_items where specialist_request_key = '58000000-0000-4000-a400-000000000001'$$
  ) as remote_items(item_count integer)),
  1,
  'concurrent same-key requests create one durable purchase item'
);
select is(
  (select order_count from extensions.dblink(
    'setup',
    $$select count(*)::integer from public.purchase_orders where id in (
      select purchase_order_id from public.purchase_order_items
      where specialist_request_key = '58000000-0000-4000-a400-000000000001'
    )$$
  ) as remote_orders(order_count integer)),
  1,
  'concurrent same-key requests create one durable purchase order'
);

select extensions.dblink_exec('setup', $$
  delete from public.purchase_orders where id in (
    select purchase_order_id from public.purchase_order_items
    where specialist_request_key = '58000000-0000-4000-a400-000000000001'
  )
$$);
select extensions.dblink_exec('setup', $$delete from public.parts where id = '58000000-0000-4000-a250-000000000001'$$);
select extensions.dblink_exec('setup', $$delete from public.vendors where id = '58000000-0000-4000-a200-000000000001'$$);
select extensions.dblink_exec('setup', $$delete from public.jobs where id = '58000000-0000-4000-a100-000000000001'$$);
select extensions.dblink_exec('setup', $$delete from public.shop_members where shop_id = 'specialist-concurrency-shop'$$);
select extensions.dblink_exec('setup', $$delete from public.shop_profiles where shop_id = 'specialist-concurrency-shop'$$);
select extensions.dblink_exec('setup', $$delete from auth.users where id = '58000000-0000-4000-a000-000000000001'$$);

select extensions.dblink_disconnect('request_one');
select extensions.dblink_disconnect('request_two');
select extensions.dblink_disconnect('holder');
select extensions.dblink_disconnect('setup');

select * from finish();
rollback;
