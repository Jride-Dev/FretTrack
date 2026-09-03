alter table public.jobs
  add column if not exists estimate_decision_source text not null default 'staff',
  add column if not exists estimate_decision_link_id uuid;

alter table public.jobs
  drop constraint if exists jobs_estimate_lifecycle_check;

alter table public.jobs
  add constraint jobs_estimate_lifecycle_check
  check (
    (
      estimate_status = 'draft'
      and estimate_snapshot is null
      and estimate_sent_at is null
      and estimate_sent_by is null
      and estimate_decided_at is null
      and estimate_decided_by is null
      and estimate_status_note is null
      and estimate_decision_source = 'staff'
      and estimate_decision_link_id is null
    )
    or (
      estimate_status = 'sent'
      and pg_catalog.jsonb_typeof(estimate_snapshot) = 'object'
      and estimate_sent_at is not null
      and estimate_sent_by is not null
      and estimate_decided_at is null
      and estimate_decided_by is null
      and char_length(btrim(estimate_status_note)) between 8 and 500
      and estimate_decision_source = 'staff'
      and estimate_decision_link_id is null
    )
    or (
      estimate_status in ('approved', 'declined')
      and pg_catalog.jsonb_typeof(estimate_snapshot) = 'object'
      and estimate_sent_at is not null
      and estimate_sent_by is not null
      and estimate_decided_at is not null
      and char_length(btrim(estimate_status_note)) between 8 and 500
      and (
        (
          estimate_decision_source = 'staff'
          and estimate_decided_by is not null
          and estimate_decision_link_id is null
        )
        or (
          estimate_decision_source = 'customer_link'
          and estimate_decided_by is null
          and estimate_decision_link_id is not null
        )
      )
    )
  );

create table if not exists private.public_estimate_links (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  shop_id text not null,
  estimate_revision integer not null check (estimate_revision > 0),
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);

create index if not exists public_estimate_links_job_revision_idx
  on private.public_estimate_links (job_id, estimate_revision);

create index if not exists public_estimate_links_active_token_idx
  on private.public_estimate_links (token_hash)
  where revoked_at is null;

alter table private.public_estimate_links enable row level security;
revoke all on private.public_estimate_links from public, anon, authenticated, service_role;

