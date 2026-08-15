begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into public.shop_profiles (shop_id, shop_name)
values ('pgtap-stripe-event-ordering', 'pgTAP Stripe Event Ordering');

select has_function(
  'public',
  'begin_stripe_subscription_sync',
  array['text', 'text', 'timestamp with time zone'],
  'Stripe synchronization generation function exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.begin_stripe_subscription_sync(text, text, timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated users cannot begin Stripe synchronization'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.begin_stripe_subscription_sync(text, text, timestamp with time zone)',
    'EXECUTE'
  ),
  'the Stripe webhook service role can begin synchronization'
);

set local role service_role;
set local "request.jwt.claim.role" = 'service_role';

select is(
  public.begin_stripe_subscription_sync(
    'pgtap-stripe-event-ordering',
    'evt_initial',
    '2026-08-14 12:00:00+00'::timestamptz
  ),
  1::bigint,
  'the first Stripe event starts generation one'
);

select is(
  public.begin_stripe_subscription_sync(
    'pgtap-stripe-event-ordering',
    'evt_newer',
    '2026-08-14 13:00:00+00'::timestamptz
  ),
  2::bigint,
  'a newer Stripe event advances the generation'
);

select is(
  public.begin_stripe_subscription_sync(
    'pgtap-stripe-event-ordering',
    'evt_older',
    '2026-08-14 11:00:00+00'::timestamptz
  ),
  0::bigint,
  'an older Stripe event is rejected without a new generation'
);

select is(
  (
    select generation
    from public.stripe_subscription_sync_cursors
    where shop_id = 'pgtap-stripe-event-ordering'
  ),
  2::bigint,
  'a rejected older event does not advance the stored generation'
);

select is(
  (
    select last_started_event_id
    from public.stripe_subscription_sync_cursors
    where shop_id = 'pgtap-stripe-event-ordering'
  ),
  'evt_newer'::text,
  'a rejected older event does not replace the newer event cursor'
);

select is(
  public.begin_stripe_subscription_sync(
    'pgtap-stripe-event-ordering',
    'evt_missing_timestamp',
    null
  ),
  0::bigint,
  'an event without ordering metadata cannot overwrite a timestamped cursor'
);

reset role;
select * from finish();
rollback;
