-- Keep access-application retries tied to one durable request identity.
-- The request UUID is returned to the landing Worker for provider/archive
-- idempotency, while repeated pending submissions retain their original
-- requested_at value and do not append the same notes again.

create or replace function public.submit_beta_access_request(
  applicant_email text,
  applicant_name text default '',
  applicant_shop_name text default '',
  applicant_notes text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, private, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(applicant_email, '')));
  clean_name text := trim(coalesce(applicant_name, ''));
  clean_shop_name text := trim(coalesce(applicant_shop_name, ''));
  clean_notes text := trim(coalesce(applicant_notes, ''));
  matching_user_id uuid;
  request_row public.beta_access_requests%rowtype;
  next_notes text;
begin
  if normalized_email = ''
    or length(normalized_email) > 180
    or normalized_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'Please enter a valid email address.';
  end if;

  select id
  into matching_user_id
  from auth.users
  where lower(email) = normalized_email
  order by created_at desc
  limit 1;

  if length(clean_name) > 120
    or length(clean_shop_name) > 160
    or length(clean_notes) > 1500 then
    raise exception 'Please keep each field within its character limit.';
  end if;

  next_notes := trim(concat_ws(E'\n',
    nullif('Applicant: ' || clean_name, 'Applicant: '),
    nullif('Shop: ' || clean_shop_name, 'Shop: '),
    nullif(clean_notes, '')
  ));

  select *
  into request_row
  from public.beta_access_requests
  where lower(email) = normalized_email
     or (matching_user_id is not null and user_id = matching_user_id)
  order by requested_at desc
  limit 1;

  if request_row.id is null then
    insert into public.beta_access_requests (
      user_id,
      email,
      status,
      requested_at,
      notes
    )
    values (
      matching_user_id,
      normalized_email,
      'pending',
      now(),
      next_notes
    )
    returning * into request_row;
  elsif auth.uid() is null or auth.uid() is distinct from matching_user_id then
    return jsonb_build_object(
      'ok', true,
      'requestId', request_row.id,
      'status', request_row.status,
      'email', request_row.email,
      'requestedAt', request_row.requested_at
    );
  else
    update public.beta_access_requests
    set
      user_id = coalesce(user_id, matching_user_id),
      email = normalized_email,
      notes = case
        when next_notes = '' then notes
        when coalesce(notes, '') = '' then next_notes
        when position(next_notes in coalesce(notes, '')) > 0 then notes
        else left(notes || E'\n\nUpdated application:\n' || next_notes, 5000)
      end
    where id = request_row.id
    returning * into request_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'requestId', request_row.id,
    'status', request_row.status,
    'email', request_row.email,
    'requestedAt', request_row.requested_at
  );
end;
$$;

revoke all on function public.submit_beta_access_request(text, text, text, text) from public;
revoke all on function public.submit_beta_access_request(text, text, text, text) from anon;
revoke all on function public.submit_beta_access_request(text, text, text, text) from authenticated;
grant execute on function public.submit_beta_access_request(text, text, text, text) to anon, authenticated;
