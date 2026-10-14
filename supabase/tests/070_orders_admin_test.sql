begin;
\ir helpers/setup.psql
select plan(30);

select tests.create_staff('owner@orders.test', 'owner') as owner_id \gset
select tests.create_staff('sales@orders.test', 'sales_staff') as sales_id \gset
select id as variant, price_fils as price from public.product_variants where sku = 'SOL-P-CAP-50' \gset
select id as main from public.stock_locations where is_default \gset
select public.on_hand(:'variant', :'main') as stock_before \gset

-- A website order for 2 × Capri, awaiting payment (as the checkout server would create it).
select order_id, order_number from public.create_web_order(jsonb_build_object(
  'client_uuid', gen_random_uuid(),
  'fulfilment', 'delivery',
  'emirate', 'abu_dhabi',
  'contact', jsonb_build_object('name', 'Order Test', 'phone', '+971501110070', 'email', 'orders070@solei.test'),
  'address', jsonb_build_object('line1', 'Villa 1', 'area', 'Al Bateen', 'city', 'Abu Dhabi', 'emirate', 'abu_dhabi'),
  'lines', jsonb_build_array(jsonb_build_object('variant_id', :'variant', 'qty', 2, 'unit_price_fils', :price)),
  'subtotal_fils', 2 * :price, 'delivery_fee_fils', 0, 'vat_fils', 0, 'total_fils', 2 * :price,
  'vat_rate_bp', 500, 'prices_include_vat', true
)) \gset

select is((select count(*)::int from public.notification_templates), 14, 'all notification templates are seeded');
select is((select status::text from public.orders where id = :'order_id'), 'pending_payment', 'web order awaits payment');

-- ---------------------------------------------------------------- sales staff
select tests.login_as(:'sales_id', 'aal1');

select throws_ok(format($$ select public.update_order_status(%L, 'preparing') $$, :'order_id'),
  '42501', null, 'sales staff cannot change order status');
select throws_ok(format($$ select * from public.record_payment(%L, 100, 'online_card') $$, :'order_id'),
  '22023', null, 'online methods cannot be recorded by hand');
select throws_ok(format($$ select * from public.record_payment(%L, %s, 'cash') $$, :'order_id', 2 * :price + 1),
  'P0001', null, 'cannot record more than the outstanding balance');

select is(
  (select newly_paid from public.record_payment(:'order_id', :price, 'cash', 'R-1', 'deposit')),
  false, 'a part payment does not complete the order');
select is((select status::text from public.orders where id = :'order_id'), 'pending_payment', 'still awaiting payment');
select is((select payment_status from public.order_payment_summary where order_id = :'order_id'), 'partially_paid', 'part paid');
select tests.logout();
select is(public.on_hand(:'variant', :'main'), :stock_before, 'no stock deducted before full payment');

select tests.login_as(:'sales_id', 'aal1');
select is(
  (select newly_paid from public.record_payment(:'order_id', :price, 'card_terminal')),
  true, 'the final payment completes the order');
select is((select status::text from public.orders where id = :'order_id'), 'new', 'paid order becomes new');
select is((select received_by from public.payments where order_id = :'order_id' and method = 'card_terminal'),
  :'sales_id'::uuid, 'payment records who received it');
select throws_ok(format($$ select public.record_refund(%L, 100, 'cash', 'test refund') $$, :'order_id'),
  '42501', null, 'sales staff cannot record refunds');
select throws_ok(format($$ select public.cancel_order(%L, 'changed mind') $$, :'order_id'),
  '42501', null, 'sales staff cannot cancel orders');
with u as (update public.orders set status = 'completed' where id = :'order_id' returning 1)
select is((select count(*)::int from u), 0, 'orders cannot be updated directly');
select throws_ok(format($$ select * from public.variant_stock_alerts(array[%L]::uuid[]) $$, :'variant'),
  '42501', null, 'stock alert data is server-only');
select tests.logout();

select is(public.on_hand(:'variant', :'main'), :stock_before - 2, 'stock deducted on full payment');
select is((select count(*)::int from public.stock_movements m join public.order_lines l on l.id = m.order_line_id
            where l.order_id = :'order_id' and m.type = 'sale'), 1, 'stock deducted exactly once');

-- ---------------------------------------------------------------- owner
select tests.login_as(:'owner_id', 'aal1');
select throws_ok(format($$ select public.update_order_status(%L, 'preparing') $$, :'order_id'),
  '42501', null, 'owner needs MFA (aal2) to manage orders');

select tests.login_as(:'owner_id');
select is(public.update_order_status(:'order_id', 'dispatched', 'Left with Aramex', 'AX123', 'Aramex')::text,
  'dispatched', 'owner marks the order dispatched');
select is((select tracking_number || ' / ' || courier from public.orders where id = :'order_id'), 'AX123 / Aramex',
  'tracking number and courier are saved');
select is((select note from public.order_status_history where order_id = :'order_id' order by id desc limit 1),
  'Left with Aramex', 'the note is attached to the status change');
select throws_ok(format($$ select public.update_order_status(%L, 'new') $$, :'order_id'),
  'P0001', null, 'dispatched orders cannot go back to new');
select throws_ok(format($$ select public.update_order_status(%L, 'pending_payment') $$, :'order_id'),
  'P0001', null, 'paid orders cannot go back to awaiting payment');

select throws_ok(format($$ select public.record_refund(%L, %s, 'cash', 'too much') $$, :'order_id', 2 * :price + 1),
  'P0001', null, 'cannot refund more than was paid');
select lives_ok(format($$ select public.record_refund(%L, 1000, 'cash', 'Scratched box') $$, :'order_id'),
  'owner records a partial refund');

select is(public.cancel_order(:'order_id', 'Customer returned it', true), 1, 'cancelling restocks the line');
select is(public.cancel_order(:'order_id', 'Customer returned it', true), 0, 'cancelling twice does nothing');
select throws_ok(format($$ select * from public.record_payment(%L, 100, 'cash') $$, :'order_id'),
  'P0001', null, 'cancelled orders take no payments');
select tests.logout();

select is(public.on_hand(:'variant', :'main'), :stock_before, 'stock is back where it started (restocked once)');

select * from finish();
rollback;
