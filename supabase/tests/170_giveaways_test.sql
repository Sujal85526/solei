begin;
\ir helpers/setup.psql
select plan(14);

-- A giveaway: mini perfume AED 25, at least 20 pieces.
insert into public.products (slug, name, category_id, active, min_order_qty)
select 'test-mini-giveaway', 'Test Mini Giveaway', id, true, 20 from public.categories where slug = 'perfume'
returning id as product \gset
insert into public.product_variants (product_id, sku, label, price_fils, active)
values (:'product', 'TST-GIVE-10', '10 ml', 2500, true) returning id as variant \gset
insert into public.product_option_groups (product_id, name, kind, required, sort)
values (:'product', 'Ribbon', 'single', true, 1) returning id as ribbon \gset
insert into public.product_option_groups (product_id, name, kind, required, max_length, sort)
values (:'product', 'Name on the tag', 'text', true, 20, 2) returning id as tag \gset
insert into public.product_option_groups (product_id, name, kind, required, sort)
values (:'product', 'Extras', 'multi', false, 3) returning id as extras \gset
insert into public.product_options (group_id, label, price_delta_fils, sort) values (:'ribbon', 'Blush', 0, 1) returning id as blush \gset
insert into public.product_options (group_id, label, price_delta_fils, sort) values (:'ribbon', 'Gold', 500, 2) returning id as gold \gset
insert into public.product_options (group_id, label, price_delta_fils, sort) values (:'extras', 'Dried flower', 1000, 1) returning id as flower \gset

create function pg_temp.opts(p_ribbon uuid, p_tag text, p_extras uuid[] default '{}')
returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('group_id', (select id from public.product_option_groups where name = 'Ribbon' and product_id = (select id from public.products where slug = 'test-mini-giveaway')),
                       'option_ids', case when p_ribbon is null then '[]'::jsonb else jsonb_build_array(p_ribbon) end),
    jsonb_build_object('group_id', (select id from public.product_option_groups where name = 'Name on the tag' and product_id = (select id from public.products where slug = 'test-mini-giveaway')),
                       'text', p_tag),
    jsonb_build_object('group_id', (select id from public.product_option_groups where name = 'Extras' and product_id = (select id from public.products where slug = 'test-mini-giveaway')),
                       'option_ids', to_jsonb(p_extras)));
$$;

select is(public.line_unit_price_fils(:'variant', pg_temp.opts(:'blush', 'Sara & Omar')), 2500, 'base price with a free option');
select is(public.line_unit_price_fils(:'variant', pg_temp.opts(:'gold', 'Sara & Omar', array[:'flower'::uuid])), 4000,
  'gold ribbon +5 and a flower +10');
select is(public.line_options_check(:'variant', pg_temp.opts(null, 'Sara')) ->> 'ok', 'false', 'required single choice');
select is(public.line_options_check(:'variant', pg_temp.opts(:'blush', '')) ->> 'ok', 'false', 'required text');
select is(public.line_options_check(:'variant', pg_temp.opts(:'blush', 'A name that is far too long for a tag')) ->> 'ok', 'false', 'text too long');
select is(public.line_options_check(:'variant', jsonb_build_array(jsonb_build_object('group_id', :'ribbon', 'option_ids', jsonb_build_array(:'flower')))) ->> 'ok',
  'false', 'an option from another group is refused');
select is(public.line_options_check(:'variant', pg_temp.opts(:'gold', 'Sara & Omar')) -> 'snapshot' -> 0 -> 'choices' -> 0 ->> 'label',
  'Gold', 'snapshot names the choice');

create function pg_temp.order_with(p_qty int, p_unit int, p_opts jsonb)
returns uuid language sql as $$
  select order_id from public.create_web_order(jsonb_build_object(
    'client_uuid', gen_random_uuid(), 'emirate', 'abu_dhabi',
    'contact', jsonb_build_object('name', 'Giveaway Buyer', 'phone', '+971509990011', 'email', 'giveaway@solei.test'),
    'address', jsonb_build_object('line1', 'Hall 1'),
    'lines', jsonb_build_array(jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'TST-GIVE-10'),
                                                  'qty', p_qty, 'unit_price_fils', p_unit, 'options', p_opts)),
    'subtotal_fils', p_qty * p_unit, 'discount_fils', 0, 'delivery_fee_fils', 0,
    'vat_fils', 0, 'total_fils', p_qty * p_unit, 'vat_rate_bp', 0, 'prices_include_vat', true));
$$;

select pg_temp.order_with(20, 3000, pg_temp.opts(:'gold', 'Sara & Omar')) as o1 \gset
select is((select unit_price_fils from public.order_lines where order_id = :'o1'), 3000, 'line priced with options');
select is((select options -> 1 ->> 'text' from public.order_lines where order_id = :'o1'), 'Sara & Omar', 'tag text kept on the line');
select is((select total_fils from public.orders where id = :'o1'), 60000, '20 × AED 30');
select throws_ok(format('select pg_temp.order_with(10, 3000, pg_temp.opts(%L, %L))', :'gold', 'Sara'),
  'P0001', null, 'below the minimum quantity is refused');
select throws_ok(format('select pg_temp.order_with(20, 2500, pg_temp.opts(%L, %L))', :'gold', 'Sara'),
  'P0001', null, 'a price that ignores the options is refused');

-- Discount codes and saved bags see the option price.
insert into public.coupons (code, kind, percent_bp) values ('TSTGIVE10', 'percent', 1000);
select is(public.coupon_evaluate('TSTGIVE10',
  jsonb_build_array(jsonb_build_object('variant_id', :'variant', 'qty', 20, 'options', pg_temp.opts(:'gold', 'Sara'))), null) ->> 'discount_fils',
  '6000', '10% of AED 600');
select tests.create_user('giveaway.bag@solei.test') as u \gset
select public.cart_sync(:'u', 'giveaway.bag@solei.test', null,
  jsonb_build_array(jsonb_build_object('variant_id', :'variant', 'qty', 20, 'options', pg_temp.opts(:'gold', 'Sara')))) as cart \gset
select is((select value_fils from public.carts where id = :'cart'), 60000, 'saved bag keeps the options (value and lines)');

select * from finish();
rollback;
