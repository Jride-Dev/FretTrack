begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

select has_column('public', 'jobs', 'accounting_voided_at', 'jobs record accounting exclusion time');
select has_column('public', 'jobs', 'accounting_voided_by', 'jobs record the acting user');
select has_column('public', 'jobs', 'accounting_void_reason', 'jobs record the audit reason');
select has_function('public', 'set_job_accounting_void', array['uuid', 'boolean', 'text'], 'guarded accounting exclusion RPC exists');
select ok(has_function_privilege('authenticated', 'public.set_job_accounting_void(uuid, boolean, text)', 'execute'), 'authenticated users may call the guarded RPC');
select ok(not has_function_privilege('anon', 'public.set_job_accounting_void(uuid, boolean, text)', 'execute'), 'anonymous users cannot call the guarded RPC');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('56000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'void-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('56000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'void-tech@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status, sales_tax_rate)
values ('void-pgtap-shop', 'Void Safety Shop', '56000000-0000-4000-a000-000000000001', 'pro', 'active', 0);

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id = 'void-pgtap-shop';

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('void-pgtap-shop', '56000000-0000-4000-a000-000000000001', 'owner', 'Void Owner'),
  ('void-pgtap-shop', '56000000-0000-4000-a000-000000000002', 'tech', 'Void Tech');

insert into public.jobs (
  id, shop_id, customer_name, guitar_brand, job_number, status, tech_details,
  date_received, job_date, job_day_code, daily_sequence, created_at
)
values
  ('76000000-0000-4000-a000-000000000001', 'void-pgtap-shop', 'Safe Void', 'Fender', 'VOID-1', 'On Bench', '{"payments":[]}'::jsonb, current_date, current_date, 'VOID', 1, now()),
  ('76000000-0000-4000-a000-000000000002', 'void-pgtap-shop', 'Paid Job', 'Gibson', 'VOID-2', 'Completed', '{"payments":[{"id":"pay-1","amount":"100","type":"payment"}]}'::jsonb, current_date, current_date, 'VOID', 2, now()),
  ('76000000-0000-4000-a000-000000000003', 'void-pgtap-shop', 'Removed Payment', 'Martin', 'VOID-3', 'Completed', '{"payments":[]}'::jsonb, current_date, current_date, 'VOID', 3, now()),
  ('76000000-0000-4000-a000-000000000004', 'void-pgtap-shop', 'Refunded Job', 'Taylor', 'VOID-4', 'Completed', '{"payments":[{"id":"pay-4","amount":"100","type":"payment"},{"id":"refund-4","amount":"100","type":"refund"}]}'::jsonb, current_date, current_date, 'VOID', 4, now());

insert into public.job_events (shop_id, job_id, event_type, event_label, event_data)
values
  ('void-pgtap-shop', '76000000-0000-4000-a000-000000000003', 'payment_added', 'Payment added', '{"amount":"100"}'::jsonb),
  ('void-pgtap-shop', '76000000-0000-4000-a000-000000000004', 'payment_added', 'Payment added', '{"amount":"100"}'::jsonb);

set local role authenticated;
set local "request.jwt.claim.sub" = '56000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select throws_like(
  $$select public.set_job_accounting_void('76000000-0000-4000-a000-000000000001', true, 'Invalid test work order')$$,
  '%Only a shop owner or admin%',
  'technicians cannot exclude work orders from accounting'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '56000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select throws_like(
  $$select public.set_job_accounting_void('76000000-0000-4000-a000-000000000001', true, 'short')$$,
  '%between 8 and 500%',
  'an audit reason is required'
);
select lives_ok(
  $$select public.set_job_accounting_void('76000000-0000-4000-a000-000000000001', true, 'Duplicate test work order')$$,
  'an owner can exclude an unpaid work order'
);
select ok(
  (select accounting_voided_at is not null and accounting_voided_by = '56000000-0000-4000-a000-000000000001' and accounting_void_reason = 'Duplicate test work order'
   from public.jobs where id = '76000000-0000-4000-a000-000000000001'),
  'the exclusion fields are stored together'
);
select lives_ok(
  $$select public.set_job_accounting_void('76000000-0000-4000-a000-000000000001', true, 'Duplicate test work order')$$,
  'replaying the same exclusion is idempotent'
);
select is(
  (select count(*)::integer from public.job_events where job_id = '76000000-0000-4000-a000-000000000001' and event_type = 'job_accounting_voided'),
  1,
  'excluding a work order creates one audit event'
);
select throws_like(
  $$update public.jobs set customer_name = 'Hidden rewrite' where id = '76000000-0000-4000-a000-000000000001'$$,
  '%read-only%',
  'an excluded work order cannot be edited through ordinary updates'
);
select lives_ok(
  $$select public.set_job_accounting_void('76000000-0000-4000-a000-000000000001', false, 'Confirmed legitimate work order')$$,
  'an owner can restore an excluded work order'
);
select ok(
  (select accounting_voided_at is null and accounting_voided_by is null and accounting_void_reason is null
   from public.jobs where id = '76000000-0000-4000-a000-000000000001'),
  'restoring clears the exclusion state'
);
select is(
  (select count(*)::integer from public.job_events where job_id = '76000000-0000-4000-a000-000000000001' and event_type = 'job_accounting_restored'),
  1,
  'restoring creates an audit event'
);
select lives_ok(
  $$update public.jobs set customer_name = 'Safe edit' where id = '76000000-0000-4000-a000-000000000001'$$,
  'a restored work order is editable again'
);
select throws_like(
  $$select public.set_job_accounting_void('76000000-0000-4000-a000-000000000002', true, 'Customer payment recorded')$$,
  '%must be explicitly refunded or voided%',
  'a positive recorded payment blocks exclusion'
);
select throws_like(
  $$select public.set_job_accounting_void('76000000-0000-4000-a000-000000000003', true, 'Payment was removed unsafely')$$,
  '%must be explicitly refunded or voided%',
  'removing a payment row does not erase its audit history'
);
select lives_ok(
  $$select public.set_job_accounting_void('76000000-0000-4000-a000-000000000004', true, 'Payment was fully refunded')$$,
  'a fully refunded work order can be explicitly excluded'
);
select is(
  (select (event_data ->> 'netPayment')::numeric from public.job_events where job_id = '76000000-0000-4000-a000-000000000004' and event_type = 'job_accounting_voided'),
  0::numeric,
  'the audit event snapshots the zero net payment'
);

reset role;
update public.shop_subscriptions set status = 'read_only' where shop_id = 'void-pgtap-shop';
set local role authenticated;
set local "request.jwt.claim.sub" = '56000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';
select throws_like(
  $$select public.set_job_accounting_void('76000000-0000-4000-a000-000000000001', true, 'Shop is currently read only')$$,
  '%read-only%',
  'read-only billing state blocks accounting changes'
);

reset role;
select * from finish();
rollback;
