alter table public.system_announcements
  add column if not exists notice_type text not null default 'information'
    check (notice_type in ('information', 'maintenance', 'degraded', 'outage', 'warning', 'recovery')),
  add column if not exists is_status_notice boolean not null default false;

create table if not exists public.system_status (
  singleton_key text primary key default 'current' check (singleton_key = 'current'),
  status text not null default 'operational'
    check (status in ('operational', 'maintenance', 'degraded', 'outage')),
  public_notice_title text not null default 'All systems operational',
  public_notice_message text not null default 'FretTrack services are operating normally.',
  notice_type text not null default 'recovery'
    check (notice_type in ('maintenance', 'degraded', 'outage', 'warning', 'recovery')),
  status_changed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  latest_announcement_id uuid null references public.system_announcements(id) on delete set null
);

alter table public.system_status enable row level security;

insert into public.system_status (singleton_key)
values ('current')
on conflict (singleton_key) do nothing;

revoke all on public.system_status from public, anon, authenticated;

create or replace function public.get_public_system_status()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'status', system_status.status,
    'publicNoticeTitle', system_status.public_notice_title,
    'publicNoticeMessage', system_status.public_notice_message,
    'noticeType', system_status.notice_type,
    'statusChangedAt', system_status.status_changed_at,
    'lastUpdatedAt', system_status.updated_at,
    'incidentState', system_status.status <> 'operational'
  )
  from public.system_status
  where singleton_key = 'current';
$$;

create or replace function public.update_system_status(
  next_status text,
  next_notice_title text,
  next_notice_message text,
  next_notice_type text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, private, auth, pg_catalog
as $$
declare
  current_status public.system_status%rowtype;
  resolved_notice_type text;
  resolved_severity text;
  next_status_changed_at timestamptz;
  announcement_id uuid;
begin
  if not private.is_operator() then
    raise exception 'Not allowed to update system status.';
  end if;

  if next_status not in ('operational', 'maintenance', 'degraded', 'outage') then
    raise exception 'Invalid system status.';
  end if;

  if nullif(btrim(next_notice_title), '') is null
    or nullif(btrim(next_notice_message), '') is null then
    raise exception 'A public notice title and message are required.';
  end if;

  if char_length(btrim(next_notice_title)) > 160
    or char_length(btrim(next_notice_message)) > 1200 then
    raise exception 'The public notice is too long.';
  end if;

  select *
  into current_status
  from public.system_status
  where singleton_key = 'current'
  for update;

  resolved_notice_type := case
    when next_status = 'maintenance' then 'maintenance'
    when next_status = 'degraded' then 'degraded'
    when next_status = 'outage' then 'outage'
    when current_status.status <> 'operational' then 'recovery'
    when next_notice_type in ('warning', 'recovery') then next_notice_type
    else 'warning'
  end;

  resolved_severity := case
    when resolved_notice_type in ('outage', 'warning') then 'urgent'
    when resolved_notice_type in ('maintenance', 'degraded') then 'warning'
    else 'info'
  end;

  next_status_changed_at := case
    when current_status.status is distinct from next_status then now()
    else current_status.status_changed_at
  end;

  update public.system_announcements
  set ends_at = now(),
      updated_at = now()
  where is_status_notice = true
    and ends_at is null;

  insert into public.system_announcements (
    title,
    message,
    severity,
    notice_type,
    is_status_notice,
    starts_at,
    created_by
  )
  values (
    btrim(next_notice_title),
    btrim(next_notice_message),
    resolved_severity,
    resolved_notice_type,
    true,
    now(),
    auth.uid()
  )
  returning id into announcement_id;

  update public.system_status
  set status = next_status,
      public_notice_title = btrim(next_notice_title),
      public_notice_message = btrim(next_notice_message),
      notice_type = resolved_notice_type,
      status_changed_at = next_status_changed_at,
      updated_at = now(),
      latest_announcement_id = announcement_id
  where singleton_key = 'current';

  return public.get_public_system_status();
end;
$$;

revoke all on function public.get_public_system_status() from public, anon, authenticated;
grant execute on function public.get_public_system_status() to anon, authenticated;

revoke all on function public.update_system_status(text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_system_status(text, text, text, text) to authenticated;
