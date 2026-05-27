alter table public.beta_access_requests
  add column if not exists id uuid default gen_random_uuid();

update public.beta_access_requests
set id = gen_random_uuid()
where id is null;

alter table public.beta_access_requests
  alter column id set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'beta_access_requests_pkey'
      and conrelid = 'public.beta_access_requests'::regclass
  ) then
    alter table public.beta_access_requests drop constraint beta_access_requests_pkey;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'beta_access_requests_pkey'
      and conrelid = 'public.beta_access_requests'::regclass
  ) then
    alter table public.beta_access_requests add constraint beta_access_requests_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'beta_access_requests_user_id_key'
      and conrelid = 'public.beta_access_requests'::regclass
  ) then
    alter table public.beta_access_requests add constraint beta_access_requests_user_id_key unique (user_id);
  end if;
end $$;

alter table public.beta_access_requests
  alter column user_id drop not null;

create unique index if not exists beta_access_requests_email_lower_key
  on public.beta_access_requests (lower(email))
  where email <> '';

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

  select *
  into request_row
  from public.beta_access_requests
  where user_id = current_user_id
  limit 1;

  if request_row.id is not null then
    update public.beta_access_requests
    set email = coalesce(nullif(current_email, ''), email)
    where id = request_row.id
    returning * into request_row;

    return to_jsonb(request_row);
  end if;

  select *
  into request_row
  from public.beta_access_requests
  where lower(email) = lower(coalesce(current_email, ''))
    and user_id is null
  order by requested_at desc
  limit 1;

  if request_row.id is not null then
    update public.beta_access_requests
    set
      user_id = current_user_id,
      email = coalesce(nullif(current_email, ''), email)
    where id = request_row.id
    returning * into request_row;

    return to_jsonb(request_row);
  end if;

  insert into public.beta_access_requests (user_id, email, status)
  values (current_user_id, coalesce(current_email, ''), 'pending')
  returning * into request_row;

  return to_jsonb(request_row);
end;
$$;

revoke all on function public.get_or_create_beta_access_request() from public, anon;
grant execute on function public.get_or_create_beta_access_request() to authenticated;

create or replace function public.submit_beta_access_request(
  applicant_email text,
  applicant_name text default '',
  applicant_shop_name text default '',
  applicant_notes text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(applicant_email, '')));
  clean_name text := trim(coalesce(applicant_name, ''));
  clean_shop_name text := trim(coalesce(applicant_shop_name, ''));
  clean_notes text := trim(coalesce(applicant_notes, ''));
  matching_user_id uuid;
  request_row public.beta_access_requests%rowtype;
  next_notes text;
begin
  if normalized_email = ''
    or length(normalized_email) > 180
    or normalized_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'Please enter a valid email address.';
  end if;

  select id
  into matching_user_id
  from auth.users
  where lower(email) = normalized_email
  order by created_at desc
  limit 1;

  next_notes := trim(concat_ws(E'\n',
    nullif('Applicant: ' || left(clean_name, 120), 'Applicant: '),
    nullif('Shop: ' || left(clean_shop_name, 160), 'Shop: '),
    nullif(left(clean_notes, 1500), '')
  ));

  select *
  into request_row
  from public.beta_access_requests
  where lower(email) = normalized_email
     or (matching_user_id is not null and user_id = matching_user_id)
  order by requested_at desc
  limit 1;

  if request_row.id is null then
    insert into public.beta_access_requests (
      user_id,
      email,
      status,
      requested_at,
      notes
    )
    values (
      matching_user_id,
      normalized_email,
      'pending',
      now(),
      next_notes
    )
    returning * into request_row;
  else
    update public.beta_access_requests
    set
      user_id = coalesce(user_id, matching_user_id),
      email = normalized_email,
      requested_at = case when status = 'pending' then now() else requested_at end,
      notes = case
        when next_notes = '' then notes
        when notes = '' then next_notes
        else notes || E'\n\nUpdated application:\n' || next_notes
      end
    where id = request_row.id
    returning * into request_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', request_row.status,
    'email', request_row.email,
    'requestedAt', request_row.requested_at
  );
end;
$$;

revoke all on function public.submit_beta_access_request(text, text, text, text) from public;
grant execute on function public.submit_beta_access_request(text, text, text, text) to anon, authenticated;

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
        'id', beta_access_requests.id,
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

drop function if exists public.update_beta_access_request(uuid, text, text);

create or replace function public.update_beta_access_request(
  target_request_id uuid,
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

  if target_request_id is null then
    raise exception 'Missing beta access request.';
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
  where id = target_request_id
  returning * into request_row;

  if request_row.id is null then
    raise exception 'Beta access request not found.';
  end if;

  return to_jsonb(request_row);
end;
$$;

revoke all on function public.update_beta_access_request(uuid, text, text) from public, anon;
grant execute on function public.update_beta_access_request(uuid, text, text) to authenticated;
