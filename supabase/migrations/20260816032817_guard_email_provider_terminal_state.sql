-- Serialize provider reconciliation so a stale cancellation or failure cannot
-- replace a delivery that another request has already recorded.

create or replace function public.reconcile_customer_email_provider_state(
  p_message_id uuid,
  p_status text,
  p_provider_last_event text,
  p_provider_event_at timestamptz,
  p_sent_at timestamptz,
  p_canceled_at timestamptz,
  p_error_message text
)
returns setof public.customer_messages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored_message public.customer_messages%rowtype;
begin
  if p_status is not null and p_status not in ('sent', 'failed', 'canceled') then
    raise exception 'Unsupported provider reconciliation status: %', p_status;
  end if;

  select *
  into stored_message
  from public.customer_messages
  where id = p_message_id
    and channel = 'email'
  for update;

  if not found then
    return;
  end if;

  -- Delivery is irreversible. Once recorded, no delayed cancellation,
  -- failure, or nonterminal provider snapshot may replace it.
  if stored_message.status = 'sent' and p_status is distinct from 'sent' then
    return next stored_message;
    return;
  end if;

  -- Nonterminal snapshots cannot reopen any terminal provider result.
  if stored_message.status in ('sent', 'failed', 'canceled') and p_status is null then
    return next stored_message;
    return;
  end if;

  -- A delivered event still wins even when it was observed by an earlier
  -- request. Other older observations cannot replace newer provider state.
  if p_status is distinct from 'sent'
     and stored_message.provider_event_at is not null
     and p_provider_event_at is not null
     and p_provider_event_at < stored_message.provider_event_at then
    return next stored_message;
    return;
  end if;

  if p_status is null then
    update public.customer_messages
    set provider_last_event = p_provider_last_event,
        provider_event_at = p_provider_event_at
    where id = p_message_id
    returning * into stored_message;
  else
    update public.customer_messages
    set status = p_status,
        provider_last_event = p_provider_last_event,
        provider_event_at = p_provider_event_at,
        sent_at = p_sent_at,
        canceled_at = p_canceled_at,
        error_message = coalesce(p_error_message, '')
    where id = p_message_id
    returning * into stored_message;
  end if;

  return next stored_message;
end;
$$;

revoke all on function public.reconcile_customer_email_provider_state(uuid, text, text, timestamptz, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.reconcile_customer_email_provider_state(uuid, text, text, timestamptz, timestamptz, timestamptz, text)
  to service_role;

comment on function public.reconcile_customer_email_provider_state(uuid, text, text, timestamptz, timestamptz, timestamptz, text) is
  'Atomically applies provider email state while preserving sent precedence and rejecting stale observations.';
