begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('46000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'keyboard-fulfill-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('46000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'keyboard-fulfill-viewer@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status)
values ('keyboard-fulfill-shop', 'Keyboard Fulfillment Shop', '46000000-0000-4000-a000-000000000001', 'pro', 'active');

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id = 'keyboard-fulfill-shop';

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('keyboard-fulfill-shop', '46000000-0000-4000-a000-000000000001', 'owner', 'Fulfillment Owner'),
  ('keyboard-fulfill-shop', '46000000-0000-4000-a000-000000000002', 'viewer', 'Fulfillment Viewer');

insert into public.jobs (id, shop_id, customer_name, guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence, tech_details)
values ('46000000-0000-4000-a100-000000000001', 'keyboard-fulfill-shop', 'Fulfillment Customer', 'Roland', 'KEY-FULFILL', current_date, current_date, 'KEY-FULFILL', 1, '{"instrumentType":"Keyboard"}'::jsonb);

insert into public.parts (id, shop_id, sku, name, quantity_on_hand, retail_price)
values ('46000000-0000-4000-a200-000000000001', 'keyboard-fulfill-shop', 'KEY-SPRING', 'Keyboard Return Spring', 5, 8.00);

insert into public.keyboard_part_requests (id, job_id, inventory_part_id, requested_part, quantity, created_by)
values ('46000000-0000-4000-a400-000000000001', '46000000-0000-4000-a100-000000000001', '46000000-0000-4000-a200-000000000001', 'Keyboard Return Spring', 2, '46000000-0000-4000-a000-000000000001');

select ok(has_function_privilege('authenticated', 'public.fulfill_keyboard_part_request(uuid)', 'EXECUTE'), 'authenticated can call atomic fulfillment');
select ok(not has_function_privilege('anon', 'public.fulfill_keyboard_part_request(uuid)', 'EXECUTE'), 'anonymous clients cannot call fulfillment');
select ok(not has_column_privilege('authenticated', 'public.keyboard_part_requests', 'job_part_id', 'UPDATE'), 'clients cannot forge a fulfilled job-part link');
select ok(has_column_privilege('authenticated', 'public.keyboard_part_requests', 'request_status', 'UPDATE'), 'writers can advance ordinary request workflow statuses');

set local role authenticated;
set local "request.jwt.claim.sub" = '46000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is(
  (public.fulfill_keyboard_part_request('46000000-0000-4000-a400-000000000001')).part_id,
  '46000000-0000-4000-a200-000000000001'::uuid,
  'fulfillment creates the requested inventory-backed job part'
);
select is((select request_status from public.keyboard_part_requests where id = '46000000-0000-4000-a400-000000000001'), 'installed', 'fulfillment marks the request installed');
select is((select quantity_on_hand from public.parts where id = '46000000-0000-4000-a200-000000000001'), 3, 'fulfillment decrements inventory once');

select lives_ok($$select public.fulfill_keyboard_part_request('46000000-0000-4000-a400-000000000001')$$, 'retry returns the existing fulfillment');
select is((select count(*)::integer from public.job_parts where job_id = '46000000-0000-4000-a100-000000000001'), 1, 'retry does not create a duplicate job part');
select is((select quantity_on_hand from public.parts where id = '46000000-0000-4000-a200-000000000001'), 3, 'retry does not decrement inventory twice');
select throws_like(
  $$update public.keyboard_part_requests set request_status = 'ordered' where id = '46000000-0000-4000-a400-000000000001'$$,
  '%cannot be reassigned or reopened%',
  'an installed request cannot be reopened for duplicate fulfillment'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '46000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select throws_like(
  $$select public.fulfill_keyboard_part_request('46000000-0000-4000-a400-000000000001')$$,
  '%Not allowed to fulfill%',
  'a viewer cannot fulfill a parts request'
);

reset role;
select * from finish();
rollback;
