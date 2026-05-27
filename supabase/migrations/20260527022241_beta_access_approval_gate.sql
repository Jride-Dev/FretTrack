create table if not exists public.beta_access_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists beta_access_requests_status_requested_idx
  on public.beta_access_requests (status, requested_at desc);

drop trigger if exists beta_access_requests_set_updated_at on public.beta_access_requests;
create trigger beta_access_requests_set_updated_at
  before update on public.beta_access_requests
  for each row
  execute function public.set_updated_at();

alter table public.beta_access_requests enable row level security;

create or replace function private.has_approved_beta_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.beta_access_requests
    where beta_access_requests.user_id = auth.uid()
      and beta_access_requests.status = 'approved'
  );
$$;

grant execute on function private.has_approved_beta_access() to authenticated;

drop policy if exists "beta_access_requests_select_self_or_operator" on public.beta_access_requests;
create policy "beta_access_requests_select_self_or_operator"
  on public.beta_access_requests
  for select
  to authenticated
  using (user_id = auth.uid() or private.is_operator());

drop policy if exists "beta_access_requests_insert_own_pending" on public.beta_access_requests;
create policy "beta_access_requests_insert_own_pending"
  on public.beta_access_requests
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
  );

drop policy if exists "beta_access_requests_update_operator" on public.beta_access_requests;
create policy "beta_access_requests_update_operator"
  on public.beta_access_requests
  for update
  to authenticated
  using (private.is_operator())
  with check (private.is_operator());

revoke all on public.beta_access_requests from anon, public;
grant select, insert, update on public.beta_access_requests to authenticated;

create or replace function public.get_or_create_beta_access_request()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  request_row public.beta_access_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select email
  into current_email
  from auth.users
  where id = current_user_id;

  insert into public.beta_access_requests (user_id, email, status)
  values (current_user_id, coalesce(current_email, ''), 'pending')
  on conflict (user_id) do update
  set email = coalesce(excluded.email, public.beta_access_requests.email, '')
  returning * into request_row;

  return to_jsonb(request_row);
end;
$$;

revoke all on function public.get_or_create_beta_access_request() from public, anon;
grant execute on function public.get_or_create_beta_access_request() to authenticated;

create or replace function public.get_beta_access_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  payload jsonb;
begin
  if not private.is_operator() then
    raise exception 'Not allowed to view beta access requests.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', beta_access_requests.user_id,
        'email', coalesce(nullif(beta_access_requests.email, ''), auth.users.email, ''),
        'status', beta_access_requests.status,
        'requested_at', beta_access_requests.requested_at,
        'reviewed_at', beta_access_requests.reviewed_at,
        'reviewed_by', beta_access_requests.reviewed_by,
        'reviewed_by_email', reviewer.email,
        'notes', beta_access_requests.notes,
        'last_sign_in_at', auth.users.last_sign_in_at,
        'email_confirmed_at', auth.users.email_confirmed_at,
        'updated_at', beta_access_requests.updated_at
      )
      order by
        case beta_access_requests.status when 'pending' then 0 when 'approved' then 1 else 2 end,
        beta_access_requests.requested_at desc
    ),
    '[]'::jsonb
  )
  into payload
  from public.beta_access_requests
  left join auth.users on auth.users.id = beta_access_requests.user_id
  left join auth.users reviewer on reviewer.id = beta_access_requests.reviewed_by;

  return payload;
end;
$$;

revoke all on function public.get_beta_access_requests() from public, anon;
grant execute on function public.get_beta_access_requests() to authenticated;

create or replace function public.update_beta_access_request(
  target_user_id uuid,
  next_status text,
  next_notes text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  request_row public.beta_access_requests%rowtype;
begin
  if not private.is_operator() then
    raise exception 'Not allowed to update beta access requests.';
  end if;

  if target_user_id is null then
    raise exception 'Missing beta access user.';
  end if;

  if next_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid beta access status.';
  end if;

  update public.beta_access_requests
  set
    status = next_status,
    reviewed_at = case when next_status = 'pending' then null else now() end,
    reviewed_by = case when next_status = 'pending' then null else auth.uid() end,
    notes = coalesce(next_notes, notes, '')
  where user_id = target_user_id
  returning * into request_row;

  if request_row.user_id is null then
    raise exception 'Beta access request not found.';
  end if;

  return to_jsonb(request_row);
end;
$$;

revoke all on function public.update_beta_access_request(uuid, text, text) from public, anon;
grant execute on function public.update_beta_access_request(uuid, text, text) to authenticated;

insert into public.beta_access_requests (user_id, email, status, reviewed_at, notes)
select distinct
  shop_members.user_id,
  coalesce(auth.users.email, ''),
  'approved',
  now(),
  'Backfilled from existing shop membership.'
from public.shop_members
left join auth.users on auth.users.id = shop_members.user_id
on conflict (user_id) do update
set
  email = coalesce(excluded.email, public.beta_access_requests.email, ''),
  status = 'approved',
  reviewed_at = coalesce(public.beta_access_requests.reviewed_at, now()),
  notes = case
    when public.beta_access_requests.notes = '' then excluded.notes
    else public.beta_access_requests.notes
  end;

insert into public.beta_access_requests (user_id, email, status, reviewed_at, notes)
select
  operator_users.user_id,
  coalesce(nullif(operator_users.email, ''), auth.users.email, ''),
  'approved',
  now(),
  'Backfilled from operator access.'
from public.operator_users
left join auth.users on auth.users.id = operator_users.user_id
where operator_users.active = true
on conflict (user_id) do update
set
  email = coalesce(excluded.email, public.beta_access_requests.email, ''),
  status = 'approved',
  reviewed_at = coalesce(public.beta_access_requests.reviewed_at, now()),
  notes = case
    when public.beta_access_requests.notes = '' then excluded.notes
    else public.beta_access_requests.notes
  end;

drop policy if exists "shop_members_insert_bootstrap_owner" on public.shop_members;
create policy "shop_members_insert_bootstrap_owner"
  on public.shop_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and private.shop_has_no_members(shop_id)
    and (private.has_approved_beta_access() or private.is_operator())
  );
