alter table public.keyboard_part_requests
  add column job_part_id uuid references public.job_parts(id) on delete set null;

create unique index keyboard_part_requests_job_part_uidx
  on public.keyboard_part_requests (job_part_id)
  where job_part_id is not null;

create or replace function public.fulfill_keyboard_part_request(p_request_id uuid)
returns public.job_parts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_request public.keyboard_part_requests%rowtype;
  fulfilled_part public.job_parts%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into target_request
  from public.keyboard_part_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Keyboard parts request not found or is not accessible.' using errcode = 'P0002';
  end if;

  if not private.can_write_job(target_request.job_id)
    or not exists (
      select 1 from public.jobs
      where jobs.id = target_request.job_id
        and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')
    ) then
    raise exception 'Not allowed to fulfill this keyboard parts request.' using errcode = '42501';
  end if;

  if target_request.job_part_id is not null then
    select * into fulfilled_part
    from public.job_parts
    where id = target_request.job_part_id;

    if found then
      return fulfilled_part;
    end if;
  end if;

  if target_request.inventory_part_id is null then
    raise exception 'This request is not linked to an inventory part.' using errcode = '22023';
  end if;

  fulfilled_part := public.add_inventory_part_to_job(
    target_request.job_id,
    target_request.inventory_part_id,
    target_request.quantity
  );

  update public.keyboard_part_requests
  set request_status = 'installed',
      job_part_id = fulfilled_part.id
  where id = target_request.id;

  return fulfilled_part;
end;
$$;

revoke all on function public.fulfill_keyboard_part_request(uuid) from public, anon;
grant execute on function public.fulfill_keyboard_part_request(uuid) to authenticated;

comment on function public.fulfill_keyboard_part_request(uuid) is
  'Atomically and idempotently converts one inventory-linked keyboard parts request into a job part.';
