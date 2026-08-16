begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('41000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'scheduled-pro@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('42000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'scheduled-shop@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.shop_profiles (shop_id, shop_name, created_by, subscription_tier, subscription_status)
values
  ('scheduled-pgtap-pro', 'Scheduled Email Pro', '41000000-0000-4000-a000-000000000001', 'pro', 'active'),
  ('scheduled-pgtap-shop', 'Scheduled Email Shop', '42000000-0000-4000-a000-000000000001', 'shop', 'active');

update public.shop_subscriptions
set plan_id = case shop_id when 'scheduled-pgtap-pro' then 'pro' else 'shop' end,
    status = 'active',
    trial_ends_at = null,
    grace_ends_at = null
where shop_id in ('scheduled-pgtap-pro', 'scheduled-pgtap-shop');

insert into public.shop_members (shop_id, user_id, role, display_name)
values
  ('scheduled-pgtap-pro', '41000000-0000-4000-a000-000000000001', 'owner', 'Scheduled Pro Owner'),
  ('scheduled-pgtap-shop', '42000000-0000-4000-a000-000000000001', 'owner', 'Scheduled Shop Owner');

insert into public.jobs (id, shop_id, customer_name, email, email_opt_in, guitar_brand, job_number, date_received, job_date, job_day_code, daily_sequence)
values
  ('d1000000-0000-4000-a000-000000000001', 'scheduled-pgtap-pro', 'Pro Customer', 'pro@example.test', true, 'Fender', 'SCHED-PRO', current_date, current_date, 'SCHED-PRO', 1),
  ('d2000000-0000-4000-a000-000000000001', 'scheduled-pgtap-shop', 'Shop Customer', 'shop@example.test', true, 'Gibson', 'SCHED-SHOP', current_date, current_date, 'SCHED-SHOP', 1);

insert into public.customer_messages (id, job_id, channel, recipient, subject, body, status, provider, provider_message_id, sent_at)
values
  ('e1000000-0000-4000-a000-000000000001', 'd1000000-0000-4000-a000-000000000001', 'email', 'pro@example.test', 'Historical', 'Historical sent email', 'sent', 'resend', 'email-historical', now()),
  ('e2000000-0000-4000-a000-000000000001', 'd2000000-0000-4000-a000-000000000001', 'email', 'shop@example.test', 'Other shop', 'Other shop email', 'sent', 'resend', 'email-other-shop', now());

insert into public.customer_messages (id, job_id, channel, recipient, subject, body, status, provider, provider_message_id, scheduled_at)
values
  ('e1000000-0000-4000-a000-000000000002', 'd1000000-0000-4000-a000-000000000001', 'email', 'pro@example.test', 'Scheduled', 'Scheduled snapshot', 'scheduled', 'resend', 'email-scheduled', now() + interval '1 day');

select ok(private.shop_has_entitlement('scheduled-pgtap-pro', 'scheduled_email'), 'Pro has scheduled_email entitlement');
select ok(not private.shop_has_entitlement('scheduled-pgtap-shop', 'scheduled_email'), 'Shop does not have scheduled_email entitlement');
select has_column('public', 'customer_messages', 'scheduled_at', 'customer_messages stores scheduled delivery time');
select has_column('public', 'customer_messages', 'canceled_at', 'customer_messages stores cancellation time');
select has_column('public', 'customer_messages', 'request_id', 'customer_messages stores the stable provider request ID');
select has_column('public', 'customer_messages', 'operation_key', 'customer_messages stores the scheduled operation fingerprint');
select has_column('public', 'customer_messages', 'cancel_requested_at', 'customer_messages stores durable cancellation intent');
select is(
  (select count(*)::integer from public.customer_messages where id = 'e1000000-0000-4000-a000-000000000001' and scheduled_at is null and canceled_at is null),
  1,
  'historical message state remains unchanged'
);

insert into public.customer_messages (
  id, job_id, channel, recipient, subject, body, status, provider,
  request_id, quota_request_id, operation_key, processing_started_at, scheduled_at
)
values (
  'e1000000-0000-4000-a000-000000000003',
  'd1000000-0000-4000-a000-000000000001',
  'email', 'pro@example.test', 'Pending', 'Pending snapshot', 'pending', 'resend',
  'e1000000-0000-4000-a000-000000000003',
  'e1000000-0000-4000-a000-000000000003',
  'scheduled-operation-one', now(), now() + interval '2 days'
);
select throws_like(
  $$
    insert into public.customer_messages (job_id, channel, recipient, subject, body, status, provider, request_id, scheduled_at)
    values ('d1000000-0000-4000-a000-000000000001', 'email', 'pro@example.test', 'Duplicate request', 'Duplicate request', 'pending', 'resend', 'e1000000-0000-4000-a000-000000000003', now() + interval '2 days')
  $$,
  '%duplicate key value%',
  'stable email request IDs cannot create duplicate history rows'
);
select throws_like(
  $$
    insert into public.customer_messages (job_id, channel, recipient, subject, body, status, provider, request_id, operation_key, scheduled_at)
    values ('d1000000-0000-4000-a000-000000000001', 'email', 'pro@example.test', 'Duplicate schedule', 'Duplicate schedule', 'pending', 'resend', 'e1000000-0000-4000-a000-000000000004', 'scheduled-operation-one', now() + interval '2 days')
  $$,
  '%duplicate key value%',
  'concurrent identical scheduled operations cannot create duplicate history rows'
);
select lives_ok(
  $$
    update public.customer_messages
    set status = 'scheduled', provider_message_id = 'provider-state-test', processing_started_at = null
    where id = 'e1000000-0000-4000-a000-000000000003'
  $$,
  'a durable pending operation can become provider-scheduled'
);
select lives_ok(
  $$
    update public.customer_messages
    set status = 'canceling', cancel_requested_at = now()
    where id = 'e1000000-0000-4000-a000-000000000003'
  $$,
  'a scheduled operation can record cancellation intent before the provider call'
);
select lives_ok(
  $$
    update public.customer_messages
    set status = 'canceled', canceled_at = now(), provider_last_event = 'canceled', provider_event_at = now()
    where id = 'e1000000-0000-4000-a000-000000000003'
  $$,
  'a provider-accepted cancellation can finalize the same history row'
);

select has_function(
  'public',
  'reconcile_customer_email_provider_state',
  array['uuid', 'text', 'text', 'timestamp with time zone', 'timestamp with time zone', 'timestamp with time zone', 'text'],
  'provider reconciliation uses an atomic database transition'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.reconcile_customer_email_provider_state(uuid, text, text, timestamptz, timestamptz, timestamptz, text)',
    'execute'
  ),
  'anonymous callers cannot reconcile provider email state'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.reconcile_customer_email_provider_state(uuid, text, text, timestamptz, timestamptz, timestamptz, text)',
    'execute'
  ),
  'authenticated callers cannot reconcile provider email state'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reconcile_customer_email_provider_state(uuid, text, text, timestamptz, timestamptz, timestamptz, text)',
    'execute'
  ),
  'the email Edge Function service role can reconcile provider state'
);

