insert into public.plan_entitlements (plan_id, key, value)
values
  ('free', 'photo_editor', 'false'::jsonb),
  ('free', 'advanced_reporting', 'false'::jsonb),
  ('free', 'team_members', 'false'::jsonb),
  ('pro', 'core_jobs', 'true'::jsonb),
  ('pro', 'customers', 'true'::jsonb),
  ('pro', 'photos', 'true'::jsonb),
  ('pro', 'reports', 'true'::jsonb),
  ('pro', 'csv_export', 'true'::jsonb),
  ('pro', 'email_messages', 'true'::jsonb),
  ('pro', 'sms_messages', 'false'::jsonb),
  ('pro', 'scheduling', 'true'::jsonb),
  ('pro', 'damage_maps', 'true'::jsonb),
  ('pro', 'work_logs', 'true'::jsonb),
  ('pro', 'printing', 'true'::jsonb),
  ('pro', 'mobile_pwa', 'true'::jsonb),
  ('pro', 'inventory', 'true'::jsonb),
  ('pro', 'advanced_accounting', 'false'::jsonb),
  ('pro', 'photo_editor', 'true'::jsonb),
  ('pro', 'advanced_reporting', 'true'::jsonb),
  ('pro', 'team_members', 'true'::jsonb),
  ('pro', 'business_analytics', 'false'::jsonb),
  ('pro', 'inventory_analytics', 'false'::jsonb),
  ('pro', 'revenue_dashboards', 'false'::jsonb),
  ('pro', 'backup_tools', 'false'::jsonb),
  ('pro', 'additional_storage', 'false'::jsonb),
  ('pro', 'customer_portal', 'false'::jsonb),
  ('pro', 'public_job_status_links', 'false'::jsonb),
  ('pro', 'public_invoice_links', 'false'::jsonb),
  ('pro', 'api_access', 'false'::jsonb),
  ('pro', 'advanced_branding', 'false'::jsonb),
  ('pro', 'custom_branding', 'false'::jsonb),
  ('pro', 'advanced_inventory_workflows', 'false'::jsonb),
  ('pro', 'multi_location', 'false'::jsonb),
  ('pro', 'cross_location_inventory', 'false'::jsonb),
  ('pro', 'centralized_reporting', 'false'::jsonb),
  ('pro', 'enterprise_administration', 'false'::jsonb),
  ('pro', 'monthly_sms_limit', '0'::jsonb),
  ('enterprise', 'photo_editor', 'true'::jsonb),
  ('enterprise', 'advanced_reporting', 'true'::jsonb),
  ('enterprise', 'team_members', 'true'::jsonb),
  ('trial', 'photo_editor', 'false'::jsonb),
  ('trial', 'advanced_reporting', 'false'::jsonb),
  ('trial', 'team_members', 'false'::jsonb)
on conflict (plan_id, key) do update
set
  value = excluded.value,
  updated_at = now();

