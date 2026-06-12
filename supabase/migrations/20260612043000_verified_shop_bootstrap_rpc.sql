create or replace function public.bootstrap_current_user_as_owner(target_shop_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  normalized_shop_id text := lower(trim(coalesce(target_shop_id, '')));
  current_user_id uuid := auth.uid();
  current_email text;
  current_email_confirmed_at timestamptz;
  saved_membership public.shop_members%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if normalized_shop_id = ''
    or length(normalized_shop_id) > 64
    or normalized_shop_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Invalid shop id.';
  end if;

  select email, email_confirmed_at
  into current_email, current_email_confirmed_at
  from auth.users
  where id = current_user_id;

  if current_email_confirmed_at is null then
    raise exception 'Confirm your email before creating a shop workspace.'
      using errcode = '42501';
  end if;

  if not private.is_operator()
    and not exists (
      select 1
      from public.beta_access_requests
      where user_id = current_user_id
        and status = 'approved'
    ) then
    raise exception 'An operator must approve your beta access before you can create a shop.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.shop_members
    where shop_id = normalized_shop_id
  ) then
    raise exception 'That shop workspace already exists.';
  end if;

  insert into public.shop_members (
    shop_id,
    user_id,
    role,
    display_name
  )
  values (
    normalized_shop_id,
    current_user_id,
    'owner',
    coalesce(current_email, '')
  )
  returning * into saved_membership;

  return jsonb_build_object(
    'id', saved_membership.id,
    'shop_id', saved_membership.shop_id,
    'user_id', saved_membership.user_id,
    'role', saved_membership.role,
    'display_name', saved_membership.display_name,
    'effective_member_access', true,
    'created_at', saved_membership.created_at,
    'updated_at', saved_membership.updated_at
  );
end;
$$;

revoke all on function public.bootstrap_current_user_as_owner(text) from public, anon;
grant execute on function public.bootstrap_current_user_as_owner(text) to authenticated;
