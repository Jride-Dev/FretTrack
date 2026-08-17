create table public.fault_codes (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,63}$'),
  label text not null check (char_length(trim(label)) between 2 and 80),
  category text not null check (category in ('mechanical', 'structural', 'electrical', 'sensor', 'contamination', 'other')),
  damage_status text not null check (damage_status in ('structural', 'electrical', 'dirty', 'clean')),
  overlay_tone text not null check (overlay_tone in ('dead', 'velocity', 'mechanical', 'dirty', 'good', 'neutral')),
  part_keywords text[] not null default '{}',
  default_group_size smallint check (default_group_size is null or default_group_size between 1 and 128),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.fault_codes (code, label, category, damage_status, overlay_tone, part_keywords, default_group_size) values
  ('stuck_key', 'Stuck Key', 'mechanical', 'structural', 'mechanical', array['key', 'spring', 'bushing'], null),
  ('stuck_note', 'Stuck Note', 'electrical', 'electrical', 'dead', array['rubber contact', 'contact strip', 'sensor'], 12),
  ('slow_return', 'Slow Key Return', 'mechanical', 'structural', 'mechanical', array['spring', 'felt', 'bushing'], null),
  ('uneven_key_height', 'Uneven Key Height', 'mechanical', 'structural', 'mechanical', array['felt', 'balance rail', 'key'], null),
  ('broken_keytop', 'Broken Keytop', 'structural', 'structural', 'dead', array['keytop', 'replacement key', 'key'], 1),
  ('broken_stem', 'Broken Key Stem', 'structural', 'structural', 'dead', array['replacement key', 'key stem', 'key'], 1),
  ('cracked_key_hinge', 'Cracked Key Hinge', 'structural', 'structural', 'dead', array['replacement key', 'hinge', 'key'], 1),
  ('noisy_key', 'Noisy Key', 'mechanical', 'structural', 'mechanical', array['felt', 'grease', 'bushing'], null),
  ('dead_key', 'Dead Key', 'electrical', 'electrical', 'dead', array['rubber contact', 'contact strip', 'sensor'], 12),
  ('no_trigger', 'No Trigger', 'electrical', 'electrical', 'dead', array['rubber contact', 'contact strip', 'sensor'], 12),
  ('zero_velocity', 'Zero Velocity Trigger', 'sensor', 'electrical', 'dead', array['rubber contact', 'contact strip', 'sensor'], 12),
  ('missing_note_off', 'Missing Note Off', 'electrical', 'electrical', 'dead', array['rubber contact', 'contact strip', 'sensor'], 12),
  ('intermittent_key', 'Intermittent Key', 'electrical', 'electrical', 'dead', array['rubber contact', 'contact strip', 'ribbon'], 12),
  ('velocity_spike', 'Velocity Spike', 'sensor', 'electrical', 'velocity', array['rubber contact', 'contact strip', 'sensor'], 12),
  ('velocity_dropout', 'Velocity Dropout', 'sensor', 'electrical', 'velocity', array['rubber contact', 'contact strip', 'sensor'], 12),
  ('dead_rubber_contact', 'Dead Rubber Contact', 'sensor', 'electrical', 'dead', array['rubber contact', 'contact strip'], 12),
  ('double_trigger', 'Double Trigger', 'sensor', 'electrical', 'velocity', array['rubber contact', 'contact strip', 'sensor'], 12),
  ('aftertouch_fault', 'Aftertouch Fault', 'sensor', 'electrical', 'velocity', array['aftertouch', 'pressure strip', 'sensor'], null),
  ('contact_contamination', 'Contact Contamination', 'contamination', 'dirty', 'dirty', array['contact cleaner', 'rubber contact', 'contact strip'], 12),
  ('spring_failure', 'Spring Failure', 'mechanical', 'structural', 'mechanical', array['spring'], 1),
  ('keybed_frame_damage', 'Keybed Frame Damage', 'structural', 'structural', 'dead', array['keybed', 'frame'], null),
  ('diode_matrix_fault', 'Diode Matrix Fault', 'electrical', 'electrical', 'dead', array['diode', 'key scan board'], null),
  ('ribbon_cable_fault', 'Ribbon Cable Fault', 'electrical', 'electrical', 'dead', array['ribbon cable', 'ffc', 'connector'], null),
  ('connector_fault', 'Connector Fault', 'electrical', 'electrical', 'dead', array['connector', 'header', 'ribbon'], null),
  ('other', 'Other', 'other', 'electrical', 'neutral', '{}', null);

