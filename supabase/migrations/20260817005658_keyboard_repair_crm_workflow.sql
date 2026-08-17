create table public.keyboard_key_states (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  midi_note smallint not null check (midi_note between 0 and 127),
  key_label text not null check (char_length(key_label) between 1 and 8),
  condition_status text not null default 'fault' check (condition_status in ('pass', 'fault', 'not_tested')),
  fault_code text not null default '',
  fault_category text not null default '',
  severity text not null default 'moderate' check (severity in ('minor', 'moderate', 'major')),
  velocity_min smallint check (velocity_min is null or velocity_min between 0 and 127),
  velocity_max smallint check (velocity_max is null or velocity_max between 0 and 127),
  notes text not null default '',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, midi_note),
  check (velocity_min is null or velocity_max is null or velocity_min <= velocity_max)
);

create index keyboard_key_states_job_updated_idx
  on public.keyboard_key_states (job_id, updated_at desc);

create index keyboard_key_states_fault_idx
  on public.keyboard_key_states (fault_code)
  where condition_status = 'fault' and fault_code <> '';

create table public.keyboard_part_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  key_state_id uuid references public.keyboard_key_states(id) on delete set null,
  inventory_part_id uuid references public.parts(id) on delete set null,
  requested_part text not null check (char_length(trim(requested_part)) between 1 and 160),
  quantity integer not null default 1 check (quantity between 1 and 999),
  request_status text not null default 'requested' check (request_status in ('requested', 'ordered', 'received', 'installed', 'not_needed')),
  notes text not null default '',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index keyboard_part_requests_job_status_idx
  on public.keyboard_part_requests (job_id, request_status, created_at desc);

drop trigger if exists keyboard_key_states_set_updated_at on public.keyboard_key_states;
create trigger keyboard_key_states_set_updated_at
  before update on public.keyboard_key_states
  for each row execute function public.set_updated_at();

drop trigger if exists keyboard_part_requests_set_updated_at on public.keyboard_part_requests;
create trigger keyboard_part_requests_set_updated_at
  before update on public.keyboard_part_requests
  for each row execute function public.set_updated_at();

alter table public.keyboard_key_states enable row level security;
alter table public.keyboard_part_requests enable row level security;

create policy "keyboard_key_states_select_member"
  on public.keyboard_key_states for select to authenticated
  using (private.can_access_job(job_id));

create policy "keyboard_key_states_insert_writer"
  on public.keyboard_key_states for insert to authenticated
  with check (
    private.can_write_job(job_id)
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.jobs
      where jobs.id = keyboard_key_states.job_id
        and lower(coalesce(jobs.tech_details ->> 'instrumentType', '')) = 'keyboard'
        and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')
    )
  );

create policy "keyboard_key_states_update_writer"
  on public.keyboard_key_states for update to authenticated
  using (
    private.can_write_job(job_id)
    and exists (
      select 1 from public.jobs
      where jobs.id = keyboard_key_states.job_id
        and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')
    )
  )
  with check (
    private.can_write_job(job_id)
    and exists (
      select 1 from public.jobs
      where jobs.id = keyboard_key_states.job_id
        and lower(coalesce(jobs.tech_details ->> 'instrumentType', '')) = 'keyboard'
        and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')
    )
  );

create policy "keyboard_key_states_delete_writer"
  on public.keyboard_key_states for delete to authenticated
  using (
    private.can_write_job(job_id)
    and exists (
      select 1 from public.jobs
      where jobs.id = keyboard_key_states.job_id
        and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')
    )
  );

create policy "keyboard_part_requests_select_member"
  on public.keyboard_part_requests for select to authenticated
  using (private.can_access_job(job_id));

create policy "keyboard_part_requests_insert_writer"
  on public.keyboard_part_requests for insert to authenticated
  with check (
    private.can_write_job(job_id)
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.jobs
      where jobs.id = keyboard_part_requests.job_id
        and lower(coalesce(jobs.tech_details ->> 'instrumentType', '')) = 'keyboard'
        and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')
    )
    and (
      key_state_id is null
      or exists (
        select 1 from public.keyboard_key_states
        where keyboard_key_states.id = keyboard_part_requests.key_state_id
          and keyboard_key_states.job_id = keyboard_part_requests.job_id
      )
    )
    and (
      inventory_part_id is null
      or exists (
        select 1
        from public.parts
        join public.jobs on jobs.id = keyboard_part_requests.job_id
        where parts.id = keyboard_part_requests.inventory_part_id
          and parts.shop_id = jobs.shop_id
      )
    )
  );

create policy "keyboard_part_requests_update_writer"
  on public.keyboard_part_requests for update to authenticated
  using (
    private.can_write_job(job_id)
    and exists (
      select 1 from public.jobs
      where jobs.id = keyboard_part_requests.job_id
        and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')
    )
  )
  with check (
    private.can_write_job(job_id)
    and exists (
      select 1 from public.jobs
      where jobs.id = keyboard_part_requests.job_id
        and lower(coalesce(jobs.tech_details ->> 'instrumentType', '')) = 'keyboard'
        and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')
    )
    and (
      key_state_id is null
      or exists (
        select 1 from public.keyboard_key_states
        where keyboard_key_states.id = keyboard_part_requests.key_state_id
          and keyboard_key_states.job_id = keyboard_part_requests.job_id
      )
    )
    and (
      inventory_part_id is null
      or exists (
        select 1
        from public.parts
        join public.jobs on jobs.id = keyboard_part_requests.job_id
        where parts.id = keyboard_part_requests.inventory_part_id
          and parts.shop_id = jobs.shop_id
      )
    )
  );

create policy "keyboard_part_requests_delete_writer"
  on public.keyboard_part_requests for delete to authenticated
  using (
    private.can_write_job(job_id)
    and exists (
      select 1 from public.jobs
      where jobs.id = keyboard_part_requests.job_id
        and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')
    )
  );

revoke all on public.keyboard_key_states, public.keyboard_part_requests from public, anon;
grant select, insert, update, delete on public.keyboard_key_states, public.keyboard_part_requests to authenticated, service_role;

comment on table public.keyboard_key_states is 'Per-key physical and electrical findings for Keyboard Repair work orders.';
comment on table public.keyboard_part_requests is 'Keyboard fault-driven parts requests linked to existing shop inventory when available.';