select is(
  (select status from public.reconcile_customer_email_provider_state(
    'e1000000-0000-4000-a000-000000000003',
    'sent',
    'delivered',
    '2026-08-16T03:00:00Z',
    '2026-08-16T03:00:00Z',
    null,
    ''
  )),
  'sent',
  'a delivered provider event replaces an earlier recorded cancellation'
);
select is(
  (select status from public.reconcile_customer_email_provider_state(
    'e1000000-0000-4000-a000-000000000003',
    'canceled',
    'cancel_accepted',
    '2026-08-16T03:01:00Z',
    null,
    '2026-08-16T03:01:00Z',
    ''
  )),
  'sent',
  'a losing cancellation request receives the authoritative sent row'
);
select is(
  (select status from public.customer_messages where id = 'e1000000-0000-4000-a000-000000000003'),
  'sent',
  'a late cancellation cannot replace an already-recorded delivery'
);
select is(
  (select provider_last_event from public.customer_messages where id = 'e1000000-0000-4000-a000-000000000003'),
  'delivered',
  'a rejected late cancellation cannot replace the delivered provider event'
);
select ok(
  (select sent_at is not null and canceled_at is null from public.customer_messages where id = 'e1000000-0000-4000-a000-000000000003'),
  'sent and canceled timestamps remain consistent after a late cancellation'
);

