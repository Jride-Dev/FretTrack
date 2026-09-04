begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select has_table('public', 'customer_inbound_email_routes', 'inbound email routes are durable');
select has_table('public', 'customer_inbound_webhook_events', 'webhook claims are durable');
select has_column('public', 'customer_inbound_email_routes', 'shop_id', 'routes are shop scoped');
select has_column('public', 'customer_inbound_email_routes', 'email_address', 'routes identify the receiving address');
select has_column('public', 'customer_inbound_webhook_events', 'event_id', 'webhook claims retain provider event identity');
select has_column('public', 'customer_inbound_webhook_events', 'payload_hash', 'webhook claims retain the verified payload hash');
select has_column('public', 'customer_inbound_webhook_events', 'processing_started_at', 'webhook claims support stale-processing recovery');
select ok(not has_table_privilege('anon', 'public.customer_inbound_email_routes', 'select'), 'anonymous callers cannot read inbound routes');
select ok(not has_table_privilege('authenticated', 'public.customer_inbound_email_routes', 'select'), 'browser clients cannot read service-managed inbound routes');
select ok(has_table_privilege('service_role', 'public.customer_inbound_email_routes', 'select'), 'service role can resolve inbound routes');
select ok(not has_table_privilege('anon', 'public.customer_inbound_webhook_events', 'select'), 'anonymous callers cannot read webhook claims');
select ok(not has_table_privilege('authenticated', 'public.customer_inbound_webhook_events', 'select'), 'browser clients cannot read webhook claims');
select ok(has_table_privilege('service_role', 'public.customer_inbound_webhook_events', 'insert'), 'service role can claim inbound webhook deliveries');

select * from finish();
rollback;
