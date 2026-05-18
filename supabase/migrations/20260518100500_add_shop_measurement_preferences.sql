alter table shop_profiles
  add column if not exists measurement_system text not null default 'imperial',
  add column if not exists length_unit text not null default 'in';

alter table shop_profiles
  drop constraint if exists shop_profiles_measurement_system_check;

alter table shop_profiles
  add constraint shop_profiles_measurement_system_check
  check (measurement_system in ('imperial', 'metric'));

alter table shop_profiles
  drop constraint if exists shop_profiles_length_unit_check;

alter table shop_profiles
  add constraint shop_profiles_length_unit_check
  check (length_unit in ('in', 'mm'));

update shop_profiles
set
  measurement_system = 'metric',
  length_unit = 'mm'
where currency_code = 'GBP'
  or lower(locale) = 'en-gb';
