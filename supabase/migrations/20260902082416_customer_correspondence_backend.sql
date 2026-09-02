-- Provider-neutral customer correspondence foundation.
-- This migration does not enable inbound email, SMS, Realtime, or a new UI.

create table public.customer_conversation_threads (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  channel text not null,
  contact_address text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_conversation_threads_channel_check
    check (channel in ('email', 'sms')),
  constraint customer_conversation_threads_status_check
    check (status in ('active', 'archived')),
  constraint customer_conversation_threads_shop_customer_channel_key
    unique (shop_id, customer_id, channel)
);

create index customer_conversation_threads_shop_updated_idx
  on public.customer_conversation_threads (shop_id, updated_at desc);

create index customer_conversation_threads_customer_updated_idx
  on public.customer_conversation_threads (customer_id, updated_at desc);

alter table public.customer_conversation_threads enable row level security;

revoke all on table public.customer_conversation_threads from public, anon, authenticated;
grant select, insert, update on table public.customer_conversation_threads to authenticated;
grant select, insert, update, delete on table public.customer_conversation_threads to service_role;

create policy "customer_conversation_threads_select_member"
  on public.customer_conversation_threads
  for select
  to authenticated
  using (private.is_shop_member(shop_id));

create policy "customer_conversation_threads_insert_writer"
  on public.customer_conversation_threads
  for insert
  to authenticated
  with check (
    private.can_write_shop(shop_id)
    and exists (
      select 1
      from public.customers
      where customers.id = customer_id
        and customers.shop_id = customer_conversation_threads.shop_id
    )
  );

create policy "customer_conversation_threads_update_writer"
  on public.customer_conversation_threads
  for update
  to authenticated
  using (private.can_write_shop(shop_id))
  with check (
    private.can_write_shop(shop_id)
    and exists (
      select 1
      from public.customers
      where customers.id = customer_id
        and customers.shop_id = customer_conversation_threads.shop_id
    )
  );

create or replace function private.guard_customer_conversation_thread_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.shop_id is distinct from new.shop_id
     or old.customer_id is distinct from new.customer_id
     or old.channel is distinct from new.channel then
    raise exception 'Conversation thread ownership and channel cannot be changed.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_customer_conversation_thread_scope() from public, anon, authenticated;

create trigger customer_conversation_threads_guard_scope
  before update on public.customer_conversation_threads
  for each row execute function private.guard_customer_conversation_thread_scope();

create trigger customer_conversation_threads_set_updated_at
  before update on public.customer_conversation_threads
  for each row execute function public.set_updated_at();

alter table public.customer_messages
  add column shop_id text,
  add column thread_id uuid references public.customer_conversation_threads(id) on delete restrict,
  add column direction text not null default 'outbound',
  add column sender_address text not null default '',
  add column received_at timestamptz,
  add column read_at timestamptz,
  add column include_in_customer_report boolean not null default false;

update public.customer_messages
set shop_id = jobs.shop_id,
    customer_id = case
      when exists (
        select 1
        from public.customers
        where customers.id = customer_messages.customer_id
          and customers.shop_id = jobs.shop_id
      ) then customer_messages.customer_id
      else jobs.customer_id
    end
from public.jobs
where jobs.id = customer_messages.job_id;

insert into public.customer_conversation_threads (
  shop_id,
  customer_id,
  channel,
  contact_address,
  created_at,
  updated_at
)
select
  customer_messages.shop_id,
  customer_messages.customer_id,
  customer_messages.channel,
  max(customer_messages.recipient),
  min(customer_messages.created_at),
  max(customer_messages.created_at)
from public.customer_messages
where customer_messages.customer_id is not null
group by customer_messages.shop_id, customer_messages.customer_id, customer_messages.channel
on conflict (shop_id, customer_id, channel) do nothing;

update public.customer_messages
set thread_id = customer_conversation_threads.id
from public.customer_conversation_threads
where customer_messages.shop_id = customer_conversation_threads.shop_id
  and customer_messages.customer_id = customer_conversation_threads.customer_id
  and customer_messages.channel = customer_conversation_threads.channel
  and customer_messages.thread_id is null;

alter table public.customer_messages
  alter column shop_id set not null,
  alter column job_id drop not null,
  add constraint customer_messages_shop_id_fkey
    foreign key (shop_id) references public.shop_profiles(shop_id) on delete cascade;

alter table public.customer_messages
  drop constraint if exists customer_messages_status_check;

alter table public.customer_messages
  add constraint customer_messages_status_check
  check (status in ('pending', 'sent', 'delivered', 'received', 'failed', 'scheduled', 'canceling', 'canceled'));

alter table public.customer_messages
  drop constraint if exists customer_messages_schedule_state_check;

