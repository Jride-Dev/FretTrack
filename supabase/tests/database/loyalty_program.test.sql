begin;

create extension if not exists pgtap with schema extensions;

select plan(43);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('53000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'loyalty-pro-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('53000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'loyalty-pro-viewer@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('54000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'loyalty-shop-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status, sales_tax_rate)
values
  ('loyalty-pgtap-pro', 'Loyalty Pro Shop', '53000000-0000-4000-a000-000000000001', 'pro', 'active', 0),
  ('loyalty-pgtap-shop', 'Loyalty Shop Plan', '54000000-0000-4000-a000-000000000001', 'shop', 'active', 0);

update public.shop_subscriptions
set plan_id = case shop_id when 'loyalty-pgtap-pro' then 'pro' else 'shop' end,
    status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id in ('loyalty-pgtap-pro', 'loyalty-pgtap-shop');

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('loyalty-pgtap-pro', '53000000-0000-4000-a000-000000000001', 'owner', 'Loyalty Pro Owner'),
  ('loyalty-pgtap-pro', '53000000-0000-4000-a000-000000000002', 'viewer', 'Loyalty Pro Viewer'),
  ('loyalty-pgtap-shop', '54000000-0000-4000-a000-000000000001', 'owner', 'Loyalty Shop Owner');

select ok(private.shop_has_entitlement('loyalty-pgtap-pro', 'loyalty_program'), 'Pro includes the Loyalty Program');
select ok(not private.shop_has_entitlement('loyalty-pgtap-shop', 'loyalty_program'), 'Shop does not include the Loyalty Program');
select has_table('public', 'loyalty_program_rules', 'loyalty configuration is durable');
select has_table('public', 'loyalty_job_awards', 'work-order-backed loyalty stamps are durable');
select has_table('public', 'loyalty_redemptions', 'reward redemptions have an audit ledger');
select ok((select relrowsecurity from pg_class where oid = 'public.loyalty_program_rules'::regclass), 'loyalty rules enable RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.loyalty_job_awards'::regclass), 'loyalty awards enable RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.loyalty_redemptions'::regclass), 'loyalty redemptions enable RLS');
select ok(has_function_privilege('authenticated', 'public.get_customer_loyalty_summary(uuid)', 'execute'), 'authenticated members can load customer loyalty summaries');
select ok(has_function_privilege('authenticated', 'public.redeem_customer_loyalty_reward(uuid, uuid, uuid, text)', 'execute'), 'authenticated writers can request an audited redemption');
select ok(not has_function_privilege('anon', 'public.redeem_customer_loyalty_reward(uuid, uuid, uuid, text)', 'execute'), 'anonymous callers cannot redeem rewards');
select is((select count(*)::integer from public.loyalty_program_rules where shop_id in ('loyalty-pgtap-pro', 'loyalty-pgtap-shop')), 2, 'new shops receive disabled loyalty rules automatically');

update public.loyalty_program_rules
set enabled = true, points_per_paid_job = 2, reward_threshold = 4, reward_name = 'Free bench check'
where shop_id = 'loyalty-pgtap-pro';
update public.loyalty_program_rules set enabled = true where shop_id = 'loyalty-pgtap-shop';

select ok((select program_started_at is not null from public.loyalty_program_rules where shop_id = 'loyalty-pgtap-pro'), 'first enablement records the program start boundary');

