begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

select has_column('public', 'jobs', 'estimate_status', 'jobs record estimate state');
select has_column('public', 'jobs', 'estimate_snapshot', 'jobs store a sent estimate snapshot');
select has_column('public', 'jobs', 'estimate_revision', 'jobs track estimate revisions');
select has_column('public', 'jobs', 'estimate_decided_at', 'jobs record estimate decisions');
select ok(exists (
  select 1 from pg_catalog.pg_constraint
  where conname = 'job_services_quantity_whole_check'
    and conrelid = 'public.job_services'::regclass
), 'service quantities have a whole-number database guard');
select has_function('public', 'set_job_estimate_state', array['uuid', 'text', 'text', 'timestamp with time zone', 'uuid'], 'guarded estimate RPC exists');
select ok(has_function_privilege('authenticated', 'public.set_job_estimate_state(uuid, text, text, timestamptz, uuid)', 'execute'), 'authenticated users may call the estimate RPC');
select ok(not has_function_privilege('anon', 'public.set_job_estimate_state(uuid, text, text, timestamptz, uuid)', 'execute'), 'anonymous users cannot change estimate state');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('58000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'estimate-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('58000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'estimate-tech@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status, sales_tax_rate)
values ('estimate-pgtap-shop', 'Estimate Safety Shop', '58000000-0000-4000-a000-000000000001', 'pro', 'active', 10);

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id = 'estimate-pgtap-shop';

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('estimate-pgtap-shop', '58000000-0000-4000-a000-000000000001', 'owner', 'Estimate Owner'),
  ('estimate-pgtap-shop', '58000000-0000-4000-a000-000000000002', 'tech', 'Estimate Tech');

insert into public.jobs (
  id, shop_id, customer_name, guitar_brand, job_number, status, tech_details,
  date_received, job_date, job_day_code, daily_sequence, created_at
)
values
  (
    '78000000-0000-4000-a000-000000000001', 'estimate-pgtap-shop', 'Approval Customer', 'Fender', 'EST-1', 'Completed',
    '{"payments":[],"discountType":"none","discountValue":"","tax":{"salesTaxRate":"10","taxableParts":true,"taxableServices":true,"currencyCode":"USD","state":"CA"}}'::jsonb,
    current_date, current_date, 'EST', 1, now()
  ),
  (
    '78000000-0000-4000-a000-000000000002', 'estimate-pgtap-shop', 'Decline Customer', 'Gibson', 'EST-2', 'Completed',
    '{"payments":[],"discountType":"none","discountValue":"","tax":{"salesTaxRate":"10","taxableParts":true,"taxableServices":true,"currencyCode":"USD","state":"CA"}}'::jsonb,
    current_date, current_date, 'EST', 2, now()
  );

insert into public.job_parts (id, shop_id, job_id, name, quantity, retail, retail_price, cost, unit_cost, created_at)
values
  ('88000000-0000-4000-a000-000000000001', 'estimate-pgtap-shop', '78000000-0000-4000-a000-000000000001', 'Approval Part', 1, 20, 20, 5, 5, now()),
  ('88000000-0000-4000-a000-000000000002', 'estimate-pgtap-shop', '78000000-0000-4000-a000-000000000002', 'Decline Part', 1, 10, 10, 3, 3, now());

insert into public.job_services (id, job_id, description, quantity, retail, cost, created_at)
values
  ('98000000-0000-4000-a000-000000000001', '78000000-0000-4000-a000-000000000001', 'Approval Service', 1, 30, 5, now()),
  ('98000000-0000-4000-a000-000000000002', '78000000-0000-4000-a000-000000000002', 'Decline Service', 1, 20, 5, now());

set local role authenticated;
set local "request.jwt.claim.sub" = '58000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select throws_like(
  $$insert into public.jobs (id, shop_id, customer_name, job_number, status, estimate_status, estimate_snapshot, estimate_revision, estimate_sent_at, estimate_sent_by, estimate_status_note) values ('78000000-0000-4000-a000-000000000099', 'estimate-pgtap-shop', 'Forged Estimate', 'EST-99', 'Completed', 'sent', '{}'::jsonb, 1, now(), '58000000-0000-4000-a000-000000000001', 'Forged sent estimate')$$,
  '%must begin with a draft estimate%','new work orders cannot forge an already-sent estimate');