alter table public.customer_messages
  add constraint customer_messages_schedule_state_check
  check (
    (status = 'pending' and sent_at is null and canceled_at is null)
    or
    (status = 'scheduled' and scheduled_at is not null and sent_at is null and canceled_at is null and cancel_requested_at is null)
    or
    (status = 'canceling' and scheduled_at is not null and sent_at is null and canceled_at is null and cancel_requested_at is not null)
    or
    (status = 'canceled' and scheduled_at is not null and sent_at is null and canceled_at is not null and cancel_requested_at is not null)
    or
    (status in ('sent', 'delivered') and sent_at is not null and canceled_at is null)
    or
    (status = 'received' and received_at is not null and sent_at is null and canceled_at is null)
    or
    (status = 'failed' and canceled_at is null)
  );

alter table public.customer_messages
  add constraint customer_messages_direction_check
    check (direction in ('inbound', 'outbound')),
  add constraint customer_messages_direction_state_check
    check (
      (direction = 'outbound' and status <> 'received' and received_at is null and read_at is null)
      or
      (direction = 'inbound' and status in ('received', 'failed') and scheduled_at is null and sent_at is null and canceled_at is null)
    ),
  add constraint customer_messages_report_inclusion_check
    check (
      include_in_customer_report = false
      or (
        nullif(btrim(body), '') is not null
        and (
          (direction = 'outbound' and status in ('sent', 'delivered'))
          or (direction = 'inbound' and status = 'received')
        )
      )
    );

create unique index customer_messages_inbound_provider_id_uidx
  on public.customer_messages (provider, provider_message_id)
  where direction = 'inbound'
    and provider <> ''
    and provider_message_id <> '';

create index customer_messages_thread_activity_idx
  on public.customer_messages (
    thread_id,
    coalesce(received_at, sent_at, scheduled_at, created_at) desc
  )
  where thread_id is not null;

create index customer_messages_shop_unassigned_idx
  on public.customer_messages (shop_id, created_at desc)
  where job_id is null;

create or replace function private.prepare_customer_message_correspondence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_job public.jobs%rowtype;
  target_thread public.customer_conversation_threads%rowtype;
begin
  if new.job_id is not null then
    select *
    into target_job
    from public.jobs
    where id = new.job_id;

    if not found then
      raise exception 'Message work order was not found.'
        using errcode = '23503';
    end if;

    if new.shop_id is null or btrim(new.shop_id) = '' then
      new.shop_id := target_job.shop_id;
    elsif new.shop_id <> target_job.shop_id then
      raise exception 'Message shop does not match its work order.'
        using errcode = '23514';
    end if;

    if new.customer_id is null then
      new.customer_id := target_job.customer_id;
    elsif target_job.customer_id is not null and new.customer_id <> target_job.customer_id then
      raise exception 'Message customer does not match its work order.'
        using errcode = '23514';
    end if;
  end if;

  if new.shop_id is null or btrim(new.shop_id) = '' then
    raise exception 'Message shop is required.'
      using errcode = '23502';
  end if;

  if new.customer_id is not null and not exists (
    select 1
    from public.customers
    where customers.id = new.customer_id
      and customers.shop_id = new.shop_id
  ) then
    raise exception 'Message customer does not belong to its shop.'
      using errcode = '23514';
  end if;

  if new.thread_id is not null then
    select *
    into target_thread
    from public.customer_conversation_threads
    where id = new.thread_id;

    if not found
       or target_thread.shop_id <> new.shop_id
       or target_thread.customer_id is distinct from new.customer_id
       or target_thread.channel <> new.channel then
      raise exception 'Message thread does not match its shop, customer, and channel.'
        using errcode = '23514';
    end if;

    update public.customer_conversation_threads
    set contact_address = case
          when contact_address = '' then
            case when new.direction = 'inbound' then new.sender_address else new.recipient end
          else contact_address
        end,
        updated_at = greatest(updated_at, now())
    where id = target_thread.id;
  elsif new.customer_id is not null then
    insert into public.customer_conversation_threads (
      shop_id,
      customer_id,
      channel,
      contact_address
    )
    values (
      new.shop_id,
      new.customer_id,
      new.channel,
      case when new.direction = 'inbound' then new.sender_address else new.recipient end
    )
    on conflict (shop_id, customer_id, channel) do update
    set contact_address = case
          when public.customer_conversation_threads.contact_address = ''
            then excluded.contact_address
          else public.customer_conversation_threads.contact_address
        end,
        updated_at = greatest(public.customer_conversation_threads.updated_at, now())
    returning * into target_thread;

    new.thread_id := target_thread.id;
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_customer_message_correspondence() from public, anon, authenticated;

create trigger customer_messages_prepare_correspondence
  before insert on public.customer_messages
  for each row execute function private.prepare_customer_message_correspondence();

create or replace function private.guard_customer_message_correspondence_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.shop_id is distinct from new.shop_id
     or old.customer_id is distinct from new.customer_id
     or old.job_id is distinct from new.job_id
     or old.thread_id is distinct from new.thread_id
     or old.channel is distinct from new.channel
     or old.direction is distinct from new.direction then
    raise exception 'Message ownership, routing, channel, and direction cannot be changed.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_customer_message_correspondence_scope() from public, anon, authenticated;

create trigger customer_messages_guard_correspondence_scope
  before update on public.customer_messages
  for each row execute function private.guard_customer_message_correspondence_scope();

