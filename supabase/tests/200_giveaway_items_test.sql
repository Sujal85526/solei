begin;
\ir helpers/setup.psql
select plan(23);

-- A wedding giveaway offering two real bottles: Cannes 50 ml at a giveaway price of AED 150 and
-- Soho spray 100 ml at its own price (AED 190); a packaging choice with a photo; at least 20 pieces.
insert into public.products (slug, name, category_id, active, min_order_qty, is_giveaway)
select 'test-wedding-giveaway', 'Test Wedding Giveaway', id, true, 20, true from public.categories where slug = 'perfume'
returning id as gw \gset
select id as cannes from public.product_variants where sku = 'TST-P-CAN-50' \gset
select id as soho from public.product_variants where sku = 'TST-S-SOH-100' \gset
select id as capri from public.product_variants where sku = 'TST-P-CAP-50' \gset
insert into public.giveaway_items (product_id, variant_id, price_fils, sort) values (:'gw', :'cannes', 15000, 1);
insert into public.giveaway_items (product_id, variant_id, sort) values (:'gw', :'soho', 2);
insert into public.product_option_groups (product_id, name, kind, required, sort)
values (:'gw', 'Packaging', 'single', true, 1) returning id as pack \gset
insert into public.product_options (group_id, label, price_delta_fils, image_url, sort)
values (:'pack', 'Gold box', 1000, '/images/x.jpg', 1) returning id as gold \gset

select jsonb_build_array(jsonb_build_object('group_id', :'pack', 'option_ids', jsonb_build_array(:'gold'))) as opts \gset

-- ── Pricing and checks ──
select is(public.line_unit_price_fils(:'cannes', :'opts', :'gw'), 16000, 'giveaway price + packaging');
select is(public.line_unit_price_fils(:'soho', :'opts', :'gw'), 20000, 'variant price when no giveaway price + packaging');
select is(public.line_unit_price_fils(:'cannes', null, null), 28000, 'an ordinary line keeps the variant price');
select is(public.line_unit_price_fils(:'cannes', null), 28000, 'the 2-argument version still works');
select is(public.line_options_check(:'capri', :'opts', :'gw') ->> 'ok', 'false', 'a bottle the giveaway does not offer is refused');
select is(public.line_options_check(:'cannes', '[]', :'gw') ->> 'ok', 'false', 'the giveaway''s required packaging must be chosen');
select is(public.line_options_check(:'cannes', :'opts', null) ->> 'ok', 'false', 'giveaway options on an ordinary line are refused');
select is(public.line_options_check(:'cannes', :'opts', :'gw') -> 'snapshot' -> 0 -> 'choices' -> 0 ->> 'label',
  'Test Wedding Giveaway', 'snapshot starts with the giveaway');
select is(public.line_options_check(:'cannes', :'opts', :'gw') -> 'snapshot' -> 1 -> 'choices' -> 0 ->> 'label',
  'Gold box', 'snapshot names the packaging');

-- ── Website ──
create function pg_temp.web_order(p_lines jsonb, p_total int)
returns uuid language sql as $$
  select order_id from public.create_web_order(jsonb_build_object(
    'client_uuid', gen_random_uuid(), 'emirate', 'abu_dhabi',
    'contact', jsonb_build_object('name', 'Wedding Buyer', 'phone', '+971509990012', 'email', 'wedding@solei.test'),
    'address', jsonb_build_object('line1', 'Hall 2'), 'lines', p_lines,
    'subtotal_fils', p_total, 'discount_fils', 0, 'delivery_fee_fils', 0,
    'vat_fils', 0, 'total_fils', p_total, 'vat_rate_bp', 0, 'prices_include_vat', true));
$$;
-- 12 Cannes + 8 Soho = 20 pieces of the giveaway (each bottle alone is below the minimum).
select pg_temp.web_order(jsonb_build_array(
  jsonb_build_object('variant_id', :'cannes', 'qty', 12, 'unit_price_fils', 16000, 'options', :'opts'::jsonb, 'giveaway_id', :'gw'),
  jsonb_build_object('variant_id', :'soho', 'qty', 8, 'unit_price_fils', 20000, 'options', :'opts'::jsonb, 'giveaway_id', :'gw')),
  12 * 16000 + 8 * 20000) as o1 \gset
select is((select sum(line_total_fils)::int from public.order_lines where order_id = :'o1'), 352000, 'website lines priced by the database');
select is((select count(*)::int from public.order_lines where order_id = :'o1' and giveaway_product_id = :'gw'), 2,
  'lines remember the giveaway');
