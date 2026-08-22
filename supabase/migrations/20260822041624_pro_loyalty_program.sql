insert into public.plan_entitlements (plan_id, key, value)
values
  ('free', 'loyalty_program', 'false'::jsonb),
  ('solo', 'loyalty_program', 'false'::jsonb),
  ('shop', 'loyalty_program', 'false'::jsonb),
  ('pro', 'loyalty_program', 'true'::jsonb),
  ('enterprise', 'loyalty_program', 'true'::jsonb),
  ('trial', 'loyalty_program', 'false'::jsonb)
on conflict (plan_id, key) do update set value = excluded.value, updated_at = now();

create table public.loyalty_program_rules (
  shop_id text primary key references public.shop_profiles(shop_id) on delete cascade,
  enabled boolean not null default false,
  program_started_at timestamptz,
  points_per_paid_job integer not null default 1 check (points_per_paid_job between 1 and 10),
  reward_threshold integer not null default 5 check (reward_threshold between 2 and 100),
  reward_name text not null default 'Loyalty reward' check (char_length(reward_name) between 1 and 120),
  terms text not null default 'Reward redemption is recorded in FretTrack. Apply any invoice discount separately.' check (char_length(terms) <= 1000),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.loyalty_program_rules (shop_id)
select shop_id from public.shop_profiles
on conflict (shop_id) do nothing;

create or replace function private.set_loyalty_program_start()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.enabled then
    new.program_started_at := coalesce(new.program_started_at, now());
  elsif tg_op = 'UPDATE' and new.enabled and old.enabled is not true then
    new.program_started_at := coalesce(new.program_started_at, old.program_started_at, now());
  end if;
  return new;
end;
$$;

create trigger loyalty_program_rules_set_start
  before insert or update of enabled on public.loyalty_program_rules
  for each row execute function private.set_loyalty_program_start();

create or replace function private.ensure_loyalty_rule_for_shop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.loyalty_program_rules (shop_id) values (new.shop_id)
  on conflict (shop_id) do nothing;
  return new;
end;
$$;

create trigger shop_profiles_ensure_loyalty_rule
  after insert on public.shop_profiles
  for each row execute function private.ensure_loyalty_rule_for_shop();

create table public.loyalty_job_awards (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  source_job_id uuid not null references public.jobs(id) on delete cascade,
  points integer not null check (points between 1 and 10),
  active boolean not null default true,
  total_due_snapshot numeric(14,2) not null default 0,
  paid_total_snapshot numeric(14,2) not null default 0,
  qualified_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_job_id),
  check ((active and reversed_at is null) or (not active and reversed_at is not null))
);

create table public.loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  source_job_id uuid references public.jobs(id) on delete set null,
  points_spent integer not null check (points_spent > 0),
  reward_name_snapshot text not null check (char_length(reward_name_snapshot) between 1 and 120),
  note text not null default '' check (char_length(note) <= 500),
  idempotency_key uuid not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (shop_id, idempotency_key)
);

create index loyalty_job_awards_customer_idx on public.loyalty_job_awards (shop_id, customer_id, active, qualified_at desc);
create index loyalty_redemptions_customer_idx on public.loyalty_redemptions (shop_id, customer_id, created_at desc);

create trigger loyalty_program_rules_set_updated_at
  before update on public.loyalty_program_rules
  for each row execute function public.set_updated_at();
create trigger loyalty_job_awards_set_updated_at
  before update on public.loyalty_job_awards
  for each row execute function public.set_updated_at();

