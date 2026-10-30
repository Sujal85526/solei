begin;
-- One snapshot for the whole file: the test DB is shared, so rows others commit mid-run stay out of the checks.
set transaction isolation level repeatable read;
\ir helpers/setup.psql
select plan(8);

-- Counted against the DB itself (the 8 TST-* test bottles plus whatever the DB holds).
select count(*)::int as active_products from public.products where active \gset
select count(*)::int as active_variants from public.product_variants v
  join public.products p on p.id = v.product_id where v.active and p.active \gset
update public.product_variants set active = false where sku = 'TST-S-MAY-100';

select tests.login_anon();
select is((select count(*)::int from public.products), :active_products, 'anon sees only active products');
select is((select count(*)::int from public.product_variants), :active_variants - 1,
  'anon sees only active variants of active products');
select is((select count(*)::int from public.product_variants where sku = 'TST-S-MAY-100'), 0,
  'an inactive variant is hidden');
select is((select count(*)::int from public.variant_costs), 0, 'anon cannot read costs');
select is((select price_fils from public.product_variants where sku = 'TST-P-CAP-50'), 28000, 'anon reads prices');
select throws_ok($$ insert into public.categories (slug, name) values ('x', 'X') $$, '42501', null, 'anon cannot write catalog');
with u as (update public.product_variants set price_fils = 1 where sku = 'TST-P-CAP-50' returning 1)
select is((select count(*)::int from u), 0, 'anon cannot change prices');

select tests.logout();
update public.products set active = false where slug = 'tst-s-soh-100';
select tests.login_anon();
select is((select count(*)::int from public.products), :active_products - 1, 'inactive products are hidden from the public');

select * from finish();
rollback;
