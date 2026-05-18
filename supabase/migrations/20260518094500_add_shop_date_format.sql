alter table shop_profiles
  add column if not exists date_format text not null default 'MM/DD/YYYY';

alter table shop_profiles
  drop constraint if exists shop_profiles_date_format_check;

alter table shop_profiles
  add constraint shop_profiles_date_format_check
  check (date_format in ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'));

update shop_profiles
set date_format = case
  when lower(locale) = 'en-gb' then 'DD/MM/YYYY'
  else 'MM/DD/YYYY'
end
where date_format is null
  or date_format = ''
  or (
    date_format = 'MM/DD/YYYY'
    and lower(locale) = 'en-gb'
  );
