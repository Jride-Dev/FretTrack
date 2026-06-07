create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  description text,
  event_type text not null check (event_type in ('intake', 'pickup', 'due', 'follow_up', 'shop_block', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'missed')),
  location text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedule_events_shop_id_idx on public.schedule_events (shop_id);
create index if not exists schedule_events_shop_starts_at_idx on public.schedule_events (shop_id, starts_at);
create index if not exists schedule_events_shop_event_type_idx on public.schedule_events (shop_id, event_type);
create index if not exists schedule_events_shop_status_idx on public.schedule_events (shop_id, status);
create index if not exists schedule_events_shop_job_idx on public.schedule_events (shop_id, job_id);
create index if not exists schedule_events_shop_customer_idx on public.schedule_events (shop_id, customer_id);

drop trigger if exists schedule_events_set_updated_at on public.schedule_events;
create trigger schedule_events_set_updated_at
  before update on public.schedule_events
  for each row
  execute function public.set_updated_at();

alter table public.schedule_events enable row level security;

drop policy if exists "schedule_events_select_member" on public.schedule_events;
create policy "schedule_events_select_member"
  on public.schedule_events
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

drop policy if exists "schedule_events_insert_writer" on public.schedule_events;
create policy "schedule_events_insert_writer"
  on public.schedule_events
  for insert
  to authenticated
  with check (private.can_write_shop(shop_id));

drop policy if exists "schedule_events_update_writer" on public.schedule_events;
create policy "schedule_events_update_writer"
  on public.schedule_events
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (private.can_write_shop(shop_id));

drop policy if exists "schedule_events_delete_writer" on public.schedule_events;
create policy "schedule_events_delete_writer"
  on public.schedule_events
  for delete
  to authenticated
  using (private.can_write_shop(shop_id));

revoke all on public.schedule_events from anon;
grant select, insert, update, delete on public.schedule_events to authenticated;
