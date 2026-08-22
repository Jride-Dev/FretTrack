begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('51000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reminder-pro-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('51000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reminder-pro-viewer@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('52000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reminder-shop-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status)
values
  ('reminder-pgtap-pro', 'Reminder Pro Shop', '51000000-0000-4000-a000-000000000001', 'pro', 'active'),
  ('reminder-pgtap-shop', 'Reminder Shop Plan', '52000000-0000-4000-a000-000000000001', 'shop', 'active');

update public.shop_subscriptions
set plan_id = case shop_id when 'reminder-pgtap-pro' then 'pro' else 'shop' end,
    status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id in ('reminder-pgtap-pro', 'reminder-pgtap-shop');

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('reminder-pgtap-pro', '51000000-0000-4000-a000-000000000001', 'owner', 'Reminder Pro Owner'),
  ('reminder-pgtap-pro', '51000000-0000-4000-a000-000000000002', 'viewer', 'Reminder Pro Viewer'),
  ('reminder-pgtap-shop', '52000000-0000-4000-a000-000000000001', 'owner', 'Reminder Shop Owner');

insert into public.service_reminder_rules (shop_id)
values ('reminder-pgtap-pro'), ('reminder-pgtap-shop')
on conflict (shop_id) do nothing;

select ok(private.shop_has_entitlement('reminder-pgtap-pro', 'automated_service_reminders'), 'Pro includes automated service reminders');
select ok(not private.shop_has_entitlement('reminder-pgtap-shop', 'automated_service_reminders'), 'Shop does not include automated service reminders');
select has_column('public', 'customers', 'service_reminder_opt_in', 'customers store separate service-reminder consent');
select has_column('public', 'customers', 'service_reminder_consent_at', 'customers store the consent timestamp');
select has_column('public', 'jobs', 'service_completed_at', 'jobs store an authoritative completion timestamp');
select has_table('public', 'service_reminder_rules', 'service reminder rules are durable');
select has_table('public', 'service_reminder_queue', 'long-horizon reminders use a durable queue');
select ok(not has_function_privilege('authenticated', 'public.claim_due_service_reminders(uuid, integer)', 'execute'), 'authenticated users cannot claim nightly deliveries');
select ok(not has_function_privilege('authenticated', 'public.validate_service_reminder_claim(uuid, uuid)', 'execute'), 'authenticated users cannot validate a delivery claim');
select ok(not has_function_privilege('authenticated', 'public.finalize_service_reminder_delivery(uuid, uuid, text, text, text)', 'execute'), 'authenticated users cannot finalize a delivery');
select ok(has_function_privilege('service_role', 'public.claim_due_service_reminders(uuid, integer)', 'execute'), 'the service role can claim nightly deliveries');

set local role authenticated;
set local "request.jwt.claim.sub" = '51000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.service_reminder_rules), 1, 'a Pro owner sees only their own reminder rule');
select isnt_empty(
  $$update public.service_reminder_rules
    set enabled = true, interval_months = 6,
        subject_template = 'Time for {{service_name}}, {{customer_first_name}}?',
        body_template = '{{shop_name}} recommends service after {{months}} months. {{booking_url}}',
        booking_url = 'https://example.test/book'
    where shop_id = 'reminder-pgtap-pro' returning 1$$,
  'a Pro owner can enable and customize reminders'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '51000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.service_reminder_rules), 1, 'a Pro viewer can inspect reminder settings');
select is_empty(
  $$update public.service_reminder_rules set interval_months = 12 where shop_id = 'reminder-pgtap-pro' returning 1$$,
  'a viewer cannot change reminder settings'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '52000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.service_reminder_rules), 0, 'a non-Pro shop cannot read the gated reminder configuration');
select is_empty(
  $$update public.service_reminder_rules set enabled = true where shop_id = 'reminder-pgtap-shop' returning 1$$,
  'a non-Pro shop cannot enable reminders'
);

reset role;

insert into public.customers (
  id, shop_id, display_name, first_name, email, email_normalized,
  service_reminder_opt_in, service_reminder_consent_at, service_reminder_consent_source
)
values
  ('61000000-0000-4000-a000-000000000001', 'reminder-pgtap-pro', 'Taylor Test', 'Taylor', 'taylor@example.test', 'taylor@example.test', true, now(), 'pgtap'),
  ('61000000-0000-4000-a000-000000000002', 'reminder-pgtap-pro', 'Jordan Test', 'Jordan', 'jordan@example.test', 'jordan@example.test', true, now(), 'pgtap'),
  ('62000000-0000-4000-a000-000000000001', 'reminder-pgtap-shop', 'Casey Test', 'Casey', 'casey@example.test', 'casey@example.test', true, now(), 'pgtap');

insert into public.jobs (
  id, shop_id, customer_id, customer_name, email, guitar_brand, job_number,
  status, service_completed_at, date_received, job_date, job_day_code, daily_sequence
)
values
  ('71000000-0000-4000-a000-000000000001', 'reminder-pgtap-pro', '61000000-0000-4000-a000-000000000001', 'Taylor Test', 'taylor@example.test', 'Fender', 'REM-PRO-1', 'Completed', now() - interval '7 months', current_date, current_date, 'REM-PRO', 1),
  ('72000000-0000-4000-a000-000000000001', 'reminder-pgtap-shop', '62000000-0000-4000-a000-000000000001', 'Casey Test', 'casey@example.test', 'Gibson', 'REM-SHOP-1', 'Completed', now() - interval '7 months', current_date, current_date, 'REM-SHOP', 1);

select ok((select service_completed_at is not null from public.jobs where id = '71000000-0000-4000-a000-000000000001'), 'completed jobs retain a durable service completion time');
select is((select count(*)::integer from public.service_reminder_queue), 0, 'a completed job is not queued until an eligible service exists');

insert into public.job_services (id, job_id, description, quantity, cost, retail)
values
  ('81000000-0000-4000-a000-000000000001', '71000000-0000-4000-a000-000000000001', 'Complete Setup', 1, 0, 95),
  ('82000000-0000-4000-a000-000000000001', '72000000-0000-4000-a000-000000000001', 'Complete Setup', 1, 0, 95);

select is((select count(*)::integer from public.service_reminder_queue), 1, 'only the eligible Pro job enters the reminder queue');
select is(
  (select due_at from public.service_reminder_queue where source_job_id = '71000000-0000-4000-a000-000000000001'),
  (select service_completed_at + interval '6 months' from public.jobs where id = '71000000-0000-4000-a000-000000000001'),
  'the due date is calculated from completion time and the configured month interval'
);

set local role service_role;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000000';
set local "request.jwt.claim.role" = 'service_role';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"service_role"}', true);

select is(
  (select count(*)::integer from public.claim_due_service_reminders('aaaaaaaa-0000-4000-a000-000000000001', 25)),
  1,
  'the nightly worker claims one due reminder'
);
select is((select subject_snapshot from public.service_reminder_queue where source_job_id = '71000000-0000-4000-a000-000000000001'), 'Time for Complete Setup, Taylor?', 'claiming snapshots the rendered subject');
select is((select body_snapshot from public.service_reminder_queue where source_job_id = '71000000-0000-4000-a000-000000000001'), 'Reminder Pro Shop recommends service after 6 months. https://example.test/book', 'claiming snapshots the rendered body');
select ok((select status = 'processing' and attempt_count = 1 from public.service_reminder_queue where source_job_id = '71000000-0000-4000-a000-000000000001'), 'a claim creates a visible processing lease');
select ok(public.validate_service_reminder_claim('91000000-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000001') is false, 'a claim token cannot validate a different queue ID');
select ok(public.validate_service_reminder_claim((select id from public.service_reminder_queue where source_job_id = '71000000-0000-4000-a000-000000000001'), 'aaaaaaaa-0000-4000-a000-000000000001'), 'the final pre-provider authorization check accepts a current claim');
select ok(public.finalize_service_reminder_delivery((select id from public.service_reminder_queue where source_job_id = '71000000-0000-4000-a000-000000000001'), 'aaaaaaaa-0000-4000-a000-000000000001', 'sent', 'resend-reminder-1', ''), 'the worker can atomically finalize its own claim');
select ok(not public.finalize_service_reminder_delivery((select id from public.service_reminder_queue where source_job_id = '71000000-0000-4000-a000-000000000001'), 'aaaaaaaa-0000-4000-a000-000000000001', 'failed', '', 'late failure'), 'a late retry cannot replace a finalized reminder');
select ok((select status = 'sent' and sent_at is not null and provider_message_id = 'resend-reminder-1' from public.service_reminder_queue where source_job_id = '71000000-0000-4000-a000-000000000001'), 'the finalized queue keeps authoritative sent state');

reset role;

insert into public.jobs (
  id, shop_id, customer_id, customer_name, email, guitar_brand, job_number,
  status, service_completed_at, date_received, job_date, job_day_code, daily_sequence
)
values
  ('71000000-0000-4000-a000-000000000002', 'reminder-pgtap-pro', '61000000-0000-4000-a000-000000000002', 'Jordan Test', 'jordan@example.test', 'Martin', 'REM-PRO-2', 'Completed', now() - interval '10 months', current_date, current_date, 'REM-PRO', 2),
  ('71000000-0000-4000-a000-000000000003', 'reminder-pgtap-pro', '61000000-0000-4000-a000-000000000002', 'Jordan Test', 'jordan@example.test', 'Martin', 'REM-PRO-3', 'Completed', now() - interval '5 months', current_date, current_date, 'REM-PRO', 3);

insert into public.job_services (id, job_id, description, quantity, cost, retail)
values ('81000000-0000-4000-a000-000000000002', '71000000-0000-4000-a000-000000000002', 'Annual Setup', 1, 0, 125);
insert into public.job_services (id, job_id, description, quantity, cost, retail)
values ('81000000-0000-4000-a000-000000000003', '71000000-0000-4000-a000-000000000003', 'Annual Setup', 1, 0, 125);

select is((select status from public.service_reminder_queue where source_job_id = '71000000-0000-4000-a000-000000000002'), 'canceled', 'a newer eligible service cancels the older pending reminder');
select is((select status from public.service_reminder_queue where source_job_id = '71000000-0000-4000-a000-000000000003'), 'pending', 'the newer eligible service owns the current reminder');

update public.customers set service_reminder_opt_in = false, service_reminder_consent_at = null where id = '61000000-0000-4000-a000-000000000002';
select is((select status from public.service_reminder_queue where source_job_id = '71000000-0000-4000-a000-000000000003'), 'canceled', 'withdrawing consent cancels an unsent reminder immediately');
select ok((select service_reminder_opt_in is false and service_reminder_consent_at is null from public.customers where id = '61000000-0000-4000-a000-000000000002'), 'withdrawn reminder consent remains explicit in the customer record');

select ok(
  not has_function_privilege('anon', 'public.claim_due_service_reminders(uuid, integer)', 'execute'),
  'an anonymous caller cannot impersonate the nightly worker'
);

select * from finish();
rollback;
