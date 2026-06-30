alter table public.shop_profiles
  add column if not exists inventory_location_presets jsonb not null default '[]'::jsonb,
  add column if not exists inventory_category_presets jsonb not null default '[]'::jsonb,
  add column if not exists shipping_label_settings jsonb not null default '{"preset":"parts_bin_2_25x1_25"}'::jsonb;

alter table public.parts
  add column if not exists special_order boolean not null default false,
  add column if not exists image_path text,
  add column if not exists image_mime_type text,
  add column if not exists image_width integer,
  add column if not exists image_height integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shop_profiles_inventory_location_presets_array'
  ) then
    alter table public.shop_profiles
      add constraint shop_profiles_inventory_location_presets_array
      check (jsonb_typeof(inventory_location_presets) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shop_profiles_inventory_category_presets_array'
  ) then
    alter table public.shop_profiles
      add constraint shop_profiles_inventory_category_presets_array
      check (jsonb_typeof(inventory_category_presets) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shop_profiles_shipping_label_settings_object'
  ) then
    alter table public.shop_profiles
      add constraint shop_profiles_shipping_label_settings_object
      check (jsonb_typeof(shipping_label_settings) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'parts_image_dimensions_max_300'
  ) then
    alter table public.parts
      add constraint parts_image_dimensions_max_300
      check (
        (image_width is null or image_width between 1 and 300)
        and (image_height is null or image_height between 1 and 300)
      );
  end if;
end $$;

create index if not exists parts_special_order_idx
  on public.parts (shop_id, special_order);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'part-images',
  'part-images',
  false,
  262144,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 262144,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "part_images_storage_select_member" on storage.objects;
create policy "part_images_storage_select_member"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'part-images'
    and private.is_shop_member((storage.foldername(name))[1])
  );

drop policy if exists "part_images_storage_insert_writer" on storage.objects;
create policy "part_images_storage_insert_writer"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'part-images'
    and private.can_write_shop((storage.foldername(name))[1])
  );

drop policy if exists "part_images_storage_update_writer" on storage.objects;
create policy "part_images_storage_update_writer"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'part-images'
    and private.can_write_shop((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'part-images'
    and private.can_write_shop((storage.foldername(name))[1])
  );

drop policy if exists "part_images_storage_delete_writer" on storage.objects;
create policy "part_images_storage_delete_writer"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'part-images'
    and private.can_write_shop((storage.foldername(name))[1])
  );
