begin;
\ir helpers/setup.psql
select plan(14);

select v.id as perfume from public.product_variants v where v.sku = 'SOL-P-CAN-50' \gset
select v.id as spray from public.product_variants v where v.sku = 'SOL-S-SOH-100' \gset
select id as spray_cat from public.categories where slug = 'all_over_spray' \gset

insert into public.coupons (code, kind, percent_bp, category_ids)
values ('SPRAY10', 'percent', 1000, array[:'spray_cat'::uuid]);
insert into public.coupons (code, kind, min_order_fils, per_customer_limit)
values ('SHIPFREE', 'free_delivery', 30000, 2);

-- Category scope: 10% off the spray (AED 190) only, not the perfume.
select is(
  public.coupon_evaluate('spray10',
    jsonb_build_array(jsonb_build_object('variant_id', :'perfume', 'qty', 1),
                      jsonb_build_object('variant_id', :'spray', 'qty', 1)), null) ->> 'discount_fils',
  '1900', 'category-scoped percent comes off the in-scope items only');
select is(
  public.coupon_evaluate('SPRAY10', jsonb_build_array(jsonb_build_object('variant_id', :'perfume', 'qty', 1)), null) ->> 'reason',
  'no_eligible_items', 'no in-scope item → refused');

-- Free delivery: takes nothing off the goods; minimum order applies.
select is(
  public.coupon_evaluate('SHIPFREE', jsonb_build_array(jsonb_build_object('variant_id', :'spray', 'qty', 1)), null) ->> 'reason',
  'min_order', 'free delivery respects the minimum order');
select is(
  public.coupon_evaluate('SHIPFREE', jsonb_build_array(jsonb_build_object('variant_id', :'perfume', 'qty', 2)), null),
  jsonb_build_object('ok', true, 'coupon_id', (select id from public.coupons where code = 'SHIPFREE'),
    'code', 'SHIPFREE', 'kind', 'free_delivery', 'discount_fils', 0, 'eligible_fils', 56000,
    'subtotal_fils', 56000, 'free_delivery', true),
  'free delivery code is accepted with 0 goods discount');

create function pg_temp.order_with(p_uuid uuid, p_code text, p_fee int, p_delivery_discount int, p_discount int, p_total int)
returns uuid language sql as $$
  select order_id from public.create_web_order(jsonb_build_object(
    'client_uuid', p_uuid, 'emirate', 'abu_dhabi',
    'contact', jsonb_build_object('name', 'Promo Tester', 'phone', '+971501112233', 'email', 'promo@solei.test'),
    'address', jsonb_build_object('line1', 'Street 1'),
    'lines', jsonb_build_array(jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'SOL-P-CAN-50'), 'qty', 2, 'unit_price_fils', 28000)),
    'subtotal_fils', 56000, 'coupon_code', p_code, 'discount_fils', p_discount,
    'delivery_fee_fils', p_fee, 'delivery_discount_fils', p_delivery_discount,
    'vat_fils', 0, 'total_fils', p_total, 'vat_rate_bp', 0, 'prices_include_vat', true));
$$;

select pg_temp.order_with(gen_random_uuid(), 'SHIPFREE', 0, 3000, 0, 56000) as o1 \gset
select is((select delivery_discount_fils from public.orders where id = :'o1'), 3000, 'waived delivery fee is recorded');
select is((select applied_promotions -> 0 ->> 'kind' from public.orders where id = :'o1'), 'free_delivery', 'applied promotion snapshot');
select is((select coupon_code from public.orders where id = :'o1'), 'SHIPFREE', 'code stored on the order');

select throws_ok(
  $$ select pg_temp.order_with(gen_random_uuid(), 'SHIPFREE', 3000, 0, 0, 59000) $$,
  'P0001', null, 'free-delivery code with a delivery fee charged is refused');
select throws_ok(
  $$ select pg_temp.order_with(gen_random_uuid(), null, 0, 3000, 0, 56000) $$,
  '22023', null, 'a delivery discount needs a free-delivery code');

-- Per-customer limit 2: second use ok, third refused.
select lives_ok(
  $$ select pg_temp.order_with(gen_random_uuid(), 'SHIPFREE', 0, 3000, 0, 56000) $$,
  'second use within the per-customer limit');
select is(
  public.coupon_evaluate('SHIPFREE', jsonb_build_array(jsonb_build_object('variant_id', :'perfume', 'qty', 2)), 'PROMO@solei.test') ->> 'reason',
  'already_used', 'per-customer limit reached (email matched case-insensitively)');
select is(
  public.coupon_evaluate('SHIPFREE', jsonb_build_array(jsonb_build_object('variant_id', :'perfume', 'qty', 2)), 'someone@solei.test') ->> 'ok',
  'true', 'another customer can still use it');

-- Report: only paid orders count.
update public.orders set status = 'new' where id = :'o1';
select tests.login_as(tests.create_staff('promo-owner@solei.test', 'owner'));
select is(
  (select row(orders, discount_fils, delivery_discount_fils, sales_fils)::text
     from public.promotion_report(public.business_today() - 1, public.business_today()) where code = 'SHIPFREE'),
  '(1,0,3000,56000)', 'promotions report counts paid orders with their waived delivery');
select tests.login_anon();
select throws_ok(
  $$ select * from public.promotion_report(public.business_today() - 1, public.business_today()) $$,
  '42501', null, 'anon cannot run the report');

select * from finish();
rollback;
