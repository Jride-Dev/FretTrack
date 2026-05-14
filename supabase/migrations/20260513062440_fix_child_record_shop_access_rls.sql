create or replace function private.can_access_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs
    join public.shop_members
      on shop_members.shop_id = jobs.shop_id
     and shop_members.user_id = auth.uid()
    where jobs.id = target_job_id
  );
$$;

grant execute on function private.can_access_job(uuid) to authenticated;
