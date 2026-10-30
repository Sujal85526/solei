begin;
-- One snapshot for the whole file: the test DB is shared, so rows others commit mid-run stay out of the checks.
set transaction isolation level repeatable read;
\ir helpers/setup.psql
select plan(8);

-- Counted against the DB itself (seed = 8 + 8), so rows other tests or testers add don't break it.
select count(*)::int as active_products from public.products where active \gset
select count(*)::int as active_variants from public.product_variants v
  join public.products p on p.id = v.product_id where v.active and p.active \gset
select ok(:active_products >= 8, 'the 8 seed products are active');

select tests.login_anon();
select is((select count(*)::int from public.products), :active_products, 'anon sees only active products');
select is((select count(*)::int from public.product_variants), :active_variants,
  'anon sees only active variants of active products');
select is((select count(*)::int from public.variant_costs), 0, 'anon cannot read costs');
select is(
  (select count(*)::int from public.product_variants where sku like 'SOL-P-%' and price_fils = 28000), 5,
  'five perfumes at AED 280');
select is(
  (select count(*)::int from public.product_variants where sku like 'SOL-S-%' and price_fils = 19000), 3,
  'three sprays at AED 190');
select throws_ok($$ insert into public.categories (slug, name) values ('x', 'X') $$, '42501', null, 'anon cannot write catalog');

select tests.logout();
update public.products set active = false where slug = 'soho-all-over-spray';
select tests.login_anon();
select is((select count(*)::int from public.products), :active_products - 1, 'inactive products are hidden from the public');

select * from finish();
rollback;
