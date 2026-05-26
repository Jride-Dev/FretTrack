create or replace function private.get_shop_members(target_shop_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  payload jsonb;
begin
  if not private.can_admin_shop(target_shop_id) then
    raise exception 'Not allowed to view shop members.'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', shop_members.id,
        'shop_id', shop_members.shop_id,
        'user_id', shop_members.user_id,
        'email', coalesce(auth.users.email, shop_members.display_name, ''),
        'display_name', shop_members.display_name,
        'role', shop_members.role,
        'status', case
          when auth.users.id is null then 'missing_auth_user'
          when auth.users.email_confirmed_at is null then 'unconfirmed'
          when auth.users.banned_until is not null and auth.users.banned_until > now() then 'blocked'
          else 'active'
        end,
        'last_sign_in_at', auth.users.last_sign_in_at,
        'created_at', shop_members.created_at,
        'updated_at', shop_members.updated_at
      )
      order by
        case shop_members.role
          when 'owner' then 1
          when 'admin' then 2
          when 'tech' then 3
          else 4
        end,
        coalesce(auth.users.email, shop_members.display_name, '')
    ),
    '[]'::jsonb
  )
  into payload
  from public.shop_members
  left join auth.users on auth.users.id = shop_members.user_id
  where shop_members.shop_id = target_shop_id;

  return payload;
end;
$$;

