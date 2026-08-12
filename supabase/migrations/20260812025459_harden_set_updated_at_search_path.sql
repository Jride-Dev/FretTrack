-- Pin the shared updated_at trigger helper to a deterministic search path.
-- The function is trigger-only and does not need direct client execution.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;