create or replace function private.shop_has_entitlement(target_shop_id text, entitlement_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_row public.shop_profiles%rowtype;
  subscription_row public.shop_subscriptions%rowtype;
  stored_status text;
  stored_tier text;
  entitlement_plan_id text;
  entitlement_value jsonb;
  profile_override jsonb;
  override_value jsonb;
  trial_expired boolean := false;
begin
  select *
  into profile_row
  from public.shop_profiles
  where shop_id = target_shop_id;

  if profile_row.shop_id is null then
    return false;
  end if;

  select *
  into subscription_row
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  stored_status := coalesce(nullif(subscription_row.status, ''), nullif(profile_row.subscription_status, ''), 'active');
  stored_tier := coalesce(nullif(subscription_row.plan_id, ''), nullif(profile_row.subscription_tier, ''), 'free');
  trial_expired := stored_status = 'trialing'
    and coalesce(subscription_row.trial_ends_at, profile_row.trial_ends_at) is not null
    and coalesce(subscription_row.trial_ends_at, profile_row.trial_ends_at) < now();

  entitlement_plan_id := case
    when trial_expired then 'free'
    when stored_tier in ('free', 'solo', 'pro', 'enterprise', 'trial') then stored_tier
    else 'free'
  end;

  select value
  into entitlement_value
  from public.plan_entitlements
  where plan_id = entitlement_plan_id
    and key = entitlement_key;

  if trial_expired then
    return coalesce((entitlement_value::text)::boolean, false);
  end if;

  profile_override := profile_row.feature_overrides -> entitlement_key;

  select value
  into override_value
  from public.shop_entitlement_overrides
  where shop_id = target_shop_id
    and key = entitlement_key
    and (expires_at is null or expires_at > now());

  if override_value is not null then
    return coalesce((override_value::text)::boolean, false);
  end if;

  if profile_override is not null then
    return coalesce((profile_override::text)::boolean, false);
  end if;

  return coalesce((entitlement_value::text)::boolean, false);
end;
$$;

create or replace function private.shop_lifecycle_allows_write(target_shop_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_row public.shop_profiles%rowtype;
  subscription_row public.shop_subscriptions%rowtype;
  stored_status text;
begin
  select *
  into profile_row
  from public.shop_profiles
  where shop_id = target_shop_id;

  if profile_row.shop_id is null then
    return false;
  end if;

  select *
  into subscription_row
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  stored_status := coalesce(nullif(subscription_row.status, ''), nullif(profile_row.subscription_status, ''), 'active');
  return stored_status not in ('read_only', 'canceled', 'cancelled');
end;
$$;

create or replace function private.has_preserved_shop_membership(target_shop_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_members
    where shop_id = target_shop_id
      and user_id = auth.uid()
  );
$$;

create or replace function private.is_shop_member(target_shop_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_members
    where shop_id = target_shop_id
      and user_id = auth.uid()
      and (
        role = 'owner'
        or private.shop_has_entitlement(target_shop_id, 'team_members')
      )
  );
$$;

create or replace function private.has_shop_role(target_shop_id text, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_members
    where shop_id = target_shop_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
      and (
        role = 'owner'
        or private.shop_has_entitlement(target_shop_id, 'team_members')
      )
  );
$$;

create or replace function private.can_write_shop(target_shop_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.shop_lifecycle_allows_write(target_shop_id)
    and private.has_shop_role(target_shop_id, array['owner', 'admin', 'tech']);
$$;

create or replace function private.can_admin_shop(target_shop_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_shop_role(target_shop_id, array['owner', 'admin']);
$$;

create or replace function private.can_write_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs
    where jobs.id = target_job_id
      and private.can_write_shop(jobs.shop_id)
  );
$$;

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
    where jobs.id = target_job_id
      and private.is_shop_member(jobs.shop_id)
  );
$$;

create or replace function private.can_admin_job(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs
    where jobs.id = target_job_id
      and private.shop_lifecycle_allows_write(jobs.shop_id)
      and private.can_admin_shop(jobs.shop_id)
  );
$$;

drop policy if exists "jobs_delete_shop_admin" on public.jobs;
create policy "jobs_delete_shop_admin"
  on public.jobs
  for delete
  to authenticated
  using (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  );

drop policy if exists "customers_delete_admin_without_jobs" on public.customers;
create policy "customers_delete_admin_without_jobs"
  on public.customers
  for delete
  to authenticated
  using (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
    and not exists (
      select 1
      from public.jobs
      where jobs.customer_id = customers.id
    )
  );

drop policy if exists "parts_delete_admin" on public.parts;
create policy "parts_delete_admin"
  on public.parts
  for delete
  to authenticated
  using (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  );

drop policy if exists "shop_profiles_update_admin" on public.shop_profiles;
create policy "shop_profiles_update_admin"
  on public.shop_profiles
  for update
  to authenticated
  using (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  )
  with check (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  );

drop policy if exists "shop_profiles_delete_admin" on public.shop_profiles;
create policy "shop_profiles_delete_admin"
  on public.shop_profiles
  for delete
  to authenticated
  using (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  );

drop policy if exists "shop_assets_storage_insert_admin" on storage.objects;
create policy "shop_assets_storage_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'shop-assets'
    and private.can_admin_shop((storage.foldername(name))[1])
    and private.shop_lifecycle_allows_write((storage.foldername(name))[1])
  );

drop policy if exists "shop_assets_storage_update_admin" on storage.objects;
create policy "shop_assets_storage_update_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'shop-assets'
    and private.can_admin_shop((storage.foldername(name))[1])
    and private.shop_lifecycle_allows_write((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'shop-assets'
    and private.can_admin_shop((storage.foldername(name))[1])
    and private.shop_lifecycle_allows_write((storage.foldername(name))[1])
  );

drop policy if exists "shop_assets_storage_delete_admin" on storage.objects;
create policy "shop_assets_storage_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'shop-assets'
    and private.can_admin_shop((storage.foldername(name))[1])
    and private.shop_lifecycle_allows_write((storage.foldername(name))[1])
  );

drop policy if exists "tax_profiles_insert_admin" on public.tax_profiles;
create policy "tax_profiles_insert_admin"
  on public.tax_profiles
  for insert
  to authenticated
  with check (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  );

drop policy if exists "tax_profiles_update_admin" on public.tax_profiles;
create policy "tax_profiles_update_admin"
  on public.tax_profiles
  for update
  to authenticated
  using (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  )
  with check (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  );

drop policy if exists "tax_profiles_delete_admin" on public.tax_profiles;
create policy "tax_profiles_delete_admin"
  on public.tax_profiles
  for delete
  to authenticated
  using (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  );

drop policy if exists "payment_methods_insert_admin" on public.payment_methods;
create policy "payment_methods_insert_admin"
  on public.payment_methods
  for insert
  to authenticated
  with check (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  );

drop policy if exists "payment_methods_update_admin" on public.payment_methods;
create policy "payment_methods_update_admin"
  on public.payment_methods
  for update
  to authenticated
  using (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  )
  with check (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  );

drop policy if exists "payment_methods_delete_admin" on public.payment_methods;
create policy "payment_methods_delete_admin"
  on public.payment_methods
  for delete
  to authenticated
  using (
    private.can_admin_shop(shop_id)
    and private.shop_lifecycle_allows_write(shop_id)
  );

drop policy if exists "shop_members_insert_admin" on public.shop_members;
create policy "shop_members_insert_admin"
  on public.shop_members
  for insert
  to authenticated
  with check (
    private.has_shop_role(shop_id, array['owner', 'admin'])
    and private.shop_has_entitlement(shop_id, 'team_members')
  );

drop policy if exists "shop_members_update_admin" on public.shop_members;
create policy "shop_members_update_admin"
  on public.shop_members
  for update
  to authenticated
  using (
    private.has_shop_role(shop_id, array['owner', 'admin'])
    and private.shop_has_entitlement(shop_id, 'team_members')
  )
  with check (
    private.has_shop_role(shop_id, array['owner', 'admin'])
    and private.shop_has_entitlement(shop_id, 'team_members')
  );

drop policy if exists "shop_members_delete_owner" on public.shop_members;
create policy "shop_members_delete_owner"
  on public.shop_members
  for delete
  to authenticated
  using (
    private.has_shop_role(shop_id, array['owner'])
    and private.shop_has_entitlement(shop_id, 'team_members')
  );

create or replace function public.get_current_user_shop_memberships()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  payload jsonb;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', shop_members.id,
        'shop_id', shop_members.shop_id,
        'shop_name', coalesce(shop_profiles.shop_name, shop_members.shop_id),
        'user_id', shop_members.user_id,
        'role', shop_members.role,
        'display_name', shop_members.display_name,
        'effective_member_access', shop_members.role = 'owner'
          or private.shop_has_entitlement(shop_members.shop_id, 'team_members'),
        'created_at', shop_members.created_at,
        'updated_at', shop_members.updated_at
      )
      order by shop_members.created_at
    ),
    '[]'::jsonb
  )
  into payload
  from public.shop_members
  left join public.shop_profiles on shop_profiles.shop_id = shop_members.shop_id
  where shop_members.user_id = auth.uid();

  return payload;
