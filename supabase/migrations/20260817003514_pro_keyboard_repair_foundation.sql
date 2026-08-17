insert into public.plan_entitlements (plan_id, key, value)
values
  ('free', 'keyboard_repair', 'false'::jsonb),
  ('solo', 'keyboard_repair', 'false'::jsonb),
  ('shop', 'keyboard_repair', 'false'::jsonb),
  ('pro', 'keyboard_repair', 'true'::jsonb),
  ('enterprise', 'keyboard_repair', 'true'::jsonb),
  ('trial', 'keyboard_repair', 'false'::jsonb)
on conflict (plan_id, key) do update
set value = excluded.value,
    updated_at = now();

create or replace function private.enforce_keyboard_repair_entitlement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_is_keyboard boolean := false;
  new_is_keyboard boolean := lower(coalesce(new.tech_details ->> 'instrumentType', '')) = 'keyboard';
begin
  if tg_op = 'UPDATE' then
    old_is_keyboard := lower(coalesce(old.tech_details ->> 'instrumentType', '')) = 'keyboard';
  end if;

  if (old_is_keyboard or new_is_keyboard)
    and not private.shop_has_entitlement(new.shop_id, 'keyboard_repair') then
    raise exception 'Keyboard Repair is available on Pro.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_keyboard_repair_entitlement() from public, anon, authenticated, service_role;

drop trigger if exists jobs_enforce_keyboard_repair_entitlement on public.jobs;
create trigger jobs_enforce_keyboard_repair_entitlement
  before insert or update on public.jobs
  for each row
  execute function private.enforce_keyboard_repair_entitlement();