create or replace function private.guard_job_estimate_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  monetary_fields_changed boolean;
  estimate_fields_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.estimate_status <> 'draft'
      or new.estimate_snapshot is not null
      or new.estimate_revision <> 0
      or new.estimate_sent_at is not null
      or new.estimate_sent_by is not null
      or new.estimate_decided_at is not null
      or new.estimate_decided_by is not null
      or new.estimate_status_note is not null
      or new.estimate_last_request_id is not null
      or new.estimate_decision_source <> 'staff'
      or new.estimate_decision_link_id is not null then
      raise exception 'New work orders must begin with a draft estimate.' using errcode = '42501';
    end if;
    return new;
  end if;

  monetary_fields_changed :=
    coalesce(new.tech_details ->> 'discountType', 'none') is distinct from coalesce(old.tech_details ->> 'discountType', 'none')
    or coalesce(new.tech_details ->> 'discountValue', '') is distinct from coalesce(old.tech_details ->> 'discountValue', '')
    or coalesce(new.tech_details -> 'tax', '{}'::jsonb) is distinct from coalesce(old.tech_details -> 'tax', '{}'::jsonb);
  estimate_fields_changed :=
    new.estimate_status is distinct from old.estimate_status
    or new.estimate_snapshot is distinct from old.estimate_snapshot
    or new.estimate_revision is distinct from old.estimate_revision
    or new.estimate_sent_at is distinct from old.estimate_sent_at
    or new.estimate_sent_by is distinct from old.estimate_sent_by
    or new.estimate_decided_at is distinct from old.estimate_decided_at
    or new.estimate_decided_by is distinct from old.estimate_decided_by
    or new.estimate_status_note is distinct from old.estimate_status_note
    or new.estimate_last_request_id is distinct from old.estimate_last_request_id
    or new.estimate_decision_source is distinct from old.estimate_decision_source
    or new.estimate_decision_link_id is distinct from old.estimate_decision_link_id;

  if estimate_fields_changed
    and pg_catalog.current_setting('frettrack.estimate_rpc', true) is distinct from 'on' then
    raise exception 'Estimate state must use the guarded estimate action.' using errcode = '42501';
  end if;
  if old.estimate_status <> 'draft' and monetary_fields_changed then
    raise exception 'Sent or decided estimate charges are locked. Return the estimate to draft before changing them.' using errcode = '55000';
  end if;
  if old.estimate_status in ('sent', 'declined')
    and old.invoice_finalized_at is null
    and new.invoice_finalized_at is not null then
    raise exception 'Only an approved estimate can be finalized after it has been sent.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.set_job_estimate_state(
  p_job_id uuid,
  p_status text,
  p_note text,
  p_expected_updated_at timestamptz default null,
  p_request_id uuid default pg_catalog.gen_random_uuid()
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.jobs%rowtype;
  saved_job public.jobs%rowtype;
  clean_status text := lower(btrim(coalesce(p_status, '')));
  clean_note text := btrim(coalesce(p_note, ''));
  snapshot jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if clean_status not in ('draft', 'sent', 'approved', 'declined') then
    raise exception 'Unsupported estimate state.' using errcode = '22023';
  end if;
  if char_length(clean_note) < 8 or char_length(clean_note) > 500 then
    raise exception 'Enter an estimate audit note between 8 and 500 characters.' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'An estimate request ID is required.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_job_id::text, 0));
  select * into target_job
  from public.jobs
  where id = p_job_id
  for update;

  if target_job.id is null then
    raise exception 'Work order not found.' using errcode = 'P0002';
  end if;
  if not private.has_shop_role(target_job.shop_id, array['owner', 'admin']) then
    raise exception 'Only a shop owner or admin can change estimate state.' using errcode = '42501';
  end if;
  if not private.shop_lifecycle_allows_write(target_job.shop_id) then
    raise exception 'This shop is read-only.' using errcode = '42501';
  end if;
  if target_job.accounting_voided_at is not null then
    raise exception 'An accounting-excluded work order cannot use estimates.' using errcode = '55000';
  end if;
  if target_job.invoice_finalized_at is not null then
    raise exception 'Reopen the finalized invoice before changing estimate state.' using errcode = '55000';
  end if;
  if target_job.estimate_last_request_id = p_request_id then
    return target_job;
  end if;
  if p_expected_updated_at is not null and target_job.updated_at is distinct from p_expected_updated_at then
    raise exception 'This job changed in another session. Reload it before changing the estimate.' using errcode = '40001';
  end if;
  if target_job.estimate_status = clean_status then
    return target_job;
  end if;
  if target_job.estimate_status = 'draft' and clean_status <> 'sent' then
    raise exception 'A draft estimate must be sent before it can be approved or declined.' using errcode = '55000';
  end if;
  if target_job.estimate_status = 'sent' and clean_status not in ('draft', 'approved', 'declined') then
    raise exception 'A sent estimate can only be approved, declined, or returned to draft.' using errcode = '55000';
  end if;
  if target_job.estimate_status in ('approved', 'declined') and clean_status <> 'draft' then
    raise exception 'Return the decided estimate to draft before starting another revision.' using errcode = '55000';
  end if;

  perform pg_catalog.set_config('frettrack.estimate_rpc', 'on', true);
  if clean_status = 'sent' then
    snapshot := private.calculate_job_invoice_snapshot(target_job.id);
    update public.jobs
    set estimate_status = 'sent',
        estimate_snapshot = snapshot,
        estimate_revision = estimate_revision + 1,
        estimate_sent_at = pg_catalog.now(),
        estimate_sent_by = (select auth.uid()),
        estimate_decided_at = null,
        estimate_decided_by = null,
        estimate_status_note = clean_note,
        estimate_last_request_id = p_request_id,
        estimate_decision_source = 'staff',
        estimate_decision_link_id = null,
        updated_at = pg_catalog.now()
    where id = target_job.id
    returning * into saved_job;
  elsif clean_status in ('approved', 'declined') then
    update public.jobs
    set estimate_status = clean_status,
        estimate_decided_at = pg_catalog.now(),
        estimate_decided_by = (select auth.uid()),
        estimate_status_note = clean_note,
        estimate_last_request_id = p_request_id,
        estimate_decision_source = 'staff',
        estimate_decision_link_id = null,
        updated_at = pg_catalog.now()
    where id = target_job.id
    returning * into saved_job;
  else
    update public.jobs
    set estimate_status = 'draft',
        estimate_snapshot = null,
        estimate_sent_at = null,
        estimate_sent_by = null,
        estimate_decided_at = null,
        estimate_decided_by = null,
        estimate_status_note = null,
        estimate_last_request_id = p_request_id,
        estimate_decision_source = 'staff',
        estimate_decision_link_id = null,
        updated_at = pg_catalog.now()
    where id = target_job.id
    returning * into saved_job;
  end if;
  perform pg_catalog.set_config('frettrack.estimate_rpc', 'off', true);

  insert into public.job_events (
    shop_id, job_id, event_type, event_label, event_note, event_data, created_by
  ) values (
    saved_job.shop_id,
    saved_job.id,
    'estimate_' || clean_status,
    case clean_status
      when 'sent' then 'Estimate sent'
      when 'approved' then 'Estimate approved'
      when 'declined' then 'Estimate declined'
      else 'Estimate returned to draft'
    end,
    clean_note,
    pg_catalog.jsonb_build_object(
      'previousStatus', target_job.estimate_status,
      'status', clean_status,
      'revision', saved_job.estimate_revision,
      'requestId', p_request_id,
      'snapshot', coalesce(saved_job.estimate_snapshot, target_job.estimate_snapshot),
      'source', 'staff'
    ),
    (select auth.uid())::text
  );

  return saved_job;
