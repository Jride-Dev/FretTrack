begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('47000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'keyboard-normalized-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('48000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'keyboard-normalized-other@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status) values
  ('keyboard-normalized-a', 'Keyboard Normalized A', '47000000-0000-4000-a000-000000000001', 'pro', 'active'),
  ('keyboard-normalized-b', 'Keyboard Normalized B', '48000000-0000-4000-a000-000000000001', 'pro', 'active');

update public.shop_subscriptions set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id in ('keyboard-normalized-a', 'keyboard-normalized-b');

insert into public.shop_members (shop_id, user_id, role, display_name) values
  ('keyboard-normalized-a', '47000000-0000-4000-a000-000000000001', 'owner', 'Normalized Owner'),
  ('keyboard-normalized-b', '48000000-0000-4000-a000-000000000001', 'owner', 'Other Owner');

insert into public.jobs (id, shop_id, customer_name, guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence, tech_details) values
  ('47000000-0000-4000-a100-000000000001', 'keyboard-normalized-a', 'Keyboard Customer', 'Yamaha', 'KEY-NORM-A', current_date, current_date, 'KEY-NORM-A', 1, '{"instrumentType":"Keyboard","keyboard":{"keyCount":"88","keyAction":"Graded hammer","sensorTechnology":"Triple sensor","lowestMidiNote":"21"}}'::jsonb),
  ('48000000-0000-4000-a100-000000000001', 'keyboard-normalized-b', 'Other Customer', 'Roland', 'KEY-NORM-B', current_date, current_date, 'KEY-NORM-B', 1, '{"instrumentType":"Keyboard","keyboard":{"keyCount":"61"}}'::jsonb);

insert into public.parts (id, shop_id, sku, name, quantity_on_hand) values
  ('47000000-0000-4000-a200-000000000001', 'keyboard-normalized-a', 'GH3-D', 'Yamaha GH3 Replacement Key - White D', 2),
  ('48000000-0000-4000-a200-000000000001', 'keyboard-normalized-b', 'STRIP-12', 'Other Shop 12-note Rubber Strip', 2);

select ok((select count(*) from public.fault_codes where code in ('velocity_spike', 'no_trigger', 'stuck_note', 'broken_stem')) = 4, 'standard fault codes are seeded');
select ok((select relrowsecurity from pg_class where oid = 'public.fault_codes'::regclass), 'fault codes enable RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.keyboard_profiles'::regclass), 'keyboard profiles enable RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.key_damage_map'::regclass), 'key damage map enables RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.keyboard_part_compatibility'::regclass), 'part compatibility enables RLS');
select ok(has_table_privilege('authenticated', 'public.fault_codes', 'SELECT'), 'authenticated users can read standardized faults');
select ok(not has_table_privilege('authenticated', 'public.fault_codes', 'INSERT'), 'authenticated users cannot rewrite standardized faults');
select is((select count(*)::integer from public.keyboard_profiles where job_id = '47000000-0000-4000-a100-000000000001'), 1, 'keyboard job creates one normalized profile');
select is((select key_count from public.keyboard_profiles where job_id = '47000000-0000-4000-a100-000000000001'), 88::smallint, 'profile stores key count');
select is((select action_type from public.keyboard_profiles where job_id = '47000000-0000-4000-a100-000000000001'), 'graded_hammer', 'profile normalizes key action');
select is((select sensor_type from public.keyboard_profiles where job_id = '47000000-0000-4000-a100-000000000001'), 'triple_sensor', 'profile normalizes sensor technology');
select is((select lowest_midi_note from public.keyboard_profiles where job_id = '47000000-0000-4000-a100-000000000001'), 21::smallint, 'profile stores the keybed MIDI origin');

set local role authenticated;
set local "request.jwt.claim.sub" = '47000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select label from public.fault_codes where code = 'velocity_spike'), 'Velocity Spike', 'shop user reads the shared fault catalog');
select lives_ok($$insert into public.keyboard_part_compatibility (part_id, fault_code, part_scope, group_size, key_color, note_name, manufacturer) values ('47000000-0000-4000-a200-000000000001', 'broken_keytop', 'single_key', 1, 'white', 'D4', 'Yamaha')$$, 'shop writer links a key-specific inventory item');
select throws_like($$insert into public.keyboard_part_compatibility (part_id, fault_code, part_scope, group_size) values ('48000000-0000-4000-a200-000000000001', 'dead_key', 'key_group', 12)$$, '%row-level security policy%', 'shop writer cannot link another shop inventory');
select throws_like($$insert into public.key_damage_map (job_id, key_index, midi_note, note_name, health_state, status, fault_code) values ('47000000-0000-4000-a100-000000000001', 88, 109, 'C#8', 'defective', 'electrical', 'no_trigger')$$, '%outside the saved profile%', 'damage map rejects keys outside the saved profile');
select lives_ok($$insert into public.key_damage_map (job_id, key_index, midi_note, note_name, health_state, status, fault_code) values ('47000000-0000-4000-a100-000000000001', 39, 60, 'C4', 'defective', 'electrical', 'velocity_spike')$$, 'writer records a valid per-key defect');
select throws_like($$update public.jobs set tech_details = jsonb_set(tech_details, '{keyboard,lowestMidiNote}', '"22"'::jsonb) where id = '47000000-0000-4000-a100-000000000001'$$, '%profile cannot change%', 'profile changes cannot orphan saved key findings');
select throws_like($$insert into public.key_damage_map (job_id, key_index, midi_note, note_name, health_state, status, fault_code) values ('47000000-0000-4000-a100-000000000001', 39, 60, 'C4', 'defective', 'electrical', 'no_trigger')$$, '%duplicate key value%', 'one authoritative row exists per physical key');

reset role;
select * from finish();
rollback;
