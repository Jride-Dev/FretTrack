create or replace function private.guard_keyboard_key_state_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.job_id is distinct from old.job_id
    or new.midi_note is distinct from old.midi_note
    or new.key_label is distinct from old.key_label
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Keyboard key finding identity fields cannot be changed.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function private.guard_keyboard_part_request_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.job_id is distinct from old.job_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Keyboard parts request identity fields cannot be changed.' using errcode = '22023';
  end if;

  if old.job_part_id is not null and (
    new.job_part_id is distinct from old.job_part_id
    or new.inventory_part_id is distinct from old.inventory_part_id
    or new.key_state_id is distinct from old.key_state_id
    or new.requested_part is distinct from old.requested_part
    or new.quantity is distinct from old.quantity
    or new.request_status <> 'installed'
  ) then
    raise exception 'An installed keyboard parts request cannot be reassigned or reopened.' using errcode = '22023';
  end if;

  if (new.request_status = 'installed') <> (new.job_part_id is not null) then
    raise exception 'Installed keyboard parts requests require their fulfilled job part.' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_keyboard_key_state_identity() from public, anon, authenticated, service_role;
revoke all on function private.guard_keyboard_part_request_identity() from public, anon, authenticated, service_role;

create trigger keyboard_key_states_guard_identity
  before update on public.keyboard_key_states
  for each row execute function private.guard_keyboard_key_state_identity();

create trigger keyboard_part_requests_guard_identity
  before update on public.keyboard_part_requests
  for each row execute function private.guard_keyboard_part_request_identity();

revoke update on public.keyboard_part_requests from authenticated;
grant update (requested_part, quantity, request_status, notes) on public.keyboard_part_requests to authenticated;

alter function public.fulfill_keyboard_part_request(uuid) security definer;
