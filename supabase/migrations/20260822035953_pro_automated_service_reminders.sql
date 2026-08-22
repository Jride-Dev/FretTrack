insert into public.plan_entitlements (plan_id, key, value)
values
  ('free', 'automated_service_reminders', 'false'::jsonb),
  ('solo', 'automated_service_reminders', 'false'::jsonb),
  ('shop', 'automated_service_reminders', 'false'::jsonb),
  ('pro', 'automated_service_reminders', 'true'::jsonb),
  ('enterprise', 'automated_service_reminders', 'true'::jsonb),
  ('trial', 'automated_service_reminders', 'false'::jsonb)
on conflict (plan_id, key) do update set value = excluded.value, updated_at = now();

alter table public.customers
  add column service_reminder_opt_in boolean not null default false,
  add column service_reminder_consent_at timestamptz,
  add column service_reminder_consent_source text not null default '';

alter table public.jobs
  add column service_completed_at timestamptz;

update public.jobs
set service_completed_at = coalesce(updated_at, created_at, now())
where status in ('Completed', 'Picked Up') and service_completed_at is null;

create table public.service_reminder_rules (
  shop_id text primary key references public.shop_profiles(shop_id) on delete cascade,
  enabled boolean not null default false,
  interval_months integer not null default 6 check (interval_months between 1 and 60),
  eligible_service_keywords text[] not null default array['setup']::text[],
  subject_template text not null default 'Is it time for your next {{service_name}}?'
    check (char_length(subject_template) between 1 and 200),
  body_template text not null default 'Hi {{customer_first_name}},\n\nIt has been {{months}} months since your last {{service_name}} at {{shop_name}}. Would you like to book another appointment?\n\n{{booking_url}}'
    check (char_length(body_template) between 1 and 4000),
  booking_url text not null default '' check (char_length(booking_url) <= 500),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(eligible_service_keywords) between 1 and 25)
);

insert into public.service_reminder_rules (shop_id)
select shop_id from public.shop_profiles
on conflict (shop_id) do nothing;

create table public.service_reminder_queue (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  source_job_id uuid not null references public.jobs(id) on delete cascade,
  service_name text not null check (char_length(service_name) between 1 and 240),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'canceled')),
  delivery_key uuid not null default gen_random_uuid(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  next_attempt_at timestamptz,
  processing_token uuid,
  processing_started_at timestamptz,
  recipient_snapshot text not null default '',
  subject_snapshot text not null default '',
  body_snapshot text not null default '',
  provider_message_id text not null default '',
  error_message text not null default '',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_job_id),
  unique (delivery_key)
);

create index service_reminder_queue_due_idx
  on public.service_reminder_queue (status, next_attempt_at, due_at)
  where status in ('pending', 'failed');
create index service_reminder_queue_customer_idx
  on public.service_reminder_queue (shop_id, customer_id, due_at desc);

drop trigger if exists service_reminder_rules_set_updated_at on public.service_reminder_rules;
create trigger service_reminder_rules_set_updated_at
  before update on public.service_reminder_rules
  for each row execute function public.set_updated_at();
drop trigger if exists service_reminder_queue_set_updated_at on public.service_reminder_queue;
create trigger service_reminder_queue_set_updated_at
  before update on public.service_reminder_queue
  for each row execute function public.set_updated_at();

create or replace function private.set_service_completion_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('Completed', 'Picked Up') then
    if tg_op = 'INSERT' or old.status not in ('Completed', 'Picked Up') then
      new.service_completed_at := coalesce(new.service_completed_at, now());
    end if;
  elsif tg_op = 'UPDATE' and old.status in ('Completed', 'Picked Up') then
    new.service_completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_set_service_completion_time on public.jobs;
create trigger jobs_set_service_completion_time
  before insert or update of status on public.jobs
  for each row execute function private.set_service_completion_time();

