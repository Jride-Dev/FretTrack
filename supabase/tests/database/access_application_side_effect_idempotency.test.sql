begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_function(
  'public',
  'submit_beta_access_request',
  array['text', 'text', 'text', 'text'],
  'the public access-application submission function exists'
);

select ok(
  has_function_privilege(
    'anon',
    'public.submit_beta_access_request(text, text, text, text)',
    'EXECUTE'
  ),
  'the landing page can submit a bounded access application'
);

create temporary table access_application_results (
  attempt integer primary key,
  result jsonb not null
);

insert into access_application_results (attempt, result)
values (
  1,
  public.submit_beta_access_request(
    'access-retry@example.test',
    'Access Retry',
    'Retry Repair',
    E'State: CA\nTeam size: 2\nCurrent tracking: Paper'
  )
);

select ok(
  (select result->>'requestId' from access_application_results where attempt = 1) is not null,
  'the submission returns its durable request identity'
);

update public.beta_access_requests
set requested_at = '2026-01-02 03:04:05+00'::timestamptz
where email = 'access-retry@example.test';

insert into access_application_results (attempt, result)
values (
  2,
  public.submit_beta_access_request(
    'ACCESS-RETRY@example.test',
    'Access Retry',
    'Retry Repair',
    E'State: CA\nTeam size: 2\nCurrent tracking: Paper'
  )
);

select is(
  (select result->>'requestId' from access_application_results where attempt = 2),
  (select result->>'requestId' from access_application_results where attempt = 1),
  'an identical retry returns the original request identity'
);

select is(
  (select result->>'requestedAt' from access_application_results where attempt = 2),
  '2026-01-02T03:04:05+00:00',
  'an identical retry retains the original request timestamp'
);

select is(
  (select count(*)::integer from public.beta_access_requests where email = 'access-retry@example.test'),
  1,
  'an identical retry retains one access-request row'
);

select is(
  (
    select (
      (length(notes) - length(replace(notes, 'Current tracking: Paper', '')))
      / length('Current tracking: Paper')
    )::integer
    from public.beta_access_requests
    where email = 'access-retry@example.test'
  ),
  1,
  'an identical retry does not append duplicate application notes'
);

select throws_like(
  $$select public.submit_beta_access_request(
    'length-check@example.test',
    repeat('A', 121),
    'Length Check Shop',
    E'State: CA\nTeam size: 2\nCurrent tracking: Paper'
  )$$,
  '%character limit%',
  'over-limit applicant names are rejected'
);

select throws_like(
  $$select public.submit_beta_access_request(
    'notes-check@example.test',
    'Length Check',
    'Length Check Shop',
    repeat('N', 1501)
  )$$,
  '%character limit%',
  'over-limit application notes are rejected'
);

select * from finish();

rollback;
