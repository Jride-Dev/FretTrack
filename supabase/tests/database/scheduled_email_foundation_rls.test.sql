begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

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
select is(
  (select count(*)::integer from public.customer_messages where id = 'e1000000-0000-4000-a000-000000000001' and scheduled_at is null and canceled_at is null),
  1,
  'historical message state remains unchanged'
);

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
