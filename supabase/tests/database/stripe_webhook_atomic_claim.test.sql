begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

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

select has_function(
  'public',
  'get_stripe_webhook_event_claim_state',
  array['text'],
  'Stripe webhook claim-state function exists'
);

select has_function(
  'public',
  'release_stripe_webhook_event_claim',
  array['text', 'uuid', 'text'],
  'Stripe webhook emergency claim-release function exists'
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
  not has_function_privilege(
    'authenticated',
    'public.get_stripe_webhook_event_claim_state(text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.release_stripe_webhook_event_claim(text, uuid, text)',
    'EXECUTE'
  ),
  'authenticated users cannot inspect or release Stripe webhook claims'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.get_stripe_webhook_event_claim_state(text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.release_stripe_webhook_event_claim(text, uuid, text)',
    'EXECUTE'
  ),
  'the Stripe webhook service role can inspect and release event claims'
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

select ok(
  public.claim_stripe_webhook_event(
    'evt_expired_processing',
    'invoice.payment_succeeded',
    '2026-08-27 12:10:00+00'::timestamptz,
    false,
    '66666666-6666-4666-8666-666666666666'::uuid
  ),
  'an event can be claimed for expired-lease recovery'
);

update public.stripe_webhook_events
set processing_started_at = pg_catalog.now() - interval '6 minutes'
where stripe_event_id = 'evt_expired_processing';

select ok(
  public.claim_stripe_webhook_event(
    'evt_expired_processing',
    'invoice.payment_succeeded',
    '2026-08-27 12:10:00+00'::timestamptz,
    false,
    '77777777-7777-4777-8777-777777777777'::uuid
  ),
  'an abandoned processing lease can be reclaimed after the timeout'
);

select ok(
  (
    select status = 'processing'
      and processing_token = '77777777-7777-4777-8777-777777777777'::uuid
      and attempt_count = 2
    from public.stripe_webhook_events
    where stripe_event_id = 'evt_expired_processing'
  ),
  'lease recovery installs a new token and increments the attempt count'
);

select ok(
  not public.release_stripe_webhook_event_claim(
    'evt_expired_processing',
    '66666666-6666-4666-8666-666666666666'::uuid,
    'stale attempt'
  ),
  'a stale attempt cannot release a newer claim'
);

select is(
  public.get_stripe_webhook_event_claim_state('evt_expired_processing'),
  'processing'::text,
  'claim-state lookup reports a current in-flight lease'
);

select ok(
  public.release_stripe_webhook_event_claim(
    'evt_expired_processing',
    '77777777-7777-4777-8777-777777777777'::uuid,
    'terminal finalization unavailable'
  ),
  'the current claim owner can release an unrecoverable finalization failure'
);

select is(
  public.get_stripe_webhook_event_claim_state('evt_expired_processing'),
  'failed'::text,
  'emergency release leaves the event explicitly retryable'
);

select ok(
  public.claim_stripe_webhook_event(
    'evt_expired_processing',
    'invoice.payment_succeeded',
    '2026-08-27 12:10:00+00'::timestamptz,
    false,
    '88888888-8888-4888-8888-888888888888'::uuid
  ),
  'a delivery after emergency release can claim the event again'
);

select ok(
  public.finalize_stripe_webhook_event(
    'evt_expired_processing',
    '88888888-8888-4888-8888-888888888888'::uuid,
    'processed',
    '',
    '',
    '',
    ''
  ),
  'the recovered retry can finalize normally'
);

reset role;
select * from finish();
rollback;
