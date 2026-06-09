create table if not exists public.photo_derivatives (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null default '',
  job_id uuid not null references public.jobs(id) on delete cascade,
  source_photo_id uuid references public.job_images(id) on delete set null,
  derivative_type text not null default 'edited' check (derivative_type in ('edited', 'background_removed', 'cropped', 'annotated')),
  storage_path text not null default '',
  public_url text not null default '',
  edit_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists photo_derivatives_job_created_idx
  on public.photo_derivatives (job_id, created_at desc);

create index if not exists photo_derivatives_source_photo_idx
  on public.photo_derivatives (source_photo_id);

alter table public.photo_derivatives enable row level security;

drop policy if exists "photo_derivatives_select_member" on public.photo_derivatives;
create policy "photo_derivatives_select_member"
  on public.photo_derivatives
  for select
  to authenticated
  using (private.can_access_job(job_id));

drop policy if exists "photo_derivatives_insert_writer" on public.photo_derivatives;
create policy "photo_derivatives_insert_writer"
  on public.photo_derivatives
  for insert
  to authenticated
  with check (private.can_write_job(job_id));

drop policy if exists "photo_derivatives_update_writer" on public.photo_derivatives;
create policy "photo_derivatives_update_writer"
  on public.photo_derivatives
  for update
  to authenticated
  using (private.can_write_job(job_id))
  with check (private.can_write_job(job_id));

drop policy if exists "photo_derivatives_delete_writer" on public.photo_derivatives;
create policy "photo_derivatives_delete_writer"
  on public.photo_derivatives
  for delete
  to authenticated
  using (private.can_write_job(job_id));
