begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

select has_column('public', 'parts', 'purchase_unit_cost', 'parts preserve the exact whole-package vendor price');
select col_type_is('public', 'parts', 'purchase_unit_cost', 'numeric(12,2)', 'whole-package prices retain ordinary currency precision');
select has_check('public', 'parts', 'parts reject negative whole-package prices');

select * from finish();

rollback;
