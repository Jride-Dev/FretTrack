begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

select has_column('public', 'jobs', 'invoice_finalized_at', 'jobs record invoice finalization time');
select has_column('public', 'jobs', 'invoice_snapshot', 'jobs store the server-calculated invoice snapshot');
select has_column('public', 'jobs', 'invoice_revision', 'jobs track invoice revisions');
select has_function('public', 'record_job_payment', array['uuid', 'uuid', 'bigint', 'text', 'text', 'text', 'date', 'timestamp with time zone'], 'guarded payment RPC exists');
select has_function('public', 'record_job_payment_adjustment', array['uuid', 'uuid', 'uuid', 'bigint', 'text', 'text', 'text', 'date', 'timestamp with time zone'], 'linked adjustment RPC exists');
select has_function('public', 'set_job_invoice_finalization', array['uuid', 'boolean', 'text'], 'guarded finalization RPC exists');
select ok(has_function_privilege('authenticated', 'public.record_job_payment(uuid, uuid, bigint, text, text, text, date, timestamptz)', 'execute'), 'authenticated users may call the payment RPC');
select ok(not has_function_privilege('anon', 'public.record_job_payment(uuid, uuid, bigint, text, text, text, date, timestamptz)', 'execute'), 'anonymous users cannot call the payment RPC');
select ok(has_function_privilege('authenticated', 'public.record_job_payment_adjustment(uuid, uuid, uuid, bigint, text, text, text, date, timestamptz)', 'execute'), 'authenticated users may call the adjustment RPC');
select ok(not has_function_privilege('anon', 'public.record_job_payment_adjustment(uuid, uuid, uuid, bigint, text, text, text, date, timestamptz)', 'execute'), 'anonymous users cannot call the adjustment RPC');
select ok(not has_function_privilege('anon', 'public.set_job_invoice_finalization(uuid, boolean, text)', 'execute'), 'anonymous users cannot finalize invoices');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('57000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'commerce-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('57000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'commerce-tech@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status, sales_tax_rate)
values ('commerce-pgtap-shop', 'Commerce Safety Shop', '57000000-0000-4000-a000-000000000001', 'pro', 'active', 8.25);

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id = 'commerce-pgtap-shop';

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('commerce-pgtap-shop', '57000000-0000-4000-a000-000000000001', 'owner', 'Commerce Owner'),
  ('commerce-pgtap-shop', '57000000-0000-4000-a000-000000000002', 'tech', 'Commerce Tech');

insert into public.jobs (
  id, shop_id, customer_name, guitar_brand, job_number, status, tech_details,
  date_received, job_date, job_day_code, daily_sequence, created_at
)
values (
  '77000000-0000-4000-a000-000000000001', 'commerce-pgtap-shop', 'Invoice Customer', 'Fender', 'COM-1', 'Completed',
  '{"payments":[],"discountType":"dollar","discountValue":"5","includedPartIds":["87000000-0000-4000-a000-000000000002"],"tax":{"salesTaxRate":"10","taxableParts":true,"taxableServices":true,"currencyCode":"USD","state":"CA"}}'::jsonb,
  current_date, current_date, 'COM', 1, now()
);

insert into public.job_parts (id, shop_id, job_id, name, quantity, retail, retail_price, cost, unit_cost, created_at)
values
  ('87000000-0000-4000-a000-000000000001', 'commerce-pgtap-shop', '77000000-0000-4000-a000-000000000001', 'Billable Part', 2, 10, 10, 2, 2, now()),
  ('87000000-0000-4000-a000-000000000002', 'commerce-pgtap-shop', '77000000-0000-4000-a000-000000000001', 'Included Part', 1, 3, 3, 1, 1, now());

insert into public.job_services (id, job_id, description, quantity, retail, cost, created_at)
values ('97000000-0000-4000-a000-000000000001', '77000000-0000-4000-a000-000000000001', 'Setup', 1, 30, 5, now());

set local role authenticated;
set local "request.jwt.claim.sub" = '57000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select lives_ok(
  $$select public.record_job_payment('77000000-0000-4000-a000-000000000001', 'a7000000-0000-4000-a000-000000000001', 1000, 'payment', 'Cash', 'Deposit', current_date, null)$$,
  'a technician can record an ordinary payment'
);
select is(
  (select (tech_details #>> '{payments,0,amount}')::numeric from public.jobs where id = '77000000-0000-4000-a000-000000000001'),
  10::numeric,
  'the guarded payment is appended to the job'
);
select lives_ok(
  $$select public.record_job_payment('77000000-0000-4000-a000-000000000001', 'a7000000-0000-4000-a000-000000000001', 1000, 'payment', 'Cash', 'Deposit', current_date, null)$$,
  'replaying the same payment request is idempotent'
);
select is(
  (select pg_catalog.jsonb_array_length(tech_details -> 'payments') from public.jobs where id = '77000000-0000-4000-a000-000000000001'),
  1,
  'an idempotent replay does not duplicate payment history'
);
select throws_like(
  $$select public.record_job_payment('77000000-0000-4000-a000-000000000001', 'a7000000-0000-4000-a000-000000000002', 500, 'refund', 'Cash', 'Refund', current_date, null)$$,
  '%Only a shop owner or admin%','technicians cannot record refunds');
select throws_like(
  $$update public.jobs set tech_details = pg_catalog.jsonb_set(tech_details, '{payments}', '[]'::jsonb) where id = '77000000-0000-4000-a000-000000000001'$$,
  '%append-only%','payment history cannot be rewritten directly');
select throws_like(
  $$update public.jobs set tech_details = pg_catalog.jsonb_set(tech_details, '{discountValue}', '"20"'::jsonb) where id = '77000000-0000-4000-a000-000000000001'$$,
  '%Only a shop owner or admin%','technicians cannot change discounts');
select throws_like(
  $$select public.set_job_invoice_finalization('77000000-0000-4000-a000-000000000001', true, 'Customer approved final invoice')$$,
  '%Only a shop owner or admin%','technicians cannot finalize invoices');
select throws_like(
  $$update public.job_services set retail = 35 where id = '97000000-0000-4000-a000-000000000001'$$,
  '%Only a shop owner or admin%','technicians cannot change invoice charge rows');

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '57000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select lives_ok(
  $$select public.record_job_payment_adjustment('77000000-0000-4000-a000-000000000001', 'a7000000-0000-4000-a000-000000000003', 'a7000000-0000-4000-a000-000000000001', 200, 'refund', 'Cash', 'Partial refund', current_date, null)$$,
  'an owner can append a linked refund adjustment'
);
select lives_ok(
  $$select public.record_job_payment_adjustment('77000000-0000-4000-a000-000000000001', 'a7000000-0000-4000-a000-000000000003', 'a7000000-0000-4000-a000-000000000001', 9999, 'refund', 'Cash', 'Changed retry payload', current_date, null)$$,
  'replaying an adjustment request returns the original adjustment'
);
select throws_like(
  $$select public.record_job_payment_adjustment('77000000-0000-4000-a000-000000000001', 'a7000000-0000-4000-a000-000000000006', 'a7000000-0000-4000-a000-000000000001', 8100, 'refund', 'Cash', 'Too much refund', current_date, null)$$,
  '%exceeds the remaining refundable balance%', 'refunds cannot exceed the original payment balance'
);
select lives_ok(
  $$select public.set_job_invoice_finalization('77000000-0000-4000-a000-000000000001', true, 'Customer approved final invoice')$$,
  'an owner can finalize an invoice'
);
select is(
  (select (invoice_snapshot ->> 'totalMinor')::bigint from public.jobs where id = '77000000-0000-4000-a000-000000000001'),
  4950::bigint,
  'the server snapshots billable parts, services, discount-adjusted tax, and total in minor units'
);
select is(
  (select (invoice_snapshot ->> 'includedPartsMinor')::bigint from public.jobs where id = '77000000-0000-4000-a000-000000000001'),
  300::bigint,
  'included parts are recorded but excluded from the amount due'
);
select throws_like(
  $$update public.job_services set retail = 40 where id = '97000000-0000-4000-a000-000000000001'$$,
  '%Finalized invoice parts and services are locked%','finalized service charges cannot be changed');
select throws_like(
  $$update public.jobs set tech_details = pg_catalog.jsonb_set(tech_details, '{discountValue}', '"10"'::jsonb) where id = '77000000-0000-4000-a000-000000000001'$$,
  '%Finalized invoice charges and tax settings are locked%','finalized discounts cannot be changed');
select lives_ok(
  $$select public.record_job_payment('77000000-0000-4000-a000-000000000001', 'a7000000-0000-4000-a000-000000000004', 3800, 'payment', 'Card', 'Final payment', current_date, null)$$,
  'payments can still be appended after invoice finalization'
);
select lives_ok(
  $$select public.record_job_payment_adjustment('77000000-0000-4000-a000-000000000001', 'a7000000-0000-4000-a000-000000000005', 'a7000000-0000-4000-a000-000000000001', 300, 'refund', 'Card', 'Post-finalization refund', current_date, null)$$,
  'linked owner refunds can be appended after invoice finalization'
);
select lives_ok(
  $$select public.set_job_invoice_finalization('77000000-0000-4000-a000-000000000001', false, 'Customer requested charge correction')$$,
  'an owner can reopen a finalized invoice with an audit reason'
);
select lives_ok(
  $$update public.job_services set retail = 40 where id = '97000000-0000-4000-a000-000000000001'$$,
  'charge rows become editable after invoice reopening'
);
select is(
  (select count(*)::integer from public.job_events where job_id = '77000000-0000-4000-a000-000000000001' and event_type in ('invoice_finalized', 'invoice_reopened')),
  2,
  'finalization and reopening both create audit events'
);

reset role;
select * from finish();
rollback;
