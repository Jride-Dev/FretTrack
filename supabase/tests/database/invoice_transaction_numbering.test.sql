begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_table('public', 'invoice_number_sequences', 'invoice number sequence state exists');
select has_column('public', 'jobs', 'invoice_number', 'jobs store a durable invoice number');
select has_column('public', 'transaction_events', 'request_id', 'transaction events store an optional retry identity');
select has_function('public', 'set_job_invoice_finalization', array['uuid', 'boolean', 'text'], 'invoice finalization RPC remains available');
select has_function('public', 'create_transaction_event', array['jsonb'], 'transaction event RPC remains available');
select ok(not has_function_privilege('anon', 'public.set_job_invoice_finalization(uuid, boolean, text)', 'execute'), 'anonymous users cannot finalize invoices');
select ok(not has_function_privilege('anon', 'public.create_transaction_event(jsonb)', 'execute'), 'anonymous users cannot create transaction events');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '61000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'numbering-owner@frettrack.local',
  crypt('FretTrackTest123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status, sales_tax_rate)
values ('numbering-pgtap-shop', 'Numbering Safety Shop', '61000000-0000-4000-a000-000000000001', 'pro', 'active', 0);

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id = 'numbering-pgtap-shop';

insert into public.shop_members (shop_id, user_id, role, display_name)
values ('numbering-pgtap-shop', '61000000-0000-4000-a000-000000000001', 'owner', 'Numbering Owner');

insert into public.jobs (
  id, shop_id, customer_name, guitar_brand, job_number, status, tech_details,
  date_received, job_date, job_day_code, daily_sequence, created_at
)
values (
  '62000000-0000-4000-a000-000000000001', 'numbering-pgtap-shop', 'Numbering Customer', 'Fender', 'NUM-1', 'Completed',
  '{"payments":[],"discountType":"none","discountValue":"","tax":{"calculationMode":"disabled","currencyCode":"USD"}}'::jsonb,
  current_date, current_date, 'NUM', 1, now()
);

set local role authenticated;
set local "request.jwt.claim.sub" = '61000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select lives_ok(
  $$select public.set_job_invoice_finalization('62000000-0000-4000-a000-000000000001', true, 'Customer approved invoice')$$,
  'first finalization succeeds'
);
select is(
  (select invoice_number from public.jobs where id = '62000000-0000-4000-a000-000000000001'),
  1::bigint,
  'first finalized invoice receives number one from the shop sequence'
);
select is(
  (select (invoice_snapshot ->> 'invoiceNumber')::bigint from public.jobs where id = '62000000-0000-4000-a000-000000000001'),
  1::bigint,
  'invoice snapshot carries the assigned number'
);
select is(
  (select invoice_revision from public.jobs where id = '62000000-0000-4000-a000-000000000001'),
  1,
  'first finalization creates revision one'
);
select lives_ok(
  $$select public.set_job_invoice_finalization('62000000-0000-4000-a000-000000000001', true, 'Repeated finalization request')$$,
  'repeating an already finalized request is safe'
);
select is(
  (select count(*)::integer from public.job_events where job_id = '62000000-0000-4000-a000-000000000001' and event_type = 'invoice_finalized'),
  1,
  'repeating finalization does not create a second audit event'
);
select lives_ok(
  $$select public.set_job_invoice_finalization('62000000-0000-4000-a000-000000000001', false, 'Correcting invoice details')$$,
  'reopening the invoice succeeds'
);
select lives_ok(
  $$select public.set_job_invoice_finalization('62000000-0000-4000-a000-000000000001', true, 'Customer approved corrected invoice')$$,
  're-finalizing the corrected invoice succeeds'
);
select is(
  (select invoice_number from public.jobs where id = '62000000-0000-4000-a000-000000000001'),
  1::bigint,
  'invoice number is preserved across revisions'
);
select is(
  (select invoice_revision from public.jobs where id = '62000000-0000-4000-a000-000000000001'),
  2,
  're-finalization increments the invoice revision'
);
select throws_like(
  $$update public.jobs set invoice_number = 99 where id = '62000000-0000-4000-a000-000000000001'$$,
  '%Invoice numbering must use the guarded invoice action%',
  'invoice numbers cannot be edited directly'
);
select throws_like(
  $$insert into public.jobs (id, shop_id, customer_name, job_number, invoice_number) values ('62000000-0000-4000-a000-000000000002', 'numbering-pgtap-shop', 'Forged invoice', 'NUM-2', 88)$$,
  '%Invoice numbering must use the guarded invoice action%',
  'new work orders cannot forge an invoice number'
);

select lives_ok(
  $$select public.create_transaction_event('{"shop_id":"numbering-pgtap-shop","request_id":"txn-retry-1","event_type":"payment","source_type":"job","source_id":"62000000-0000-4000-a000-000000000001","currency_code":"USD","total_minor":1250}'::jsonb)$$,
  'a transaction event can be created with a request identity'
);
select is(
  (select transaction_number from public.transaction_events where shop_id = 'numbering-pgtap-shop' and request_id = 'txn-retry-1'),
  1::bigint,
  'the first transaction receives number one'
);
select lives_ok(
  $$select public.create_transaction_event('{"shop_id":"numbering-pgtap-shop","request_id":"txn-retry-1","event_type":"payment","source_type":"job","source_id":"62000000-0000-4000-a000-000000000001","currency_code":"USD","total_minor":9999}'::jsonb)$$,
  'replaying a transaction request returns the original event'
);
select is(
  (select count(*)::integer from public.transaction_events where shop_id = 'numbering-pgtap-shop' and request_id = 'txn-retry-1'),
  1,
  'transaction replay does not create a duplicate event'
);
select is(
  (select total_minor from public.transaction_events where shop_id = 'numbering-pgtap-shop' and request_id = 'txn-retry-1'),
  1250::bigint,
  'transaction replay keeps the original amount'
);
select lives_ok(
  $$select public.create_transaction_event('{"shop_id":"numbering-pgtap-shop","request_id":"txn-retry-2","event_type":"payment","source_type":"job","source_id":"62000000-0000-4000-a000-000000000001","currency_code":"USD","total_minor":250}'::jsonb)$$,
  'a new transaction request succeeds'
);
select is(
  (select transaction_number from public.transaction_events where shop_id = 'numbering-pgtap-shop' and request_id = 'txn-retry-2'),
  2::bigint,
  'a distinct transaction request receives the next number'
);
select throws_like(
  $$select public.create_transaction_event('{"shop_id":"numbering-pgtap-shop","event_type":"payment","currency_code":"USD","total_minor":500}'::jsonb)$$,
  '%request_id is required%',
  'transaction creation rejects requests without a retry identity'
);
select ok(
  exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public' and indexname = 'transaction_events_shop_request_id_key'
  ),
  'transaction request identities are uniquely indexed per shop'
);

reset role;
select * from finish();
rollback;
