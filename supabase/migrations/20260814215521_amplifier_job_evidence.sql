insert into public.plan_entitlements (plan_id, key, value)
values
  ('free', 'amplifier_repair', 'false'::jsonb),
  ('solo', 'amplifier_repair', 'false'::jsonb),
  ('shop', 'amplifier_repair', 'false'::jsonb),
  ('pro', 'amplifier_repair', 'true'::jsonb),
  ('enterprise', 'amplifier_repair', 'true'::jsonb),
  ('trial', 'amplifier_repair', 'false'::jsonb)
on conflict (plan_id, key) do update
set value = excluded.value,
    updated_at = now();

create or replace function private.enforce_amplifier_repair_entitlement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_is_amplifier boolean := false;
  new_is_amplifier boolean := lower(coalesce(new.tech_details ->> 'instrumentType', '')) = 'amplifier';
begin
  if tg_op = 'UPDATE' then
    old_is_amplifier := lower(coalesce(old.tech_details ->> 'instrumentType', '')) = 'amplifier';
  end if;

  if (old_is_amplifier or new_is_amplifier)
    and not private.shop_has_entitlement(new.shop_id, 'amplifier_repair') then
    raise exception 'Amplifier Repair is available on Pro.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_amplifier_repair_entitlement() from public, anon, authenticated, service_role;

drop trigger if exists jobs_enforce_amplifier_repair_entitlement on public.jobs;
create trigger jobs_enforce_amplifier_repair_entitlement
  before insert or update on public.jobs
  for each row
  execute function private.enforce_amplifier_repair_entitlement();

create table if not exists public.job_evidence (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  evidence_kind text not null check (evidence_kind in ('audio', 'waveform', 'spectrum', 'other_image')),
  test_type text not null default 'other',
  storage_path text not null unique,
  file_name text not null default '',
  mime_type text not null default '',
  file_size_bytes bigint not null default 0 check (file_size_bytes > 0 and file_size_bytes <= 26214400),
  duration_seconds numeric(10, 2) check (duration_seconds is null or duration_seconds >= 0),
  notes text not null default '',
  captured_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists job_evidence_job_id_captured_at_idx
  on public.job_evidence (job_id, captured_at desc);

alter table public.job_evidence enable row level security;

drop policy if exists "job_evidence_select_member" on public.job_evidence;
create policy "job_evidence_select_member"
  on public.job_evidence
  for select
  to authenticated
  using (private.can_access_job(job_id));

drop policy if exists "job_evidence_insert_writer" on public.job_evidence;
create policy "job_evidence_insert_writer"
  on public.job_evidence
  for insert
  to authenticated
  with check (
    private.can_write_job(job_id)
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_evidence.job_id
        and private.shop_has_entitlement(jobs.shop_id, 'amplifier_repair')
    )
    and created_by = (select auth.uid())
  );

drop policy if exists "job_evidence_update_writer" on public.job_evidence;
create policy "job_evidence_update_writer"
  on public.job_evidence
  for update
  to authenticated
  using (
    private.can_write_job(job_id)
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_evidence.job_id
        and private.shop_has_entitlement(jobs.shop_id, 'amplifier_repair')
    )
  )
  with check (
    private.can_write_job(job_id)
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_evidence.job_id
        and private.shop_has_entitlement(jobs.shop_id, 'amplifier_repair')
    )
    and created_by = (select auth.uid())
  );

drop policy if exists "job_evidence_delete_writer" on public.job_evidence;
create policy "job_evidence_delete_writer"
  on public.job_evidence
  for delete
  to authenticated
  using (
    private.can_write_job(job_id)
    and exists (
      select 1
      from public.jobs
      where jobs.id = job_evidence.job_id
        and private.shop_has_entitlement(jobs.shop_id, 'amplifier_repair')
    )
  );

revoke all on public.job_evidence from anon;
grant select, insert, update, delete on public.job_evidence to authenticated;

alter table public.shop_usage_reservations
  drop constraint if exists shop_usage_reservation_target;

alter table public.shop_usage_reservations
  add constraint shop_usage_reservation_target check (
    (usage_kind = 'email_recipients' and target_bucket is null and target_path is null and reserved_storage_bytes = 0)
    or
    (usage_kind in ('source_photo', 'photo_derivative') and target_bucket in ('job-images', 'part-images', 'job-evidence') and nullif(target_path, '') is not null)
  );

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
    when target_bucket in ('job-images', 'job-evidence') then exists (
      select 1
      from public.jobs
      where jobs.shop_id = target_shop_id
        and jobs.id::text = split_part(target_path, '/', 1)
    )
    when target_bucket = 'part-images' then split_part(target_path, '/', 1) = target_shop_id
    else false
  end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-evidence',
  'job-evidence',
  false,
  26214400,
  array[
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/wav',
    'audio/x-wav',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "job_evidence_storage_select_member" on storage.objects;
create policy "job_evidence_storage_select_member"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'job-evidence'
    and private.can_access_job(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "job_evidence_storage_insert_writer" on storage.objects;
create policy "job_evidence_storage_insert_writer"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'job-evidence'
    and private.can_write_job(((storage.foldername(name))[1])::uuid)
    and exists (
      select 1
      from public.jobs
      where jobs.id = ((storage.foldername(name))[1])::uuid
        and private.shop_has_entitlement(jobs.shop_id, 'amplifier_repair')
    )
    and private.has_active_photo_usage_reservation(
      (select jobs.shop_id from public.jobs where jobs.id = ((storage.foldername(name))[1])::uuid),
      bucket_id,
      name
    )
  );

drop policy if exists "job_evidence_storage_update_writer" on storage.objects;
create policy "job_evidence_storage_update_writer"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'job-evidence'
    and private.can_write_job(((storage.foldername(name))[1])::uuid)
    and exists (
      select 1
      from public.jobs
      where jobs.id = ((storage.foldername(name))[1])::uuid
        and private.shop_has_entitlement(jobs.shop_id, 'amplifier_repair')
    )
  )
  with check (
    bucket_id = 'job-evidence'
    and private.can_write_job(((storage.foldername(name))[1])::uuid)
    and exists (
      select 1
      from public.jobs
      where jobs.id = ((storage.foldername(name))[1])::uuid
        and private.shop_has_entitlement(jobs.shop_id, 'amplifier_repair')
    )
    and private.has_active_photo_usage_reservation(
      (select jobs.shop_id from public.jobs where jobs.id = ((storage.foldername(name))[1])::uuid),
      bucket_id,
      name
    )
  );

drop policy if exists "job_evidence_storage_delete_writer" on storage.objects;
create policy "job_evidence_storage_delete_writer"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'job-evidence'
    and private.can_write_job(((storage.foldername(name))[1])::uuid)
    and exists (
      select 1
      from public.jobs
      where jobs.id = ((storage.foldername(name))[1])::uuid
        and private.shop_has_entitlement(jobs.shop_id, 'amplifier_repair')
    )
  );
