-- FretTrack Pro Team Assignment Foundation
--
-- `jobs.assigned_member_id` references the shop membership, not a mutable name
-- or email. The display-name column is a non-authoritative snapshot retained
-- when a membership is removed so historical jobs remain understandable.

insert into public.plan_entitlements (plan_id, key, value)
values
  ('free', 'team_assignment', 'false'::jsonb),
  ('solo', 'team_assignment', 'false'::jsonb),
  ('shop', 'team_assignment', 'false'::jsonb),
  ('pro', 'team_assignment', 'true'::jsonb),
  ('enterprise', 'team_assignment', 'true'::jsonb),
  ('trial', 'team_assignment', 'true'::jsonb)
on conflict (plan_id, key) do update
set
  value = excluded.value,
  updated_at = now();

alter table public.jobs
  add column if not exists assigned_member_id uuid
    references public.shop_members(id) on delete set null,
  add column if not exists assigned_member_display_name text not null default '',
  add column if not exists assignment_updated_at timestamptz;

create index if not exists jobs_shop_assigned_member_active_idx
  on public.jobs (shop_id, assigned_member_id)
  where assigned_member_id is not null;

create or replace function private.is_active_shop_member(
  target_shop_id text,
  target_member_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.shop_members
    join auth.users on auth.users.id = shop_members.user_id
    where shop_members.id = target_member_id
      and shop_members.shop_id = target_shop_id
      and auth.users.email_confirmed_at is not null
      and (
        auth.users.banned_until is null
        or auth.users.banned_until <= now()
      )
  );
$$;

create or replace function private.shop_can_use_team_assignment(target_shop_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    private.shop_has_entitlement(target_shop_id, 'team_assignment')
    or exists (
      select 1
      from public.shop_members
      join public.beta_access_requests
        on beta_access_requests.user_id = shop_members.user_id
      where shop_members.shop_id = target_shop_id
        and beta_access_requests.status = 'approved'
    );
$$;

create or replace function private.enforce_job_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_member public.shop_members%rowtype;
  target_member public.shop_members%rowtype;
begin
  if tg_op = 'INSERT' and new.assigned_member_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.assigned_member_id is not distinct from old.assigned_member_id then
    if new.assigned_member_id is not null then
      select *
      into target_member
      from public.shop_members
      where id = new.assigned_member_id
        and shop_id = new.shop_id;

      if target_member.id is not null then
        new.assigned_member_display_name := coalesce(
          nullif(trim(target_member.display_name), ''),
          'Team member'
        );
      end if;
    end if;
    return new;
  end if;

  if auth.uid() is null and session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    new.assignment_updated_at := now();
    return new;
  end if;

  select *
  into actor_member
  from public.shop_members
  where shop_id = new.shop_id
    and user_id = auth.uid();

  if actor_member.id is null
    or not private.shop_lifecycle_allows_write(new.shop_id)
    or not private.shop_can_use_team_assignment(new.shop_id) then
    raise exception 'Team assignment is not available for this shop or account.'
      using errcode = '42501';
  end if;

  if new.assigned_member_id is not null then
    select *
    into target_member
    from public.shop_members
    where id = new.assigned_member_id
      and shop_id = new.shop_id;

    if target_member.id is null
      or not private.is_active_shop_member(new.shop_id, new.assigned_member_id) then
      raise exception 'The assigned technician must be an active member of this shop.'
        using errcode = '23514';
    end if;
  end if;

  if actor_member.role in ('owner', 'admin') then
    null;
  elsif actor_member.role = 'tech' then
    if tg_op = 'INSERT' then
      if new.assigned_member_id is distinct from actor_member.id then
        raise exception 'Technicians may only assign themselves to a new job.'
          using errcode = '42501';
      end if;
    elsif old.assigned_member_id is null
      and new.assigned_member_id = actor_member.id then
      null;
    elsif old.assigned_member_id = actor_member.id
      and new.assigned_member_id is null then
      null;
    else
      raise exception 'Technicians may only claim an unassigned job or remove themselves.'
        using errcode = '42501';
    end if;
  else
    raise exception 'Your shop role cannot change job assignments.'
      using errcode = '42501';
  end if;

  if new.assigned_member_id is not null then
    new.assigned_member_display_name := coalesce(
      nullif(trim(target_member.display_name), ''),
      'Team member'
    );
  end if;
  new.assignment_updated_at := now();
  return new;
end;
$$;

drop trigger if exists jobs_enforce_assignment on public.jobs;
create trigger jobs_enforce_assignment
  before insert or update of assigned_member_id, assigned_member_display_name
  on public.jobs
  for each row
  execute function private.enforce_job_assignment();

create or replace function private.get_assignable_shop_members(target_shop_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  payload jsonb;
begin
  if not private.is_shop_member(target_shop_id) then
    raise exception 'Not allowed to view assignable shop members.'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', shop_members.id,
        'shop_id', shop_members.shop_id,
        'user_id', shop_members.user_id,
        'display_name', coalesce(
          nullif(trim(shop_members.display_name), ''),
          split_part(coalesce(auth.users.email, ''), '@', 1),
          'Team member'
        ),
        'role', shop_members.role,
        'status', 'active'
      )
      order by
        case shop_members.role
          when 'owner' then 1
          when 'admin' then 2
          when 'tech' then 3
          else 4
        end,
        lower(coalesce(nullif(shop_members.display_name, ''), auth.users.email, ''))
    ),
    '[]'::jsonb
  )
  into payload
  from public.shop_members
  join auth.users on auth.users.id = shop_members.user_id
  where shop_members.shop_id = target_shop_id
    and auth.users.email_confirmed_at is not null
    and (
      auth.users.banned_until is null
      or auth.users.banned_until <= now()
    );

  return payload;
