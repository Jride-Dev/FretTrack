alter table job_images
add column if not exists stored_filename text not null default '',
add column if not exists original_size_bytes bigint not null default 0,
add column if not exists optimized_size_bytes bigint not null default 0,
add column if not exists mime_type text not null default '',
add column if not exists width integer not null default 0,
add column if not exists height integer not null default 0,
add column if not exists optimization_version text not null default '';

update job_images
set
  stored_filename = coalesce(nullif(stored_filename, ''), file_name),
  mime_type = coalesce(nullif(mime_type, ''), 'image/jpeg')
where stored_filename = '' or mime_type = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_images_original_size_bytes_nonnegative'
  ) then
    alter table job_images
    add constraint job_images_original_size_bytes_nonnegative
    check (original_size_bytes >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_images_optimized_size_bytes_nonnegative'
  ) then
    alter table job_images
    add constraint job_images_optimized_size_bytes_nonnegative
    check (optimized_size_bytes >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_images_width_nonnegative'
  ) then
    alter table job_images
    add constraint job_images_width_nonnegative
    check (width >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_images_height_nonnegative'
  ) then
    alter table job_images
    add constraint job_images_height_nonnegative
    check (height >= 0);
  end if;
end;
$$;