create table public.keyboard_profiles (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  key_count smallint not null check (key_count between 1 and 128),
  action_type text not null check (action_type in ('weighted', 'semi_weighted', 'synth', 'hammer', 'graded_hammer', 'waterfall', 'unknown', 'other')),
  sensor_type text not null check (sensor_type in ('rubber_contact_pcb', 'dual_contact', 'triple_sensor', 'optical', 'hall_effect', 'capacitive', 'mechanical', 'unknown', 'other')),
  lowest_midi_note smallint not null check (lowest_midi_note between 0 and 127),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lowest_midi_note + key_count <= 128)
);

create or replace function private.sync_keyboard_profile_from_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  keyboard jsonb := coalesce(new.tech_details -> 'keyboard', '{}'::jsonb);
  parsed_count integer;
  parsed_lowest integer;
  normalized_action text;
  normalized_sensor text;
begin
  if lower(coalesce(new.tech_details ->> 'instrumentType', '')) <> 'keyboard' then
    if exists (select 1 from public.key_damage_map where job_id = new.id) then
      raise exception 'A keyboard work order with saved key findings cannot be converted to another instrument type.' using errcode = '22023';
    end if;
    delete from public.keyboard_profiles where job_id = new.id;
    return new;
  end if;

  parsed_count := case
    when coalesce(keyboard ->> 'keyCount', '') ~ '^\d{1,3}$' then (keyboard ->> 'keyCount')::integer
    else 61
  end;
  if parsed_count < 1 or parsed_count > 128 then parsed_count := 61; end if;

  parsed_lowest := case
    when coalesce(keyboard ->> 'lowestMidiNote', '') ~ '^\d{1,3}$' then (keyboard ->> 'lowestMidiNote')::integer
    else case parsed_count when 25 then 48 when 32 then 41 when 37 then 36 when 44 then 29 when 49 then 36 when 61 then 36 when 73 then 28 when 76 then 28 when 88 then 21 else greatest(0, 60 - floor(parsed_count / 2.0)::integer) end
  end;
  if parsed_lowest < 0 or parsed_lowest + parsed_count > 128 then
    parsed_lowest := greatest(0, least(127 - parsed_count + 1, 60 - floor(parsed_count / 2.0)::integer));
  end if;

  normalized_action := case lower(coalesce(keyboard ->> 'keyAction', ''))
    when 'weighted' then 'weighted'
    when 'semi-weighted' then 'semi_weighted'
    when 'synth action' then 'synth'
    when 'hammer action' then 'hammer'
    when 'graded hammer' then 'graded_hammer'
    when 'waterfall' then 'waterfall'
    when 'other' then 'other'
    else 'unknown'
  end;
  normalized_sensor := case lower(coalesce(keyboard ->> 'sensorTechnology', ''))
    when 'rubber contact strip' then 'rubber_contact_pcb'
    when 'dual contact' then 'dual_contact'
    when 'triple sensor' then 'triple_sensor'
    when 'optical' then 'optical'
    when 'hall effect' then 'hall_effect'
    when 'capacitive' then 'capacitive'
    when 'mechanical switch' then 'mechanical'
    when 'other' then 'other'
    else 'unknown'
  end;

  if exists (
    select 1 from public.key_damage_map
    where job_id = new.id
      and (key_index >= parsed_count or midi_note <> parsed_lowest + key_index)
  ) then
    raise exception 'The keyboard profile cannot change while saved key findings fall outside the new keybed range.' using errcode = '22023';
  end if;

  insert into public.keyboard_profiles (job_id, key_count, action_type, sensor_type, lowest_midi_note)
  values (new.id, parsed_count, normalized_action, normalized_sensor, parsed_lowest)
  on conflict (job_id) do update set
    key_count = excluded.key_count,
    action_type = excluded.action_type,
    sensor_type = excluded.sensor_type,
    lowest_midi_note = excluded.lowest_midi_note,
    updated_at = now();
  return new;
end;
$$;

revoke all on function private.sync_keyboard_profile_from_job() from public, anon, authenticated, service_role;

drop trigger if exists jobs_sync_keyboard_profile on public.jobs;
create trigger jobs_sync_keyboard_profile
  after insert or update of tech_details on public.jobs
  for each row execute function private.sync_keyboard_profile_from_job();

