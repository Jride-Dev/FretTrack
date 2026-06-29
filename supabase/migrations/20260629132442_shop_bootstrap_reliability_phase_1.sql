drop function if exists public.bootstrap_current_user_as_owner(text);

create or replace function public.bootstrap_current_user_as_owner(
  target_shop_id text,
  target_shop_name text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, auth
as $$
declare
  normalized_shop_id text := lower(trim(coalesce(target_shop_id, '')));
  normalized_shop_name text := nullif(btrim(coalesce(target_shop_name, '')), '');
  current_user_id uuid := auth.uid();
  current_email text;
  current_email_confirmed_at timestamptz;
  saved_membership public.shop_members%rowtype;
  saved_profile public.shop_profiles%rowtype;
  saved_subscription public.shop_subscriptions%rowtype;
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

  if normalized_shop_name is null then
    normalized_shop_name := initcap(replace(normalized_shop_id, '-', ' '));
  end if;

  normalized_shop_name := left(normalized_shop_name, 160);

  if normalized_shop_name = '' then
    raise exception 'Shop name is required.';
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
  )
  or exists (
    select 1
    from public.shop_profiles
    where shop_id = normalized_shop_id
  ) then
    raise exception 'That shop workspace already exists.';
  end if;

  insert into public.shop_profiles (
    shop_id,
    shop_name,
    email,
    onboarded_at,
    created_by
  )
  values (
    normalized_shop_id,
    normalized_shop_name,
    coalesce(current_email, ''),
    now(),
    current_user_id
  )
  returning * into saved_profile;

  insert into public.shop_subscriptions (
    shop_id,
    plan_id,
    status,
    trial_ends_at,
    grace_ends_at,
    billing_email
  )
  values (
    normalized_shop_id,
    'trial',
    'trialing',
    now() + interval '30 days',
    now() + interval '44 days',
    coalesce(current_email, '')
  )
  on conflict (shop_id) do nothing;

  select *
  into saved_subscription
  from public.shop_subscriptions
  where shop_id = normalized_shop_id;

  if saved_subscription.shop_id is null then
    raise exception 'Unable to create shop subscription.';
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
    'shop_name', saved_profile.shop_name,
    'user_id', saved_membership.user_id,
    'role', saved_membership.role,
    'display_name', saved_membership.display_name,
    'effective_member_access', true,
    'created_at', saved_membership.created_at,
    'updated_at', saved_membership.updated_at,
    'profile', jsonb_build_object(
      'shop_id', saved_profile.shop_id,
      'shop_name', saved_profile.shop_name,
      'email', saved_profile.email,
      'created_by', saved_profile.created_by,
      'onboarded_at', saved_profile.onboarded_at,
      'created_at', saved_profile.created_at,
      'updated_at', saved_profile.updated_at
    ),
    'subscription', jsonb_build_object(
      'shop_id', saved_subscription.shop_id,
      'plan_id', saved_subscription.plan_id,
      'status', saved_subscription.status,
      'trial_ends_at', saved_subscription.trial_ends_at,
      'grace_ends_at', saved_subscription.grace_ends_at,
      'created_at', saved_subscription.created_at,
      'updated_at', saved_subscription.updated_at
    )
  );
end;
$$;

revoke all on function public.bootstrap_current_user_as_owner(text, text) from public;
revoke all on function public.bootstrap_current_user_as_owner(text, text) from anon;
revoke all on function public.bootstrap_current_user_as_owner(text, text) from authenticated;
grant execute on function public.bootstrap_current_user_as_owner(text, text) to authenticated;
