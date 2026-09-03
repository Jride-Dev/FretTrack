-- Services represent billable units in FretTrack. Keep their quantity integral
-- so browser controls, stored rows, and estimate calculations cannot disagree.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'job_services_quantity_whole_check'
      and conrelid = 'public.job_services'::regclass
  ) then
    alter table public.job_services
      add constraint job_services_quantity_whole_check
      check (quantity >= 1 and quantity <= 9999 and quantity = trunc(quantity))
      not valid;
  end if;
end;
$$;

comment on constraint job_services_quantity_whole_check on public.job_services is
  'Service quantities are positive whole units; prices remain exact currency values.';