select throws_like(
  $$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000001', 'sent', 'Estimate delivered to customer', null)$$,
  '%Only a shop owner or admin%','technicians cannot change estimate state');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '58000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select throws_like(
  $$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000001', 'approved', 'Customer approved estimate', null)$$,
  '%must be sent%','a draft estimate cannot skip directly to approval');
select lives_ok(
  $$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000001', 'sent', 'Estimate delivered to customer', null, 'a8000000-0000-4000-a000-000000000001')$$,
  'an owner can send an estimate');
select lives_ok(
  $$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000001', 'sent', 'Estimate delivered to customer', null, 'a8000000-0000-4000-a000-000000000001')$$,
  'a lost-response retry replays the same estimate transition');
select is((select count(*)::integer from public.job_events where job_id = '78000000-0000-4000-a000-000000000001' and event_type = 'estimate_sent'), 1, 'an idempotent retry does not duplicate estimate events');
select is((select estimate_status from public.jobs where id = '78000000-0000-4000-a000-000000000001'), 'sent', 'the estimate is marked sent');
select is((select estimate_revision from public.jobs where id = '78000000-0000-4000-a000-000000000001'), 1, 'sending creates the first estimate revision');
select is((select (estimate_snapshot ->> 'totalMinor')::bigint from public.jobs where id = '78000000-0000-4000-a000-000000000001'), 5500::bigint, 'the sent estimate snapshots server-calculated charges and tax');
select throws_like(
  $$update public.jobs set estimate_status = 'approved' where id = '78000000-0000-4000-a000-000000000001'$$,
  '%guarded estimate action%','estimate state cannot be changed directly');
select throws_like(
  $$update public.job_services set retail = 35 where id = '98000000-0000-4000-a000-000000000001'$$,
  '%estimate parts and services are locked%','sent estimate services are locked');
select throws_like(
  $$update public.jobs set tech_details = pg_catalog.jsonb_set(tech_details, '{discountValue}', '"5"'::jsonb) where id = '78000000-0000-4000-a000-000000000001'$$,
  '%estimate charges are locked%','sent estimate discounts are locked');
select lives_ok(
  $$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000001', 'approved', 'Customer approved the estimate', null)$$,
  'an owner can record customer approval');
select is((select estimate_status from public.jobs where id = '78000000-0000-4000-a000-000000000001'), 'approved', 'the estimate is marked approved');
select ok((select estimate_decided_at is not null from public.jobs where id = '78000000-0000-4000-a000-000000000001'), 'approval records a decision timestamp');
select lives_ok(
  $$select public.set_job_invoice_finalization('78000000-0000-4000-a000-000000000001', true, 'Approved work completed for customer')$$,
  'an approved estimate can become a finalized invoice');

select lives_ok(
  $$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000002', 'sent', 'Estimate delivered to customer', null)$$,
  'a second estimate can be sent');
select lives_ok(
  $$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000002', 'declined', 'Customer declined the estimate', null)$$,
  'an owner can record a declined estimate');
select throws_like(
  $$select public.set_job_invoice_finalization('78000000-0000-4000-a000-000000000002', true, 'Attempt to finalize declined estimate')$$,
  '%Only an approved estimate%','a declined estimate cannot be finalized');
select lives_ok(
  $$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000002', 'draft', 'Preparing a revised estimate', null)$$,
  'a declined estimate can return to draft');
select lives_ok(
  $$update public.job_services set retail = 25 where id = '98000000-0000-4000-a000-000000000002'$$,
  'charges become editable again in draft');
select lives_ok(
  $$select public.set_job_estimate_state('78000000-0000-4000-a000-000000000002', 'sent', 'Revised estimate sent to customer', null)$$,
  'a revised estimate can be sent');
select is((select estimate_revision from public.jobs where id = '78000000-0000-4000-a000-000000000002'), 2, 'a revised send increments the estimate revision');
select is((select count(*)::integer from public.job_events where job_id = '78000000-0000-4000-a000-000000000002' and event_type like 'estimate_%'), 4, 'every estimate transition creates an audit event');

reset role;
select * from finish();
rollback;
