begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select has_column('public', 'shop_profiles', 'tax_calculation_mode', 'shops declare whether manual tax is enabled');
select has_column('public', 'shop_profiles', 'default_tax_profile_id', 'shops have a stable default tax profile identity');
select has_column('public', 'shop_profiles', 'tax_profile_revision', 'shops version tax defaults');
select has_column('public', 'tax_profiles', 'calculation_mode', 'tax profiles record calculation mode');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '59000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'tax-owner@frettrack.local',
  crypt('FretTrackTest123!', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.shop_profiles (
  shop_id, shop_name, created_by, subscription_tier, subscription_status,
  currency_code, tax_label, tax_state, tax_registration_number, sales_tax_rate,
  taxable_parts_default, taxable_services_default, tax_calculation_mode
) values (
  'tax-profile-pgtap-shop', 'Tax Profile Safety Shop', '59000000-0000-4000-a000-000000000001',
  'pro', 'active', 'USD', 'Sales Tax', 'CA', 'TEST-PERMIT', 7.25, true, false, 'manual'
);

insert into public.shop_members (shop_id, user_id, role, display_name)
values ('tax-profile-pgtap-shop', '59000000-0000-4000-a000-000000000001', 'owner', 'Tax Owner');

select is((select tax_profile_revision from public.shop_profiles where shop_id = 'tax-profile-pgtap-shop'), 1, 'the initial tax profile begins at revision one');
select is((select count(*)::integer from public.tax_profiles where shop_id = 'tax-profile-pgtap-shop' and is_default), 1, 'the shop has exactly one default tax profile');
select is((select tax_rate_basis_points from public.tax_profiles where shop_id = 'tax-profile-pgtap-shop' and is_default), 725, 'the manual percentage is stored as basis points');
select is((select calculation_mode from public.tax_profiles where shop_id = 'tax-profile-pgtap-shop' and is_default), 'manual', 'the default profile records manual calculation');

update public.shop_profiles set sales_tax_rate = 8.25 where shop_id = 'tax-profile-pgtap-shop';
select is((select tax_profile_revision from public.shop_profiles where shop_id = 'tax-profile-pgtap-shop'), 2, 'changing tax defaults increments the profile revision');
select is((select tax_rate_basis_points from public.tax_profiles where shop_id = 'tax-profile-pgtap-shop' and is_default), 825, 'the default profile synchronizes the changed rate');

select throws_like(
  $$update public.shop_profiles set tax_state = '', tax_calculation_mode = 'manual' where shop_id = 'tax-profile-pgtap-shop'$$,
  '%jurisdiction is required%', 'manual tax cannot be enabled without a jurisdiction');

insert into public.jobs (
  id, shop_id, customer_name, job_number, status, tech_details, date_received,
  job_date, job_day_code, daily_sequence, created_at
) values
  (
    '79000000-0000-4000-a000-000000000001', 'tax-profile-pgtap-shop', 'Manual Tax Customer',
    'TAX-1', 'Completed',
    jsonb_build_object('payments', '[]'::jsonb, 'discountType', 'none', 'discountValue', '', 'tax', jsonb_build_object(
      'calculationMode', 'manual',
      'profileId', (select default_tax_profile_id from public.shop_profiles where shop_id = 'tax-profile-pgtap-shop'),
      'profileRevision', 2,
      'salesTaxRate', '8.25', 'state', 'CA', 'taxLabel', 'Sales Tax',
      'taxRegistrationNumber', 'TEST-PERMIT', 'currencyCode', 'USD',
      'taxableParts', true, 'taxableServices', false
    )),
    current_date, current_date, 'TAX', 1, now()
  ),
  (
    '79000000-0000-4000-a000-000000000002', 'tax-profile-pgtap-shop', 'Disabled Tax Customer',
    'TAX-2', 'Completed',
    '{"payments":[],"discountType":"none","discountValue":"","tax":{"calculationMode":"disabled","salesTaxRate":"99","currencyCode":"USD","taxableParts":true,"taxableServices":true}}'::jsonb,
    current_date, current_date, 'TAX', 2, now()
  );

insert into public.job_parts (id, shop_id, job_id, name, quantity, retail, retail_price, cost, unit_cost, created_at)
values
  ('89000000-0000-4000-a000-000000000001', 'tax-profile-pgtap-shop', '79000000-0000-4000-a000-000000000001', 'Taxable Part', 1, 100, 100, 20, 20, now()),
  ('89000000-0000-4000-a000-000000000002', 'tax-profile-pgtap-shop', '79000000-0000-4000-a000-000000000002', 'Disabled Part', 1, 100, 100, 20, 20, now());

select is((private.calculate_job_invoice_snapshot('79000000-0000-4000-a000-000000000001') ->> 'version')::integer, 2, 'new snapshots use the tax-provenance format');
select is(private.calculate_job_invoice_snapshot('79000000-0000-4000-a000-000000000001') ->> 'taxCalculationMode', 'manual', 'manual calculation mode is frozen in the snapshot');
select is((private.calculate_job_invoice_snapshot('79000000-0000-4000-a000-000000000001') ->> 'taxProfileRevision')::integer, 2, 'the applied tax profile revision is frozen');
select is((private.calculate_job_invoice_snapshot('79000000-0000-4000-a000-000000000001') ->> 'taxMinor')::bigint, 825::bigint, 'manual tax is calculated in minor units');
select is((private.calculate_job_invoice_snapshot('79000000-0000-4000-a000-000000000002') ->> 'taxMinor')::bigint, 0::bigint, 'disabled mode calculates no tax even when stale rate fields exist');

update public.shop_profiles set tax_calculation_mode = 'disabled' where shop_id = 'tax-profile-pgtap-shop';
select is((select tax_rate_basis_points from public.tax_profiles where shop_id = 'tax-profile-pgtap-shop' and is_default), 0, 'disabling tax zeroes the active default calculation rate');
select ok((select not taxable_parts and not taxable_services from public.tax_profiles where shop_id = 'tax-profile-pgtap-shop' and is_default), 'disabled profiles expose no taxable defaults');

select * from finish();
rollback;
