alter table public.shop_profiles
  add column if not exists country_code text not null default 'US';

update public.shop_profiles
set country_code = case
  when currency_code = 'GBP' or lower(locale) like 'en-gb%' then 'GB'
  when currency_code = 'CAD' or lower(locale) like 'en-ca%' then 'CA'
  else 'US'
end
where country_code = 'US';

alter table public.shop_profiles
  drop constraint if exists shop_profiles_country_code_check;

alter table public.shop_profiles
  add constraint shop_profiles_country_code_check
  check (country_code in ('US', 'GB', 'CA'));

alter table public.shop_profiles
  drop constraint if exists shop_profiles_currency_code_check;

alter table public.shop_profiles
  add constraint shop_profiles_currency_code_check
  check (currency_code in ('USD', 'GBP', 'CAD'));

alter table public.shop_profiles
  drop constraint if exists shop_profiles_sales_tax_rate_reasonable;

alter table public.shop_profiles
  add constraint shop_profiles_sales_tax_rate_reasonable
  check (sales_tax_rate >= 0 and sales_tax_rate <= 100);

insert into public.currencies (code, name, symbol, minor_unit, locale_hint, active, metadata)
values ('CAD', 'Canadian Dollar', 'CA$', 2, 'en-CA', true, '{"tax_label":"GST"}'::jsonb)
on conflict (code) do update
set
  name = excluded.name,
  symbol = excluded.symbol,
  minor_unit = excluded.minor_unit,
  locale_hint = excluded.locale_hint,
  active = excluded.active,
  metadata = public.currencies.metadata || excluded.metadata;