select is((select variant_id from public.order_lines where order_id = :'o1' order by qty desc limit 1), :'cannes'::uuid,
  'the line is the real bottle (stock and reports count it)');
select throws_ok(format($$ select pg_temp.web_order(jsonb_build_array(jsonb_build_object('variant_id', %L, 'qty', 10,
    'unit_price_fils', 16000, 'options', %L::jsonb, 'giveaway_id', %L)), 160000) $$, :'cannes', :'opts', :'gw'),
  'P0001', 'Test Wedding Giveaway comes in at least 20 pieces', 'the giveaway minimum counts across its bottles');
select throws_ok(format($$ select pg_temp.web_order(jsonb_build_array(jsonb_build_object('variant_id', %L, 'qty', 20,
    'unit_price_fils', 15000, 'options', %L::jsonb, 'giveaway_id', %L)), 300000) $$, :'cannes', :'opts', :'gw'),
  'P0001', 'prices changed — please review your cart', 'a wrong browser price is refused');
select is((public.coupon_evaluate('NOPE', '[]', null) ->> 'ok'), 'false', 'coupon_evaluate still answers');

-- Saved bag keeps the giveaway.
select tests.create_user('wedding-bag@solei.test') as bag_user \gset
select public.cart_sync(:'bag_user', 'wedding-bag@solei.test', 'Bag',
  jsonb_build_array(jsonb_build_object('variant_id', :'cannes', 'qty', 150, 'options', :'opts'::jsonb, 'giveaway_id', :'gw'))) as cart \gset
select is((select value_fils from public.carts where id = :'cart'), 150 * 16000, 'saved bag priced as a giveaway (150 pieces)');
select is((select lines -> 0 ->> 'giveaway_id' from public.carts where id = :'cart'), :'gw'::text, 'saved bag keeps the giveaway');

-- ── Till and manual orders ──
insert into public.events (name, status, start_date, end_date)
values ('Giveaway Test Pop-up', 'confirmed', public.business_today(), public.business_today()) returning id as ev \gset
select tests.login_as(tests.create_staff('giveaway-owner@solei.test', 'owner'));
select order_id as pos from public.pos_complete_sale(jsonb_build_object(
  'client_uuid', gen_random_uuid(), 'event_id', :'ev',
  'lines', jsonb_build_array(jsonb_build_object('variant_id', :'cannes', 'qty', 20, 'options', :'opts'::jsonb, 'giveaway_id', :'gw')),
  'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_fils', 20 * 16000)))) \gset
select is((select options -> 1 -> 'choices' -> 0 ->> 'label' from public.order_lines where order_id = :'pos'), 'Gold box',
  'till line snapshots the choices');
select is((select -sum(m.qty)::int from public.stock_movements m join public.order_lines l on l.id = m.order_line_id
            where l.order_id = :'pos' and m.variant_id = :'cannes'), 20, 'till sale takes the real bottles from stock');
select throws_ok(format($$ select public.pos_complete_sale(jsonb_build_object('client_uuid', gen_random_uuid(), 'event_id', %L,
    'lines', jsonb_build_array(jsonb_build_object('variant_id', %L, 'qty', 5, 'options', %L::jsonb, 'giveaway_id', %L)),
    'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_fils', 80000)))) $$, :'ev', :'cannes', :'opts', :'gw'),
  'P0001', 'Test Wedding Giveaway comes in at least 20 pieces', 'till applies the minimum too');

insert into public.customers (name, phone, email) values ('Manual Giveaway', '+971509990013', 'manual-giveaway@solei.test')
returning id as cust \gset
select * from public.create_manual_order(jsonb_build_object(
  'client_uuid', gen_random_uuid(), 'channel', 'whatsapp', 'customer_id', :'cust', 'fulfilment', 'handed_over',
  'lines', jsonb_build_array(jsonb_build_object('variant_id', :'soho', 'qty', 25, 'options', :'opts'::jsonb, 'giveaway_id', :'gw')))) \gset m_
select is(:m_total_fils, 25 * 20000, 'manual order priced with the giveaway choices');
select is((select list_price_fils from public.order_lines where order_id = :'m_order_id'), 20000,
  'list price includes the choices (no override needed)');
select throws_ok(format($$ select public.create_manual_order(jsonb_build_object('client_uuid', gen_random_uuid(),
    'channel', 'whatsapp', 'customer_id', %L, 'lines', jsonb_build_array(jsonb_build_object('variant_id', %L, 'qty', 25,
    'giveaway_id', %L)))) $$, :'cust', :'soho', :'gw'),
  '22023', null, 'manual order needs the required choices');

select * from finish();
rollback;