with keyboard_jobs as (
  select
    jobs.id,
    coalesce(jobs.tech_details -> 'keyboard', '{}'::jsonb) as keyboard,
    case
      when coalesce(jobs.tech_details -> 'keyboard' ->> 'keyCount', '') ~ '^\d{1,3}$'
        then (jobs.tech_details -> 'keyboard' ->> 'keyCount')::integer
      else 61
    end as requested_count
  from public.jobs
  where lower(coalesce(jobs.tech_details ->> 'instrumentType', '')) = 'keyboard'
), normalized_counts as (
  select *, case when requested_count between 1 and 128 then requested_count else 61 end as key_count
  from keyboard_jobs
), requested_profiles as (
  select
    *,
    case
      when coalesce(keyboard ->> 'lowestMidiNote', '') ~ '^\d{1,3}$' then (keyboard ->> 'lowestMidiNote')::integer
      else case key_count when 25 then 48 when 32 then 41 when 37 then 36 when 44 then 29 when 49 then 36 when 61 then 36 when 73 then 28 when 76 then 28 when 88 then 21 else greatest(0, 60 - floor(key_count / 2.0)::integer) end
    end as requested_lowest
  from normalized_counts
)
insert into public.keyboard_profiles (job_id, key_count, action_type, sensor_type, lowest_midi_note)
select
  id,
  key_count,
  case lower(coalesce(keyboard ->> 'keyAction', ''))
    when 'weighted' then 'weighted' when 'semi-weighted' then 'semi_weighted' when 'synth action' then 'synth'
    when 'hammer action' then 'hammer' when 'graded hammer' then 'graded_hammer' when 'waterfall' then 'waterfall'
    when 'other' then 'other' else 'unknown' end,
  case lower(coalesce(keyboard ->> 'sensorTechnology', ''))
    when 'rubber contact strip' then 'rubber_contact_pcb' when 'dual contact' then 'dual_contact'
    when 'triple sensor' then 'triple_sensor' when 'optical' then 'optical' when 'hall effect' then 'hall_effect'
    when 'capacitive' then 'capacitive' when 'mechanical switch' then 'mechanical'
    when 'other' then 'other' else 'unknown' end,
  case when requested_lowest >= 0 and requested_lowest + key_count <= 128 then requested_lowest
       else greatest(0, least(127 - key_count + 1, 60 - floor(key_count / 2.0)::integer)) end
from requested_profiles;

create table public.key_damage_map (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  key_index smallint not null check (key_index between 0 and 127),
  midi_note smallint not null check (midi_note between 0 and 127),
  note_name text not null check (char_length(note_name) between 1 and 8),
  health_state text not null default 'defective' check (health_state in ('good', 'defective', 'not_tested')),
  status text not null default 'electrical' check (status in ('structural', 'electrical', 'dirty', 'clean')),
  fault_code text references public.fault_codes(code),
  severity text not null default 'moderate' check (severity in ('minor', 'moderate', 'major')),
  velocity_min smallint check (velocity_min is null or velocity_min between 0 and 127),
  velocity_max smallint check (velocity_max is null or velocity_max between 0 and 127),
  notes text not null default '',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, key_index),
  unique (job_id, midi_note),
  check (velocity_min is null or velocity_max is null or velocity_min <= velocity_max),
  check ((health_state = 'defective' and fault_code is not null) or (health_state <> 'defective' and fault_code is null))
);

create index key_damage_map_job_updated_idx on public.key_damage_map (job_id, updated_at desc);
create index key_damage_map_fault_status_idx on public.key_damage_map (fault_code, status) where health_state = 'defective';

create or replace function private.guard_key_damage_map()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare profile public.keyboard_profiles%rowtype;
begin
  if (select auth.uid()) is not null and not private.can_access_job(new.job_id) then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.job_id is distinct from old.job_id or new.key_index is distinct from old.key_index
      or new.midi_note is distinct from old.midi_note or new.note_name is distinct from old.note_name
      or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'Keyboard key finding identity fields cannot be changed.' using errcode = '22023';
    end if;
  end if;
  select * into profile from public.keyboard_profiles where job_id = new.job_id;
  if not found then raise exception 'A keyboard profile is required before recording key damage.' using errcode = '23503'; end if;
  if new.key_index >= profile.key_count or new.midi_note <> profile.lowest_midi_note + new.key_index then
    raise exception 'Keyboard key identity is outside the saved profile.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_key_damage_map() from public, anon, authenticated, service_role;

create trigger key_damage_map_guard before insert or update on public.key_damage_map
  for each row execute function private.guard_key_damage_map();
create trigger key_damage_map_set_updated_at before update on public.key_damage_map
  for each row execute function public.set_updated_at();

