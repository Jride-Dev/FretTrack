begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('41000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'keyboard-pro-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('41000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'keyboard-pro-viewer@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('42000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'keyboard-shop-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status)
values
  ('keyboard-pgtap-pro', 'Keyboard pgTAP Pro Shop', '41000000-0000-4000-a000-000000000001', 'pro', 'active'),
  ('keyboard-pgtap-shop', 'Keyboard pgTAP Shop Plan', '42000000-0000-4000-a000-000000000001', 'pro', 'active');

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id in ('keyboard-pgtap-pro', 'keyboard-pgtap-shop');

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('keyboard-pgtap-pro', '41000000-0000-4000-a000-000000000001', 'owner', 'Keyboard Pro Owner'),
  ('keyboard-pgtap-pro', '41000000-0000-4000-a000-000000000002', 'viewer', 'Keyboard Pro Viewer'),
  ('keyboard-pgtap-shop', '42000000-0000-4000-a000-000000000001', 'owner', 'Keyboard Shop Owner');

insert into public.jobs (id, shop_id, customer_name, guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence, tech_details)
values
  ('41000000-0000-4000-a100-000000000001', 'keyboard-pgtap-pro', 'Synth Customer', 'Roland', 'KEY-PRO-1', current_date, current_date, 'KEY-PRO', 1, '{"instrumentType":"Keyboard","keyboard":{"keyboardType":"Synthesizer"}}'::jsonb),
  ('42000000-0000-4000-a100-000000000001', 'keyboard-pgtap-shop', 'Historical Piano Customer', 'Yamaha', 'KEY-SHOP-1', current_date, current_date, 'KEY-SHOP', 1, '{"instrumentType":"Keyboard","keyboard":{"keyboardType":"Digital Piano"}}'::jsonb);

update public.shop_profiles
set subscription_tier = 'shop'
where shop_id = 'keyboard-pgtap-shop';

update public.shop_subscriptions
set plan_id = 'shop'
where shop_id = 'keyboard-pgtap-shop';

select is(
  (select value from public.plan_entitlements where plan_id = 'shop' and key = 'keyboard_repair'),
  'false'::jsonb,
  'Shop does not include Keyboard Repair'
);

select is(
  (select value from public.plan_entitlements where plan_id = 'pro' and key = 'keyboard_repair'),
  'true'::jsonb,
  'Pro includes Keyboard Repair'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '41000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select isnt_empty(
  $$
    insert into public.jobs (id, shop_id, customer_name, guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence, tech_details)
    values ('41000000-0000-4000-a100-000000000002', 'keyboard-pgtap-pro', 'Second Synth Customer', 'Korg', 'KEY-PRO-2', current_date, current_date, 'KEY-PRO', 2, '{"instrumentType":"Keyboard"}'::jsonb)
    returning 1
  $$,
  'a Pro owner can create a keyboard work order'
);

select is((select count(*)::integer from public.jobs where lower(tech_details ->> 'instrumentType') = 'keyboard'), 2, 'a Pro owner sees only their shop keyboard work orders');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '41000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select throws_like(
  $$
    insert into public.jobs (id, shop_id, customer_name, guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence, tech_details)
    values ('41000000-0000-4000-a100-000000000003', 'keyboard-pgtap-pro', 'Blocked Viewer Customer', 'Casio', 'KEY-PRO-3', current_date, current_date, 'KEY-PRO', 3, '{"instrumentType":"Keyboard"}'::jsonb)
    returning 1
  $$,
  '%row-level security policy%',
  'a viewer cannot create a keyboard work order'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '42000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.jobs where lower(tech_details ->> 'instrumentType') = 'keyboard'), 1, 'a Shop owner retains read access to historical keyboard work');

select throws_like(
  $$update public.jobs set reason_for_visit = 'Blocked edit' where id = '42000000-0000-4000-a100-000000000001'$$,
  '%Keyboard Repair is available on Pro%',
  'a Shop owner cannot edit a historical keyboard work order'
);

select throws_like(
  $$update public.jobs set tech_details = jsonb_set(tech_details, '{instrumentType}', '"Electric"'::jsonb) where id = '42000000-0000-4000-a100-000000000001'$$,
  '%Keyboard Repair is available on Pro%',
  'a Shop owner cannot bypass the gate by converting historical keyboard work'
);

select throws_like(
  $$
    insert into public.jobs (id, shop_id, customer_name, guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence, tech_details)
    values ('42000000-0000-4000-a100-000000000002', 'keyboard-pgtap-shop', 'Blocked Keyboard Customer', 'Nord', 'KEY-SHOP-2', current_date, current_date, 'KEY-SHOP', 2, '{"instrumentType":"Keyboard"}'::jsonb)
  $$,
  '%Keyboard Repair is available on Pro%',
  'a Shop owner cannot create a keyboard work order'
);

select isnt_empty(
  $$
    insert into public.jobs (id, shop_id, customer_name, guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence, tech_details)
    values ('42000000-0000-4000-a100-000000000003', 'keyboard-pgtap-shop', 'Guitar Customer', 'Fender', 'GTR-SHOP-3', current_date, current_date, 'GTR-SHOP', 3, '{"instrumentType":"Electric"}'::jsonb)
    returning 1
  $$,
  'a Shop owner can continue creating ordinary guitar jobs'
);

select throws_like(
  $$update public.jobs set tech_details = jsonb_set(tech_details, '{instrumentType}', '"Keyboard"'::jsonb) where id = '42000000-0000-4000-a100-000000000003'$$,
  '%Keyboard Repair is available on Pro%',
  'a Shop owner cannot convert an ordinary job into Keyboard Repair'
);

reset role;
select * from finish();
rollback;
