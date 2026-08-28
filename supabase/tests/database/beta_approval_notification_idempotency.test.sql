begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

select has_table(
  'private',
  'beta_approval_notification_deliveries',
  'approval notification delivery ledger exists outside the exposed schema'
);

select has_function(
  'public',
  'begin_beta_approval_notification',
  array['uuid', 'text', 'text', 'text', 'text'],
  'approval notification begin function exists'
);

select has_function(
  'public',
  'finalize_beta_approval_notification',
  array['uuid', 'text', 'text'],
  'approval notification finalize function exists'
);

select has_function(
  'public',
  'fail_beta_approval_notification',
  array['uuid', 'text', 'text'],
  'approval notification failure function exists'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.begin_beta_approval_notification(uuid, text, text, text, text)',
    'EXECUTE'
  ),
  'authenticated users cannot begin approval notification deliveries'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.finalize_beta_approval_notification(uuid, text, text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.fail_beta_approval_notification(uuid, text, text)',
    'EXECUTE'
  ),
  'authenticated users cannot finalize approval notification deliveries'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.begin_beta_approval_notification(uuid, text, text, text, text)',
    'EXECUTE'
  ),
  'the notification service can begin approval deliveries'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.finalize_beta_approval_notification(uuid, text, text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.fail_beta_approval_notification(uuid, text, text)',
    'EXECUTE'
  ),
  'the notification service can finalize approval deliveries'
);

select ok(
  not has_table_privilege(
    'service_role',
    'private.beta_approval_notification_deliveries',
    'SELECT'
  ),
  'the service role cannot bypass the notification delivery RPCs'
);

insert into public.beta_access_requests (
  id,
  user_id,
  email,
  status,
  requested_at,
  reviewed_at,
  notes
)
values
  (
    'aaaaaaaa-1111-4111-8111-111111111111'::uuid,
    null,
    'approval-idempotency@example.test',
    'approved',
    pg_catalog.now(),
    pg_catalog.now(),
    'pgTAP approval notification fixture'
  ),
  (
    'bbbbbbbb-2222-4222-8222-222222222222'::uuid,
    null,
    'approval-indeterminate@example.test',
    'approved',
    pg_catalog.now(),
    pg_catalog.now(),
    'pgTAP stale approval notification fixture'
  );

set local role service_role;
set local "request.jwt.claim.role" = 'service_role';

create temporary table approval_test_results (
  label text primary key,
  payload jsonb not null
);

insert into approval_test_results
values (
  'first',
  public.begin_beta_approval_notification(
    'aaaaaaaa-1111-4111-8111-111111111111'::uuid,
    'approval-idempotency@example.test',
    'FretTrack <noreply@frettrack-app.com>',
    'Your FretTrack access is approved',
    'Welcome to FretTrack.'
  )
);

select is(
  (select payload->>'action' from approval_test_results where label = 'first'),
  'send',
  'the first request starts one provider delivery'
);

select ok(
  (select payload->>'idempotencyKey' from approval_test_results where label = 'first')
    like 'frettrack-beta-approval/%/1',
  'the first delivery receives a stable first-attempt key'
);

insert into approval_test_results
values (
  'resume',
  public.begin_beta_approval_notification(
    'aaaaaaaa-1111-4111-8111-111111111111'::uuid,
    'changed-address@example.test',
    'Changed Sender <changed@example.test>',
    'Changed subject',
    'Changed body'
  )
);

select is(
  (select payload->>'action' from approval_test_results where label = 'resume'),
  'resume',
  'a retry resumes the unresolved provider operation'
);

select is(
  (select payload->>'idempotencyKey' from approval_test_results where label = 'resume'),
  (select payload->>'idempotencyKey' from approval_test_results where label = 'first'),
  'a retry reuses the same provider idempotency key'
);

select is(
  (select payload->>'to' from approval_test_results where label = 'resume'),
  'approval-idempotency@example.test',
  'a retry reuses the original recipient snapshot'
);

select ok(
  not public.fail_beta_approval_notification(
    'aaaaaaaa-1111-4111-8111-111111111111'::uuid,
    'wrong-key',
    'wrong attempt'
  ),
  'a stale key cannot release the current delivery'
);

