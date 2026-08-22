begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('57000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'specialist-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('57000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'specialist-viewer@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status)
values ('specialist-purchasing-shop', 'Specialist Purchasing Shop', '57000000-0000-4000-a000-000000000001', 'pro', 'active');

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id = 'specialist-purchasing-shop';

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('specialist-purchasing-shop', '57000000-0000-4000-a000-000000000001', 'owner', 'Specialist Owner'),
  ('specialist-purchasing-shop', '57000000-0000-4000-a000-000000000002', 'viewer', 'Specialist Viewer');

insert into public.jobs (id, shop_id, customer_name, guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence, tech_details)
values
  ('57000000-0000-4000-a100-000000000001', 'specialist-purchasing-shop', 'Amp Customer', 'Fender', 'AMP-BRIDGE', current_date, current_date, 'AMP-BRIDGE', 1, '{"instrumentType":"Amplifier"}'::jsonb),
  ('57000000-0000-4000-a100-000000000002', 'specialist-purchasing-shop', 'Keyboard Customer', 'Roland', 'KEY-BRIDGE', current_date, current_date, 'KEY-BRIDGE', 2, '{"instrumentType":"Keyboard"}'::jsonb);

insert into public.vendors (id, shop_id, name, is_active)
values ('57000000-0000-4000-a200-000000000001', 'specialist-purchasing-shop', 'Specialist Parts Vendor', true);

insert into public.keyboard_part_requests (id, job_id, requested_part, quantity, created_by)
values
  ('57000000-0000-4000-a300-000000000001', '57000000-0000-4000-a100-000000000002', '61-key contact strip', 1, '57000000-0000-4000-a000-000000000001'),
  ('57000000-0000-4000-a300-000000000002', '57000000-0000-4000-a100-000000000002', 'Key return spring', 2, '57000000-0000-4000-a000-000000000001');

select ok(has_function_privilege('authenticated', 'public.create_specialist_purchase_order(uuid,uuid,uuid,uuid,uuid,text,text,integer,integer,text,integer,numeric,numeric,date,text)', 'EXECUTE'), 'authenticated users can call specialist PO creation');
select ok(not has_function_privilege('anon', 'public.create_specialist_purchase_order(uuid,uuid,uuid,uuid,uuid,text,text,integer,integer,text,integer,numeric,numeric,date,text)', 'EXECUTE'), 'anonymous users cannot create specialist POs');
select ok(has_function_privilege('authenticated', 'public.fulfill_specialist_purchase_order_item(uuid)', 'EXECUTE'), 'authenticated users can call specialist fulfillment');
select ok(not has_function_privilege('anon', 'public.fulfill_specialist_purchase_order_item(uuid)', 'EXECUTE'), 'anonymous users cannot fulfill specialist PO items');
select ok(not has_column_privilege('authenticated', 'public.keyboard_part_requests', 'purchase_order_item_id', 'UPDATE'), 'clients cannot forge the keyboard PO link');

set local role authenticated;
set local "request.jwt.claim.sub" = '57000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select lives_ok($$
  select public.create_specialist_purchase_order(
    '57000000-0000-4000-a100-000000000001', '57000000-0000-4000-a400-000000000001',
    '57000000-0000-4000-a200-000000000001', null, null, 'Matched 6L6 pair', '6L6-MP',
    1, 1, 'set', 1, 45.00, 89.00, current_date + 5, 'Amp repair order'
  )
$$, 'owner creates an amplifier-linked purchase order atomically');

