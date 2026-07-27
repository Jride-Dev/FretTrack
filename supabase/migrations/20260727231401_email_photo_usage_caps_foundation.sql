-- FretTrack 0.2.9-beta.3 Email and Photo Usage Caps Foundation.
-- UTC calendar months are authoritative until provider billing periods exist.

insert into public.plan_entitlements (plan_id, key, value)
values
  ('free', 'monthly_email_limit', '1000'::jsonb),
  ('free', 'monthly_photo_upload_limit', '2000'::jsonb),
  ('free', 'max_photo_storage_bytes', '5368709120'::jsonb),
  ('solo', 'monthly_email_limit', '1000'::jsonb),
  ('solo', 'monthly_photo_upload_limit', '2000'::jsonb),
  ('solo', 'max_photo_storage_bytes', '5368709120'::jsonb),
  ('shop', 'monthly_email_limit', '1000'::jsonb),
  ('shop', 'monthly_photo_upload_limit', '2000'::jsonb),
  ('shop', 'max_photo_storage_bytes', '5368709120'::jsonb),
  ('trial', 'monthly_email_limit', '1000'::jsonb),
  ('trial', 'monthly_photo_upload_limit', '2000'::jsonb),
  ('trial', 'max_photo_storage_bytes', '5368709120'::jsonb),
  ('pro', 'monthly_email_limit', '5000'::jsonb),
  ('pro', 'monthly_photo_upload_limit', '10000'::jsonb),
  ('pro', 'max_photo_storage_bytes', '26843545600'::jsonb),
  ('enterprise', 'monthly_email_limit', '25000'::jsonb),
  ('enterprise', 'monthly_photo_upload_limit', '50000'::jsonb),
  ('enterprise', 'max_photo_storage_bytes', '107374182400'::jsonb)
on conflict (plan_id, key) do update
set value = excluded.value,
    updated_at = now();

create table if not exists public.shop_usage_periods (
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  period_start date not null,
  period_end date not null,
  email_recipients_used bigint not null default 0 check (email_recipients_used >= 0),
  source_photos_uploaded bigint not null default 0 check (source_photos_uploaded >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shop_id, period_start),
  constraint shop_usage_period_month_start check (
    period_start = date_trunc('month', period_start::timestamp)::date
  ),
  constraint shop_usage_period_valid check (period_end = (period_start + interval '1 month')::date)
);

