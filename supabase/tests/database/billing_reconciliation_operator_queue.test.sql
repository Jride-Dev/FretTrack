begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_function(
  'public',
  'get_billing_reconciliation_queue',
  array[]::text[],
  'billing reconciliation queue RPC exists'
);

select ok(
  has_function_privilege('authenticated', 'public.get_billing_reconciliation_queue()', 'execute'),
  'authenticated users may call the operator-gated queue RPC'
);

select ok(
  not has_function_privilege('anon', 'public.get_billing_reconciliation_queue()', 'execute'),
  'anonymous users cannot call the queue RPC'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('61000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'billing-operator@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'billing-member@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.operator_users (user_id, email, role)
values ('61000000-0000-4000-a000-000000000001', 'billing-operator@frettrack.local', 'operator');

insert into public.shop_profiles (shop_id, shop_name, email, created_by, subscription_tier, subscription_status)
values
  ('billing-reconcile-missing-customer', 'Missing Customer Billing Shop', 'missing@example.test', '61000000-0000-4000-a000-000000000002', 'pro', 'active'),
  ('billing-reconcile-healthy', 'Healthy Billing Shop', 'healthy@example.test', '61000000-0000-4000-a000-000000000002', 'pro', 'active');

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', provider_status = 'active',
    stripe_subscription_id = 'sub_missing_customer', stripe_price_id = 'price_pro',
    current_period_ends_at = now() + interval '30 days'
where shop_id = 'billing-reconcile-missing-customer';

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', provider_status = 'active',
    stripe_customer_id = 'cus_healthy', stripe_subscription_id = 'sub_healthy', stripe_price_id = 'price_pro',
    current_period_ends_at = now() + interval '30 days'
where shop_id = 'billing-reconcile-healthy';

set local role authenticated;
set local "request.jwt.claim.sub" = '61000000-0000-4000-a000-000000000002';
set local "request.jwt.claim.role" = 'authenticated';

select throws_like(
  $$select public.get_billing_reconciliation_queue()$$,
  '%Not allowed to view billing reconciliation%',
  'non-operators cannot view billing reconciliation data'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '61000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select lives_ok(
  $$select public.get_billing_reconciliation_queue()$$,
  'an operator can view the read-only reconciliation queue'
);

select ok(
  public.get_billing_reconciliation_queue() @> '[{"shop_id":"billing-reconcile-missing-customer","issue_code":"missing_customer_id"}]'::jsonb,
  'the queue identifies an active subscription missing its Stripe customer'
);

select ok(
  public.get_billing_reconciliation_queue() @> '[{"shop_id":"billing-reconcile-healthy","issue_code":"ok","stripe_customer_id":"cus_healthy","stripe_subscription_id":"sub_healthy"}]'::jsonb,
  'the queue preserves healthy provider identifiers for support review'
);

select ok(
  not (public.get_billing_reconciliation_queue() @> '[{"shop_id":"billing-reconcile-missing-customer","issue_code":"ok"}]'::jsonb),
  'an actionable billing mismatch is not reported as healthy'
);

select * from finish();
rollback;
