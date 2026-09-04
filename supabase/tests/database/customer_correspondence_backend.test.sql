begin;

create extension if not exists pgtap with schema extensions;

select plan(47);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('71000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'correspondence-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('72000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'correspondence-other@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status)
values
  ('correspondence-pgtap-one', 'Correspondence Shop One', '71000000-0000-4000-a000-000000000001', 'pro', 'active'),
  ('correspondence-pgtap-two', 'Correspondence Shop Two', '72000000-0000-4000-a000-000000000001', 'pro', 'active');

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id in ('correspondence-pgtap-one', 'correspondence-pgtap-two');

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('correspondence-pgtap-one', '71000000-0000-4000-a000-000000000001', 'owner', 'Correspondence Owner'),
  ('correspondence-pgtap-two', '72000000-0000-4000-a000-000000000001', 'owner', 'Other Owner');

insert into public.customers (id, shop_id, display_name, first_name, last_name, email, email_normalized)
values
  ('73000000-0000-4000-a000-000000000001', 'correspondence-pgtap-one', 'Correspondence Customer', 'Correspondence', 'Customer', 'customer-one@example.test', 'customer-one@example.test'),
  ('74000000-0000-4000-a000-000000000001', 'correspondence-pgtap-two', 'Other Customer', 'Other', 'Customer', 'customer-two@example.test', 'customer-two@example.test');

insert into public.jobs (
  id, shop_id, customer_id, customer_name, email, email_opt_in,
  guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence
)
values
  ('75000000-0000-4000-a000-000000000001', 'correspondence-pgtap-one', '73000000-0000-4000-a000-000000000001', 'Correspondence Customer', 'customer-one@example.test', true, 'Fender', 'CORR-ONE', current_date, current_date, 'CORR-ONE', 1),
  ('76000000-0000-4000-a000-000000000001', 'correspondence-pgtap-two', '74000000-0000-4000-a000-000000000001', 'Other Customer', 'customer-two@example.test', true, 'Gibson', 'CORR-TWO', current_date, current_date, 'CORR-TWO', 1);

insert into public.customer_messages (
  id, job_id, channel, recipient, subject, body, status, provider,
  provider_message_id, request_id, sent_at
)
values (
  '77000000-0000-4000-a000-000000000001',
  '75000000-0000-4000-a000-000000000001',
  'email', 'customer-one@example.test', 'Repair update', 'Your repair is ready.', 'sent', 'resend',
  'correspondence-provider-outbound', '77000000-0000-4000-a000-000000000011', now()
);

insert into public.customer_messages (
  id, job_id, channel, recipient, subject, body, status, provider, provider_message_id, sent_at
)
values (
  '77000000-0000-4000-a000-000000000002',
  '75000000-0000-4000-a000-000000000001',
  'email', 'customer-one@example.test', 'Failed update', 'This was not delivered.', 'failed', 'resend', 'correspondence-provider-failed', null
);

insert into public.customer_messages (
  id, shop_id, thread_id, job_id, customer_id, channel, direction,
  sender_address, recipient, subject, body, status, provider, provider_message_id, received_at
)
select
  '77000000-0000-4000-a000-000000000003',
  customer_conversation_threads.shop_id,
  customer_conversation_threads.id,
  null,
  customer_conversation_threads.customer_id,
  'email',
  'inbound',
  'customer-one@example.test',
  'shop@example.test',
  'Re: Repair update',
  'Please go ahead.',
  'received',
  'resend',
  'correspondence-provider-inbound',
  now()
from public.customer_conversation_threads
where shop_id = 'correspondence-pgtap-one'
  and customer_id = '73000000-0000-4000-a000-000000000001'
  and channel = 'email';

select has_table('public', 'customer_conversation_threads', 'correspondence threads are durable');
select has_column('public', 'customer_messages', 'shop_id', 'messages carry direct shop scope');
select has_column('public', 'customer_messages', 'thread_id', 'messages can belong to a conversation thread');
select has_column('public', 'customer_messages', 'direction', 'messages record inbound or outbound direction');
select has_column('public', 'customer_messages', 'sender_address', 'messages snapshot the sender address');
select has_column('public', 'customer_messages', 'received_at', 'messages record inbound receipt time');
select has_column('public', 'customer_messages', 'read_at', 'messages record staff read time');
select has_column('public', 'customer_messages', 'include_in_customer_report', 'messages record explicit report selection');
select ok(not has_table_privilege('anon', 'public.customer_conversation_threads', 'select'), 'anonymous callers cannot read conversation threads');
select ok(has_table_privilege('authenticated', 'public.customer_conversation_threads', 'select'), 'authenticated callers receive the thread read grant');
select ok(not has_table_privilege('authenticated', 'public.customer_conversation_threads', 'delete'), 'authenticated callers cannot delete conversation history');
select ok(has_table_privilege('service_role', 'public.customer_conversation_threads', 'delete'), 'service role retains maintenance access to conversation threads');
select has_function('public', 'set_customer_message_report_inclusion', array['uuid', 'boolean'], 'report selection uses a narrow RPC');
select has_function('public', 'mark_customer_message_read', array['uuid', 'timestamp with time zone'], 'read state uses a narrow RPC');
select has_function('public', 'assign_customer_message_job', array['uuid', 'uuid'], 'routing uses a narrow RPC');
select ok(not has_function_privilege('anon', 'public.set_customer_message_report_inclusion(uuid, boolean)', 'execute'), 'anonymous callers cannot select report correspondence');
select ok(not has_function_privilege('anon', 'public.mark_customer_message_read(uuid, timestamptz)', 'execute'), 'anonymous callers cannot mark correspondence read');
select ok(not has_function_privilege('anon', 'public.assign_customer_message_job(uuid, uuid)', 'execute'), 'anonymous callers cannot route correspondence');
select ok(has_function_privilege('authenticated', 'public.set_customer_message_report_inclusion(uuid, boolean)', 'execute'), 'authenticated callers can use the guarded report-selection RPC');
select ok(has_function_privilege('authenticated', 'public.mark_customer_message_read(uuid, timestamptz)', 'execute'), 'authenticated callers can use the guarded read-state RPC');
select ok(has_function_privilege('authenticated', 'public.assign_customer_message_job(uuid, uuid)', 'execute'), 'authenticated callers can use the guarded routing RPC');
select is((select count(*)::integer from public.customer_conversation_threads where shop_id = 'correspondence-pgtap-one'), 1, 'existing outbound messages share one shop/customer/channel thread');
select is((select shop_id from public.customer_messages where id = '77000000-0000-4000-a000-000000000001'), 'correspondence-pgtap-one', 'job-linked outbound messages derive direct shop scope');
select ok((select thread_id is not null from public.customer_messages where id = '77000000-0000-4000-a000-000000000001'), 'job-linked outbound messages attach to the customer thread');
select is((select count(*)::integer from public.customer_messages where id = '77000000-0000-4000-a000-000000000003' and job_id is null), 1, 'ambiguous inbound correspondence can remain unassigned');

set local role authenticated;
set local "request.jwt.claim.sub" = '71000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.customer_conversation_threads), 1, 'a shop owner sees only their conversation threads');
select is((select count(*)::integer from public.customer_messages), 3, 'a shop owner sees job-linked and unassigned correspondence for their shop');
select isnt_empty(
  $$
    insert into public.customer_messages (job_id, channel, recipient, subject, body, status, provider, provider_message_id, sent_at)
    values ('75000000-0000-4000-a000-000000000001', 'email', 'customer-one@example.test', 'Ordinary send', 'Ordinary outbound history.', 'sent', 'resend', 'correspondence-ordinary-send', now())
    returning 1
  $$,
  'existing authenticated outbound history writes remain available'
);
select is((select count(*)::integer from public.customer_messages where shop_id = 'correspondence-pgtap-one' and thread_id is not null), 4, 'new outbound history is scoped and threaded automatically');
select throws_like(
  $$
    insert into public.customer_messages (shop_id, customer_id, channel, direction, sender_address, recipient, body, status, received_at)
    values ('correspondence-pgtap-one', '73000000-0000-4000-a000-000000000001', 'sms', 'inbound', '+13105550100', '+13105550200', 'Forged inbound', 'received', now())
  $$,
  '%row-level security policy%',
  'authenticated browser clients cannot forge inbound provider messages'
);
select is_empty(
  $$
    update public.customer_messages
    set include_in_customer_report = true
    where id = '77000000-0000-4000-a000-000000000001'
    returning 1
  $$,
  'provider-owned messages cannot be edited directly by the browser'
);
select is(
  (select include_in_customer_report from public.set_customer_message_report_inclusion('77000000-0000-4000-a000-000000000001', true)),
  true,
  'the guarded RPC can select completed outbound correspondence for a report'
);
select is((select include_in_customer_report from public.customer_messages where id = '77000000-0000-4000-a000-000000000001'), true, 'report selection persists on the existing history row');
select throws_like(
  $$select public.set_customer_message_report_inclusion('77000000-0000-4000-a000-000000000002', true)$$,
  '%Only completed customer-facing correspondence%',
  'failed correspondence cannot be included in a customer report'
);
select ok(
  (select read_at is not null from public.mark_customer_message_read('77000000-0000-4000-a000-000000000003', now())),
  'the guarded RPC marks received inbound correspondence read'
);
select ok((select read_at is not null from public.customer_messages where id = '77000000-0000-4000-a000-000000000003'), 'inbound read state persists');
select throws_like(
  $$select public.assign_customer_message_job('77000000-0000-4000-a000-000000000003', '76000000-0000-4000-a000-000000000001')$$,
  '%same shop and customer%',
  'routing rejects a work order from another shop'
);
select is((select job_id from public.assign_customer_message_job('77000000-0000-4000-a000-000000000003', '75000000-0000-4000-a000-000000000001')), '75000000-0000-4000-a000-000000000001', 'staff can deliberately route an inbound message to a matching work order');
select is((select job_id from public.customer_messages where id = '77000000-0000-4000-a000-000000000003'), '75000000-0000-4000-a000-000000000001', 'routed correspondence persists its work-order assignment');
select throws_like(
  $$select public.assign_customer_message_job('77000000-0000-4000-a000-000000000003', '76000000-0000-4000-a000-000000000002')$$,
  '%Only unassigned received inbound correspondence can be routed%',
  'a routed message cannot be assigned a second time'
);
select throws_like(
  $$
    update public.customer_conversation_threads
    set customer_id = '74000000-0000-4000-a000-000000000001'
    where shop_id = 'correspondence-pgtap-one'
  $$,
  '%ownership and channel cannot be changed%',
  'conversation ownership cannot be reassigned after creation'
);
select throws_like(
  $$
    insert into public.customer_conversation_threads (shop_id, customer_id, channel)
    values ('correspondence-pgtap-one', '74000000-0000-4000-a000-000000000001', 'sms')
  $$,
  '%row-level security policy%',
  'a shop cannot create a thread for another shop customer'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '72000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.customer_conversation_threads), 0, 'another shop cannot read the first shop threads');
select is((select count(*)::integer from public.customer_messages), 0, 'another shop cannot read the first shop messages');
select throws_like(
  $$select public.set_customer_message_report_inclusion('77000000-0000-4000-a000-000000000001', false)$$,
  '%Not allowed to change customer report correspondence%',
  'another shop cannot change report selection'
);

reset role;
set local role anon;
select throws_like($$select * from public.customer_conversation_threads$$, '%permission denied%', 'anonymous callers cannot query conversation threads');
select throws_like($$select * from public.customer_messages$$, '%permission denied%', 'anonymous callers cannot query customer messages');

reset role;
select * from finish();
rollback;
