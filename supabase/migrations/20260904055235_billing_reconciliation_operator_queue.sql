create or replace function public.get_billing_reconciliation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if not private.is_operator() then
    raise exception 'Not allowed to view billing reconciliation.';
  end if;

  with reconciliation_rows as (
    select
      profiles.shop_id,
      profiles.shop_name,
      coalesce(nullif(subscriptions.billing_email, ''), profiles.email, '') as billing_email,
      coalesce(subscriptions.plan_id, profiles.subscription_tier, 'free') as plan_id,
      coalesce(subscriptions.status, profiles.subscription_status, 'active') as subscription_status,
      subscriptions.provider_status,
      subscriptions.billing_interval,
      subscriptions.current_period_ends_at,
      subscriptions.updated_at,
      subscriptions.stripe_customer_id,
      subscriptions.stripe_subscription_id,
      subscriptions.stripe_price_id,
      case
        when subscriptions.shop_id is null then 'missing_subscription'
        when coalesce(subscriptions.status, '') in ('active', 'past_due', 'incomplete')
          and nullif(subscriptions.stripe_customer_id, '') is null then 'missing_customer_id'
        when coalesce(subscriptions.status, '') in ('active', 'past_due', 'incomplete')
          and nullif(subscriptions.stripe_subscription_id, '') is null then 'missing_subscription_id'
        when coalesce(subscriptions.status, '') in ('active', 'past_due', 'incomplete')
          and nullif(subscriptions.provider_status, '') is null then 'missing_provider_status'
        when coalesce(subscriptions.status, '') in ('active', 'past_due', 'incomplete')
          and subscriptions.current_period_ends_at is null then 'missing_period_end'
        when subscriptions.status = 'active'
          and lower(coalesce(subscriptions.provider_status, '')) not in ('active', 'trialing') then 'provider_status_mismatch'
        when subscriptions.status = 'past_due'
          and lower(coalesce(subscriptions.provider_status, '')) <> 'past_due' then 'provider_status_mismatch'
        when subscriptions.status = 'incomplete'
          and lower(coalesce(subscriptions.provider_status, '')) <> 'incomplete' then 'provider_status_mismatch'
        else 'ok'
      end as issue_code
    from public.shop_profiles profiles
    left join public.shop_subscriptions subscriptions on subscriptions.shop_id = profiles.shop_id
  )
  select coalesce(jsonb_agg(to_jsonb(reconciliation_rows) order by
    case when issue_code = 'ok' then 1 else 0 end,
    updated_at desc nulls last,
    shop_name), '[]'::jsonb)
  into payload
  from reconciliation_rows;

  return payload;
end;
$$;

revoke all on function public.get_billing_reconciliation_queue() from public, anon;
grant execute on function public.get_billing_reconciliation_queue() to authenticated;
