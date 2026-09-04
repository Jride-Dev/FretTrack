-- Allow staff to deliberately route an unassigned inbound message once.
-- Direct table updates remain blocked by RLS; this RPC validates shop/customer ownership.

create or replace function private.guard_customer_message_correspondence_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.shop_id is distinct from new.shop_id
     or old.customer_id is distinct from new.customer_id
     or (old.job_id is distinct from new.job_id and not (old.job_id is null and new.job_id is not null))
     or old.thread_id is distinct from new.thread_id
     or old.channel is distinct from new.channel
     or old.direction is distinct from new.direction then
    raise exception 'Message ownership, routing, channel, and direction cannot be changed.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.assign_customer_message_job(
  p_message_id uuid,
  p_job_id uuid
)
returns public.customer_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_message public.customer_messages%rowtype;
  target_job public.jobs%rowtype;
begin
  select * into stored_message
  from public.customer_messages
  where id = p_message_id
  for update;

  if not found then
    raise exception 'Customer message was not found.' using errcode = 'P0002';
  end if;

  if stored_message.direction <> 'inbound'
     or stored_message.status <> 'received'
     or stored_message.job_id is not null then
    raise exception 'Only unassigned received inbound correspondence can be routed.'
      using errcode = '23514';
  end if;

  if not private.can_write_shop(stored_message.shop_id) then
    raise exception 'Not allowed to route customer correspondence.'
      using errcode = '42501';
  end if;

  select * into target_job
  from public.jobs
  where id = p_job_id;

  if not found
     or target_job.shop_id <> stored_message.shop_id
     or target_job.customer_id is distinct from stored_message.customer_id then
    raise exception 'Target work order must belong to the same shop and customer.'
      using errcode = '23514';
  end if;

  update public.customer_messages
  set job_id = target_job.id
  where id = stored_message.id
  returning * into stored_message;

  return stored_message;
end;
$$;

revoke all on function public.assign_customer_message_job(uuid, uuid) from public, anon;
grant execute on function public.assign_customer_message_job(uuid, uuid) to authenticated, service_role;

comment on function public.assign_customer_message_job(uuid, uuid) is
  'Routes one unassigned received inbound message to a same-shop, same-customer work order after staff write authorization.';