select ok(
  public.fail_beta_approval_notification(
    'aaaaaaaa-1111-4111-8111-111111111111'::uuid,
    (select payload->>'idempotencyKey' from approval_test_results where label = 'first'),
    'provider rejected the request'
  ),
  'a confirmed provider rejection releases the current delivery'
);

reset role;

select is(
  (
    select state
    from private.beta_approval_notification_deliveries
    where request_id = 'aaaaaaaa-1111-4111-8111-111111111111'::uuid
  ),
  'failed',
  'a confirmed rejection is recorded as failed'
);

set local role service_role;
set local "request.jwt.claim.role" = 'service_role';

insert into approval_test_results
values (
  'second-attempt',
  public.begin_beta_approval_notification(
    'aaaaaaaa-1111-4111-8111-111111111111'::uuid,
    'approval-idempotency@example.test',
    'FretTrack <noreply@frettrack-app.com>',
    'Your FretTrack access is approved',
    'Welcome to FretTrack.'
  )
);

select is(
  (select payload->>'action' from approval_test_results where label = 'second-attempt'),
  'send',
  'a confirmed rejection permits a new provider attempt'
);

select ok(
  (select payload->>'idempotencyKey' from approval_test_results where label = 'second-attempt')
    like 'frettrack-beta-approval/%/2',
  'the new provider attempt receives a distinct key'
);

select ok(
  not public.finalize_beta_approval_notification(
    'aaaaaaaa-1111-4111-8111-111111111111'::uuid,
    'wrong-key',
    'provider-message-stale'
  ),
  'a stale key cannot finalize the current delivery'
);

select ok(
  public.finalize_beta_approval_notification(
    'aaaaaaaa-1111-4111-8111-111111111111'::uuid,
    (select payload->>'idempotencyKey' from approval_test_results where label = 'second-attempt'),
    'provider-message-final'
  ),
  'the current provider operation finalizes successfully'
);

reset role;

select ok(
  (
    select approved_notified_at is not null
    from public.beta_access_requests
    where id = 'aaaaaaaa-1111-4111-8111-111111111111'::uuid
  ),
  'provider finalization records the legacy notification timestamp atomically'
);

select is(
  (
    select state || ':' || provider_message_id
    from private.beta_approval_notification_deliveries
    where request_id = 'aaaaaaaa-1111-4111-8111-111111111111'::uuid
  ),
  'sent:provider-message-final',
  'the delivery ledger records the provider acceptance identity'
);

set local role service_role;
set local "request.jwt.claim.role" = 'service_role';

select is(
  public.begin_beta_approval_notification(
    'aaaaaaaa-1111-4111-8111-111111111111'::uuid,
    'approval-idempotency@example.test',
    'FretTrack <noreply@frettrack-app.com>',
    'Your FretTrack access is approved',
    'Welcome to FretTrack.'
  )->>'action',
  'sent',
  'a completed notification is never sent again'
);

insert into approval_test_results
values (
  'stale-first',
  public.begin_beta_approval_notification(
    'bbbbbbbb-2222-4222-8222-222222222222'::uuid,
    'approval-indeterminate@example.test',
    'FretTrack <noreply@frettrack-app.com>',
    'Your FretTrack access is approved',
    'Welcome to FretTrack.'
  )
);

select is(
  (select payload->>'action' from approval_test_results where label = 'stale-first'),
  'send',
  'a second request starts its own provider delivery'
);

reset role;

update private.beta_approval_notification_deliveries
set attempt_started_at = pg_catalog.now() - interval '24 hours'
where request_id = 'bbbbbbbb-2222-4222-8222-222222222222'::uuid;

set local role service_role;
set local "request.jwt.claim.role" = 'service_role';

select is(
  public.begin_beta_approval_notification(
    'bbbbbbbb-2222-4222-8222-222222222222'::uuid,
    'approval-indeterminate@example.test',
    'FretTrack <noreply@frettrack-app.com>',
    'Your FretTrack access is approved',
    'Welcome to FretTrack.'
  )->>'action',
  'indeterminate',
  'an unresolved delivery is blocked before provider deduplication expires'
);

reset role;

select is(
  (
    select state
    from private.beta_approval_notification_deliveries
    where request_id = 'bbbbbbbb-2222-4222-8222-222222222222'::uuid
  ),
  'indeterminate',
  'the blocked unresolved delivery remains visible for manual recovery'
);

select * from finish();

rollback;