set local role authenticated;
set local "request.jwt.claim.sub" = '53000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.loyalty_program_rules), 1, 'a Pro owner reads only their own loyalty rule');
select isnt_empty(
  $$update public.loyalty_program_rules set terms = 'Staff records redemption; invoices remain explicit.' where shop_id = 'loyalty-pgtap-pro' returning 1$$,
  'a Pro owner can customize loyalty terms'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '53000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.loyalty_program_rules), 1, 'a Pro viewer can inspect loyalty terms');
select is_empty(
  $$update public.loyalty_program_rules set reward_threshold = 2 where shop_id = 'loyalty-pgtap-pro' returning 1$$,
  'a viewer cannot change loyalty terms'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '54000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';
select is((select count(*)::integer from public.loyalty_program_rules), 0, 'a non-Pro shop cannot read the gated loyalty rule');

reset role;

insert into public.customers (id, shop_id, display_name, email, email_normalized)
values
  ('63000000-0000-4000-a000-000000000001', 'loyalty-pgtap-pro', 'Morgan Loyalty', 'morgan@example.test', 'morgan@example.test'),
  ('63000000-0000-4000-a000-000000000002', 'loyalty-pgtap-pro', 'Alex Other', 'alex@example.test', 'alex@example.test'),
  ('64000000-0000-4000-a000-000000000001', 'loyalty-pgtap-shop', 'Riley Shop', 'riley@example.test', 'riley@example.test');

insert into public.jobs (
  id, shop_id, customer_id, customer_name, guitar_brand, job_number, status,
  tech_details, date_received, job_date, job_day_code, daily_sequence, created_at
)
values (
  '73000000-0000-4000-a000-000000000001', 'loyalty-pgtap-pro', '63000000-0000-4000-a000-000000000001',
  'Morgan Loyalty', 'Fender', 'LOY-PRO-1', 'Completed',
  '{"tax":{"rateSource":"job","salesTaxRate":"10","taxableParts":true,"taxableServices":false},"payments":[{"id":"pay-1","amount":"120"}],"discountType":"none","discountValue":"","includedPartIds":[]}'::jsonb,
  current_date, current_date, 'LOY-PRO', 1, now()
);

select is((select count(*)::integer from public.loyalty_job_awards), 0, 'completion alone does not award a stamp before a positive bill exists');

insert into public.job_parts (id, shop_id, job_id, name, quantity, cost, retail, unit_cost, retail_price)
values ('83000000-0000-4000-a000-000000000001', 'loyalty-pgtap-pro', '73000000-0000-4000-a000-000000000001', 'Pickup', 1, 50, 100, 50, 100);
insert into public.job_services (id, job_id, description, quantity, cost, retail)
values ('84000000-0000-4000-a000-000000000001', '73000000-0000-4000-a000-000000000001', 'Installation', 1, 0, 10);

select is((select total_due from private.calculate_loyalty_job_totals('73000000-0000-4000-a000-000000000001')), 120.00::numeric, 'loyalty qualification uses the same parts, services, and tax math as billing');
select is((select paid_total from private.calculate_loyalty_job_totals('73000000-0000-4000-a000-000000000001')), 120.00::numeric, 'loyalty qualification reads the saved payment ledger');
update public.jobs set tech_details = jsonb_set(tech_details, '{includedPartIds}', '["83000000-0000-4000-a000-000000000001"]') where id = '73000000-0000-4000-a000-000000000001';
select is((select total_due from private.calculate_loyalty_job_totals('73000000-0000-4000-a000-000000000001')), 10.00::numeric, 'parts included in service are not billed twice for loyalty qualification');
update public.jobs set tech_details = jsonb_set(jsonb_set(jsonb_set(tech_details, '{includedPartIds}', '[]'), '{discountType}', '"dollar"'), '{discountValue}', '"10"') where id = '73000000-0000-4000-a000-000000000001';
select is((select total_due from private.calculate_loyalty_job_totals('73000000-0000-4000-a000-000000000001')), 110.00::numeric, 'saved invoice discounts are included in loyalty qualification');
update public.jobs set tech_details = jsonb_set(jsonb_set(tech_details, '{discountType}', '"none"'), '{discountValue}', '""') where id = '73000000-0000-4000-a000-000000000001';
select is((select count(*)::integer from public.loyalty_job_awards where source_job_id = '73000000-0000-4000-a000-000000000001'), 1, 'a paid completed work order creates one award row');
select ok((select active and points = 2 from public.loyalty_job_awards where source_job_id = '73000000-0000-4000-a000-000000000001'), 'the award snapshots the configured stamps per work order');

update public.jobs set tech_details = jsonb_set(tech_details, '{payments,0,amount}', '"100"') where id = '73000000-0000-4000-a000-000000000001';
select ok((select not active and reversed_at is not null from public.loyalty_job_awards where source_job_id = '73000000-0000-4000-a000-000000000001'), 'removing payment reverses the stamp');

update public.jobs set tech_details = jsonb_set(tech_details, '{payments,0,amount}', '"120"') where id = '73000000-0000-4000-a000-000000000001';
select ok((select active from public.loyalty_job_awards where source_job_id = '73000000-0000-4000-a000-000000000001'), 'restoring full payment reactivates the same stamp');
select is((select count(*)::integer from public.loyalty_job_awards where source_job_id = '73000000-0000-4000-a000-000000000001'), 1, 'payment retries cannot duplicate the award');

update public.jobs set status = 'On Bench' where id = '73000000-0000-4000-a000-000000000001';
select ok((select not active from public.loyalty_job_awards where source_job_id = '73000000-0000-4000-a000-000000000001'), 'reopening a completed work order reverses its stamp');
update public.jobs set status = 'Completed' where id = '73000000-0000-4000-a000-000000000001';
select ok((select active from public.loyalty_job_awards where source_job_id = '73000000-0000-4000-a000-000000000001'), 'recompleting the fully paid work order restores its stamp');

insert into public.jobs (
  id, shop_id, customer_id, customer_name, guitar_brand, job_number, status,
  tech_details, date_received, job_date, job_day_code, daily_sequence, created_at
)
values (
  '73000000-0000-4000-a000-000000000002', 'loyalty-pgtap-pro', '63000000-0000-4000-a000-000000000001',
  'Morgan Loyalty', 'Gibson', 'LOY-PRO-2', 'Completed',
  '{"tax":{"rateSource":"job","salesTaxRate":"0","taxableParts":false,"taxableServices":false},"payments":[{"id":"pay-2","amount":"50"}],"discountType":"none","includedPartIds":[]}'::jsonb,
  current_date, current_date, 'LOY-PRO', 2, now()
);
insert into public.job_services (id, job_id, description, quantity, cost, retail)
values ('84000000-0000-4000-a000-000000000002', '73000000-0000-4000-a000-000000000002', 'Setup', 1, 0, 50);

select is((select count(*)::integer from public.loyalty_job_awards where customer_id = '63000000-0000-4000-a000-000000000001' and active), 2, 'two qualifying work orders create two active awards');
update public.jobs set customer_id = '63000000-0000-4000-a000-000000000002', customer_name = 'Alex Other' where id = '73000000-0000-4000-a000-000000000002';
select ok((select not active from public.loyalty_job_awards where source_job_id = '73000000-0000-4000-a000-000000000002'), 'changing the customer reverses an existing work-order award');
select is((select count(*)::integer from public.loyalty_job_awards where customer_id = '63000000-0000-4000-a000-000000000002' and active), 0, 'an earned stamp cannot move to another customer and be redeemed twice');
update public.jobs set customer_id = '63000000-0000-4000-a000-000000000001', customer_name = 'Morgan Loyalty' where id = '73000000-0000-4000-a000-000000000002';
select ok((select active from public.loyalty_job_awards where source_job_id = '73000000-0000-4000-a000-000000000002'), 'restoring the original customer restores the original award');

set local role authenticated;
set local "request.jwt.claim.sub" = '53000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select available_points from public.get_customer_loyalty_summary('63000000-0000-4000-a000-000000000001')), 4, 'customer summary totals active stamps');
select is((select available_rewards from public.get_customer_loyalty_summary('63000000-0000-4000-a000-000000000001')), 1, 'customer summary exposes one earned reward');
select ok(public.redeem_customer_loyalty_reward('63000000-0000-4000-a000-000000000001', 'aaaaaaaa-1000-4000-a000-000000000001', null, 'Customer chose reward') is not null, 'a writer can record one explicit reward redemption');
select ok((select redeemed_points = 4 and available_points = 0 from public.get_customer_loyalty_summary('63000000-0000-4000-a000-000000000001')), 'redemption spends the threshold without changing an invoice');
select is(
  public.redeem_customer_loyalty_reward('63000000-0000-4000-a000-000000000001', 'aaaaaaaa-1000-4000-a000-000000000001', null, 'Customer chose reward'),
  (select id from public.loyalty_redemptions where idempotency_key = 'aaaaaaaa-1000-4000-a000-000000000001'),
  'retrying a redemption key returns the original audit row'
);
select throws_like(
  $$select public.redeem_customer_loyalty_reward('63000000-0000-4000-a000-000000000001', 'aaaaaaaa-1000-4000-a000-000000000002', null, 'Duplicate benefit')$$,
  '%has not earned enough loyalty points%',
  'a second reward cannot overspend the customer balance'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '53000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';
select is((select available_points from public.get_customer_loyalty_summary('63000000-0000-4000-a000-000000000001')), 0, 'a Pro viewer can inspect the customer loyalty summary');

reset role;
insert into public.jobs (
  id, shop_id, customer_id, customer_name, guitar_brand, job_number, status,
  tech_details, date_received, job_date, job_day_code, daily_sequence, created_at
)
select
  '73000000-0000-4000-a000-000000000003', 'loyalty-pgtap-pro', '63000000-0000-4000-a000-000000000001',
  'Morgan Loyalty', 'Taylor', 'LOY-PRO-OLD', 'Completed',
  '{"tax":{"rateSource":"job","salesTaxRate":"0"},"payments":[{"amount":"50"}],"includedPartIds":[]}'::jsonb,
  current_date, current_date, 'LOY-PRO', 3, program_started_at - interval '1 day'
from public.loyalty_program_rules where shop_id = 'loyalty-pgtap-pro';
insert into public.job_services (id, job_id, description, quantity, cost, retail)
values ('84000000-0000-4000-a000-000000000003', '73000000-0000-4000-a000-000000000003', 'Historical Setup', 1, 0, 50);
select is((select count(*)::integer from public.loyalty_job_awards where source_job_id = '73000000-0000-4000-a000-000000000003'), 0, 'work orders opened before program start do not receive surprise retroactive stamps');

insert into public.jobs (
  id, shop_id, customer_id, customer_name, guitar_brand, job_number, status,
  tech_details, date_received, job_date, job_day_code, daily_sequence, created_at
)
values (
  '74000000-0000-4000-a000-000000000001', 'loyalty-pgtap-shop', '64000000-0000-4000-a000-000000000001',
  'Riley Shop', 'Ibanez', 'LOY-SHOP-1', 'Completed',
  '{"tax":{"rateSource":"job","salesTaxRate":"0"},"payments":[{"amount":"50"}],"includedPartIds":[]}'::jsonb,
  current_date, current_date, 'LOY-SHOP', 1, now()
);
insert into public.job_services (id, job_id, description, quantity, cost, retail)
values ('85000000-0000-4000-a000-000000000001', '74000000-0000-4000-a000-000000000001', 'Setup', 1, 0, 50);
select is((select count(*)::integer from public.loyalty_job_awards where source_job_id = '74000000-0000-4000-a000-000000000001'), 0, 'a non-Pro shop cannot earn loyalty awards even if its raw rule is enabled');

select * from finish();
rollback;