drop policy if exists "customer_messages_select_member" on public.customer_messages;
create policy "customer_messages_select_member"
  on public.customer_messages
  for select
  to authenticated
  using (
    private.is_shop_member(shop_id)
    and (job_id is null or private.can_access_job(job_id))
  );

drop policy if exists "customer_messages_insert_writer" on public.customer_messages;
create policy "customer_messages_insert_writer"
  on public.customer_messages
  for insert
  to authenticated
  with check (
    direction = 'outbound'
    and job_id is not null
    and private.can_write_job(job_id)
    and private.can_write_shop(shop_id)
    and status in ('sent', 'failed')
    and scheduled_at is null
    and canceled_at is null
    and request_id is null
    and quota_request_id is null
    and operation_key is null
    and processing_started_at is null
    and cancel_requested_at is null
    and provider_last_event is null
    and provider_event_at is null
  );

drop policy if exists "customer_messages_update_writer" on public.customer_messages;
create policy "customer_messages_update_writer"
  on public.customer_messages
  for update
  to authenticated
  using (
    direction = 'outbound'
    and job_id is not null
    and private.can_write_job(job_id)
    and private.can_write_shop(shop_id)
    and status in ('sent', 'failed')
    and scheduled_at is null
    and canceled_at is null
    and request_id is null
    and operation_key is null
  )
  with check (
    direction = 'outbound'
    and job_id is not null
    and private.can_write_job(job_id)
    and private.can_write_shop(shop_id)
    and status in ('sent', 'failed')
    and scheduled_at is null
    and canceled_at is null
    and request_id is null
    and quota_request_id is null
    and operation_key is null
    and processing_started_at is null
    and cancel_requested_at is null
    and provider_last_event is null
    and provider_event_at is null
  );

drop policy if exists "customer_messages_delete_admin" on public.customer_messages;
create policy "customer_messages_delete_admin"
  on public.customer_messages
  for delete
  to authenticated
  using (
    case
      when job_id is not null then private.can_admin_job(job_id)
      else private.can_admin_shop(shop_id)
    end
  );

create or replace function public.set_customer_message_report_inclusion(
  p_message_id uuid,
  p_include boolean
)
returns public.customer_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_message public.customer_messages%rowtype;
begin
  select *
  into stored_message
  from public.customer_messages
  where id = p_message_id
  for update;

  if not found then
    raise exception 'Customer message was not found.'
      using errcode = 'P0002';
  end if;

  if not (
    (stored_message.job_id is not null and private.can_write_job(stored_message.job_id))
    or (stored_message.job_id is null and private.can_write_shop(stored_message.shop_id))
  ) then
    raise exception 'Not allowed to change customer report correspondence for this shop.'
      using errcode = '42501';
  end if;

  if coalesce(p_include, false)
     and (
       nullif(btrim(stored_message.body), '') is null
       or not (
         (stored_message.direction = 'outbound' and stored_message.status in ('sent', 'delivered'))
         or (stored_message.direction = 'inbound' and stored_message.status = 'received')
       )
     ) then
    raise exception 'Only completed customer-facing correspondence can be included in a customer report.'
      using errcode = '23514';
  end if;

  update public.customer_messages
  set include_in_customer_report = coalesce(p_include, false)
  where id = p_message_id
  returning * into stored_message;

  return stored_message;
end;
$$;

create or replace function public.mark_customer_message_read(
  p_message_id uuid,
  p_read_at timestamptz default now()
)
returns public.customer_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_message public.customer_messages%rowtype;
begin
  select *
  into stored_message
  from public.customer_messages
  where id = p_message_id
  for update;

  if not found then
    raise exception 'Customer message was not found.'
      using errcode = 'P0002';
  end if;

  if stored_message.direction <> 'inbound' or stored_message.status <> 'received' then
    raise exception 'Only received inbound correspondence can be marked read.'
      using errcode = '23514';
  end if;

  if not (
    (stored_message.job_id is not null and private.can_write_job(stored_message.job_id))
    or (stored_message.job_id is null and private.can_write_shop(stored_message.shop_id))
  ) then
    raise exception 'Not allowed to mark customer correspondence read for this shop.'
      using errcode = '42501';
  end if;

  update public.customer_messages
  set read_at = coalesce(p_read_at, now())
  where id = p_message_id
  returning * into stored_message;

  return stored_message;
end;
$$;

revoke all on function public.set_customer_message_report_inclusion(uuid, boolean) from public, anon;
revoke all on function public.mark_customer_message_read(uuid, timestamptz) from public, anon;
grant execute on function public.set_customer_message_report_inclusion(uuid, boolean) to authenticated;
grant execute on function public.mark_customer_message_read(uuid, timestamptz) to authenticated;

comment on table public.customer_conversation_threads is
  'Provider-neutral shop/customer conversation identity. UI and inbound provider adapters are enabled separately.';
comment on column public.customer_messages.job_id is
  'Optional work-order route. Inbound messages remain unassigned when more than one job is plausible.';
comment on column public.customer_messages.include_in_customer_report is
  'Explicit staff selection; report rendering still applies completed customer-facing eligibility rules.';
