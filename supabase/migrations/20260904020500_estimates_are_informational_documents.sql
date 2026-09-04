-- Estimates are informational documents, not a workflow gate. Keep the existing
-- estimate history and public-link features, but never lock charges or require
-- customer approval before the shop can continue or finalize an invoice.

create or replace function private.allow_estimate_editable_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

create or replace function private.allow_estimate_editable_charge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists jobs_guard_estimate_mutation on public.jobs;
create trigger jobs_guard_estimate_mutation
  before insert or update on public.jobs
  for each row execute function private.allow_estimate_editable_job();

drop trigger if exists job_parts_guard_estimate on public.job_parts;
create trigger job_parts_guard_estimate
  before insert or update or delete on public.job_parts
  for each row execute function private.allow_estimate_editable_charge();

drop trigger if exists job_services_guard_estimate on public.job_services;
create trigger job_services_guard_estimate
  before insert or update or delete on public.job_services
  for each row execute function private.allow_estimate_editable_charge();

comment on column public.jobs.estimate_snapshot is
  'Optional server-calculated estimate document snapshot. It does not lock work-order charges.';
