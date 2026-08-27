begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

select has_function(
  'public',
  'claim_stripe_webhook_event',
  array['text', 'text', 'timestamp with time zone', 'boolean', 'uuid'],
  'Stripe webhook event claim function exists'
);

select has_function(
  'public',
  'finalize_stripe_webhook_event',
  array['text', 'uuid', 'text', 'text', 'text', 'text', 'text'],
  'Stripe webhook event finalization function exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_stripe_webhook_event(text, text, timestamp with time zone, boolean, uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot claim Stripe webhook events'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.finalize_stripe_webhook_event(text, uuid, text, text, text, text, text)',
    'EXECUTE'
  ),
  'authenticated users cannot finalize Stripe webhook events'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_stripe_webhook_event(text, text, timestamp with time zone, boolean, uuid)',
    'EXECUTE'
  ),
  'the Stripe webhook service role can claim events'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.finalize_stripe_webhook_event(text, uuid, text, text, text, text, text)',
    'EXECUTE'
  ),
  'the Stripe webhook service role can finalize events'
);

set local role service_role;
set local "request.jwt.claim.role" = 'service_role';

select ok(
  public.claim_stripe_webhook_event(
    'evt_atomic_claim',
    'customer.subscription.updated',
    '2026-08-27 12:00:00+00'::timestamptz,
    false,
    '11111111-1111-4111-8111-111111111111'::uuid
  ),
  'the first delivery atomically claims the event'
);

select is(
  (
    select status
    from public.stripe_webhook_events
    where stripe_event_id = 'evt_atomic_claim'
  ),
  'processing'::text,
  'a claimed event is marked processing before its handler runs'
);

select is(
  (
    select attempt_count
    from public.stripe_webhook_events
    where stripe_event_id = 'evt_atomic_claim'
  ),
  1,
  'the first claim records one processing attempt'
);

select ok(
  not public.claim_stripe_webhook_event(
    'evt_atomic_claim',
    'customer.subscription.updated',
    '2026-08-27 12:00:00+00'::timestamptz,
    false,
    '22222222-2222-4222-8222-222222222222'::uuid
  ),
  'a concurrent duplicate cannot claim an event already being processed'
);

select ok(
  not public.finalize_stripe_webhook_event(
    'evt_atomic_claim',
    '22222222-2222-4222-8222-222222222222'::uuid,
    'processed',
    '',
    '',
    '',
    ''
  ),
  'a losing delivery cannot finalize the winning delivery claim'
);

select ok(
  public.finalize_stripe_webhook_event(
    'evt_atomic_claim',
    '11111111-1111-4111-8111-111111111111'::uuid,
    'processed',
    '',
    'cus_atomic',
    'sub_atomic',
    ''
  ),
  'the claim winner can finalize the event'
);

select is(
  (
    select status
    from public.stripe_webhook_events
    where stripe_event_id = 'evt_atomic_claim'
  ),
  'processed'::text,
  'the finalized event records its terminal status'
);

select ok(
  (
    select processed_at is not null
      and processing_token is null
      and processing_started_at is null
    from public.stripe_webhook_events
    where stripe_event_id = 'evt_atomic_claim'
  ),
  'finalization clears the lease and records completion time'
);

select ok(
  not public.claim_stripe_webhook_event(
    'evt_atomic_claim',
    'customer.subscription.updated',
    '2026-08-27 12:00:00+00'::timestamptz,
    false,
    '33333333-3333-4333-8333-333333333333'::uuid
  ),
  'a processed event remains a duplicate on replay'
);

select ok(
  public.claim_stripe_webhook_event(
    'evt_failed_retry',
    'invoice.payment_failed',
    '2026-08-27 12:05:00+00'::timestamptz,
    false,
    '44444444-4444-4444-8444-444444444444'::uuid
  ),
  'a new event can be claimed for a failure-path test'
);

select ok(
  public.finalize_stripe_webhook_event(
    'evt_failed_retry',
    '44444444-4444-4444-8444-444444444444'::uuid,
    'failed',
    '',
    '',
    '',
    'temporary failure'
  ),
  'a processing failure is recorded against its claim'
);

select ok(
  public.claim_stripe_webhook_event(
    'evt_failed_retry',
    'invoice.payment_failed',
    '2026-08-27 12:05:00+00'::timestamptz,
    false,
    '55555555-5555-4555-8555-555555555555'::uuid
  ),
  'a failed event remains retryable'
);

select is(
  (
    select attempt_count
    from public.stripe_webhook_events
    where stripe_event_id = 'evt_failed_retry'
  ),
  2,
  'retrying a failed event increments its attempt count'
);

select ok(
  not public.finalize_stripe_webhook_event(
    'evt_failed_retry',
    '44444444-4444-4444-8444-444444444444'::uuid,
    'processed',
    '',
    '',
    '',
    ''
  ),
  'a stale attempt cannot finalize a newer retry claim'
);

select ok(
  public.finalize_stripe_webhook_event(
    'evt_failed_retry',
    '55555555-5555-4555-8555-555555555555'::uuid,
    'ignored',
    '',
    '',
    '',
    'event no longer changes subscription state'
  ),
  'the current retry claim can finalize normally'
);

select is(
  (
    select status
    from public.stripe_webhook_events
    where stripe_event_id = 'evt_failed_retry'
  ),
  'ignored'::text,
  'the retry stores its terminal result'
);

reset role;
select * from finish();
rollback;
