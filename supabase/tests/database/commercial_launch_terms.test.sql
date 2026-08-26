begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_function(
  'public',
  'bootstrap_current_user_as_owner',
  array['text', 'text'],
  'shop bootstrap RPC exists'
);

select function_privs_are(
  'public',
  'bootstrap_current_user_as_owner',
  array['text', 'text'],
  'authenticated',
  array['EXECUTE'],
  'authenticated users can call the guarded bootstrap RPC'
);

select function_privs_are(
  'public',
  'bootstrap_current_user_as_owner',
  array['text', 'text'],
  'anon',
  array[]::text[],
  'anonymous users cannot call the bootstrap RPC'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '76000000-0000-4000-a000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'commercial-launch-owner@frettrack.local',
  crypt('FretTrackTest123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.beta_access_requests (user_id, email, status, reviewed_at)
values (
  '76000000-0000-4000-a000-000000000001',
  'commercial-launch-owner@frettrack.local',
  'approved',
  now()
);

set local role authenticated;
set local "request.jwt.claim.sub" = '76000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select lives_ok(
  $$select public.bootstrap_current_user_as_owner('commercial-launch-pgtap', 'Commercial Launch pgTAP')$$,
  'an approved confirmed user can create the standard trial workspace'
);

select is(
  (select plan_id from public.shop_subscriptions where shop_id = 'commercial-launch-pgtap'),
  'pro',
  'the standard new-shop trial uses Pro entitlements'
);

select is(
  (select status from public.shop_subscriptions where shop_id = 'commercial-launch-pgtap'),
  'trialing',
  'the standard new-shop subscription is trialing'
);

select ok(
  (select trial_ends_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour'
   from public.shop_subscriptions where shop_id = 'commercial-launch-pgtap'),
  'the standard Pro trial lasts 14 days'
);

select ok(
  (select stripe_customer_id is null and stripe_subscription_id is null
   from public.shop_subscriptions where shop_id = 'commercial-launch-pgtap'),
  'the application trial does not create or auto-convert to a Stripe subscription'
);

reset role;

select * from finish();

rollback;
