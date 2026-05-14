alter function public.create_job_with_number(jsonb) set search_path = public;
alter function public.prevent_commerce_event_mutation() set search_path = public;

revoke execute on function public.create_job_with_number(jsonb) from public, anon;
grant execute on function public.create_job_with_number(jsonb) to authenticated;

revoke execute on function public.create_transaction_event(jsonb) from public, anon;
grant execute on function public.create_transaction_event(jsonb) to authenticated;

revoke execute on function public.next_transaction_number(text, text) from public, anon, authenticated;
revoke execute on function public.prevent_commerce_event_mutation() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

update storage.buckets
set public = false
where id = 'job-images';
