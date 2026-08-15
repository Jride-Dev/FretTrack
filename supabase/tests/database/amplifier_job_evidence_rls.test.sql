begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('31000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amp-owner-a@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('31000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amp-viewer-a@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('32000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amp-owner-b@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status)
values
  ('amp-pgtap-shop-a', 'Amplifier pgTAP Shop A', '31000000-0000-4000-a000-000000000001', 'pro', 'active'),
  ('amp-pgtap-shop-b', 'Amplifier pgTAP Shop B', '32000000-0000-4000-a000-000000000001', 'pro', 'active');

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id in ('amp-pgtap-shop-a', 'amp-pgtap-shop-b');

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('amp-pgtap-shop-a', '31000000-0000-4000-a000-000000000001', 'owner', 'Amp Shop A Owner'),
  ('amp-pgtap-shop-a', '31000000-0000-4000-a000-000000000002', 'viewer', 'Amp Shop A Viewer'),
  ('amp-pgtap-shop-b', '32000000-0000-4000-a000-000000000001', 'owner', 'Amp Shop B Owner');

insert into public.jobs (id, shop_id, customer_name, guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence, tech_details)
values
  ('a1000000-0000-4000-a000-000000000001', 'amp-pgtap-shop-a', 'Amp Customer A', 'Fender', 'AMP-A', current_date, current_date, 'AMP-A', 1, '{"instrumentType":"Amplifier"}'::jsonb),
  ('b1000000-0000-4000-a000-000000000001', 'amp-pgtap-shop-b', 'Amp Customer B', 'Vox', 'AMP-B', current_date, current_date, 'AMP-B', 1, '{"instrumentType":"Amplifier"}'::jsonb);

insert into public.job_evidence (
  id, job_id, evidence_kind, test_type, storage_path, file_name, mime_type,
  file_size_bytes, created_by
)
values
  ('a2000000-0000-4000-a000-000000000001', 'a1000000-0000-4000-a000-000000000001', 'audio', 'noise_floor_zero', 'a1000000-0000-4000-a000-000000000001/noise.webm', 'noise.webm', 'audio/webm', 1024, '31000000-0000-4000-a000-000000000001'),
  ('b2000000-0000-4000-a000-000000000001', 'b1000000-0000-4000-a000-000000000001', 'spectrum', 'spectrum_analysis', 'b1000000-0000-4000-a000-000000000001/rta.png', 'rta.png', 'image/png', 2048, '32000000-0000-4000-a000-000000000001');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.job_evidence'::regclass),
  'job_evidence has row-level security enabled'
);

select is(
  (select public from storage.buckets where id = 'job-evidence'),
  false,
  'job-evidence bucket is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'job-evidence'),
  26214400::bigint,
  'job-evidence bucket enforces the 25 MB limit'
);

select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'job_evidence_storage_%'),
  4,
  'job-evidence Storage has select, insert, update, and delete policies'
);

select ok(
  (select with_check like '%has_active_photo_usage_reservation%' from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'job_evidence_storage_insert_writer'),
  'job-evidence uploads require an active atomic usage reservation'
);

select ok(
  (select pg_get_constraintdef(oid) like '%job-evidence%' from pg_constraint where conname = 'shop_usage_reservation_target' and conrelid = 'public.shop_usage_reservations'::regclass),
  'shop usage reservations recognize the private evidence bucket'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '31000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.job_evidence), 1, 'an owner reads evidence only for their own shop jobs');

select isnt_empty(
  $$
    insert into public.job_evidence (job_id, evidence_kind, test_type, storage_path, file_name, mime_type, file_size_bytes)
    values ('a1000000-0000-4000-a000-000000000001', 'waveform', 'oscilloscope_sine', 'a1000000-0000-4000-a000-000000000001/scope.png', 'scope.png', 'image/png', 4096)
    returning 1
  $$,
  'an owner can add evidence to their own shop job'
);

select throws_like(
  $$
    insert into public.job_evidence (job_id, evidence_kind, test_type, storage_path, file_name, mime_type, file_size_bytes)
    values ('b1000000-0000-4000-a000-000000000001', 'audio', 'other', 'b1000000-0000-4000-a000-000000000001/blocked.webm', 'blocked.webm', 'audio/webm', 1024)
  $$,
  '%row-level security policy%',
  'an owner cannot add evidence to another shop job'
);

select throws_like(
  $$
    insert into public.job_evidence (job_id, evidence_kind, test_type, storage_path, file_name, mime_type, file_size_bytes)
    values ('a1000000-0000-4000-a000-000000000001', 'audio', 'other', 'a1000000-0000-4000-a000-000000000001/too-large.webm', 'too-large.webm', 'audio/webm', 26214401)
  $$,
  '%job_evidence_file_size_bytes_check%',
  'evidence metadata rejects files larger than 25 MB'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '31000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.job_evidence), 2, 'a viewer can read evidence for their assigned shop jobs');

select throws_like(
  $$
    insert into public.job_evidence (job_id, evidence_kind, test_type, storage_path, file_name, mime_type, file_size_bytes)
    values ('a1000000-0000-4000-a000-000000000001', 'audio', 'other', 'a1000000-0000-4000-a000-000000000001/viewer.webm', 'viewer.webm', 'audio/webm', 1024)
  $$,
  '%row-level security policy%',
  'a viewer cannot add diagnostic evidence'
);

select is_empty(
  $$delete from public.job_evidence where job_id = 'a1000000-0000-4000-a000-000000000001' returning 1$$,
  'a viewer cannot delete diagnostic evidence'
);

reset role;
select * from finish();
rollback;