insert into public.key_damage_map (
  id, job_id, key_index, midi_note, note_name, health_state, status, fault_code,
  severity, velocity_min, velocity_max, notes, created_by, created_at, updated_at
)
select
  states.id, states.job_id, states.midi_note - profiles.lowest_midi_note, states.midi_note, states.key_label,
  case states.condition_status when 'pass' then 'good' when 'fault' then 'defective' else 'not_tested' end,
  case when states.condition_status = 'pass' then 'clean'
       when lower(states.fault_category) in ('physical', 'mechanical') then 'structural'
       when lower(states.fault_category) = 'contamination' then 'dirty'
       else 'electrical' end,
  case when states.condition_status = 'fault' then nullif(states.fault_code, '') else null end,
  states.severity, states.velocity_min, states.velocity_max, states.notes,
  states.created_by, states.created_at, states.updated_at
from public.keyboard_key_states states
join public.keyboard_profiles profiles on profiles.job_id = states.job_id
where states.midi_note >= profiles.lowest_midi_note
  and states.midi_note < profiles.lowest_midi_note + profiles.key_count;

alter table public.keyboard_part_requests add column key_damage_id uuid references public.key_damage_map(id) on delete set null;
update public.keyboard_part_requests set key_damage_id = key_state_id where key_state_id is not null;
create index keyboard_part_requests_key_damage_idx on public.keyboard_part_requests (key_damage_id) where key_damage_id is not null;

drop policy if exists "keyboard_part_requests_insert_writer" on public.keyboard_part_requests;
drop policy if exists "keyboard_part_requests_update_writer" on public.keyboard_part_requests;
drop trigger if exists keyboard_part_requests_guard_identity on public.keyboard_part_requests;

alter table public.keyboard_part_requests drop column key_state_id;
drop table public.keyboard_key_states;
drop function private.guard_keyboard_key_state_identity();

create or replace function private.guard_keyboard_part_request_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.job_id is distinct from old.job_id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Keyboard parts request identity fields cannot be changed.' using errcode = '22023';
  end if;
  if old.job_part_id is not null and (
    new.job_part_id is distinct from old.job_part_id or new.inventory_part_id is distinct from old.inventory_part_id
    or new.key_damage_id is distinct from old.key_damage_id or new.requested_part is distinct from old.requested_part
    or new.quantity is distinct from old.quantity or new.request_status <> 'installed'
  ) then
    raise exception 'An installed keyboard parts request cannot be reassigned or reopened.' using errcode = '22023';
  end if;
  if (new.request_status = 'installed') <> (new.job_part_id is not null) then
    raise exception 'Installed keyboard parts requests require their fulfilled job part.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_keyboard_part_request_identity() from public, anon, authenticated, service_role;
create trigger keyboard_part_requests_guard_identity before update on public.keyboard_part_requests
  for each row execute function private.guard_keyboard_part_request_identity();

