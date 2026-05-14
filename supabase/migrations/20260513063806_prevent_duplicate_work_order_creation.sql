create or replace function create_job_with_number(job_payload jsonb)
returns jobs
language plpgsql
as $$
declare
  assigned_job jobs;
  assigned_shop_id text;
  assigned_job_date date;
  assigned_day_code text;
  assigned_sequence integer;
  requested_job_number text;
begin
  assigned_shop_id := coalesce(nullif(job_payload->>'shop_id', ''), 'default-shop');
  requested_job_number := nullif(job_payload->>'job_number', '');

  if requested_job_number is not null then
    select *
    into assigned_job
    from jobs
    where shop_id = assigned_shop_id
      and job_number = requested_job_number
    limit 1;

    if found then
      return assigned_job;
    end if;
  end if;

  assigned_job_date := coalesce(
    nullif(job_payload->>'job_date', '')::date,
    nullif(job_payload->>'date_received', '')::date,
    current_date
  );
  assigned_day_code := to_char(assigned_job_date, 'YY') ||
    lpad(extract(doy from assigned_job_date)::integer::text, 3, '0');

  insert into job_daily_sequences (shop_id, job_date, last_sequence)
  values (assigned_shop_id, assigned_job_date, 1)
  on conflict (shop_id, job_date) do update
  set last_sequence = job_daily_sequences.last_sequence + 1
  returning last_sequence into assigned_sequence;

  insert into jobs (
    id,
    customer_name,
    customer_first_name,
    customer_last_name,
    phone,
    email,
    email_opt_in,
    sms_opt_in,
    preferred_contact_method,
    guitar_brand,
    model,
    serial,
    color,
    reason_for_visit,
    date_received,
    job_date,
    job_day_code,
    daily_sequence,
    shop_id,
    job_number,
    status,
    tech_details,
    created_at,
    updated_at
  )
  values (
    coalesce(nullif(job_payload->>'id', '')::uuid, gen_random_uuid()),
    coalesce(job_payload->>'customer_name', ''),
    coalesce(job_payload->>'customer_first_name', ''),
    coalesce(job_payload->>'customer_last_name', ''),
    coalesce(job_payload->>'phone', ''),
    coalesce(job_payload->>'email', ''),
    coalesce((job_payload->>'email_opt_in')::boolean, false),
    coalesce((job_payload->>'sms_opt_in')::boolean, false),
    coalesce(nullif(job_payload->>'preferred_contact_method', ''), 'email'),
    coalesce(job_payload->>'guitar_brand', ''),
    coalesce(job_payload->>'model', ''),
    coalesce(job_payload->>'serial', ''),
    coalesce(job_payload->>'color', ''),
    coalesce(job_payload->>'reason_for_visit', ''),
    assigned_job_date,
    assigned_job_date,
    assigned_day_code,
    assigned_sequence,
    assigned_shop_id,
    coalesce(requested_job_number, assigned_day_code || '-' || lpad(assigned_sequence::text, 3, '0')),
    coalesce(nullif(job_payload->>'status', ''), 'Checked In'),
    coalesce(job_payload->'tech_details', '{}'::jsonb),
    coalesce(nullif(job_payload->>'created_at', '')::timestamptz, now()),
    coalesce(nullif(job_payload->>'updated_at', '')::timestamptz, now())
  )
  on conflict (shop_id, job_number) do update
  set updated_at = jobs.updated_at
  returning * into assigned_job;

  return assigned_job;
end;
$$;

grant execute on function create_job_with_number(jsonb) to authenticated;