end;
$$;

create or replace function public.create_public_estimate_link(
  p_job_id uuid,
  p_expected_revision integer,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.jobs%rowtype;
  link_id uuid;
  raw_token text;
  expiry timestamptz := coalesce(p_expires_at, pg_catalog.now() + interval '30 days');
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_job_id is null or p_expected_revision is null then
    raise exception 'A sent estimate revision is required.' using errcode = '22023';
  end if;
  if expiry <= pg_catalog.now() or expiry > pg_catalog.now() + interval '90 days' then
    raise exception 'Estimate links can expire between now and 90 days.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_job_id::text, 0));
  select * into target_job
  from public.jobs
  where id = p_job_id
  for update;

  if target_job.id is null then
    raise exception 'Work order not found.' using errcode = 'P0002';
  end if;
  if not private.has_shop_role(target_job.shop_id, array['owner', 'admin']) then
    raise exception 'Only a shop owner or admin can create customer estimate links.' using errcode = '42501';
  end if;
  if not private.shop_lifecycle_allows_write(target_job.shop_id) then
    raise exception 'This shop is read-only.' using errcode = '42501';
  end if;
  if target_job.accounting_voided_at is not null then
    raise exception 'An accounting-excluded work order cannot use estimates.' using errcode = '55000';
  end if;
  if target_job.estimate_status not in ('sent', 'approved')
    or target_job.estimate_revision <> p_expected_revision
    or pg_catalog.jsonb_typeof(target_job.estimate_snapshot) <> 'object' then
    raise exception 'Only the current sent estimate revision can be shared.' using errcode = '55000';
  end if;

  update private.public_estimate_links
  set revoked_at = pg_catalog.now()
  where job_id = target_job.id
    and revoked_at is null;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.public_estimate_links (
    job_id, shop_id, estimate_revision, token_hash, created_by, expires_at
  ) values (
    target_job.id,
    target_job.shop_id,
    target_job.estimate_revision,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    (select auth.uid()),
    expiry
  ) returning id into link_id;

  return pg_catalog.jsonb_build_object(
    'id', link_id,
    'token', raw_token,
    'revision', target_job.estimate_revision,
    'expiresAt', expiry
  );
end;
$$;

create or replace function public.get_public_estimate(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  link_row private.public_estimate_links%rowtype;
  target_job public.jobs%rowtype;
  shop public.shop_profiles%rowtype;
  services jsonb;
  parts jsonb;
  included_ids jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'This estimate link is invalid or expired.');
  end if;

  select * into link_row
  from private.public_estimate_links
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and revoked_at is null
    and expires_at > pg_catalog.now();

  if link_row.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'This estimate link is invalid or expired.');
  end if;

  select * into target_job
  from public.jobs
  where id = link_row.job_id
    and estimate_revision = link_row.estimate_revision
    and estimate_status in ('sent', 'approved', 'declined')
    and pg_catalog.jsonb_typeof(estimate_snapshot) = 'object';

  if target_job.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'This estimate revision is no longer available.');
  end if;

  select * into shop
  from public.shop_profiles
  where shop_id = target_job.shop_id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'description', coalesce(nullif(pg_catalog.btrim(service.description), ''), 'Service'),
    'quantity', greatest(1, least(9999, trunc(coalesce(service.quantity, 1))))::integer,
    'unitMinor', round(coalesce(service.retail, 0) * 100)::bigint,
    'lineMinor', round(coalesce(service.retail, 0) * trunc(coalesce(service.quantity, 1)) * 100)::bigint
  ) order by service.created_at, service.id), '[]'::jsonb)
  into services
  from public.job_services service
  where service.job_id = target_job.id;

  included_ids := case
    when pg_catalog.jsonb_typeof(target_job.tech_details -> 'includedPartIds') = 'array'
      then target_job.tech_details -> 'includedPartIds'
    else '[]'::jsonb
  end;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'name', coalesce(nullif(pg_catalog.btrim(case when part.sku is not null and part.sku <> '' then part.sku || ' - ' else '' end || coalesce(part.name, 'Part')), ''), 'Part'),
    'quantity', coalesce(part.quantity, 1),
    'unitMinor', round(coalesce(part.retail, part.retail_price, 0) * 100)::bigint,
    'lineMinor', round(coalesce(part.retail, part.retail_price, 0) * coalesce(part.quantity, 1) * 100)::bigint,
    'included', exists (
      select 1
      from pg_catalog.jsonb_array_elements_text(included_ids) included_id
      where included_id = part.id::text
    )
  ) order by part.created_at, part.id), '[]'::jsonb)
  into parts
  from public.job_parts part
  where part.job_id = target_job.id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'estimate', pg_catalog.jsonb_build_object(
      'jobNumber', target_job.job_number,
      'customerName', target_job.customer_name,
      'instrumentType', coalesce(target_job.tech_details ->> 'instrumentType', 'Instrument'),
      'guitarBrand', target_job.guitar_brand,
      'model', target_job.model,
      'revision', target_job.estimate_revision,
      'status', target_job.estimate_status,
      'sentAt', target_job.estimate_sent_at,
      'expiresAt', link_row.expires_at,
      'snapshot', target_job.estimate_snapshot,
      'services', services,
      'parts', parts,
      'shop', pg_catalog.jsonb_build_object(
        'name', coalesce(shop.shop_name, 'FretTrack Shop'),
        'phone', coalesce(shop.phone, ''),
        'email', coalesce(shop.email, ''),
        'address', coalesce(shop.address, ''),
        'footer', coalesce(shop.print_footer_text, ''),
        'currencyCode', coalesce(target_job.estimate_snapshot ->> 'currencyCode', shop.currency_code, 'USD'),
        'locale', coalesce(shop.locale, 'en-US')
      )
    )
  );
