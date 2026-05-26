create table if not exists public.operator_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  role text not null default 'operator' check (role in ('operator', 'admin')),
  active boolean not null default true,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists operator_users_set_updated_at on public.operator_users;
create trigger operator_users_set_updated_at
  before update on public.operator_users
  for each row
  execute function public.set_updated_at();

alter table public.operator_users enable row level security;

create or replace function private.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.operator_users
    where operator_users.user_id = auth.uid()
      and operator_users.active = true
  );
$$;

grant execute on function private.is_operator() to authenticated;

drop policy if exists "operator_users_select_self_or_operator" on public.operator_users;
create policy "operator_users_select_self_or_operator"
  on public.operator_users
  for select
  to authenticated
  using (user_id = auth.uid() or private.is_operator());

revoke all on public.operator_users from anon, public;
grant select on public.operator_users to authenticated;

create or replace function public.is_current_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.is_operator();
$$;

revoke all on function public.is_current_operator() from public, anon;
grant execute on function public.is_current_operator() to authenticated;

create or replace function public.get_beta_operator_dashboard()
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
    raise exception 'Not allowed to view operator dashboard.';
  end if;

  with latest_usage as (
    select distinct on (shop_id)
      shop_id,
      user_count,
      storage_bytes,
      job_count,
      email_count_month,
      sms_count_month,
      measured_at
    from public.shop_usage_snapshots
    order by shop_id, measured_at desc
  ),
  image_usage as (
    select
      jobs.shop_id,
      count(job_images.id)::integer as image_count,
      coalesce(sum(job_images.optimized_size_bytes), 0)::bigint as image_storage_bytes
    from public.job_images
    join public.jobs on jobs.id = job_images.job_id
    group by jobs.shop_id
  ),
  job_counts as (
    select shop_id, count(*)::integer as job_count, max(updated_at) as last_job_at
    from public.jobs
    group by shop_id
  ),
  member_counts as (
    select
      shop_members.shop_id,
      count(*)::integer as user_count,
      coalesce(
        jsonb_agg(
          auth.users.email
          order by auth.users.email
        ) filter (
          where shop_members.role in ('owner', 'admin')
            and auth.users.email is not null
        ),
        '[]'::jsonb
      ) as admin_emails
    from public.shop_members
    left join auth.users on auth.users.id = shop_members.user_id
    group by shop_members.shop_id
  ),
  message_counts as (
    select
      jobs.shop_id,
      count(*) filter (
        where customer_messages.channel = 'email'
          and customer_messages.created_at >= date_trunc('month', now())
      )::integer as email_count_month,
      count(*) filter (
        where customer_messages.channel = 'sms'
          and customer_messages.created_at >= date_trunc('month', now())
      )::integer as sms_count_month,
      max(customer_messages.created_at) as last_message_at
    from public.customer_messages
    join public.jobs on jobs.id = customer_messages.job_id
    group by jobs.shop_id
  ),
  event_counts as (
    select
      shop_id,
      max(created_at) as last_event_at,
      count(*) filter (where event_type in ('image_upload_failed', 'image_optimization_blocked'))::integer as failed_upload_count
    from public.job_events
    group by shop_id
  ),
  payment_counts as (
    select shop_id, max(created_at) as last_payment_at
    from public.payment_events
    group by shop_id
  ),
  shop_rows as (
    select
      shop_profiles.shop_id,
      shop_profiles.shop_name,
      shop_profiles.email as shop_email,
      shop_profiles.created_at,
      shop_profiles.updated_at,
      shop_profiles.onboarded_at,
      coalesce(shop_subscriptions.plan_id, 'trial') as plan_id,
      coalesce(plans.name, initcap(coalesce(shop_subscriptions.plan_id, 'trial'))) as plan_name,
      coalesce(shop_subscriptions.status, 'trialing') as subscription_status,
      shop_subscriptions.trial_ends_at,
      shop_subscriptions.grace_ends_at,
      shop_subscriptions.current_period_ends_at,
      shop_subscriptions.billing_email,
      coalesce(member_counts.user_count, latest_usage.user_count, 0) as user_count,
      coalesce(job_counts.job_count, latest_usage.job_count, 0) as job_count,
      coalesce(image_usage.image_count, 0) as image_count,
      greatest(coalesce(image_usage.image_storage_bytes, 0), coalesce(latest_usage.storage_bytes, 0)) as storage_bytes,
      coalesce(message_counts.email_count_month, latest_usage.email_count_month, 0) as email_count_month,
      coalesce(message_counts.sms_count_month, latest_usage.sms_count_month, 0) as sms_count_month,
      coalesce(event_counts.failed_upload_count, 0) as failed_upload_count,
      member_counts.admin_emails,
      latest_usage.measured_at as usage_measured_at,
      greatest(
        coalesce(shop_profiles.updated_at, shop_profiles.created_at),
        coalesce(job_counts.last_job_at, shop_profiles.created_at),
        coalesce(message_counts.last_message_at, shop_profiles.created_at),
        coalesce(event_counts.last_event_at, shop_profiles.created_at),
        coalesce(payment_counts.last_payment_at, shop_profiles.created_at)
      ) as last_activity_at
    from public.shop_profiles
    left join public.shop_subscriptions on shop_subscriptions.shop_id = shop_profiles.shop_id
    left join public.plans on plans.id = shop_subscriptions.plan_id
    left join latest_usage on latest_usage.shop_id = shop_profiles.shop_id
    left join image_usage on image_usage.shop_id = shop_profiles.shop_id
    left join job_counts on job_counts.shop_id = shop_profiles.shop_id
    left join member_counts on member_counts.shop_id = shop_profiles.shop_id
    left join message_counts on message_counts.shop_id = shop_profiles.shop_id
    left join event_counts on event_counts.shop_id = shop_profiles.shop_id
    left join payment_counts on payment_counts.shop_id = shop_profiles.shop_id
  ),
  member_rows as (
    select
      shop_members.id,
      shop_members.shop_id,
      shop_profiles.shop_name,
      shop_members.user_id,
      coalesce(auth.users.email, shop_members.display_name, '') as email,
      shop_members.display_name,
      shop_members.role,
      auth.users.last_sign_in_at,
      case
        when auth.users.email_confirmed_at is null then 'unconfirmed'
        when auth.users.banned_until is not null and auth.users.banned_until > now() then 'blocked'
        else 'active'
      end as status,
      shop_members.created_at,
      shop_members.updated_at
    from public.shop_members
    left join public.shop_profiles on shop_profiles.shop_id = shop_members.shop_id
    left join auth.users on auth.users.id = shop_members.user_id
  ),
  activity_rows as (
    select
      job_events.created_at,
      job_events.shop_id,
      shop_profiles.shop_name,
      job_events.job_id::text as subject_id,
      job_events.event_type,
      job_events.event_label,
      coalesce(job_events.event_note, '') as event_note,
      job_events.event_data
    from public.job_events
    left join public.shop_profiles on shop_profiles.shop_id = job_events.shop_id

    union all

    select
      payment_events.created_at,
      payment_events.shop_id,
      shop_profiles.shop_name,
      payment_events.id::text as subject_id,
      'payment_added',
      'Payment added',
      coalesce(payment_events.payment_method_code, ''),
      jsonb_build_object(
        'amountMinor', payment_events.amount_minor,
        'currencyCode', payment_events.currency_code,
        'status', payment_events.payment_status
      )
    from public.payment_events
    left join public.shop_profiles on shop_profiles.shop_id = payment_events.shop_id

    union all

    select
      customer_messages.created_at,
      jobs.shop_id,
      shop_profiles.shop_name,
      customer_messages.id::text as subject_id,
      'customer_message_sent',
      initcap(customer_messages.channel) || ' message ' || customer_messages.status,
      coalesce(customer_messages.recipient, ''),
      jsonb_build_object(
        'channel', customer_messages.channel,
        'status', customer_messages.status,
        'templateKey', customer_messages.template_key
      )
    from public.customer_messages
    join public.jobs on jobs.id = customer_messages.job_id
    left join public.shop_profiles on shop_profiles.shop_id = jobs.shop_id

    union all

    select
      shop_profiles.onboarded_at,
      shop_profiles.shop_id,
      shop_profiles.shop_name,
      shop_profiles.shop_id,
      'onboarding_completed',
      'Onboarding completed',
      coalesce(shop_profiles.shop_name, ''),
      '{}'::jsonb
    from public.shop_profiles
    where shop_profiles.onboarded_at is not null
  ),
  limited_activity as (
    select *
    from activity_rows
    order by created_at desc
    limit 50
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'totalBetaShops', (select count(*) from shop_rows),
      'activeUsers', (select count(distinct user_id) from member_rows where status = 'active'),
      'trialingShops', (select count(*) from shop_rows where subscription_status = 'trialing'),
      'betaBypassShops', (select count(*) from shop_rows where subscription_status = 'beta_bypass'),
      'graceOrReadOnlyShops', (select count(*) from shop_rows where subscription_status in ('grace', 'read_only', 'canceled')),
      'totalStorageBytes', coalesce((select sum(storage_bytes) from shop_rows), 0),
      'totalJobs', coalesce((select sum(job_count) from shop_rows), 0),
      'recentActivityCount', (select count(*) from limited_activity),
      'failedUploadCount', coalesce((select sum(failed_upload_count) from shop_rows), 0)
    ),
    'shops', coalesce((
      select jsonb_agg(to_jsonb(shop_rows) order by last_activity_at desc nulls last)
      from shop_rows
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(to_jsonb(member_rows) order by last_sign_in_at desc nulls last, created_at desc)
      from member_rows
    ), '[]'::jsonb),
    'usage', coalesce((
      select jsonb_agg(to_jsonb(shop_rows) order by storage_bytes desc, job_count desc)
      from shop_rows
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(to_jsonb(limited_activity) order by created_at desc)
      from limited_activity
    ), '[]'::jsonb)
  )
  into payload;

  return payload;