create table if not exists public.shop_photo_storage_totals (
  shop_id text primary key references public.shop_profiles(shop_id) on delete cascade,
  photo_storage_bytes bigint not null default 0 check (photo_storage_bytes >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_usage_reservations (
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  request_id uuid not null,
  usage_kind text not null check (usage_kind in ('email_recipients', 'source_photo', 'photo_derivative')),
  period_start date not null,
  reserved_units bigint not null default 0 check (reserved_units >= 0),
  reserved_storage_bytes bigint not null default 0 check (reserved_storage_bytes >= 0),
  target_bucket text,
  target_path text,
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  settled_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (shop_id, request_id),
  constraint shop_usage_reservation_target check (
    (usage_kind = 'email_recipients' and target_bucket is null and target_path is null and reserved_storage_bytes = 0)
    or
    (usage_kind in ('source_photo', 'photo_derivative') and target_bucket in ('job-images', 'part-images') and nullif(target_path, '') is not null)
  )
);

create table if not exists public.shop_photo_storage_objects (
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  bucket_id text not null,
  object_path text not null,
  storage_bytes bigint not null check (storage_bytes >= 0),
  source_upload boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (bucket_id, object_path)
);

create index if not exists shop_usage_reservations_active_idx
  on public.shop_usage_reservations (shop_id, period_start, usage_kind, expires_at)
  where status = 'reserved';

create index if not exists shop_photo_storage_objects_shop_idx
  on public.shop_photo_storage_objects (shop_id);

alter table public.shop_usage_periods enable row level security;
alter table public.shop_photo_storage_totals enable row level security;
alter table public.shop_usage_reservations enable row level security;
alter table public.shop_photo_storage_objects enable row level security;

create policy "shop_usage_periods_select_member"
  on public.shop_usage_periods for select to authenticated
  using (private.is_shop_member(shop_id) or private.is_operator());

create policy "shop_photo_storage_totals_select_member"
  on public.shop_photo_storage_totals for select to authenticated
  using (private.is_shop_member(shop_id) or private.is_operator());

revoke all on public.shop_usage_periods from public, anon, authenticated;
revoke all on public.shop_photo_storage_totals from public, anon, authenticated;
revoke all on public.shop_usage_reservations from public, anon, authenticated;
revoke all on public.shop_photo_storage_objects from public, anon, authenticated;
grant select on public.shop_usage_periods to authenticated;
grant select on public.shop_photo_storage_totals to authenticated;

create or replace function private.usage_month_start_utc()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', now() at time zone 'UTC')::date;
$$;

create or replace function private.safe_nonnegative_bigint(raw_value jsonb, fallback_value bigint)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed_value numeric;
begin
  if raw_value is null or jsonb_typeof(raw_value) not in ('number', 'string') then
    return fallback_value;
  end if;
  begin
    parsed_value := trim(both '"' from raw_value::text)::numeric;
  exception when others then
    return fallback_value;
  end;
  if parsed_value < 0 or parsed_value > 9223372036854775807 or trunc(parsed_value) <> parsed_value then
    return fallback_value;
  end if;
  return parsed_value::bigint;
end;
$$;

create or replace function private.get_shop_usage_limits(target_shop_id text)
returns table (
  monthly_email_limit bigint,
  monthly_photo_upload_limit bigint,
  max_photo_storage_bytes bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  plan_id_value text;
  plan_values jsonb := '{}'::jsonb;
  override_values jsonb := '{}'::jsonb;
begin
  select coalesce(
    nullif(subscriptions.plan_id, ''),
    nullif(profiles.subscription_tier, ''),
    'shop'
  )
  into plan_id_value
  from public.shop_profiles profiles
  left join public.shop_subscriptions subscriptions on subscriptions.shop_id = profiles.shop_id
  where profiles.shop_id = target_shop_id;

  if plan_id_value is null then
    raise exception 'Shop not found.';
  end if;
  if plan_id_value not in ('free', 'solo', 'shop', 'pro', 'enterprise', 'trial') then
    plan_id_value := 'shop';
  end if;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  into plan_values
  from public.plan_entitlements
  where plan_id = plan_id_value
    and key in ('monthly_email_limit', 'monthly_photo_upload_limit', 'max_photo_storage_bytes');

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  into override_values
  from public.shop_entitlement_overrides
  where shop_id = target_shop_id
    and key in ('monthly_email_limit', 'monthly_photo_upload_limit', 'max_photo_storage_bytes')
    and (expires_at is null or expires_at > now());

  return query select
    private.safe_nonnegative_bigint(override_values->'monthly_email_limit', private.safe_nonnegative_bigint(plan_values->'monthly_email_limit', 1000)),
    private.safe_nonnegative_bigint(override_values->'monthly_photo_upload_limit', private.safe_nonnegative_bigint(plan_values->'monthly_photo_upload_limit', 2000)),
    private.safe_nonnegative_bigint(override_values->'max_photo_storage_bytes', private.safe_nonnegative_bigint(plan_values->'max_photo_storage_bytes', 5368709120));
end;
$$;

create or replace function private.photo_path_belongs_to_shop(
  target_shop_id text,
  target_bucket text,
  target_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_bucket = 'job-images' then exists (
      select 1
      from public.jobs
      where jobs.shop_id = target_shop_id
        and jobs.id::text = split_part(target_path, '/', 1)
    )
    when target_bucket = 'part-images' then split_part(target_path, '/', 1) = target_shop_id
    else false
  end;
$$;

create or replace function private.can_reserve_shop_usage(target_shop_id text, usage_kind_value text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    ((select auth.jwt()->>'role') = 'service_role' and usage_kind_value = 'email_recipients')
    or (
      usage_kind_value in ('source_photo', 'photo_derivative')
      and private.can_write_shop(target_shop_id)
      and private.shop_lifecycle_allows_write(target_shop_id)
    );
$$;

create or replace function private.has_active_photo_usage_reservation(
  target_shop_id text,
  target_bucket text,
  target_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_usage_reservations reservations
    where reservations.shop_id = target_shop_id
      and reservations.usage_kind in ('source_photo', 'photo_derivative')
      and reservations.target_bucket = target_bucket
      and reservations.target_path = target_path
      and reservations.status = 'reserved'
      and reservations.expires_at > now()
  );
$$;

create or replace function public.reserve_shop_usage(
  target_shop_id text,
  target_request_id uuid,
  target_usage_kind text,
  requested_units bigint default 0,
  expected_storage_bytes bigint default 0,
  target_bucket text default null,
  target_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  month_start date := private.usage_month_start_utc();
  month_end date := (private.usage_month_start_utc() + interval '1 month')::date;
  usage_row public.shop_usage_periods%rowtype;
  storage_row public.shop_photo_storage_totals%rowtype;
  existing_reservation public.shop_usage_reservations%rowtype;
  limits record;
  active_units bigint := 0;
  active_storage bigint := 0;
  used_value bigint := 0;
  limit_value bigint := 0;
begin
  if target_request_id is null or target_shop_id is null or target_shop_id = '' then
    raise exception 'Explicit shop and request IDs are required.';
  end if;
  if target_usage_kind not in ('email_recipients', 'source_photo', 'photo_derivative')
    or requested_units < 0 or expected_storage_bytes < 0 then
    raise exception 'Invalid usage reservation.';
  end if;
  if target_usage_kind = 'email_recipients' and requested_units < 1 then
    raise exception 'At least one email recipient is required.';
  end if;
  if target_usage_kind = 'source_photo' and (requested_units <> 1 or expected_storage_bytes < 1) then
    raise exception 'A source photo reservation must count one upload and its bytes.';
  end if;
  if target_usage_kind = 'photo_derivative' and (requested_units <> 0 or expected_storage_bytes < 1) then
    raise exception 'A derivative reservation counts bytes but not a source upload.';
  end if;
  if not private.can_reserve_shop_usage(target_shop_id, target_usage_kind) then
    raise exception 'Not allowed to reserve shop usage.';
  end if;
  if target_usage_kind in ('source_photo', 'photo_derivative')
    and not private.photo_path_belongs_to_shop(target_shop_id, target_bucket, target_path) then
    raise exception 'Photo storage path does not belong to the requested shop.';
  end if;

  select * into existing_reservation
  from public.shop_usage_reservations
  where shop_id = target_shop_id and request_id = target_request_id;
  if found then
    return jsonb_build_object(
      'allowed', existing_reservation.status = 'settled'
        or (existing_reservation.status = 'reserved' and existing_reservation.expires_at > now()),
      'requestId', target_request_id,
      'status', existing_reservation.status,
      'idempotent', true
    );
  end if;

  insert into public.shop_usage_periods (shop_id, period_start, period_end)
  values (target_shop_id, month_start, month_end)
  on conflict (shop_id, period_start) do nothing;
  select * into usage_row
  from public.shop_usage_periods
  where shop_id = target_shop_id and period_start = month_start
  for update;

  insert into public.shop_photo_storage_totals (shop_id)
  values (target_shop_id)
  on conflict (shop_id) do nothing;
  select * into storage_row
  from public.shop_photo_storage_totals
  where shop_id = target_shop_id
  for update;

  -- Recheck after the serialized shop locks so concurrent retries with the
  -- same request ID remain idempotent instead of racing the primary key.
  select * into existing_reservation
  from public.shop_usage_reservations
  where shop_id = target_shop_id and request_id = target_request_id;
  if found then
    return jsonb_build_object(
      'allowed', existing_reservation.status = 'settled'
        or (existing_reservation.status = 'reserved' and existing_reservation.expires_at > now()),
      'requestId', target_request_id,
      'status', existing_reservation.status,
      'idempotent', true
    );
  end if;

  select * into limits from private.get_shop_usage_limits(target_shop_id);

  select
    coalesce(sum(case
      when target_usage_kind = 'email_recipients' and usage_kind = 'email_recipients' then reserved_units
      when target_usage_kind = 'source_photo' and usage_kind = 'source_photo' then reserved_units
      else 0 end), 0),
    coalesce(sum(case when usage_kind in ('source_photo', 'photo_derivative') then reserved_storage_bytes else 0 end), 0)
  into active_units, active_storage
  from public.shop_usage_reservations
  where shop_id = target_shop_id
    and period_start = month_start
    and status = 'reserved'
    and expires_at > now();

  if target_usage_kind = 'email_recipients' then
    used_value := usage_row.email_recipients_used;
    limit_value := limits.monthly_email_limit;
  elsif target_usage_kind = 'source_photo' then
    used_value := usage_row.source_photos_uploaded;
    limit_value := limits.monthly_photo_upload_limit;
  end if;

  if target_usage_kind <> 'photo_derivative' and used_value + active_units + requested_units > limit_value then
    return jsonb_build_object(
      'allowed', false,
      'code', case when target_usage_kind = 'email_recipients'
        then 'EMAIL_MONTHLY_LIMIT_REACHED'
        else 'PHOTO_MONTHLY_UPLOAD_LIMIT_REACHED' end,
      'limit', limit_value,
      'used', used_value,
      'remaining', greatest(limit_value - used_value - active_units, 0),
      'resetDate', month_end
    );
  end if;

  if target_usage_kind in ('source_photo', 'photo_derivative')
    and storage_row.photo_storage_bytes + active_storage + expected_storage_bytes > limits.max_photo_storage_bytes then
    return jsonb_build_object(
      'allowed', false,
      'code', 'PHOTO_STORAGE_LIMIT_REACHED',
      'limit', limits.max_photo_storage_bytes,
      'used', storage_row.photo_storage_bytes,
      'remaining', greatest(limits.max_photo_storage_bytes - storage_row.photo_storage_bytes - active_storage, 0)
    );
  end if;

  insert into public.shop_usage_reservations (
    shop_id, request_id, usage_kind, period_start, reserved_units,
    reserved_storage_bytes, target_bucket, target_path
  ) values (
    target_shop_id, target_request_id, target_usage_kind, month_start, requested_units,
    expected_storage_bytes, target_bucket, target_path
  );

  return jsonb_build_object(
    'allowed', true,
    'requestId', target_request_id,
    'status', 'reserved',
    'resetDate', month_end
  );
end;
$$;

create or replace function public.settle_shop_usage_reservation(
  target_shop_id text,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.shop_usage_reservations%rowtype;
  existing_object public.shop_photo_storage_objects%rowtype;
  actual_storage_bytes bigint;
begin
  select * into reservation_row
  from public.shop_usage_reservations
  where shop_id = target_shop_id and request_id = target_request_id
  for update;
  if not found then
    raise exception 'Usage reservation not found.';
  end if;
  if reservation_row.status = 'settled' then
    return jsonb_build_object('settled', true, 'idempotent', true);
  end if;
  if reservation_row.status <> 'reserved' or reservation_row.expires_at <= now() then
    raise exception 'Usage reservation is no longer active.';
  end if;
  if not private.can_reserve_shop_usage(target_shop_id, reservation_row.usage_kind) then
    raise exception 'Not allowed to settle shop usage.';
  end if;

  if reservation_row.usage_kind = 'email_recipients' then
    update public.shop_usage_periods
    set email_recipients_used = email_recipients_used + reservation_row.reserved_units,
        updated_at = now()
    where shop_id = target_shop_id and period_start = reservation_row.period_start;
  else
    select (metadata->>'size')::bigint
    into actual_storage_bytes
    from storage.objects
    where bucket_id = reservation_row.target_bucket
      and name = reservation_row.target_path;
    if actual_storage_bytes is null or actual_storage_bytes < 0 then
      raise exception 'Uploaded photo object was not found for settlement.';
    end if;

    select * into existing_object
    from public.shop_photo_storage_objects
    where bucket_id = reservation_row.target_bucket
      and object_path = reservation_row.target_path
    for update;

    insert into public.shop_photo_storage_objects (
      shop_id, bucket_id, object_path, storage_bytes, source_upload
    ) values (
      target_shop_id,
      reservation_row.target_bucket,
      reservation_row.target_path,
      actual_storage_bytes,
      reservation_row.usage_kind = 'source_photo'
    )
    on conflict (bucket_id, object_path) do update
    set shop_id = excluded.shop_id,
        storage_bytes = excluded.storage_bytes,
        source_upload = excluded.source_upload,
        updated_at = now();

    update public.shop_photo_storage_totals
    set photo_storage_bytes = greatest(
          0,
          photo_storage_bytes - coalesce(existing_object.storage_bytes, 0) + actual_storage_bytes
        ),
        updated_at = now()
    where shop_id = target_shop_id;

    if reservation_row.usage_kind = 'source_photo' then
      update public.shop_usage_periods
      set source_photos_uploaded = source_photos_uploaded + reservation_row.reserved_units,
          updated_at = now()
      where shop_id = target_shop_id and period_start = reservation_row.period_start;
    end if;
  end if;

  update public.shop_usage_reservations
  set status = 'settled', settled_at = now()
  where shop_id = target_shop_id and request_id = target_request_id;

  return jsonb_build_object('settled', true, 'idempotent', false);
end;
$$;

create or replace function public.release_shop_usage_reservation(
  target_shop_id text,
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.shop_usage_reservations%rowtype;
begin
  select * into reservation_row
  from public.shop_usage_reservations
  where shop_id = target_shop_id and request_id = target_request_id
  for update;
  if not found then
    return jsonb_build_object('released', true, 'idempotent', true);
  end if;
  if reservation_row.status = 'released' then
    return jsonb_build_object('released', true, 'idempotent', true);
  end if;
  if reservation_row.status = 'settled' then
    return jsonb_build_object('released', false, 'settled', true);
  end if;
  if not private.can_reserve_shop_usage(target_shop_id, reservation_row.usage_kind) then
    raise exception 'Not allowed to release shop usage.';
  end if;
  update public.shop_usage_reservations
  set status = 'released', released_at = now()
  where shop_id = target_shop_id and request_id = target_request_id;
  return jsonb_build_object('released', true, 'idempotent', false);
end;
$$;

create or replace function public.release_photo_storage_object(
  target_shop_id text,
  target_bucket text,
  target_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  object_row public.shop_photo_storage_objects%rowtype;
begin
  if not private.can_write_shop(target_shop_id)
    or not private.shop_lifecycle_allows_write(target_shop_id)
    or not private.photo_path_belongs_to_shop(target_shop_id, target_bucket, target_path) then
    raise exception 'Not allowed to release photo storage.';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id = target_bucket and name = target_path
  ) then
    raise exception 'Photo storage bytes cannot be released before successful deletion.';
  end if;

  select * into object_row
  from public.shop_photo_storage_objects
  where bucket_id = target_bucket and object_path = target_path and shop_id = target_shop_id
  for update;
  if not found then
    return jsonb_build_object('released', true, 'bytesReleased', 0, 'idempotent', true);
  end if;

  update public.shop_photo_storage_totals
  set photo_storage_bytes = greatest(0, photo_storage_bytes - object_row.storage_bytes),
      updated_at = now()
  where shop_id = target_shop_id;
  delete from public.shop_photo_storage_objects
  where bucket_id = target_bucket and object_path = target_path and shop_id = target_shop_id;
  return jsonb_build_object('released', true, 'bytesReleased', object_row.storage_bytes, 'idempotent', false);
end;
$$;

create or replace function public.get_shop_usage_snapshot(target_shop_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  month_start date := private.usage_month_start_utc();
  month_end date := (private.usage_month_start_utc() + interval '1 month')::date;
  usage_row public.shop_usage_periods%rowtype;
  storage_value bigint := 0;
  limits record;
begin
  if not private.is_shop_member(target_shop_id) and not private.is_operator() then
    raise exception 'Not allowed to read shop usage.';
  end if;
  select * into limits from private.get_shop_usage_limits(target_shop_id);
  select * into usage_row
  from public.shop_usage_periods
  where shop_id = target_shop_id and period_start = month_start;
  select coalesce(photo_storage_bytes, 0) into storage_value
  from public.shop_photo_storage_totals where shop_id = target_shop_id;

  return jsonb_build_object(
    'periodStart', month_start,
    'periodEnd', month_end,
    'resetDate', month_end,
    'emailRecipientsUsed', coalesce(usage_row.email_recipients_used, 0),
    'monthlyEmailLimit', limits.monthly_email_limit,
    'sourcePhotosUploaded', coalesce(usage_row.source_photos_uploaded, 0),
    'monthlyPhotoUploadLimit', limits.monthly_photo_upload_limit,
    'photoStorageBytes', coalesce(storage_value, 0),
    'maxPhotoStorageBytes', limits.max_photo_storage_bytes
  );
end;
$$;

-- Backfill the authoritative object ledger from existing repair-related buckets.
insert into public.shop_photo_storage_objects (shop_id, bucket_id, object_path, storage_bytes, source_upload)
select jobs.shop_id, objects.bucket_id, objects.name, (objects.metadata->>'size')::bigint, true
from storage.objects objects
join public.job_images images on images.storage_path = objects.name
join public.jobs jobs on jobs.id = images.job_id
where objects.bucket_id = 'job-images' and objects.metadata ? 'size'
on conflict (bucket_id, object_path) do update
set shop_id = excluded.shop_id, storage_bytes = excluded.storage_bytes, updated_at = now();

insert into public.shop_photo_storage_objects (shop_id, bucket_id, object_path, storage_bytes, source_upload)
select parts.shop_id, objects.bucket_id, objects.name, (objects.metadata->>'size')::bigint, true
from storage.objects objects
join public.parts parts on parts.image_path = objects.name
where objects.bucket_id = 'part-images' and objects.metadata ? 'size'
on conflict (bucket_id, object_path) do update
set shop_id = excluded.shop_id, storage_bytes = excluded.storage_bytes, updated_at = now();

insert into public.shop_photo_storage_totals (shop_id, photo_storage_bytes)
select profiles.shop_id, coalesce(sum(objects.storage_bytes), 0)::bigint
from public.shop_profiles profiles
left join public.shop_photo_storage_objects objects on objects.shop_id = profiles.shop_id
group by profiles.shop_id
on conflict (shop_id) do update
set photo_storage_bytes = excluded.photo_storage_bytes, updated_at = now();

-- Storage upload/update remains shop-scoped and now also requires an exact active reservation.
drop policy if exists "job_images_storage_insert_writer" on storage.objects;
create policy "job_images_storage_insert_writer"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'job-images'
    and private.can_write_job(((storage.foldername(name))[1])::uuid)
    and private.has_active_photo_usage_reservation(
      (select jobs.shop_id from public.jobs where jobs.id = ((storage.foldername(name))[1])::uuid),
      bucket_id,
      name
    )
  );

drop policy if exists "job_images_storage_update_writer" on storage.objects;
create policy "job_images_storage_update_writer"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'job-images'
    and private.can_write_job(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'job-images'
    and private.can_write_job(((storage.foldername(name))[1])::uuid)
    and private.has_active_photo_usage_reservation(
      (select jobs.shop_id from public.jobs where jobs.id = ((storage.foldername(name))[1])::uuid),
      bucket_id,
      name
    )
  );

drop policy if exists "part_images_storage_insert_writer" on storage.objects;
create policy "part_images_storage_insert_writer"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'part-images'
    and private.can_write_shop((storage.foldername(name))[1])
    and private.has_active_photo_usage_reservation((storage.foldername(name))[1], bucket_id, name)
  );

drop policy if exists "part_images_storage_update_writer" on storage.objects;
create policy "part_images_storage_update_writer"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'part-images'
    and private.can_write_shop((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'part-images'
    and private.can_write_shop((storage.foldername(name))[1])
    and private.has_active_photo_usage_reservation((storage.foldername(name))[1], bucket_id, name)
  );

revoke all on function private.usage_month_start_utc() from public, anon, authenticated;
revoke all on function private.safe_nonnegative_bigint(jsonb, bigint) from public, anon, authenticated;
revoke all on function private.get_shop_usage_limits(text) from public, anon, authenticated;
revoke all on function private.photo_path_belongs_to_shop(text, text, text) from public, anon, authenticated;
revoke all on function private.can_reserve_shop_usage(text, text) from public, anon, authenticated;
revoke all on function private.has_active_photo_usage_reservation(text, text, text) from public, anon, authenticated;
revoke all on function public.reserve_shop_usage(text, uuid, text, bigint, bigint, text, text) from public, anon, authenticated, service_role;
revoke all on function public.settle_shop_usage_reservation(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.release_shop_usage_reservation(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.release_photo_storage_object(text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.get_shop_usage_snapshot(text) from public, anon, authenticated, service_role;

grant execute on function private.has_active_photo_usage_reservation(text, text, text) to authenticated;
grant execute on function public.reserve_shop_usage(text, uuid, text, bigint, bigint, text, text) to authenticated, service_role;
grant execute on function public.settle_shop_usage_reservation(text, uuid) to authenticated, service_role;
grant execute on function public.release_shop_usage_reservation(text, uuid) to authenticated, service_role;
grant execute on function public.release_photo_storage_object(text, text, text) to authenticated;
grant execute on function public.get_shop_usage_snapshot(text) to authenticated;
