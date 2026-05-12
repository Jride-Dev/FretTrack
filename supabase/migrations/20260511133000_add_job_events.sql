create table if not exists job_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null default 'default-shop',
  job_id uuid not null references jobs(id) on delete cascade,
  event_type text not null,
  event_label text not null,
  event_note text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists job_events_job_id_created_at_idx
on job_events (job_id, created_at desc);

create index if not exists job_events_shop_id_created_at_idx
on job_events (shop_id, created_at desc);

alter table job_events enable row level security;

drop policy if exists "job_events_select_public" on job_events;
create policy "job_events_select_public"
  on job_events
  for select
  to anon, authenticated
  using (true);

drop policy if exists "job_events_insert_public" on job_events;
create policy "job_events_insert_public"
  on job_events
  for insert
  to anon, authenticated
  with check (true);
