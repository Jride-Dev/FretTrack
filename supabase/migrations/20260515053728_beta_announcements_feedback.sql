create table if not exists public.system_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'urgent')),
  target_shop_id text null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists system_announcements_active_idx
  on public.system_announcements (starts_at, ends_at);

create index if not exists system_announcements_target_shop_idx
  on public.system_announcements (target_shop_id);

create table if not exists public.system_announcement_dismissals (
  announcement_id uuid not null references public.system_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists system_announcement_dismissals_user_idx
  on public.system_announcement_dismissals (user_id);

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null default '',
  feedback_type text not null default 'bug' check (feedback_type in ('bug', 'ux', 'print', 'data', 'security', 'other')),
  severity text not null default 'normal' check (severity in ('low', 'normal', 'high', 'blocker')),
  page_url text not null default '',
  subject text not null default '',
  message text not null,
  job_id uuid null,
  job_number text not null default '',
  browser_info jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'triaged', 'fixed', 'deferred', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists beta_feedback_shop_created_idx
  on public.beta_feedback (shop_id, created_at desc);

create index if not exists beta_feedback_status_idx
  on public.beta_feedback (status, created_at desc);

alter table public.system_announcements enable row level security;
alter table public.system_announcement_dismissals enable row level security;
alter table public.beta_feedback enable row level security;

drop policy if exists "system_announcements_select_targeted" on public.system_announcements;
create policy "system_announcements_select_targeted"
  on public.system_announcements
  for select
  to authenticated
  using (
    starts_at <= now()
    and (ends_at is null or ends_at > now())
    and (
      target_shop_id is null
      or private.is_shop_member(target_shop_id)
    )
  );

drop policy if exists "system_announcement_dismissals_select_own" on public.system_announcement_dismissals;
create policy "system_announcement_dismissals_select_own"
  on public.system_announcement_dismissals
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "system_announcement_dismissals_insert_own" on public.system_announcement_dismissals;
create policy "system_announcement_dismissals_insert_own"
  on public.system_announcement_dismissals
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "beta_feedback_insert_shop_member" on public.beta_feedback;
create policy "beta_feedback_insert_shop_member"
  on public.beta_feedback
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and private.is_shop_member(shop_id)
  );

drop policy if exists "beta_feedback_select_own" on public.beta_feedback;
create policy "beta_feedback_select_own"
  on public.beta_feedback
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.system_announcements to authenticated;
grant select, insert on public.system_announcement_dismissals to authenticated;
grant select, insert on public.beta_feedback to authenticated;