select is((select count(*)::integer from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000001'), 1, 'amplifier order creates one PO line');
select is((select job_id from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000001'), '57000000-0000-4000-a100-000000000001'::uuid, 'PO line is linked to the amplifier job');
select is((select retail_price from public.parts where id = (select part_id from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000001')), 89.00::numeric, 'new specialist part keeps its customer price');
select lives_ok($$
  select public.create_specialist_purchase_order(
    '57000000-0000-4000-a100-000000000001', '57000000-0000-4000-a400-000000000001',
    '57000000-0000-4000-a200-000000000001', null, null, 'Matched 6L6 pair', '6L6-MP',
    1, 1, 'set', 1, 45.00, 89.00, current_date + 5, 'Amp repair retry'
  )
$$, 'replaying the same request key succeeds');
select is((select count(*)::integer from public.purchase_order_items where job_id = '57000000-0000-4000-a100-000000000001'), 1, 'request-key replay does not duplicate the amplifier PO');

select lives_ok($$
  select public.receive_purchase_order_items(
    (select purchase_order_id from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000001'),
    jsonb_build_array(jsonb_build_object(
      'purchaseOrderItemId', (select id from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000001'),
      'quantityReceived', 1,
      'unitCost', 45.00
    )),
    'Amp specialist receipt'
  )
$$, 'existing receiving ledger accepts the linked amplifier line');
select is((select quantity_received from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000001'), 1, 'amplifier PO line records receipt');
select lives_ok($$select public.fulfill_specialist_purchase_order_item((select id from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000001'))$$, 'received amplifier line can be added to billing');
select is((select count(*)::integer from public.job_parts where job_id = '57000000-0000-4000-a100-000000000001'), 1, 'amplifier fulfillment creates one billed job part');
select lives_ok($$select public.fulfill_specialist_purchase_order_item((select id from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000001'))$$, 'amplifier fulfillment retry returns the existing job part');
select is((select count(*)::integer from public.job_parts where job_id = '57000000-0000-4000-a100-000000000001'), 1, 'amplifier fulfillment retry is idempotent');

select lives_ok($$
  select public.create_specialist_purchase_order(
    '57000000-0000-4000-a100-000000000002', '57000000-0000-4000-a400-000000000002',
    '57000000-0000-4000-a200-000000000001', null, '57000000-0000-4000-a300-000000000001',
    '', 'KEY-STRIP', 1, 99, 'each', 1, 22.00, 55.00, current_date + 7, 'Keyboard repair order'
  )
$$, 'owner creates a keyboard PO from a fault-driven request');
select is((select request_status from public.keyboard_part_requests where id = '57000000-0000-4000-a300-000000000001'), 'ordered', 'keyboard request becomes ordered from the durable PO link');
select isnt((select purchase_order_item_id from public.keyboard_part_requests where id = '57000000-0000-4000-a300-000000000001'), null::uuid, 'keyboard request stores its PO line');
select lives_ok($$
  select public.receive_purchase_order_items(
    (select purchase_order_id from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000002'),
    jsonb_build_array(jsonb_build_object(
      'purchaseOrderItemId', (select id from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000002'),
      'quantityReceived', 1,
      'unitCost', 22.00
    )),
    'Keyboard specialist receipt'
  )
$$, 'existing receiving ledger accepts the linked keyboard line');
select is((select request_status from public.keyboard_part_requests where id = '57000000-0000-4000-a300-000000000001'), 'received', 'actual receipt advances the keyboard request to received');
select lives_ok($$select public.fulfill_specialist_purchase_order_item((select id from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000002'))$$, 'received keyboard line can be added to billing');
select is((select request_status from public.keyboard_part_requests where id = '57000000-0000-4000-a300-000000000001'), 'installed', 'keyboard fulfillment marks the request installed');
select is((select count(*)::integer from public.job_parts where job_id = '57000000-0000-4000-a100-000000000002'), 1, 'keyboard fulfillment creates one billed job part');

select lives_ok($$
  select public.create_specialist_purchase_order(
    '57000000-0000-4000-a100-000000000002', '57000000-0000-4000-a400-000000000003',
    '57000000-0000-4000-a200-000000000001', null, '57000000-0000-4000-a300-000000000002',
    '', 'KEY-SPRING', 1, 2, 'pack', 2, 4.00, 6.00, null, 'Cancelable keyboard order'
  )
$$, 'a second keyboard request can be linked');
select lives_ok($$update public.purchase_orders set status = 'cancelled' where id = (select purchase_order_id from public.purchase_order_items where specialist_request_key = '57000000-0000-4000-a400-000000000003')$$, 'a linked unreceived keyboard PO can be cancelled');
select ok((select request_status = 'requested' and purchase_order_item_id is null from public.keyboard_part_requests where id = '57000000-0000-4000-a300-000000000002'), 'cancelling releases and reopens the keyboard request');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '57000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select throws_like($$
  select public.create_specialist_purchase_order(
    '57000000-0000-4000-a100-000000000001', '57000000-0000-4000-a400-000000000004',
    '57000000-0000-4000-a200-000000000001', null, null, 'Viewer attempt', '', 1, 1, 'each', 1, 1.00, 2.00, null, ''
  )
$$, '%Not allowed to order parts%', 'viewer cannot create a specialist purchase order');

reset role;
update public.shop_subscriptions set plan_id = 'shop' where shop_id = 'specialist-purchasing-shop';
update public.shop_profiles set subscription_tier = 'shop' where shop_id = 'specialist-purchasing-shop';
set local role authenticated;
set local "request.jwt.claim.sub" = '57000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select throws_like($$
  select public.create_specialist_purchase_order(
    '57000000-0000-4000-a100-000000000001', '57000000-0000-4000-a400-000000000005',
    '57000000-0000-4000-a200-000000000001', null, null, 'Non-Pro attempt', '', 1, 1, 'each', 1, 1.00, 2.00, null, ''
  )
$$, '%Pro specialist repair module is not enabled%', 'non-Pro shops cannot use the specialist purchasing bridge');

reset role;
select * from finish();
rollback;
