begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('43000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'keyboard-workflow-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('43000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'keyboard-workflow-viewer@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('44000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'keyboard-workflow-other@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('45000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'keyboard-workflow-history@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status)
values
  ('keyboard-workflow-a', 'Keyboard Workflow A', '43000000-0000-4000-a000-000000000001', 'pro', 'active'),
  ('keyboard-workflow-b', 'Keyboard Workflow B', '44000000-0000-4000-a000-000000000001', 'pro', 'active'),
  ('keyboard-workflow-history', 'Keyboard Workflow History', '45000000-0000-4000-a000-000000000001', 'pro', 'active');

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id in ('keyboard-workflow-a', 'keyboard-workflow-b', 'keyboard-workflow-history');

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('keyboard-workflow-a', '43000000-0000-4000-a000-000000000001', 'owner', 'Workflow Owner'),
  ('keyboard-workflow-a', '43000000-0000-4000-a000-000000000002', 'viewer', 'Workflow Viewer'),
  ('keyboard-workflow-b', '44000000-0000-4000-a000-000000000001', 'owner', 'Other Owner'),
  ('keyboard-workflow-history', '45000000-0000-4000-a000-000000000001', 'owner', 'History Owner');

insert into public.jobs (id, shop_id, customer_name, guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence, tech_details)
values
  ('43000000-0000-4000-a100-000000000001', 'keyboard-workflow-a', 'Workflow Customer', 'Roland', 'KEY-WF-A', current_date, current_date, 'KEY-WF-A', 1, '{"instrumentType":"Keyboard","keyboard":{"keyCount":"88"}}'::jsonb),
  ('44000000-0000-4000-a100-000000000001', 'keyboard-workflow-b', 'Other Customer', 'Korg', 'KEY-WF-B', current_date, current_date, 'KEY-WF-B', 1, '{"instrumentType":"Keyboard"}'::jsonb),
  ('45000000-0000-4000-a100-000000000001', 'keyboard-workflow-history', 'History Customer', 'Yamaha', 'KEY-WF-H', current_date, current_date, 'KEY-WF-H', 1, '{"instrumentType":"Keyboard"}'::jsonb);

insert into public.parts (id, shop_id, sku, name, quantity_on_hand, retail_price)
values
  ('43000000-0000-4000-a200-000000000001', 'keyboard-workflow-a', 'CONTACT-A', 'Rubber Contact Strip', 3, 24.00),
  ('44000000-0000-4000-a200-000000000001', 'keyboard-workflow-b', 'CONTACT-B', 'Other Shop Contact Strip', 2, 26.00);

insert into public.keyboard_key_states (id, job_id, midi_note, key_label, condition_status, fault_code, fault_category, created_by)
values
  ('43000000-0000-4000-a300-000000000001', '43000000-0000-4000-a100-000000000001', 60, 'C4', 'fault', 'dead_rubber_contact', 'Sensor', '43000000-0000-4000-a000-000000000001'),
  ('44000000-0000-4000-a300-000000000001', '44000000-0000-4000-a100-000000000001', 61, 'C#4', 'fault', 'velocity_spike', 'Sensor', '44000000-0000-4000-a000-000000000001'),
  ('45000000-0000-4000-a300-000000000001', '45000000-0000-4000-a100-000000000001', 62, 'D4', 'fault', 'stuck_key', 'Mechanical', '45000000-0000-4000-a000-000000000001');

insert into public.keyboard_part_requests (id, job_id, key_state_id, inventory_part_id, requested_part, created_by)
values
  ('43000000-0000-4000-a400-000000000001', '43000000-0000-4000-a100-000000000001', '43000000-0000-4000-a300-000000000001', '43000000-0000-4000-a200-000000000001', 'Rubber Contact Strip', '43000000-0000-4000-a000-000000000001'),
  ('44000000-0000-4000-a400-000000000001', '44000000-0000-4000-a100-000000000001', '44000000-0000-4000-a300-000000000001', '44000000-0000-4000-a200-000000000001', 'Other Shop Contact Strip', '44000000-0000-4000-a000-000000000001');

update public.shop_profiles set subscription_tier = 'shop' where shop_id = 'keyboard-workflow-history';
update public.shop_subscriptions set plan_id = 'shop' where shop_id = 'keyboard-workflow-history';

select ok((select relrowsecurity from pg_class where oid = 'public.keyboard_key_states'::regclass), 'keyboard key states enable RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.keyboard_part_requests'::regclass), 'keyboard parts requests enable RLS');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'keyboard_key_states'), 4, 'key states define CRUD policies');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'keyboard_part_requests'), 4, 'parts requests define CRUD policies');
select ok(has_table_privilege('authenticated', 'public.keyboard_key_states', 'SELECT'), 'authenticated has explicit key-state Data API access');
select ok(has_table_privilege('service_role', 'public.keyboard_part_requests', 'SELECT'), 'service role has explicit parts-request Data API access');

set local role authenticated;
set local "request.jwt.claim.sub" = '43000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.keyboard_key_states), 1, 'owner sees only own-shop key states');
select is((select count(*)::integer from public.keyboard_part_requests), 1, 'owner sees only own-shop parts requests');
select isnt_empty($$insert into public.keyboard_key_states (job_id, midi_note, key_label, condition_status) values ('43000000-0000-4000-a100-000000000001', 64, 'E4', 'pass') returning 1$$, 'owner can add a key finding');
select isnt_empty($$update public.keyboard_key_states set notes = 'Cleaned contact' where id = '43000000-0000-4000-a300-000000000001' returning 1$$, 'owner can update a key finding');
select throws_like($$update public.keyboard_key_states set midi_note = 63 where id = '43000000-0000-4000-a300-000000000001'$$, '%identity fields cannot be changed%', 'key identity cannot be rewritten after capture');
select throws_like($$insert into public.keyboard_key_states (job_id, midi_note, key_label) values ('44000000-0000-4000-a100-000000000001', 65, 'F4')$$, '%row-level security policy%', 'owner cannot add a finding to another shop');
select throws_like($$insert into public.keyboard_part_requests (job_id, inventory_part_id, requested_part) values ('43000000-0000-4000-a100-000000000001', '44000000-0000-4000-a200-000000000001', 'Cross-shop part')$$, '%row-level security policy%', 'parts request cannot link another shop inventory');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '43000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.keyboard_key_states), 2, 'viewer can read own-shop key findings');
select throws_like($$insert into public.keyboard_key_states (job_id, midi_note, key_label) values ('43000000-0000-4000-a100-000000000001', 67, 'G4')$$, '%row-level security policy%', 'viewer cannot add a key finding');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '45000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.keyboard_key_states), 1, 'downgraded owner retains historical key findings');
select is((select count(*)::integer from public.keyboard_part_requests), 0, 'downgraded owner has no unrelated parts requests');
select throws_like($$insert into public.keyboard_key_states (job_id, midi_note, key_label) values ('45000000-0000-4000-a100-000000000001', 69, 'A4')$$, '%row-level security policy%', 'downgraded owner cannot add key findings');
select throws_like($$insert into public.keyboard_part_requests (job_id, requested_part) values ('45000000-0000-4000-a100-000000000001', 'Blocked spring')$$, '%row-level security policy%', 'downgraded owner cannot add parts requests');

reset role;
select * from finish();
rollback;
