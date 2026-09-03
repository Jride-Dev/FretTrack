begin;

select plan(15);

select has_table('private', 'public_estimate_links', 'public estimate links remain in the private schema');
select ok(not has_table_privilege('anon', 'private.public_estimate_links', 'select'), 'anonymous clients cannot read the link table directly');
select ok(has_function_privilege('anon', 'public.get_public_estimate(text)', 'execute'), 'anonymous clients may resolve a bearer estimate link');
select ok(has_function_privilege('anon', 'public.respond_to_public_estimate(text, text, text)', 'execute'), 'anonymous clients may respond through a bearer estimate link');
select ok(not has_function_privilege('anon', 'public.create_public_estimate_link(uuid, integer, timestamptz)', 'execute'), 'anonymous clients cannot create estimate links');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '59000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'public-link-owner@frettrack.local', crypt('FretTrackTest123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.shop_profiles (shop_id, shop_name, phone, email, address, print_footer_text, created_by, subscription_tier, subscription_status)
values ('public-link-shop', 'Public Link Shop', '555-0100', 'shop@example.test', '1 Main Street', 'Thank you for choosing us.', '59000000-0000-4000-a000-000000000001', 'pro', 'active');

update public.shop_subscriptions
set plan_id = 'pro', status = 'active', trial_ends_at = null, grace_ends_at = null
where shop_id = 'public-link-shop';

insert into public.shop_members (shop_id, user_id, role, display_name)
values ('public-link-shop', '59000000-0000-4000-a000-000000000001', 'owner', 'Public Link Owner');

insert into public.jobs (
  id, shop_id, customer_name, customer_first_name, email, email_opt_in, guitar_brand, model,
  job_number, status, tech_details, date_received, job_date, job_day_code, daily_sequence, created_at
)
values (
  '79000000-0000-4000-a000-000000000001', 'public-link-shop', 'Link Customer', 'Link', 'customer@example.test', true,
  'Fender', 'Stratocaster', 'PUB-1', 'Completed',
  '{"payments":[],"discountType":"none","discountValue":"","tax":{"salesTaxRate":"10","taxableParts":true,"taxableServices":true,"currencyCode":"USD","state":"CA"}}'::jsonb,
  current_date, current_date, 'PUB', 1, now()
);

insert into public.job_parts (id, shop_id, job_id, name, quantity, retail, retail_price, cost, unit_cost, created_at)
values ('89000000-0000-4000-a000-000000000001', 'public-link-shop', '79000000-0000-4000-a000-000000000001', 'Link Part', 1, 20, 20, 5, 5, now());

insert into public.job_services (id, job_id, description, quantity, retail, cost, created_at)
values ('99000000-0000-4000-a000-000000000001', '79000000-0000-4000-a000-000000000001', 'Link Service', 1, 30, 5, now());

set local role authenticated;
set local "request.jwt.claim.sub" = '59000000-0000-4000-a000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';

select public.set_job_estimate_state('79000000-0000-4000-a000-000000000001', 'sent', 'Estimate sent by shop', null);
create temp table public_link_capture as
select public.create_public_estimate_link('79000000-0000-4000-a000-000000000001', 1) as payload;
grant select on public_link_capture to anon;

select is((select payload ->> 'revision' from public_link_capture), '1', 'the public link binds to the sent estimate revision');
select ok(length((select payload ->> 'token' from public_link_capture)) = 64, 'the public link token is a high-entropy hex bearer token');

reset role;
set local role anon;
set local "request.jwt.claim.role" = 'anon';

select ok((public.get_public_estimate((select payload ->> 'token' from public_link_capture)) ->> 'ok')::boolean, 'anonymous customers can resolve a valid estimate link');
select is((public.get_public_estimate((select payload ->> 'token' from public_link_capture)) #>> '{estimate,snapshot,totalMinor}')::bigint, 5500::bigint, 'public estimate reads retain the locked minor-unit total');
select is(public.get_public_estimate('not-a-token') ->> 'ok', 'false', 'malformed estimate tokens fail closed');

select public.respond_to_public_estimate((select payload ->> 'token' from public_link_capture), 'approved', null);

reset role;
select is((select estimate_status from public.jobs where id = '79000000-0000-4000-a000-000000000001'), 'approved', 'customer approval updates the guarded estimate lifecycle');
select is((select estimate_decision_source from public.jobs where id = '79000000-0000-4000-a000-000000000001'), 'customer_link', 'customer approval records its source');
select ok((select estimate_decided_by is null from public.jobs where id = '79000000-0000-4000-a000-000000000001'), 'customer approval is not misattributed to a shop user');
select is((select count(*)::integer from public.job_events where job_id = '79000000-0000-4000-a000-000000000001' and event_type = 'estimate_approved'), 1, 'customer approval creates one audit event');

set local role anon;
set local "request.jwt.claim.role" = 'anon';
select public.respond_to_public_estimate((select payload ->> 'token' from public_link_capture), 'approved', null);
reset role;
select is((select count(*)::integer from public.job_events where job_id = '79000000-0000-4000-a000-000000000001' and event_type = 'estimate_approved'), 1, 'repeated customer approval is idempotent');

select * from finish();
rollback;