insert into public.customer_messages (
  id, job_id, channel, recipient, subject, body, status, provider,
  provider_message_id, scheduled_at, cancel_requested_at, provider_last_event, provider_event_at
)
values (
  'e1000000-0000-4000-a000-000000000004',
  'd1000000-0000-4000-a000-000000000001',
  'email', 'pro@example.test', 'Ordering', 'Ordering snapshot', 'canceling', 'resend',
  'provider-ordering-test', now() + interval '2 days', now(), 'scheduled', '2026-08-16T03:02:00Z'
);
do $test$
begin
  perform * from public.reconcile_customer_email_provider_state(
    'e1000000-0000-4000-a000-000000000004',
    'failed',
    'failed',
    '2026-08-16T03:01:00Z',
    null,
    null,
    'Older provider failure'
  );
end;
$test$;
select is(
  (select status from public.customer_messages where id = 'e1000000-0000-4000-a000-000000000004'),
  'canceling',
  'an older provider observation cannot replace newer message state'
);
select is(
  (select provider_last_event from public.customer_messages where id = 'e1000000-0000-4000-a000-000000000004'),
  'scheduled',
  'an older provider observation cannot replace newer provider metadata'
);
delete from public.customer_messages where id = 'e1000000-0000-4000-a000-000000000004';
delete from public.customer_messages where id = 'e1000000-0000-4000-a000-000000000003';

set local role authenticated;
set local "request.jwt.claim.sub" = '41000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.customer_messages), 2, 'Pro owner reads only their own shop messages');
select is((select count(*)::integer from public.customer_messages where status = 'scheduled'), 1, 'Pro owner can read scheduled message history');
select throws_like(
  $$
    insert into public.customer_messages (job_id, channel, recipient, subject, body, status, provider, provider_message_id, scheduled_at)
    values ('d1000000-0000-4000-a000-000000000001', 'email', 'pro@example.test', 'Forged', 'Forged schedule', 'scheduled', 'resend', 'forged', now() + interval '1 day')
  $$,
  '%row-level security policy%',
  'authenticated clients cannot forge provider scheduling state'
);
select throws_like(
  $$
    insert into public.customer_messages (job_id, channel, recipient, subject, body, status, provider, request_id, processing_started_at, scheduled_at)
    values ('d1000000-0000-4000-a000-000000000001', 'email', 'pro@example.test', 'Forged pending', 'Forged pending', 'pending', 'resend', 'e1000000-0000-4000-a000-000000000005', now(), now() + interval '1 day')
  $$,
  '%row-level security policy%',
  'authenticated clients cannot forge pending provider operations'
);
select throws_like(
  $$
    insert into public.customer_messages (job_id, channel, recipient, subject, body, status, provider, provider_message_id, scheduled_at, cancel_requested_at)
    values ('d1000000-0000-4000-a000-000000000001', 'email', 'pro@example.test', 'Forged cancel', 'Forged cancel', 'canceling', 'resend', 'forged-cancel', now() + interval '1 day', now())
  $$,
  '%row-level security policy%',
  'authenticated clients cannot forge cancellation state'
);
select isnt_empty(
  $$
    insert into public.customer_messages (job_id, channel, recipient, subject, body, status, provider, provider_message_id, sent_at)
    values ('d1000000-0000-4000-a000-000000000001', 'email', 'pro@example.test', 'Ordinary', 'Ordinary sent record', 'sent', 'resend', 'ordinary', now())
    returning 1
  $$,
  'existing sent-message write policy remains available'
);
select is_empty(
  $$update public.customer_messages set subject = 'Forged edit' where id = 'e1000000-0000-4000-a000-000000000002' returning 1$$,
  'authenticated clients cannot alter provider scheduled state'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '42000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select is((select count(*)::integer from public.customer_messages), 1, 'Shop owner cannot read another shop scheduled messages');

reset role;
select * from finish();
rollback;
