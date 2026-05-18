insert into public.shop_profiles (
  shop_id,
  shop_name,
  currency_code,
  locale,
  tax_label,
  date_format,
  measurement_system,
  length_unit,
  taxable_parts_default,
  taxable_services_default
)
select
  shops.shop_id,
  initcap(replace(shops.shop_id, '-', ' ')) as shop_name,
  case
    when shops.shop_id ~* '(norwich|united-kingdom|\\buk\\b|england|gb|great-britain)' then 'GBP'
    else 'USD'
  end as currency_code,
  case
    when shops.shop_id ~* '(norwich|united-kingdom|\\buk\\b|england|gb|great-britain)' then 'en-GB'
    else 'en-US'
  end as locale,
  case
    when shops.shop_id ~* '(norwich|united-kingdom|\\buk\\b|england|gb|great-britain)' then 'VAT'
    else 'Sales Tax'
  end as tax_label,
  case
    when shops.shop_id ~* '(norwich|united-kingdom|\\buk\\b|england|gb|great-britain)' then 'DD/MM/YYYY'
    else 'MM/DD/YYYY'
  end as date_format,
  case
    when shops.shop_id ~* '(norwich|united-kingdom|\\buk\\b|england|gb|great-britain)' then 'metric'
    else 'imperial'
  end as measurement_system,
  case
    when shops.shop_id ~* '(norwich|united-kingdom|\\buk\\b|england|gb|great-britain)' then 'mm'
    else 'in'
  end as length_unit,
  true,
  false
from (
  select distinct shop_id
  from public.shop_members
  where shop_id is not null
    and shop_id <> ''
) shops
left join public.shop_profiles existing
  on existing.shop_id = shops.shop_id
where existing.shop_id is null;