create or replace function private.refresh_service_reminder_for_job(target_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.jobs%rowtype;
  target_customer public.customers%rowtype;
  target_rule public.service_reminder_rules%rowtype;
  matched_service text;
begin
  select * into target_job from public.jobs where id = target_job_id;
  if target_job.id is null then return; end if;

  select * into target_rule from public.service_reminder_rules where shop_id = target_job.shop_id;
  if target_job.customer_id is not null then
    select * into target_customer from public.customers
    where id = target_job.customer_id and shop_id = target_job.shop_id;
  end if;

  if target_job.status not in ('Completed', 'Picked Up')
    or target_job.service_completed_at is null
    or target_customer.id is null
    or target_customer.is_active is false
    or target_customer.service_reminder_opt_in is not true
    or coalesce(target_customer.email_normalized, '') = ''
    or target_rule.shop_id is null
    or target_rule.enabled is not true
    or not private.shop_has_entitlement(target_job.shop_id, 'automated_service_reminders') then
    update public.service_reminder_queue
    set status = 'canceled', processing_token = null, processing_started_at = null,
        error_message = 'No longer eligible for an automated service reminder.'
    where source_job_id = target_job.id and status <> 'sent';
    return;
  end if;

  select services.description into matched_service
  from public.job_services services
  where services.job_id = target_job.id
    and exists (
      select 1 from unnest(target_rule.eligible_service_keywords) keyword
      where btrim(keyword) <> '' and lower(services.description) like '%' || lower(btrim(keyword)) || '%'
    )
  order by services.created_at, services.id
  limit 1;

  if coalesce(btrim(matched_service), '') = '' then
    update public.service_reminder_queue
    set status = 'canceled', processing_token = null, processing_started_at = null,
        error_message = 'The completed work order has no eligible reminder service.'
    where source_job_id = target_job.id and status <> 'sent';
    return;
  end if;

  update public.service_reminder_queue queue
  set status = 'canceled', processing_token = null, processing_started_at = null,
      error_message = 'Superseded by a newer eligible service.'
  where queue.shop_id = target_job.shop_id
    and queue.customer_id = target_job.customer_id
    and queue.source_job_id <> target_job.id
    and queue.status <> 'sent'
    and exists (
      select 1 from public.jobs older
      where older.id = queue.source_job_id
        and older.service_completed_at < target_job.service_completed_at
    );

  insert into public.service_reminder_queue (
    shop_id, customer_id, source_job_id, service_name, due_at, status,
    next_attempt_at, processing_token, processing_started_at, error_message
  ) values (
    target_job.shop_id, target_job.customer_id, target_job.id, left(matched_service, 240),
    target_job.service_completed_at + make_interval(months => target_rule.interval_months),
    'pending', null, null, null, ''
  )
  on conflict (source_job_id) do update set
    customer_id = excluded.customer_id,
    service_name = excluded.service_name,
    due_at = excluded.due_at,
    status = case when public.service_reminder_queue.status = 'sent' then 'sent' else 'pending' end,
    next_attempt_at = null,
    processing_token = null,
    processing_started_at = null,
    error_message = case when public.service_reminder_queue.status = 'sent' then public.service_reminder_queue.error_message else '' end;
end;
$$;

create or replace function private.refresh_service_reminder_job_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_service_reminder_for_job(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

create or replace function private.refresh_service_reminder_service_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_service_reminder_for_job(coalesce(new.job_id, old.job_id));
  return coalesce(new, old);
end;
$$;

create or replace function private.refresh_customer_service_reminders_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare job_row record;
begin
  if new.service_reminder_opt_in is distinct from old.service_reminder_opt_in
    or new.email_normalized is distinct from old.email_normalized
    or new.is_active is distinct from old.is_active then
    for job_row in select id from public.jobs where customer_id = new.id loop
      perform private.refresh_service_reminder_for_job(job_row.id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_refresh_service_reminder on public.jobs;
create trigger jobs_refresh_service_reminder
  after insert or update of status, customer_id, service_completed_at on public.jobs
  for each row execute function private.refresh_service_reminder_job_trigger();
drop trigger if exists job_services_refresh_service_reminder on public.job_services;
create trigger job_services_refresh_service_reminder
  after insert or update or delete on public.job_services
  for each row execute function private.refresh_service_reminder_service_trigger();
drop trigger if exists customers_refresh_service_reminders on public.customers;
create trigger customers_refresh_service_reminders
  after update of service_reminder_opt_in, email_normalized, is_active on public.customers
  for each row execute function private.refresh_customer_service_reminders_trigger();

create or replace function public.rebuild_service_reminder_queue(target_shop_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare job_row record; refreshed integer := 0;
begin
  if auth.uid() is null or not private.has_shop_role(target_shop_id, array['owner', 'admin']) then
    raise exception 'Only a shop owner or admin can rebuild service reminders.' using errcode = '42501';
  end if;
  if not private.shop_has_entitlement(target_shop_id, 'automated_service_reminders') then
    raise exception 'Automated Service Reminders are available on Pro.' using errcode = '42501';
  end if;
  for job_row in select id from public.jobs where shop_id = target_shop_id loop
    perform private.refresh_service_reminder_for_job(job_row.id);
    refreshed := refreshed + 1;
  end loop;
  return refreshed;
end;
$$;

create or replace function public.claim_due_service_reminders(target_claim_token uuid, target_limit integer default 25)
returns setof public.service_reminder_queue
language plpgsql
security definer
set search_path = ''
as $$
declare queue_row public.service_reminder_queue%rowtype; customer_row public.customers%rowtype;
  shop_row public.shop_profiles%rowtype; rule_row public.service_reminder_rules%rowtype;
  safe_limit integer := least(greatest(coalesce(target_limit, 25), 1), 50);
  first_name text; rendered_subject text; rendered_body text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' or target_claim_token is null then
    raise exception 'Service reminder dispatch requires service-role access.' using errcode = '42501';
  end if;

  update public.service_reminder_queue
  set status = 'failed', next_attempt_at = now(), processing_token = null,
      processing_started_at = null, error_message = 'A stale dispatch lease was recovered.'
  where status = 'processing' and processing_started_at < now() - interval '15 minutes';

  for queue_row in
    select * from public.service_reminder_queue
    where status in ('pending', 'failed') and due_at <= now()
      and coalesce(next_attempt_at, due_at) <= now() and attempt_count < 20
    order by due_at, id
    for update skip locked
    limit safe_limit
  loop
    perform private.refresh_service_reminder_for_job(queue_row.source_job_id);
    select * into queue_row from public.service_reminder_queue where id = queue_row.id for update;
    if queue_row.status not in ('pending', 'failed') then continue; end if;

    select * into customer_row from public.customers where id = queue_row.customer_id;
    select * into shop_row from public.shop_profiles where shop_id = queue_row.shop_id;
    select * into rule_row from public.service_reminder_rules where shop_id = queue_row.shop_id;
    first_name := coalesce(nullif(customer_row.first_name, ''), split_part(customer_row.display_name, ' ', 1), 'there');
    rendered_subject := replace(replace(replace(replace(rule_row.subject_template,
      '{{customer_first_name}}', first_name), '{{service_name}}', queue_row.service_name),
      '{{shop_name}}', shop_row.shop_name), '{{months}}', rule_row.interval_months::text);
    rendered_body := replace(replace(replace(replace(replace(rule_row.body_template,
      '{{customer_first_name}}', first_name), '{{service_name}}', queue_row.service_name),
      '{{shop_name}}', shop_row.shop_name), '{{months}}', rule_row.interval_months::text),
      '{{booking_url}}', rule_row.booking_url);

    update public.service_reminder_queue
    set status = 'processing', processing_token = target_claim_token, processing_started_at = now(),
        attempt_count = attempt_count + 1, recipient_snapshot = customer_row.email_normalized,
        subject_snapshot = left(rendered_subject, 200), body_snapshot = left(rendered_body, 4000),
        error_message = ''
    where id = queue_row.id
    returning * into queue_row;
    return next queue_row;
  end loop;
end;
$$;

create or replace function public.validate_service_reminder_claim(target_queue_id uuid, target_claim_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare queue_row public.service_reminder_queue%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service-role access required.' using errcode = '42501';
  end if;
  select * into queue_row from public.service_reminder_queue
  where id = target_queue_id and status = 'processing' and processing_token = target_claim_token;
  if queue_row.id is null then return false; end if;
  return private.shop_has_entitlement(queue_row.shop_id, 'automated_service_reminders')
    and exists (select 1 from public.service_reminder_rules where shop_id = queue_row.shop_id and enabled)
    and exists (select 1 from public.customers where id = queue_row.customer_id and is_active and service_reminder_opt_in and email_normalized = queue_row.recipient_snapshot)
    and exists (select 1 from public.jobs where id = queue_row.source_job_id and status in ('Completed', 'Picked Up') and service_completed_at is not null)
    and not exists (
      select 1 from public.jobs newer
      join public.job_services services on services.job_id = newer.id
      join public.service_reminder_rules rules on rules.shop_id = newer.shop_id
      where newer.shop_id = queue_row.shop_id and newer.customer_id = queue_row.customer_id
        and newer.id <> queue_row.source_job_id and newer.status in ('Completed', 'Picked Up')
        and newer.service_completed_at > (select service_completed_at from public.jobs where id = queue_row.source_job_id)
        and exists (select 1 from unnest(rules.eligible_service_keywords) keyword where btrim(keyword) <> '' and lower(services.description) like '%' || lower(btrim(keyword)) || '%')
    );
end;
$$;

create or replace function public.finalize_service_reminder_delivery(
  target_queue_id uuid, target_claim_token uuid, target_outcome text,
  target_provider_message_id text default '', target_error_message text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service-role access required.' using errcode = '42501';
  end if;
  if target_outcome not in ('sent', 'failed', 'canceled') then
    raise exception 'Unsupported service reminder outcome.' using errcode = '22023';
  end if;
  update public.service_reminder_queue
  set status = target_outcome,
      provider_message_id = case when target_outcome = 'sent' then left(coalesce(target_provider_message_id, ''), 240) else provider_message_id end,
      error_message = left(coalesce(target_error_message, ''), 1000),
      sent_at = case when target_outcome = 'sent' then now() else sent_at end,
      next_attempt_at = case when target_outcome = 'failed' then now() + make_interval(mins => least(60, greatest(5, attempt_count * 5))) else null end,
      processing_token = null, processing_started_at = null
  where id = target_queue_id and status = 'processing' and processing_token = target_claim_token;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

alter table public.service_reminder_rules enable row level security;
alter table public.service_reminder_queue enable row level security;

create policy service_reminder_rules_select_member on public.service_reminder_rules
  for select to authenticated using (
    private.is_shop_member(shop_id)
    and private.shop_has_entitlement(shop_id, 'automated_service_reminders')
  );
create policy service_reminder_rules_insert_manager on public.service_reminder_rules
  for insert to authenticated with check (private.has_shop_role(shop_id, array['owner', 'admin']) and private.shop_has_entitlement(shop_id, 'automated_service_reminders'));
create policy service_reminder_rules_update_manager on public.service_reminder_rules
  for update to authenticated using (private.has_shop_role(shop_id, array['owner', 'admin']))
  with check (private.has_shop_role(shop_id, array['owner', 'admin']) and private.shop_has_entitlement(shop_id, 'automated_service_reminders'));
create policy service_reminder_queue_select_member on public.service_reminder_queue
  for select to authenticated using (private.is_shop_member(shop_id) and private.shop_has_entitlement(shop_id, 'automated_service_reminders'));

revoke all on public.service_reminder_rules, public.service_reminder_queue from public, anon, authenticated, service_role;
grant select, insert, update on public.service_reminder_rules to authenticated;
grant select on public.service_reminder_queue to authenticated;
grant select, insert, update, delete on public.service_reminder_rules, public.service_reminder_queue to service_role;
revoke all on function public.rebuild_service_reminder_queue(text) from public, anon, authenticated, service_role;
revoke all on function public.claim_due_service_reminders(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.validate_service_reminder_claim(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.finalize_service_reminder_delivery(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.rebuild_service_reminder_queue(text) to authenticated;
grant execute on function public.claim_due_service_reminders(uuid, integer) to service_role;
grant execute on function public.validate_service_reminder_claim(uuid, uuid) to service_role;
grant execute on function public.finalize_service_reminder_delivery(uuid, uuid, text, text, text) to service_role;

revoke all on function private.set_service_completion_time() from public, anon, authenticated, service_role;
revoke all on function private.refresh_service_reminder_for_job(uuid) from public, anon, authenticated, service_role;
revoke all on function private.refresh_service_reminder_job_trigger() from public, anon, authenticated, service_role;
revoke all on function private.refresh_service_reminder_service_trigger() from public, anon, authenticated, service_role;
revoke all on function private.refresh_customer_service_reminders_trigger() from public, anon, authenticated, service_role;

comment on table public.service_reminder_rules is 'Pro shop configuration for consent-based recurring service reminder emails.';
comment on table public.service_reminder_queue is 'Durable, retry-safe due-date queue for automated service reminder delivery.';
comment on column public.customers.service_reminder_opt_in is 'Separate affirmative consent for automated service reminder emails.';
comment on column public.jobs.service_completed_at is 'Authoritative timestamp used to calculate recurring-service reminder eligibility.';

-- The hosted Cron call is installed only when pg_cron, pg_net, and Vault are available.
-- Runtime secrets are intentionally not stored in source. Provision Vault secrets named
-- frettrack_project_url, frettrack_anon_key, and frettrack_function_key before deployment.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  create extension if not exists pg_net with schema extensions;
exception when insufficient_privilege or feature_not_supported then
  raise notice 'Hosted Cron extensions are unavailable in this environment; the reminder queue remains usable.';
end;
$$;

create or replace function private.invoke_service_reminder_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare project_url text; anon_key text; function_key text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then return; end if;
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'frettrack_project_url' limit 1;
  select decrypted_secret into anon_key from vault.decrypted_secrets where name = 'frettrack_anon_key' limit 1;
  select decrypted_secret into function_key from vault.decrypted_secrets where name = 'frettrack_function_key' limit 1;
  if coalesce(project_url, '') = '' or coalesce(anon_key, '') = '' or coalesce(function_key, '') = '' then return; end if;
  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/send-service-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key, 'apikey', anon_key, 'x-frettrack-key', function_key),
    body := '{"limit":25}'::jsonb,
    timeout_milliseconds := 50000
  );
end;
$$;

revoke all on function private.invoke_service_reminder_dispatch() from public, anon, authenticated, service_role;

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'frettrack-service-reminders-nightly';
    perform cron.schedule('frettrack-service-reminders-nightly', '17 3 * * *', 'select private.invoke_service_reminder_dispatch()');
  end if;
exception when others then
  raise notice 'Nightly service reminder Cron could not be scheduled: %', sqlerrm;
end;
$$;
