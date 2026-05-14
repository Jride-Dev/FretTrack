create table if not exists shop_profiles (
  shop_id text primary key,
  shop_name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  logo_storage_path text not null default '',
  print_footer_text text not null default '',
  tax_state text not null default '',
  sales_tax_rate numeric(7,4) not null default 0 check (sales_tax_rate >= 0),
  taxable_parts_default boolean not null default true,
  taxable_services_default boolean not null default false,
  onboarded_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table shop_profiles enable row level security;

drop trigger if exists shop_profiles_set_updated_at on shop_profiles;
create trigger shop_profiles_set_updated_at
  before update on shop_profiles
  for each row
  execute function set_updated_at();

drop policy if exists "shop_profiles_select_member" on shop_profiles;
create policy "shop_profiles_select_member"
  on shop_profiles
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "shop_profiles_insert_admin" on shop_profiles;
create policy "shop_profiles_insert_admin"
  on shop_profiles
  for insert
  to authenticated
  with check (private.can_admin_shop(shop_id));

drop policy if exists "shop_profiles_update_admin" on shop_profiles;
create policy "shop_profiles_update_admin"
  on shop_profiles
  for update
  to authenticated
  using (private.can_admin_shop(shop_id))
  with check (private.can_admin_shop(shop_id));

drop policy if exists "shop_profiles_delete_admin" on shop_profiles;
create policy "shop_profiles_delete_admin"
  on shop_profiles
  for delete
  to authenticated
  using (private.can_admin_shop(shop_id));

insert into storage.buckets (id, name, public)
values ('shop-assets', 'shop-assets', false)
on conflict (id) do update
set public = false;

drop policy if exists "shop_assets_storage_select_member" on storage.objects;
create policy "shop_assets_storage_select_member"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'shop-assets'
    and private.is_shop_member((storage.foldername(name))[1])
  );

drop policy if exists "shop_assets_storage_insert_admin" on storage.objects;
create policy "shop_assets_storage_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'shop-assets'
    and private.can_admin_shop((storage.foldername(name))[1])
  );

drop policy if exists "shop_assets_storage_update_admin" on storage.objects;
create policy "shop_assets_storage_update_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'shop-assets'
    and private.can_admin_shop((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'shop-assets'
    and private.can_admin_shop((storage.foldername(name))[1])
  );

drop policy if exists "shop_assets_storage_delete_admin" on storage.objects;
create policy "shop_assets_storage_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'shop-assets'
    and private.can_admin_shop((storage.foldername(name))[1])
  );

revoke all on shop_profiles from anon;
grant select, insert, update, delete on shop_profiles to authenticated;
