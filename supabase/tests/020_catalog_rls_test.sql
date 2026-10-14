begin;
\ir helpers/setup.psql
select plan(7);

select tests.login_anon();
select is((select count(*)::int from public.products), 8, 'anon sees 8 active products');
select is((select count(*)::int from public.product_variants), 8, 'anon sees 8 active variants');
select is((select count(*)::int from public.variant_costs), 0, 'anon cannot read costs');
select is(
  (select count(*)::int from public.product_variants where price_fils = 28000), 5,
  'five perfumes at AED 280');
select is(
  (select count(*)::int from public.product_variants where price_fils = 19000), 3,
  'three sprays at AED 190');
select throws_ok($$ insert into public.categories (slug, name) values ('x', 'X') $$, '42501', null, 'anon cannot write catalog');

select tests.logout();
update public.products set active = false where slug = 'soho-all-over-spray';
select tests.login_anon();
select is((select count(*)::int from public.products), 7, 'inactive products are hidden from the public');

select * from finish();
rollback;