end;
$$;

revoke all on function public.get_beta_operator_dashboard() from public, anon;
grant execute on function public.get_beta_operator_dashboard() to authenticated;

create or replace function public.update_beta_shop_subscription(
  target_shop_id text,
  next_status text default null,
  extend_trial_days integer default null,
  beta_bypass boolean default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  current_subscription public.shop_subscriptions%rowtype;
  resolved_status text;
  resolved_trial_ends_at timestamptz;
  resolved_grace_ends_at timestamptz;
begin
  if not private.is_operator() then
    raise exception 'Not allowed to update beta shop access.';
  end if;

  if not exists (select 1 from public.shop_profiles where shop_id = target_shop_id) then
    raise exception 'Shop not found.';
  end if;

  if next_status is not null
    and next_status not in ('trialing', 'active', 'grace', 'read_only', 'canceled', 'beta_bypass') then
    raise exception 'Invalid subscription status.';
  end if;

  select *
  into current_subscription
  from public.shop_subscriptions
  where shop_id = target_shop_id;

  resolved_status := coalesce(current_subscription.status, 'trialing');
  resolved_trial_ends_at := current_subscription.trial_ends_at;
  resolved_grace_ends_at := current_subscription.grace_ends_at;

  if beta_bypass is not null then
    resolved_status := case when beta_bypass then 'beta_bypass' else 'trialing' end;
  end if;

  if next_status is not null then
    resolved_status := next_status;
  end if;

  if extend_trial_days is not null and extend_trial_days <> 0 then
    resolved_trial_ends_at := greatest(coalesce(resolved_trial_ends_at, now()), now()) + make_interval(days => extend_trial_days);
    resolved_grace_ends_at := resolved_trial_ends_at + interval '14 days';
    if resolved_status in ('read_only', 'canceled') then
      resolved_status := 'trialing';
    end if;
  end if;

  insert into public.shop_subscriptions (
    shop_id,
    plan_id,
    status,
    trial_ends_at,
    grace_ends_at,
    billing_email
  )
  values (
    target_shop_id,
    coalesce(current_subscription.plan_id, 'trial'),
    resolved_status,
    resolved_trial_ends_at,
    resolved_grace_ends_at,
    coalesce(current_subscription.billing_email, '')
  )
  on conflict (shop_id) do update
  set
    status = excluded.status,
    trial_ends_at = excluded.trial_ends_at,
    grace_ends_at = excluded.grace_ends_at,
    updated_at = now()
  returning * into current_subscription;

  return jsonb_build_object(
    'shopId', current_subscription.shop_id,
    'planId', current_subscription.plan_id,
    'status', current_subscription.status,
    'trialEndsAt', current_subscription.trial_ends_at,
    'graceEndsAt', current_subscription.grace_ends_at,
    'updatedAt', current_subscription.updated_at
  );
end;
$$;

revoke all on function public.update_beta_shop_subscription(text, text, integer, boolean) from public, anon;
grant execute on function public.update_beta_shop_subscription(text, text, integer, boolean) to authenticated;
