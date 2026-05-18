alter table shop_profiles
  add column if not exists currency_code text not null default 'USD',
  add column if not exists locale text not null default 'en-US',
  add column if not exists tax_label text not null default 'Sales Tax',
  add column if not exists tax_registration_number text not null default '';

alter table shop_profiles
  drop constraint if exists shop_profiles_currency_code_check;

alter table shop_profiles
  add constraint shop_profiles_currency_code_check
  check (currency_code in ('USD', 'GBP'));

insert into currencies (code, name, symbol, minor_unit, locale_hint, active, metadata)
values
  ('USD', 'US Dollar', '$', 2, 'en-US', true, '{"tax_label":"Sales Tax"}'::jsonb),
  ('GBP', 'British Pound', U&'\00A3', 2, 'en-GB', true, '{"tax_label":"VAT"}'::jsonb)
on conflict (code) do update
set
  name = excluded.name,
  symbol = excluded.symbol,
  minor_unit = excluded.minor_unit,
  locale_hint = excluded.locale_hint,
  active = excluded.active,
  metadata = currencies.metadata || excluded.metadata;

update shop_profiles
set
  currency_code = 'GBP',
  locale = 'en-GB',
  tax_label = 'VAT'
where currency_code = 'USD'
  and (
    shop_name ilike '%norwich%'
    or address ilike '%norwich%'
    or address ilike '%united kingdom%'
    or address ilike '% uk%'
    or address ilike '%england%'
  );