end;
$$;

create or replace function public.get_assignable_shop_members(target_shop_id text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select private.get_assignable_shop_members(target_shop_id);
$$;

create or replace function private.update_job_assignment(
  target_job_id uuid,
  target_assigned_member_id uuid default null,
  expected_assignment_updated_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  existing_job public.jobs%rowtype;
  saved_job public.jobs%rowtype;
  actor_member public.shop_members%rowtype;
  event_type_value text;
  event_label_value text;
begin
  select *
  into existing_job
  from public.jobs
  where id = target_job_id
  for update;

  if existing_job.id is null or not private.can_access_job(existing_job.id) then
    raise exception 'Job not found or no longer available.'
      using errcode = '42501';
  end if;

  if existing_job.assignment_updated_at is distinct from expected_assignment_updated_at then
    raise exception 'This assignment changed since the job was loaded. Refresh and try again.'
      using errcode = '40001';
  end if;

  if existing_job.assigned_member_id is not distinct from target_assigned_member_id then
    return jsonb_build_object(
      'jobId', existing_job.id,
      'shopId', existing_job.shop_id,
      'assignedMemberId', existing_job.assigned_member_id,
      'assignedMemberDisplayName', existing_job.assigned_member_display_name,
      'assignmentUpdatedAt', existing_job.assignment_updated_at
    );
  end if;

  select *
  into actor_member
  from public.shop_members
  where shop_id = existing_job.shop_id
    and user_id = auth.uid();

  update public.jobs
  set
    assigned_member_id = target_assigned_member_id,
    assigned_member_display_name = case
      when target_assigned_member_id is null then ''
      else assigned_member_display_name
    end
  where id = existing_job.id
    and shop_id = existing_job.shop_id
  returning * into saved_job;

  if existing_job.assigned_member_id is null then
    event_type_value := 'job_assigned';
    event_label_value := 'Technician assigned';
  elsif saved_job.assigned_member_id is null then
    event_type_value := 'job_unassigned';
    event_label_value := 'Technician unassigned';
  else
    event_type_value := 'job_reassigned';
    event_label_value := 'Technician reassigned';
  end if;

  begin
    insert into public.job_events (
      shop_id,
      job_id,
      event_type,
      event_label,
      event_note,
      event_data,
      created_by
    )
    values (
      saved_job.shop_id,
      saved_job.id,
      event_type_value,
      event_label_value,
      case
        when saved_job.assigned_member_id is null then
          coalesce(nullif(existing_job.assigned_member_display_name, ''), 'Previous technician')
        when existing_job.assigned_member_id is null then
          saved_job.assigned_member_display_name
        else
          coalesce(nullif(existing_job.assigned_member_display_name, ''), 'Previous technician')
          || ' to ' || saved_job.assigned_member_display_name
      end,
      jsonb_build_object(
        'actorUserId', auth.uid(),
        'actorMemberId', actor_member.id,
        'priorAssigneeId', existing_job.assigned_member_id,
        'priorAssigneeName', existing_job.assigned_member_display_name,
        'newAssigneeId', saved_job.assigned_member_id,
        'newAssigneeName', saved_job.assigned_member_display_name
      ),
      auth.uid()::text
    );
  exception when others then
    raise warning 'Job assignment audit event failed for job %: %', saved_job.id, sqlerrm;
  end;

  return jsonb_build_object(
    'jobId', saved_job.id,
    'shopId', saved_job.shop_id,
    'assignedMemberId', saved_job.assigned_member_id,
    'assignedMemberDisplayName', saved_job.assigned_member_display_name,
    'assignmentUpdatedAt', saved_job.assignment_updated_at
  );
end;
$$;

create or replace function public.update_job_assignment(
  target_job_id uuid,
  target_assigned_member_id uuid default null,
  expected_assignment_updated_at timestamptz default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = public
as $$
  select private.update_job_assignment(
    target_job_id,
    target_assigned_member_id,
    expected_assignment_updated_at
  );
$$;

create or replace function public.create_job_with_number(job_payload jsonb)
returns public.jobs
language plpgsql
set search_path = public
as $$
declare
  assigned_job public.jobs;
  assigned_shop_id text;
  assigned_job_date date;
  assigned_day_code text;
  assigned_sequence integer;
  requested_job_number text;
  normalized_priority text;
begin
  assigned_shop_id := coalesce(nullif(job_payload->>'shop_id', ''), 'default-shop');
  requested_job_number := nullif(job_payload->>'job_number', '');
  normalized_priority := lower(coalesce(nullif(job_payload->>'priority', ''), 'regular'));
  if normalized_priority not in ('high', 'medium', 'regular') then
    normalized_priority := 'regular';
  end if;

  if requested_job_number is not null then
    select *
    into assigned_job
    from public.jobs
    where shop_id = assigned_shop_id
      and job_number = requested_job_number
    limit 1;

    if found then
      return assigned_job;
    end if;
  end if;

  assigned_job_date := coalesce(
    nullif(job_payload->>'job_date', '')::date,
    nullif(job_payload->>'date_received', '')::date,
    current_date
  );
  assigned_day_code := to_char(assigned_job_date, 'YY') ||
    lpad(extract(doy from assigned_job_date)::integer::text, 3, '0');

  insert into public.job_daily_sequences (shop_id, job_date, last_sequence)
  values (assigned_shop_id, assigned_job_date, 1)
  on conflict (shop_id, job_date) do update
  set last_sequence = public.job_daily_sequences.last_sequence + 1
  returning last_sequence into assigned_sequence;

  insert into public.jobs (
    id,
    customer_id,
    customer_name,
    customer_first_name,
    customer_last_name,
    phone,
    email,
    email_opt_in,
    sms_opt_in,
    preferred_contact_method,
    guitar_brand,
    model,
    serial,
    color,
    reason_for_visit,
    date_received,
    job_date,
    promise_date,
    priority,
    job_day_code,
    daily_sequence,
    shop_id,
    job_number,
    status,
    tech_details,
    assigned_member_id,
    created_at,
    updated_at
  )
  values (
    coalesce(nullif(job_payload->>'id', '')::uuid, gen_random_uuid()),
    nullif(job_payload->>'customer_id', '')::uuid,
    coalesce(job_payload->>'customer_name', ''),
    coalesce(job_payload->>'customer_first_name', ''),
    coalesce(job_payload->>'customer_last_name', ''),
    coalesce(job_payload->>'phone', ''),
    coalesce(job_payload->>'email', ''),
    coalesce((job_payload->>'email_opt_in')::boolean, false),
    coalesce((job_payload->>'sms_opt_in')::boolean, false),
    coalesce(nullif(job_payload->>'preferred_contact_method', ''), 'email'),
    coalesce(job_payload->>'guitar_brand', ''),
    coalesce(job_payload->>'model', ''),
    coalesce(job_payload->>'serial', ''),
    coalesce(job_payload->>'color', ''),
    coalesce(job_payload->>'reason_for_visit', ''),
    assigned_job_date,
    assigned_job_date,
    nullif(job_payload->>'promise_date', '')::date,
    normalized_priority,
    assigned_day_code,
    assigned_sequence,
    assigned_shop_id,
    coalesce(requested_job_number, assigned_day_code || '-' || lpad(assigned_sequence::text, 3, '0')),
    coalesce(nullif(job_payload->>'status', ''), 'Checked In'),
    coalesce(job_payload->'tech_details', '{}'::jsonb),
    nullif(job_payload->>'assigned_member_id', '')::uuid,
    coalesce(nullif(job_payload->>'created_at', '')::timestamptz, now()),
    coalesce(nullif(job_payload->>'updated_at', '')::timestamptz, now())
  )
  on conflict (shop_id, job_number) do update
  set updated_at = public.jobs.updated_at
  returning * into assigned_job;

  if assigned_job.assigned_member_id is not null then
    begin
      insert into public.job_events (
        shop_id,
        job_id,
        event_type,
        event_label,
        event_note,
        event_data,
        created_by
      )
      values (
        assigned_job.shop_id,
        assigned_job.id,
        'job_assigned',
        'Technician assigned',
        assigned_job.assigned_member_display_name,
        jsonb_build_object(
          'actorUserId', auth.uid(),
          'priorAssigneeId', null,
          'newAssigneeId', assigned_job.assigned_member_id,
          'newAssigneeName', assigned_job.assigned_member_display_name
        ),
        auth.uid()::text
      );
    exception when others then
      raise warning 'Initial job assignment audit event failed for job %: %', assigned_job.id, sqlerrm;
    end;
  end if;

  return assigned_job;
end;
$$;

revoke all on function private.is_active_shop_member(text, uuid) from public, anon;
revoke all on function private.shop_can_use_team_assignment(text) from public, anon;
revoke all on function private.enforce_job_assignment() from public, anon, authenticated;
revoke all on function private.get_assignable_shop_members(text) from public, anon;
revoke all on function private.update_job_assignment(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.get_assignable_shop_members(text) from public, anon;
revoke all on function public.update_job_assignment(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.create_job_with_number(jsonb) from public, anon;

grant execute on function private.is_active_shop_member(text, uuid) to authenticated;
grant execute on function private.shop_can_use_team_assignment(text) to authenticated;
grant execute on function private.get_assignable_shop_members(text) to authenticated;
grant execute on function private.update_job_assignment(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.get_assignable_shop_members(text) to authenticated;
grant execute on function public.update_job_assignment(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.create_job_with_number(jsonb) to authenticated;
