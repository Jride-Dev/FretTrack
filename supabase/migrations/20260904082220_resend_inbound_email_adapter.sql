-- Provider-neutral routing and replay records for the first signed inbound adapter.
-- Routes are service-managed until a shop settings control is added.

create table public.customer_inbound_email_routes (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shop_profiles(shop_id) on delete cascade,
  email_address text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint customer_inbound_email_routes_address_check
    check (btrim(email_address) <> ''),
  constraint customer_inbound_email_routes_shop_address_key
    unique (shop_id, email_address)
);

create unique index customer_inbound_email_routes_active_address_uidx
  on public.customer_inbound_email_routes (lower(btrim(email_address)))
  where active;

alter table public.customer_inbound_email_routes enable row level security;
revoke all on table public.customer_inbound_email_routes from public, anon, authenticated;
grant select on table public.customer_inbound_email_routes to service_role;
grant insert, update, delete on table public.customer_inbound_email_routes to service_role;

create table public.customer_inbound_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload_hash text not null,
  status text not null default 'processing',
  message_id uuid references public.customer_messages(id) on delete set null,
  error_message text not null default '',
  created_at timestamptz not null default now(),
  processing_started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint customer_inbound_webhook_events_provider_event_key unique (provider, event_id),
  constraint customer_inbound_webhook_events_status_check check (status in ('processing', 'received', 'ignored', 'failed'))
);

alter table public.customer_inbound_webhook_events enable row level security;
revoke all on table public.customer_inbound_webhook_events from public, anon, authenticated;
grant select, insert, update on table public.customer_inbound_webhook_events to service_role;

comment on table public.customer_inbound_email_routes is
  'Service-managed inbound email addresses mapped to one shop; browser clients cannot change routing.';
comment on table public.customer_inbound_webhook_events is
  'Replay-safe claim ledger for signed provider webhook deliveries.';
