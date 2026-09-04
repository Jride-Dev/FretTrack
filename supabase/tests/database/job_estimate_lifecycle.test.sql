begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select has_column('public', 'jobs', 'estimate_status', 'jobs retain estimate status history');
select has_column('public', 'jobs', 'estimate_snapshot', 'jobs retain optional estimate snapshots');
select has_column('public', 'jobs', 'estimate_revision', 'jobs retain estimate revisions');
select has_function('public', 'set_job_estimate_state', array['uuid', 'text', 'text', 'timestamp with time zone', 'uuid'], 'legacy estimate history RPC remains available');
select ok(has_function_privilege('authenticated', 'public.set_job_estimate_state(uuid, text, text, timestamptz, uuid)', 'execute'), 'authenticated users may call the estimate history RPC');
select ok(not has_function_privilege('anon', 'public.set_job_estimate_state(uuid, text, text, timestamptz, uuid)', 'execute'), 'anonymous users cannot change estimate history');
select ok(exists (select 1 from pg_catalog.pg_trigger where tgname = 'job_parts_guard_estimate' and tgrelid = 'public.job_parts'::regclass), 'estimate charge trigger remains installed');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('58000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'estimate-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('58000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'estimate-tech@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status, sales_tax_rate)
values ('estimate-pgtap-shop', 'Estimate Safety Shop', '58000000-0000-4000-a000-000000000001', 'pro', 'active', 10);
update public.shop_subscriptions set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null where shop_id = 'estimate-pgtap-shop';
insert into public.shop_members (shop_id, user_id, role, display_name)
values ('estimate-pgtap-shop', '58000000-0000-4000-a000-000000000001', 'owner', 'Estimate Owner'), ('estimate-pgtap-shop', '58000000-0000-4000-a000-000000000002', 'tech', 'Estimate Tech');

insert into public.jobs (id, shop_id, customer_name, guitar_brand, job_number, status, tech_details, date_received, job_date, job_day_code, daily_sequence, created_at)
values
  ('78000000-0000-4000-a000-000000000001', 'estimate-pgtap-shop', 'Estimate Customer', 'Fender', 'EST-1', 'Completed', '{"payments":[],"discountType":"none","discountValue":"","tax":{"salesTaxRate":"10","taxableParts":true,"taxableServices":true,"currencyCode":"USD","state":"CA"}}'::jsonb, current_date, current_date, 'EST', 1, now()),
  ('78000000-0000-4000-a000-000000000002', 'estimate-pgtap-shop', 'Second Customer', 'Gibson', 'EST-2', 'Completed', '{"payments":[],"discountType":"none","discountValue":"","tax":{"salesTaxRate":"10","taxableParts":true,"taxableServices":true,"currencyCode":"USD","state":"CA"}}'::jsonb, current_date, current_date, 'EST', 2, now());
insert into public.job_parts (id, shop_id, job_id, name, quantity, retail, retail_price, cost, unit_cost, created_at)
values ('88000000-0000-4000-a000-000000000001', 'estimate-pgtap-shop', '78000000-0000-4000-a000-000000000001', 'Estimate Part', 1, 20, 20, 5, 5, now()), ('88000000-0000-4000-a000-000000000002', 'estimate-pgtap-shop', '78000000-0000-4000-a000-000000000002', 'Second Part', 1, 10, 10, 3, 3, now());
insert into public.job_services (id, job_id, description, quantity, retail, cost, created_at)
values ('98000000-0000-4000-a000-000000000001', '78000000-0000-4000-a000-000000000001', 'Estimate Service', 1, 30, 5, now()), ('98000000-0000-4000-a000-000000000002', '78000000-0000-4000-a000-000000000002', 'Second Service', 1, 20, 5, now());

set local role authenticated;
set local "request.jwt.claim.sub" = '58000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';
select lives_ok($$update public.job_services set retail = 35 where id = '98000000-0000-4000-a000-000000000001'$$, 'staff can edit charge rows without an estimate approval gate');
select lives_ok($$update public.jobs set tech_details = pg_catalog.jsonb_set(tech_details, '{discountValue}', '"5"'::jsonb) where id = '78000000-0000-4000-a000-000000000001'$$, 'staff can edit discount settings without an estimate lock');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '58000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';
select lives_ok($$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000001', 'sent', 'Estimate prepared', null, 'a8000000-0000-4000-a000-000000000001')$$, 'an owner can record an estimate document');
select lives_ok($$update public.job_services set retail = 40 where id = '98000000-0000-4000-a000-000000000001'$$, 'a recorded estimate does not lock service charges');
select lives_ok($$update public.jobs set tech_details = pg_catalog.jsonb_set(tech_details, '{discountValue}', '"7"'::jsonb) where id = '78000000-0000-4000-a000-000000000001'$$, 'a recorded estimate does not lock discounts');
select lives_ok($$select public.set_job_invoice_finalization('78000000-0000-4000-a000-000000000001', true, 'Invoice ready for billing')$$, 'invoice finalization does not require estimate approval');
select is((select estimate_status from public.jobs where id = '78000000-0000-4000-a000-000000000001'), 'sent', 'estimate history remains visible');
select is((select estimate_revision from public.jobs where id = '78000000-0000-4000-a000-000000000001'), 1, 'estimate history records a revision');
select ok((select estimate_snapshot ->> 'totalMinor' is not null from public.jobs where id = '78000000-0000-4000-a000-000000000001'), 'recorded estimate history retains its calculated snapshot');
select lives_ok($$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000002', 'sent', 'Estimate prepared', null)$$, 'a second estimate can be recorded');
select lives_ok($$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000002', 'declined', 'Customer passed for now', null)$$, 'legacy decisions remain recordable without changing shop workflow');
select lives_ok($$select public.set_job_invoice_finalization('78000000-0000-4000-a000-000000000002', true, 'Invoice ready for billing')$$, 'a declined estimate does not block invoice finalization');
select is((select count(*)::integer from public.job_events where job_id = '78000000-0000-4000-a000-000000000002' and event_type like 'estimate_%'), 2, 'estimate history events remain auditable');

reset role;
select * from finish();
rollback;