create or replace function private.loyalty_numeric(value text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when btrim(coalesce(value, '')) ~ '^-?[0-9]+([.][0-9]+)?$' then btrim(value)::numeric
    else 0::numeric
  end;
$$;

create or replace function private.calculate_loyalty_job_totals(target_job_id uuid)
returns table(total_due numeric, paid_total numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with job_values as (
    select
      jobs.tech_details,
      profiles.sales_tax_rate as shop_tax_rate,
      profiles.taxable_parts_default,
      profiles.taxable_services_default,
      case
        when coalesce(jobs.tech_details -> 'tax' ->> 'rateSource', 'shop') = 'shop' then coalesce(profiles.sales_tax_rate, 0)
        else private.loyalty_numeric(jobs.tech_details -> 'tax' ->> 'salesTaxRate')
      end as tax_rate,
      case coalesce(jobs.tech_details -> 'tax' ->> 'taxableParts', '')
        when 'true' then true when 'false' then false else coalesce(profiles.taxable_parts_default, true)
      end as taxable_parts,
      case coalesce(jobs.tech_details -> 'tax' ->> 'taxableServices', '')
        when 'true' then true when 'false' then false else coalesce(profiles.taxable_services_default, false)
      end as taxable_services,
      coalesce(jobs.tech_details ->> 'discountType', 'none') as discount_type,
      private.loyalty_numeric(jobs.tech_details ->> 'discountValue') as discount_value
    from public.jobs jobs
    join public.shop_profiles profiles on profiles.shop_id = jobs.shop_id
    where jobs.id = target_job_id
  ),
  parts as (
    select coalesce(sum(parts.retail * parts.quantity), 0)::numeric as amount
    from public.job_parts parts
    join job_values on true
    where parts.job_id = target_job_id
      and not exists (
        select 1
        from jsonb_array_elements_text(coalesce(job_values.tech_details -> 'includedPartIds', '[]'::jsonb)) included(part_id)
        where included.part_id = parts.id::text
      )
  ),
  services as (
    select coalesce(sum(services.retail * services.quantity), 0)::numeric as amount
    from public.job_services services
    where services.job_id = target_job_id
  ),
  payments as (
    select coalesce(sum(private.loyalty_numeric(payment ->> 'amount')), 0)::numeric as amount
    from job_values
    cross join lateral jsonb_array_elements(coalesce(job_values.tech_details -> 'payments', '[]'::jsonb)) payment
  ),
  totals as (
    select
      parts.amount as parts_total,
      services.amount as services_total,
      payments.amount as paid_total,
      job_values.*
    from job_values cross join parts cross join services cross join payments
  )
  select
    round(greatest(
      parts_total + services_total
      - case
          when discount_type = 'percent' then (parts_total + services_total) * least(greatest(discount_value, 0), 100) / 100
          when discount_type = 'dollar' then least(greatest(discount_value, 0), parts_total + services_total)
          else 0
        end
      + ((case when taxable_parts then parts_total else 0 end) + (case when taxable_services then services_total else 0 end)) * tax_rate / 100,
      0
    ), 2),
    round(paid_total, 2)
  from totals;
$$;

create or replace function private.refresh_job_loyalty_award(target_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.jobs%rowtype;
  target_rule public.loyalty_program_rules%rowtype;
  existing_award public.loyalty_job_awards%rowtype;
  calculated_total numeric := 0;
  calculated_paid numeric := 0;
  qualifies boolean := false;
begin
  select * into target_job from public.jobs where id = target_job_id;
  if target_job.id is null then return; end if;
  select * into target_rule from public.loyalty_program_rules where shop_id = target_job.shop_id;
  select * into existing_award from public.loyalty_job_awards where source_job_id = target_job.id;
  select totals.total_due, totals.paid_total into calculated_total, calculated_paid
  from private.calculate_loyalty_job_totals(target_job.id) totals;

  if existing_award.id is not null and (
    existing_award.shop_id is distinct from target_job.shop_id
    or existing_award.customer_id is distinct from target_job.customer_id
  ) then
    update public.loyalty_job_awards
    set active = false,
        total_due_snapshot = calculated_total,
        paid_total_snapshot = calculated_paid,
        reversed_at = coalesce(reversed_at, now()),
        reversal_reason = case
          when target_job.customer_id is null then 'Work order has no linked customer.'
          else 'Work order customer or shop changed after loyalty qualification.'
        end
    where id = existing_award.id and active;
    return;
  end if;

  qualifies := target_job.customer_id is not null
    and target_job.status in ('Completed', 'Picked Up')
    and calculated_total > 0.005
    and calculated_paid + 0.005 >= calculated_total
    and target_rule.enabled is true
    and target_rule.program_started_at is not null
    and target_job.created_at >= target_rule.program_started_at
    and private.shop_has_entitlement(target_job.shop_id, 'loyalty_program');

  if qualifies then
    insert into public.loyalty_job_awards (
      shop_id, customer_id, source_job_id, points, active,
      total_due_snapshot, paid_total_snapshot, reversed_at, reversal_reason
    ) values (
      target_job.shop_id, target_job.customer_id, target_job.id,
      target_rule.points_per_paid_job, true, calculated_total, calculated_paid, null, ''
    )
    on conflict (source_job_id) do update set
      shop_id = excluded.shop_id,
      customer_id = excluded.customer_id,
      points = public.loyalty_job_awards.points,
      active = true,
      total_due_snapshot = excluded.total_due_snapshot,
      paid_total_snapshot = excluded.paid_total_snapshot,
      reversed_at = null,
      reversal_reason = '';
  else
    update public.loyalty_job_awards
    set active = false,
        total_due_snapshot = calculated_total,
        paid_total_snapshot = calculated_paid,
        reversed_at = coalesce(reversed_at, now()),
        reversal_reason = case
          when target_job.status not in ('Completed', 'Picked Up') then 'Work order is no longer completed.'
          when target_job.customer_id is null then 'Work order has no linked customer.'
          when calculated_total <= 0.005 then 'Work order has no positive billed total.'
          when calculated_paid + 0.005 < calculated_total then 'Work order is no longer fully paid.'
          when target_rule.enabled is not true then 'The loyalty program is disabled.'
          when target_rule.program_started_at is null or target_job.created_at < target_rule.program_started_at then 'Work order predates the loyalty program.'
          else 'The shop no longer has the Loyalty Program entitlement.'
        end
    where source_job_id = target_job.id and active;
  end if;
end;
$$;

create or replace function private.refresh_job_loyalty_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_job_loyalty_award(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

create or replace function private.refresh_job_child_loyalty_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_job_loyalty_award(coalesce(new.job_id, old.job_id));
  return coalesce(new, old);
end;
$$;

create trigger jobs_refresh_loyalty_award
  after insert or update of status, customer_id, tech_details on public.jobs
  for each row execute function private.refresh_job_loyalty_trigger();
create trigger job_parts_refresh_loyalty_award
  after insert or update or delete on public.job_parts
  for each row execute function private.refresh_job_child_loyalty_trigger();
create trigger job_services_refresh_loyalty_award
  after insert or update or delete on public.job_services
  for each row execute function private.refresh_job_child_loyalty_trigger();

create or replace function public.rebuild_loyalty_program(target_shop_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare job_row record; refreshed integer := 0;
begin
  if auth.uid() is null or not private.has_shop_role(target_shop_id, array['owner', 'admin']) then
    raise exception 'Only a shop owner or admin can rebuild loyalty awards.' using errcode = '42501';
  end if;
  if not private.shop_has_entitlement(target_shop_id, 'loyalty_program') then
    raise exception 'The Loyalty Program is available on Pro.' using errcode = '42501';
  end if;
  for job_row in select id from public.jobs where shop_id = target_shop_id loop
    perform private.refresh_job_loyalty_award(job_row.id);
    refreshed := refreshed + 1;
  end loop;
  return refreshed;
end;
$$;

create or replace function public.get_customer_loyalty_summary(target_customer_id uuid)
returns table(
  customer_id uuid, earned_points integer, redeemed_points integer, available_points integer,
  reward_threshold integer, available_rewards integer, points_to_next_reward integer, reward_name text,
  program_enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare target_customer public.customers%rowtype; target_rule public.loyalty_program_rules%rowtype;
  earned integer := 0; redeemed integer := 0; available integer := 0;
begin
  select * into target_customer from public.customers where id = target_customer_id;
  if target_customer.id is null or auth.uid() is null or not private.is_shop_member(target_customer.shop_id) then
    raise exception 'Customer loyalty access denied.' using errcode = '42501';
  end if;
  if not private.shop_has_entitlement(target_customer.shop_id, 'loyalty_program') then
    raise exception 'The Loyalty Program is available on Pro.' using errcode = '42501';
  end if;
  select * into target_rule from public.loyalty_program_rules where shop_id = target_customer.shop_id;
  select coalesce(sum(awards.points), 0)::integer into earned
  from public.loyalty_job_awards awards
  where awards.customer_id = target_customer.id and awards.shop_id = target_customer.shop_id and awards.active;
  select coalesce(sum(redemptions.points_spent), 0)::integer into redeemed
  from public.loyalty_redemptions redemptions
  where redemptions.customer_id = target_customer.id and redemptions.shop_id = target_customer.shop_id;
  available := greatest(earned - redeemed, 0);
  return query select target_customer.id, earned, redeemed, available,
    target_rule.reward_threshold,
    case when target_rule.enabled then floor(available::numeric / target_rule.reward_threshold)::integer else 0 end,
    case when target_rule.enabled then mod(available, target_rule.reward_threshold) else 0 end,
    target_rule.reward_name,
    coalesce(target_rule.enabled, false);
end;
$$;

create or replace function public.redeem_customer_loyalty_reward(
  target_customer_id uuid, target_idempotency_key uuid,
  target_source_job_id uuid default null, target_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare target_customer public.customers%rowtype; target_rule public.loyalty_program_rules%rowtype;
  existing_redemption public.loyalty_redemptions%rowtype; earned integer := 0; redeemed integer := 0;
  created_id uuid;
begin
  if target_idempotency_key is null then
    raise exception 'A redemption idempotency key is required.' using errcode = '22023';
  end if;
  select * into target_customer from public.customers where id = target_customer_id for update;
  if target_customer.id is null or auth.uid() is null or not private.can_write_shop(target_customer.shop_id) then
    raise exception 'Customer loyalty redemption access denied.' using errcode = '42501';
  end if;
  if not private.shop_has_entitlement(target_customer.shop_id, 'loyalty_program') then
    raise exception 'The Loyalty Program is available on Pro.' using errcode = '42501';
  end if;
  select * into existing_redemption from public.loyalty_redemptions
  where shop_id = target_customer.shop_id and idempotency_key = target_idempotency_key;
  if existing_redemption.id is not null then
    if existing_redemption.customer_id <> target_customer.id then
      raise exception 'The loyalty redemption key belongs to another customer.' using errcode = '23505';
    end if;
    return existing_redemption.id;
  end if;
  select * into target_rule from public.loyalty_program_rules where shop_id = target_customer.shop_id;
  if target_rule.enabled is not true then
    raise exception 'The shop loyalty program is disabled.' using errcode = '22023';
  end if;
  if target_source_job_id is not null and not exists (
    select 1 from public.jobs where id = target_source_job_id and shop_id = target_customer.shop_id and customer_id = target_customer.id
  ) then
    raise exception 'The redemption work order does not belong to this customer.' using errcode = '22023';
  end if;
  select coalesce(sum(points), 0)::integer into earned
  from public.loyalty_job_awards where customer_id = target_customer.id and shop_id = target_customer.shop_id and active;
  select coalesce(sum(points_spent), 0)::integer into redeemed
  from public.loyalty_redemptions where customer_id = target_customer.id and shop_id = target_customer.shop_id;
  if earned - redeemed < target_rule.reward_threshold then
    raise exception 'This customer has not earned enough loyalty points.' using errcode = '22023';
  end if;
  insert into public.loyalty_redemptions (
    shop_id, customer_id, source_job_id, points_spent, reward_name_snapshot,
    note, idempotency_key, created_by
  ) values (
    target_customer.shop_id, target_customer.id, target_source_job_id,
    target_rule.reward_threshold, target_rule.reward_name,
    left(coalesce(target_note, ''), 500), target_idempotency_key, auth.uid()
  ) returning id into created_id;
  return created_id;
end;
$$;

alter table public.loyalty_program_rules enable row level security;
alter table public.loyalty_job_awards enable row level security;
alter table public.loyalty_redemptions enable row level security;

create policy loyalty_program_rules_select_member on public.loyalty_program_rules
  for select to authenticated using (private.is_shop_member(shop_id) and private.shop_has_entitlement(shop_id, 'loyalty_program'));
create policy loyalty_program_rules_insert_manager on public.loyalty_program_rules
  for insert to authenticated with check (private.has_shop_role(shop_id, array['owner', 'admin']) and private.shop_has_entitlement(shop_id, 'loyalty_program'));
create policy loyalty_program_rules_update_manager on public.loyalty_program_rules
  for update to authenticated using (private.has_shop_role(shop_id, array['owner', 'admin']))
  with check (private.has_shop_role(shop_id, array['owner', 'admin']) and private.shop_has_entitlement(shop_id, 'loyalty_program'));
create policy loyalty_job_awards_select_member on public.loyalty_job_awards
  for select to authenticated using (private.is_shop_member(shop_id) and private.shop_has_entitlement(shop_id, 'loyalty_program'));
create policy loyalty_redemptions_select_member on public.loyalty_redemptions
  for select to authenticated using (private.is_shop_member(shop_id) and private.shop_has_entitlement(shop_id, 'loyalty_program'));

revoke all on public.loyalty_program_rules, public.loyalty_job_awards, public.loyalty_redemptions from public, anon, authenticated, service_role;
grant select, insert, update on public.loyalty_program_rules to authenticated;
grant select on public.loyalty_job_awards, public.loyalty_redemptions to authenticated;
grant select, insert, update, delete on public.loyalty_program_rules, public.loyalty_job_awards, public.loyalty_redemptions to service_role;

revoke all on function public.rebuild_loyalty_program(text) from public, anon, authenticated, service_role;
revoke all on function public.get_customer_loyalty_summary(uuid) from public, anon, authenticated, service_role;
revoke all on function public.redeem_customer_loyalty_reward(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.rebuild_loyalty_program(text) to authenticated;
grant execute on function public.get_customer_loyalty_summary(uuid) to authenticated;
grant execute on function public.redeem_customer_loyalty_reward(uuid, uuid, uuid, text) to authenticated;

revoke all on function private.calculate_loyalty_job_totals(uuid) from public, anon, authenticated, service_role;
revoke all on function private.loyalty_numeric(text) from public, anon, authenticated, service_role;
revoke all on function private.ensure_loyalty_rule_for_shop() from public, anon, authenticated, service_role;
revoke all on function private.set_loyalty_program_start() from public, anon, authenticated, service_role;
revoke all on function private.refresh_job_loyalty_award(uuid) from public, anon, authenticated, service_role;
revoke all on function private.refresh_job_loyalty_trigger() from public, anon, authenticated, service_role;
revoke all on function private.refresh_job_child_loyalty_trigger() from public, anon, authenticated, service_role;

comment on table public.loyalty_job_awards is 'Reconciled Pro loyalty stamps backed by completed and fully paid work orders.';
comment on table public.loyalty_redemptions is 'Auditable staff-confirmed loyalty reward redemptions; these do not alter invoice accounting automatically.';
