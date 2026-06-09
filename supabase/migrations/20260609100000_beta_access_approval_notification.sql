alter table public.beta_access_requests
  add column if not exists approved_notified_at timestamptz;

create or replace function public.get_beta_access_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  payload jsonb;
begin
  if not private.is_operator() then
    raise exception 'Not allowed to view beta access requests.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', beta_access_requests.id,
        'user_id', beta_access_requests.user_id,
        'email', coalesce(nullif(beta_access_requests.email, ''), auth.users.email, ''),
        'status', beta_access_requests.status,
        'requested_at', beta_access_requests.requested_at,
        'reviewed_at', beta_access_requests.reviewed_at,
        'reviewed_by', beta_access_requests.reviewed_by,
        'reviewed_by_email', reviewer.email,
        'notes', beta_access_requests.notes,
        'last_sign_in_at', auth.users.last_sign_in_at,
        'email_confirmed_at', auth.users.email_confirmed_at,
        'operator_notified_at', beta_access_requests.operator_notified_at,
        'approved_notified_at', beta_access_requests.approved_notified_at,
        'updated_at', beta_access_requests.updated_at
      )
      order by
        case beta_access_requests.status when 'pending' then 0 when 'approved' then 1 else 2 end,
        beta_access_requests.requested_at desc
    ),
    '[]'::jsonb
  )
  into payload
  from public.beta_access_requests
  left join auth.users on auth.users.id = beta_access_requests.user_id
  left join auth.users reviewer on reviewer.id = beta_access_requests.reviewed_by;

  return payload;
end;
$$;

revoke all on function public.get_beta_access_requests() from public, anon;
grant execute on function public.get_beta_access_requests() to authenticated;