end;
$$;

create or replace function private.get_shop_members(target_shop_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  payload jsonb;
  team_members_enabled boolean;
begin
  if not private.can_admin_shop(target_shop_id) then
    raise exception 'Not allowed to view shop members.'
      using errcode = '42501';
  end if;

  team_members_enabled := private.shop_has_entitlement(target_shop_id, 'team_members');

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
          when shop_members.role <> 'owner' and not team_members_enabled then 'pro_locked'
          else 'active'
        end,
        'effective_member_access', shop_members.role = 'owner' or team_members_enabled,
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

  if not private.shop_has_entitlement(target_shop_id, 'team_members') then
    raise exception 'Team member management is available on Pro.'
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
    'effectiveMemberAccess', true,
    'createdAt', saved_membership.created_at,
    'updatedAt', saved_membership.updated_at
  );
end;
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

  if not private.shop_has_entitlement(existing_membership.shop_id, 'team_members') then
    raise exception 'Team member management is available on Pro.'
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
    'effectiveMemberAccess', true,
    'createdAt', saved_membership.created_at,
    'updatedAt', saved_membership.updated_at
  );
end;
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

  if not private.shop_has_entitlement(existing_membership.shop_id, 'team_members') then
    raise exception 'Team member management is available on Pro.'
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

create or replace function public.get_shop_entitlement_snapshot(target_shop_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  profile_row public.shop_profiles%rowtype;
  subscription_row public.shop_subscriptions%rowtype;
  plan_row public.plans%rowtype;
  entitlement_values jsonb := '{}'::jsonb;
  profile_override_values jsonb := '{}'::jsonb;
  override_values jsonb := '{}'::jsonb;
  effective_entitlements jsonb := '{}'::jsonb;
  effective_status text;
  stored_status text;
  stored_tier text;
  effective_tier text;
  entitlement_plan_id text;
  can_write boolean;
  trial_expired boolean := false;
  user_count_value integer := 0;
  job_count_value integer := 0;
  email_count_value integer := 0;
  sms_count_value integer := 0;
  storage_bytes_value bigint := 0;
  latest_usage public.shop_usage_snapshots%rowtype;
begin
  if not private.is_shop_member(target_shop_id) and not private.is_operator() then
    raise exception 'Not allowed to read shop entitlements.';
  end if;

  select *
  into profile_row
  from public.shop_profiles
  where shop_id = target_shop_id;

  if profile_row.shop_id is null then
    raise exception 'Shop not found.';
  end if;

  profile_override_values := coalesce(profile_row.feature_overrides, '{}'::jsonb);

  select *
  into subscription_row
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  if subscription_row.shop_id is null then
    subscription_row.shop_id := target_shop_id;
    subscription_row.plan_id := coalesce(nullif(profile_row.subscription_tier, ''), 'free');
    subscription_row.status := coalesce(nullif(profile_row.subscription_status, ''), 'active');
    subscription_row.trial_ends_at := profile_row.trial_ends_at;
    subscription_row.grace_ends_at := null;
    subscription_row.billing_email := '';
  end if;

  stored_status := coalesce(nullif(subscription_row.status, ''), 'active');
  stored_tier := coalesce(nullif(subscription_row.plan_id, ''), nullif(profile_row.subscription_tier, ''), 'free');
  trial_expired := stored_status = 'trialing'
    and subscription_row.trial_ends_at is not null
    and subscription_row.trial_ends_at < now();

  if stored_status = 'trialing' and trial_expired then
    effective_status := 'expired';
    effective_tier := 'free';
    entitlement_plan_id := 'free';
  elsif stored_status in ('read_only', 'canceled', 'cancelled') then
    effective_status := 'read_only';
    effective_tier := stored_tier;
    entitlement_plan_id := stored_tier;
  else
    effective_status := stored_status;
    effective_tier := stored_tier;
    entitlement_plan_id := stored_tier;
  end if;

  if effective_tier not in ('free', 'solo', 'pro', 'enterprise') then
    effective_tier := 'free';
  end if;

  if entitlement_plan_id not in ('free', 'solo', 'pro', 'enterprise', 'trial') then
    entitlement_plan_id := 'free';
  end if;

  select *
  into plan_row
  from public.plans
  where id = entitlement_plan_id;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  into entitlement_values
  from public.plan_entitlements
  where plan_id = entitlement_plan_id;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  into override_values
  from public.shop_entitlement_overrides
  where shop_id = target_shop_id
    and (expires_at is null or expires_at > now());

  if trial_expired then
    effective_entitlements := entitlement_values;
  else
    effective_entitlements := entitlement_values || profile_override_values || override_values;
  end if;
  can_write := effective_status not in ('read_only', 'canceled', 'cancelled');

  select count(*)::integer
  into user_count_value
  from public.shop_members
  where shop_id = target_shop_id;

  select count(*)::integer
  into job_count_value
  from public.jobs
  where shop_id = target_shop_id;

  select count(*)::integer
  into email_count_value
  from public.customer_messages
  join public.jobs on jobs.id = customer_messages.job_id
  where jobs.shop_id = target_shop_id
    and customer_messages.channel = 'email'
    and customer_messages.created_at >= date_trunc('month', now());

  select count(*)::integer
  into sms_count_value
  from public.customer_messages
  join public.jobs on jobs.id = customer_messages.job_id
  where jobs.shop_id = target_shop_id
    and customer_messages.channel = 'sms'
    and customer_messages.created_at >= date_trunc('month', now());

  select coalesce(sum((storage.objects.metadata->>'size')::bigint), 0)
  into storage_bytes_value
  from storage.objects
  join public.job_images on job_images.storage_path = storage.objects.name
  join public.jobs on jobs.id = job_images.job_id
  where storage.objects.bucket_id = 'job-images'
    and jobs.shop_id = target_shop_id
    and storage.objects.metadata ? 'size';

  select *
  into latest_usage
  from public.shop_usage_snapshots
  where shop_id = target_shop_id
  order by measured_at desc
  limit 1;

  if latest_usage.shop_id is not null then
    storage_bytes_value := greatest(storage_bytes_value, latest_usage.storage_bytes);
  end if;

  return jsonb_build_object(
    'shopId', target_shop_id,
    'plan', jsonb_build_object(
      'id', coalesce(plan_row.id, entitlement_plan_id, 'free'),
      'name', coalesce(plan_row.name, initcap(coalesce(entitlement_plan_id, 'free'))),
      'status', coalesce(plan_row.status, 'active')
    ),
    'subscription', jsonb_build_object(
      'tier', stored_tier,
      'status', stored_status,
      'profileStatus', coalesce(profile_row.subscription_status, 'active'),
      'effectiveStatus', effective_status,
      'effectiveTier', effective_tier,
      'trialEndsAt', coalesce(subscription_row.trial_ends_at, profile_row.trial_ends_at),
      'currentPeriodEndsAt', subscription_row.current_period_ends_at,
      'graceEndsAt', subscription_row.grace_ends_at,
      'billingEmail', subscription_row.billing_email
    ),
    'entitlements', effective_entitlements,
    'featureOverrides', profile_override_values,
    'usage', jsonb_build_object(
      'userCount', user_count_value,
      'storageBytes', storage_bytes_value,
      'jobCount', job_count_value,
      'emailCountMonth', email_count_value,
      'smsCountMonth', sms_count_value
    ),
    'access', jsonb_build_object(
      'canWrite', can_write,
      'readOnly', not can_write,
      'canUploadPhotos', can_write and coalesce((effective_entitlements->>'photos')::boolean, true),
      'canSendEmail', can_write and coalesce((effective_entitlements->>'email_messages')::boolean, true),
      'canSendSms', can_write and coalesce((effective_entitlements->>'sms_messages')::boolean, false),
      'canUseReports', coalesce((effective_entitlements->>'reports')::boolean, true),
      'canExportCsv', coalesce((effective_entitlements->>'csv_export')::boolean, true),
      'canUsePhotoEditor', coalesce((effective_entitlements->>'photo_editor')::boolean, false),
      'canUseAdvancedReporting', coalesce((effective_entitlements->>'advanced_reporting')::boolean, false),
      'canManageTeamMembers', coalesce((effective_entitlements->>'team_members')::boolean, false),
      'canUseCustomerPortal', coalesce((effective_entitlements->>'customer_portal')::boolean, false),
      'canUseApi', coalesce((effective_entitlements->>'api_access')::boolean, false),
      'canUseCustomBranding', coalesce((effective_entitlements->>'custom_branding')::boolean, false),
      'canUseMultiLocation', coalesce((effective_entitlements->>'multi_location')::boolean, false)
    )
  );
end;
$$;

revoke all on function private.shop_has_entitlement(text, text) from public, anon;
revoke all on function private.shop_lifecycle_allows_write(text) from public, anon;
revoke all on function private.has_preserved_shop_membership(text) from public, anon;
revoke all on function public.get_current_user_shop_memberships() from public, anon;

grant execute on function private.shop_has_entitlement(text, text) to authenticated;
grant execute on function private.shop_lifecycle_allows_write(text) to authenticated;
grant execute on function private.has_preserved_shop_membership(text) to authenticated;
grant execute on function private.is_shop_member(text) to authenticated;
grant execute on function private.has_shop_role(text, text[]) to authenticated;
grant execute on function private.can_access_job(uuid) to authenticated;
grant execute on function private.can_write_shop(text) to authenticated;
grant execute on function private.can_admin_shop(text) to authenticated;
grant execute on function private.can_write_job(uuid) to authenticated;
grant execute on function private.can_admin_job(uuid) to authenticated;
grant execute on function public.get_current_user_shop_memberships() to authenticated;

revoke all on function public.get_shop_entitlement_snapshot(text) from public, anon;
grant execute on function public.get_shop_entitlement_snapshot(text) to authenticated;