create or replace function public.get_shop_members(target_shop_id text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select private.get_shop_members(target_shop_id);
$$;

create or replace function private.upsert_shop_member_by_email(
  target_shop_id text,
  target_email text,
  target_role text default 'tech',
  target_display_name text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  normalized_email text;
  normalized_role text;
  target_user_id uuid;
  existing_membership public.shop_members%rowtype;
  saved_membership public.shop_members%rowtype;
begin
  if not private.can_admin_shop(target_shop_id) then
    raise exception 'Not allowed to manage shop members.'
      using errcode = '42501';
  end if;

  normalized_email := lower(trim(coalesce(target_email, '')));
  normalized_role := lower(trim(coalesce(target_role, 'tech')));

  if normalized_email = '' then
    raise exception 'Member email is required.';
  end if;

  if normalized_role not in ('owner', 'admin', 'tech', 'viewer') then
    raise exception 'Invalid member role.';
  end if;

  if normalized_role = 'owner' and not private.has_shop_role(target_shop_id, array['owner']) then
    raise exception 'Only a shop owner can add another owner.'
      using errcode = '42501';
  end if;

  select auth.users.id
  into target_user_id
  from auth.users
  where lower(auth.users.email) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'No FretTrack account exists for that email yet. Have the user sign up first, then add them here.';
  end if;

  select *
  into existing_membership
  from public.shop_members
  where shop_id = target_shop_id
    and user_id = target_user_id;

  if existing_membership.id is not null
    and existing_membership.role = 'owner'
    and normalized_role <> 'owner'
    and (
      select count(*)
      from public.shop_members
      where shop_id = target_shop_id
        and role = 'owner'
    ) <= 1 then
    raise exception 'A shop must keep at least one owner.';
  end if;

  if existing_membership.id is not null
    and (existing_membership.role = 'owner' or normalized_role = 'owner')
    and not private.has_shop_role(target_shop_id, array['owner']) then
    raise exception 'Only a shop owner can change owner memberships.'
      using errcode = '42501';
  end if;

  insert into public.shop_members (
    shop_id,
    user_id,
    role,
    display_name
  )
  values (
    target_shop_id,
    target_user_id,
    normalized_role,
    coalesce(nullif(trim(target_display_name), ''), normalized_email)
  )
  on conflict (shop_id, user_id) do update
  set
    role = excluded.role,
    display_name = excluded.display_name,
    updated_at = now()
  returning * into saved_membership;

  return jsonb_build_object(
    'id', saved_membership.id,
    'shopId', saved_membership.shop_id,
    'userId', saved_membership.user_id,
    'email', normalized_email,
    'displayName', saved_membership.display_name,
    'role', saved_membership.role,
    'createdAt', saved_membership.created_at,
    'updatedAt', saved_membership.updated_at
  );
end;
$$;

create or replace function public.upsert_shop_member_by_email(
  target_shop_id text,
  target_email text,
  target_role text default 'tech',
  target_display_name text default ''
)
returns jsonb
language sql
volatile
security invoker
set search_path = public
as $$
  select private.upsert_shop_member_by_email(target_shop_id, target_email, target_role, target_display_name);
$$;

create or replace function private.update_shop_member_role(
  target_member_id uuid,
  target_role text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  normalized_role text;
  existing_membership public.shop_members%rowtype;
  saved_membership public.shop_members%rowtype;
begin
  normalized_role := lower(trim(coalesce(target_role, '')));

  if normalized_role not in ('owner', 'admin', 'tech', 'viewer') then
    raise exception 'Invalid member role.';
  end if;

  select *
  into existing_membership
  from public.shop_members
  where id = target_member_id;

  if existing_membership.id is null then
    raise exception 'Member not found.';
  end if;

  if not private.can_admin_shop(existing_membership.shop_id) then
    raise exception 'Not allowed to manage shop members.'
      using errcode = '42501';
  end if;

  if (existing_membership.role = 'owner' or normalized_role = 'owner')
    and not private.has_shop_role(existing_membership.shop_id, array['owner']) then
    raise exception 'Only a shop owner can change owner memberships.'
      using errcode = '42501';
  end if;

  if existing_membership.role = 'owner'
    and normalized_role <> 'owner'
    and (
      select count(*)
      from public.shop_members
      where shop_id = existing_membership.shop_id
        and role = 'owner'
    ) <= 1 then
    raise exception 'A shop must keep at least one owner.';
  end if;

  update public.shop_members
  set
    role = normalized_role,
    updated_at = now()
  where id = target_member_id
  returning * into saved_membership;

  return jsonb_build_object(
    'id', saved_membership.id,
    'shopId', saved_membership.shop_id,
    'userId', saved_membership.user_id,
    'role', saved_membership.role,
    'displayName', saved_membership.display_name,
    'createdAt', saved_membership.created_at,
    'updatedAt', saved_membership.updated_at
  );
end;
$$;

create or replace function public.update_shop_member_role(
  target_member_id uuid,
  target_role text
)
returns jsonb
language sql
volatile
security invoker
set search_path = public
as $$
  select private.update_shop_member_role(target_member_id, target_role);
$$;

create or replace function private.remove_shop_member(target_member_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  existing_membership public.shop_members%rowtype;
begin
  select *
  into existing_membership
  from public.shop_members
  where id = target_member_id;

  if existing_membership.id is null then
    raise exception 'Member not found.';
  end if;

  if not private.can_admin_shop(existing_membership.shop_id) then
    raise exception 'Not allowed to manage shop members.'
      using errcode = '42501';
  end if;

  if existing_membership.role = 'owner'
    and not private.has_shop_role(existing_membership.shop_id, array['owner']) then
    raise exception 'Only a shop owner can remove an owner.'
      using errcode = '42501';
  end if;

  if existing_membership.role = 'owner'
    and (
      select count(*)
      from public.shop_members
      where shop_id = existing_membership.shop_id
        and role = 'owner'
    ) <= 1 then
    raise exception 'A shop must keep at least one owner.';
  end if;

  delete from public.shop_members
  where id = target_member_id;

  return jsonb_build_object(
    'id', existing_membership.id,
    'shopId', existing_membership.shop_id,
    'userId', existing_membership.user_id,
    'role', existing_membership.role,
    'removed', true
  );
end;
$$;

create or replace function public.remove_shop_member(target_member_id uuid)
returns jsonb
language sql
volatile
security invoker
set search_path = public
as $$
  select private.remove_shop_member(target_member_id);
$$;

revoke all on function private.get_shop_members(text) from public, anon;
revoke all on function private.upsert_shop_member_by_email(text, text, text, text) from public, anon;
revoke all on function private.update_shop_member_role(uuid, text) from public, anon;
revoke all on function private.remove_shop_member(uuid) from public, anon;

grant execute on function private.get_shop_members(text) to authenticated;
grant execute on function private.upsert_shop_member_by_email(text, text, text, text) to authenticated;
grant execute on function private.update_shop_member_role(uuid, text) to authenticated;
grant execute on function private.remove_shop_member(uuid) to authenticated;

revoke all on function public.get_shop_members(text) from public, anon;
revoke all on function public.upsert_shop_member_by_email(text, text, text, text) from public, anon;
revoke all on function public.update_shop_member_role(uuid, text) from public, anon;
revoke all on function public.remove_shop_member(uuid) from public, anon;

grant execute on function public.get_shop_members(text) to authenticated;
grant execute on function public.upsert_shop_member_by_email(text, text, text, text) to authenticated;
grant execute on function public.update_shop_member_role(uuid, text) to authenticated;
grant execute on function public.remove_shop_member(uuid) to authenticated;
