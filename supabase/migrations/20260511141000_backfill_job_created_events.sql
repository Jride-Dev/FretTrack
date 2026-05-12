insert into job_events (
  shop_id,
  job_id,
  event_type,
  event_label,
  event_note,
  event_data,
  created_at
)
select
  coalesce(jobs.shop_id, 'default-shop'),
  jobs.id,
  'job_created',
  'Job created',
  case
    when jobs.job_number is null or jobs.job_number = '' then null
    else 'Job ' || jobs.job_number
  end,
  jsonb_build_object(
    'jobNumber', jobs.job_number,
    'status', jobs.status,
    'backfilled', true
  ),
  coalesce(jobs.created_at, now())
from jobs
where not exists (
  select 1
  from job_events
  where job_events.job_id = jobs.id
    and job_events.event_type = 'job_created'
);
