alter table public.parts
  add column if not exists purchase_unit_cost numeric(12, 2);

update public.parts
set purchase_unit_cost = round(coalesce(unit_cost, 0) * greatest(coalesce(units_per_purchase_unit, 1), 1), 2)
where purchase_unit_cost is null;

alter table public.parts
  drop constraint if exists parts_purchase_unit_cost_nonnegative;

alter table public.parts
  add constraint parts_purchase_unit_cost_nonnegative
  check (purchase_unit_cost is null or purchase_unit_cost >= 0);

comment on column public.parts.purchase_unit_cost is
  'Exact vendor price for one complete purchase unit (pack, box, set, etc.); inventory unit_cost remains the per-each valuation.';