end;
$$;

create or replace function public.respond_to_public_estimate(
  p_token text,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row private.public_estimate_links%rowtype;
  target_job public.jobs%rowtype;
  clean_decision text := lower(pg_catalog.btrim(coalesce(p_decision, '')));
  clean_note text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'This estimate link is invalid or expired.' using errcode = '22023';
  end if;
  if clean_decision not in ('approved', 'declined') then
    raise exception 'Choose approve or decline for this estimate.' using errcode = '22023';
  end if;

  select * into link_row
  from private.public_estimate_links
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and revoked_at is null
    and expires_at > pg_catalog.now();

  if link_row.id is null then
    raise exception 'This estimate link is invalid or expired.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(link_row.job_id::text, 0));
  select * into target_job
  from public.jobs
  where id = link_row.job_id
  for update;

  if target_job.id is null
    or target_job.estimate_revision <> link_row.estimate_revision
    or pg_catalog.jsonb_typeof(target_job.estimate_snapshot) <> 'object' then
    raise exception 'This estimate revision is no longer available.' using errcode = '55000';
  end if;
  if target_job.estimate_status = clean_decision then
    return public.get_public_estimate(p_token);
  end if;
  if target_job.estimate_status <> 'sent' then
    raise exception 'This estimate has already been decided.' using errcode = '55000';
  end if;

  clean_note := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
  clean_note := coalesce(clean_note, case clean_decision
    when 'approved' then 'Customer approved estimate through secure link.'
    else 'Customer declined estimate through secure link.'
  end);
  if pg_catalog.char_length(clean_note) < 8 or pg_catalog.char_length(clean_note) > 500 then
    raise exception 'The estimate note must be between 8 and 500 characters.' using errcode = '22023';
  end if;

  perform pg_catalog.set_config('frettrack.estimate_rpc', 'on', true);
  update public.jobs
  set estimate_status = clean_decision,
      estimate_decided_at = pg_catalog.now(),
      estimate_decided_by = null,
      estimate_status_note = clean_note,
      estimate_last_request_id = pg_catalog.gen_random_uuid(),
      estimate_decision_source = 'customer_link',
      estimate_decision_link_id = link_row.id,
      updated_at = pg_catalog.now()
  where id = target_job.id;
  perform pg_catalog.set_config('frettrack.estimate_rpc', 'off', true);

  insert into public.job_events (
    shop_id, job_id, event_type, event_label, event_note, event_data, created_by
  ) values (
    target_job.shop_id,
    target_job.id,
    'estimate_' || clean_decision,
    case clean_decision when 'approved' then 'Estimate approved by customer' else 'Estimate declined by customer' end,
    clean_note,
    pg_catalog.jsonb_build_object(
      'previousStatus', 'sent',
      'status', clean_decision,
      'revision', target_job.estimate_revision,
      'source', 'customer_link',
      'linkId', link_row.id
    ),
    null
  );

  return public.get_public_estimate(p_token);
end;
$$;

revoke all on function public.create_public_estimate_link(uuid, integer, timestamptz) from public, anon;
grant execute on function public.create_public_estimate_link(uuid, integer, timestamptz) to authenticated;
revoke all on function public.get_public_estimate(text) from public;
grant execute on function public.get_public_estimate(text) to anon, authenticated;
revoke all on function public.respond_to_public_estimate(text, text, text) from public;
grant execute on function public.respond_to_public_estimate(text, text, text) to anon, authenticated;

revoke all on function private.guard_job_estimate_mutation() from public, anon, authenticated, service_role;

comment on table private.public_estimate_links is
  'Hashed bearer tokens for shop-created customer estimate revisions; raw tokens are returned only at creation.';
comment on function public.create_public_estimate_link(uuid, integer, timestamptz) is
  'Owner/admin-only creation of a revocable, expiring customer estimate link bound to one locked revision.';
comment on function public.get_public_estimate(text) is
  'Safe anonymous read of one non-draft estimate revision using a hashed bearer token.';
comment on function public.respond_to_public_estimate(text, text, text) is
  'Anonymous customer approval or decline for the current estimate revision using its bearer token.';