create policy "keyboard_part_requests_insert_writer"
  on public.keyboard_part_requests for insert to authenticated
  with check (
    private.can_write_job(job_id) and created_by = (select auth.uid())
    and exists (select 1 from public.jobs where jobs.id = keyboard_part_requests.job_id
      and lower(coalesce(jobs.tech_details ->> 'instrumentType', '')) = 'keyboard'
      and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair'))
    and (key_damage_id is null or exists (select 1 from public.key_damage_map
      where key_damage_map.id = keyboard_part_requests.key_damage_id and key_damage_map.job_id = keyboard_part_requests.job_id))
    and (inventory_part_id is null or exists (select 1 from public.parts join public.jobs on jobs.id = keyboard_part_requests.job_id
      where parts.id = keyboard_part_requests.inventory_part_id and parts.shop_id = jobs.shop_id))
  );

create policy "keyboard_part_requests_update_writer"
  on public.keyboard_part_requests for update to authenticated
  using (private.can_write_job(job_id) and exists (select 1 from public.jobs where jobs.id = keyboard_part_requests.job_id
    and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')))
  with check (
    private.can_write_job(job_id)
    and exists (select 1 from public.jobs where jobs.id = keyboard_part_requests.job_id
      and lower(coalesce(jobs.tech_details ->> 'instrumentType', '')) = 'keyboard'
      and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair'))
    and (key_damage_id is null or exists (select 1 from public.key_damage_map
      where key_damage_map.id = keyboard_part_requests.key_damage_id and key_damage_map.job_id = keyboard_part_requests.job_id))
    and (inventory_part_id is null or exists (select 1 from public.parts join public.jobs on jobs.id = keyboard_part_requests.job_id
      where parts.id = keyboard_part_requests.inventory_part_id and parts.shop_id = jobs.shop_id))
  );

create table public.keyboard_part_compatibility (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  fault_code text not null references public.fault_codes(code),
  part_scope text not null default 'single_key' check (part_scope in ('single_key', 'key_group', 'full_keybed')),
  group_size smallint not null default 1 check (group_size between 1 and 128),
  key_color text check (key_color is null or key_color in ('white', 'black', 'any')),
  note_name text,
  manufacturer text,
  model_pattern text,
  start_key_index smallint check (start_key_index is null or start_key_index between 0 and 127),
  end_key_index smallint check (end_key_index is null or end_key_index between 0 and 127),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_key_index is null or end_key_index is null or start_key_index <= end_key_index),
  unique nulls not distinct (part_id, fault_code, part_scope, note_name, manufacturer, model_pattern, start_key_index, end_key_index)
);

create index keyboard_part_compatibility_part_idx on public.keyboard_part_compatibility (part_id);
create index keyboard_part_compatibility_fault_idx on public.keyboard_part_compatibility (fault_code, note_name);
create trigger keyboard_part_compatibility_set_updated_at before update on public.keyboard_part_compatibility
  for each row execute function public.set_updated_at();

alter table public.fault_codes enable row level security;
alter table public.keyboard_profiles enable row level security;
alter table public.key_damage_map enable row level security;
alter table public.keyboard_part_compatibility enable row level security;

create policy "fault_codes_select_authenticated" on public.fault_codes for select to authenticated using (true);
create policy "keyboard_profiles_select_member" on public.keyboard_profiles for select to authenticated using (private.can_access_job(job_id));
create policy "key_damage_map_select_member" on public.key_damage_map for select to authenticated using (private.can_access_job(job_id));
create policy "key_damage_map_insert_writer" on public.key_damage_map for insert to authenticated
  with check (private.can_write_job(job_id) and created_by = (select auth.uid()) and exists (
    select 1 from public.jobs where jobs.id = key_damage_map.job_id
      and lower(coalesce(jobs.tech_details ->> 'instrumentType', '')) = 'keyboard'
      and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')));
create policy "key_damage_map_update_writer" on public.key_damage_map for update to authenticated
  using (private.can_write_job(job_id) and exists (select 1 from public.jobs where jobs.id = key_damage_map.job_id
    and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')))
  with check (private.can_write_job(job_id) and exists (select 1 from public.jobs where jobs.id = key_damage_map.job_id
    and lower(coalesce(jobs.tech_details ->> 'instrumentType', '')) = 'keyboard'
    and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')));
create policy "key_damage_map_delete_writer" on public.key_damage_map for delete to authenticated
  using (private.can_write_job(job_id) and exists (select 1 from public.jobs where jobs.id = key_damage_map.job_id
    and private.shop_has_entitlement(jobs.shop_id, 'keyboard_repair')));

create policy "keyboard_part_compatibility_select_member" on public.keyboard_part_compatibility for select to authenticated
  using (exists (select 1 from public.parts where parts.id = keyboard_part_compatibility.part_id and private.is_shop_member(parts.shop_id)));
create policy "keyboard_part_compatibility_insert_writer" on public.keyboard_part_compatibility for insert to authenticated
  with check (exists (select 1 from public.parts where parts.id = keyboard_part_compatibility.part_id and private.can_write_shop(parts.shop_id)));
create policy "keyboard_part_compatibility_update_writer" on public.keyboard_part_compatibility for update to authenticated
  using (exists (select 1 from public.parts where parts.id = keyboard_part_compatibility.part_id and private.can_write_shop(parts.shop_id)))
  with check (exists (select 1 from public.parts where parts.id = keyboard_part_compatibility.part_id and private.can_write_shop(parts.shop_id)));
create policy "keyboard_part_compatibility_delete_writer" on public.keyboard_part_compatibility for delete to authenticated
  using (exists (select 1 from public.parts where parts.id = keyboard_part_compatibility.part_id and private.can_write_shop(parts.shop_id)));

revoke all on public.fault_codes, public.keyboard_profiles, public.key_damage_map, public.keyboard_part_compatibility from public, anon, authenticated, service_role;
grant select on public.fault_codes, public.keyboard_profiles to authenticated;
grant select, insert, update, delete on public.key_damage_map, public.keyboard_part_compatibility to authenticated;
grant select, insert, update, delete on public.fault_codes, public.keyboard_profiles, public.key_damage_map, public.keyboard_part_compatibility to service_role;

revoke update on public.keyboard_part_requests from authenticated;
grant update (requested_part, quantity, request_status, notes) on public.keyboard_part_requests to authenticated;

comment on table public.fault_codes is 'Standardized keyboard fault catalog shared by all shops.';
comment on table public.keyboard_profiles is 'Normalized keybed profile projected from each keyboard work order.';
comment on table public.key_damage_map is 'One version-guarded health and fault record per physical key on a keyboard work order.';
comment on table public.keyboard_part_compatibility is 'Shop inventory compatibility rules for individual keys, grouped contact strips, and complete keybeds.';
