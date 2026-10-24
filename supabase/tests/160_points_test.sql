begin;
\ir helpers/setup.psql
select plan(18);

insert into public.customers (name, email, phone) values ('Points Tester', 'points.tester@solei.test', '+971507776655')
returning id as cust \gset
select id as capri from public.product_variants where sku = 'SOL-P-CAP-50' \gset

-- A paid POS-style order: AED 280 cash.
create function pg_temp.paid_order(p_customer uuid, p_total int, p_days_ago int default 0)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.orders (customer_id, channel, status, total_fils, subtotal_fils, fulfilment, placed_at)
  values (p_customer, 'pos', 'completed', p_total, p_total, 'handed_over', now() - make_interval(days => p_days_ago))
  returning id into v;
  insert into public.order_lines (order_id, variant_id, product_name, sku, qty, list_price_fils, unit_price_fils, line_total_fils)
  values (v, (select id from public.product_variants where sku = 'SOL-P-CAP-50'), 'Capri Perfume', 'SOL-P-CAP-50', 1, p_total, p_total, p_total);
  insert into public.payments (order_id, amount_fils, method, status) values (v, p_total, 'cash', 'succeeded');
  perform public.settle_if_paid(v);
  return v;
end $$;

-- Off by default: nothing is earned, stamps still are.
select is((select points_enabled from public.rewards_settings), false, 'points are off by default');
select pg_temp.paid_order(:'cust', 28000) as o1 \gset
select is(public.points_balance(:'cust'), 0, 'no points while switched off');
select ok((select count(*) > 0 from public.loyalty_stamps where order_id = :'o1'), 'Passport stamps still awarded');

-- Switch on: 1 point per AED, Explorer ×1.
update public.rewards_settings set points_enabled = true where id = 1;
select pg_temp.paid_order(:'cust', 28000) as o2 \gset
select is(public.points_balance(:'cust'), 280, '280 points for AED 280 (Explorer ×1)');
select is((select count(*)::int from public.loyalty_stamps where order_id = :'o2'), 1, 'stamps unchanged with points on');

-- Spend past AED 1000 in 12 months → Voyager ×1.25 on the next order.
select pg_temp.paid_order(:'cust', 50000) as o3 \gset
select pg_temp.paid_order(:'cust', 28000) as o4 \gset
select is((select points from public.points_ledger where order_id = :'o4' and entry = 'earn'), 350, 'Voyager earns ×1.25 (280 → 350)');
select is((public.customer_tier(:'cust')).name, 'Voyager', 'tier from 12-month spend');

-- Cancel o4: its points are taken back.
select tests.login_as(tests.create_staff('points-owner@solei.test', 'owner'));
select public.cancel_order(:'o4', 'Changed mind', false);
select is(public.points_balance(:'cust'), 780, 'cancelled order''s points reversed (280 + 500)');

-- Spend 400 points (AED 20) on a website order of AED 280 + 30 delivery.
reset role;
select order_id as w1 from public.create_web_order(jsonb_build_object(
  'client_uuid', gen_random_uuid(), 'emirate', 'abu_dhabi',
  'contact', jsonb_build_object('name', 'Points Tester', 'phone', '+971507776655', 'email', 'points.tester@solei.test'),
  'address', jsonb_build_object('line1', 'Street 1'),
  'lines', jsonb_build_array(jsonb_build_object('variant_id', :'capri', 'qty', 1, 'unit_price_fils', 28000)),
  'subtotal_fils', 28000, 'discount_fils', 0, 'delivery_fee_fils', 3000,
  'vat_fils', 0, 'total_fils', 31000, 'vat_rate_bp', 0, 'prices_include_vat', true, 'points', 400)) \gset
select is(public.points_balance(:'cust'), 380, '400 points spent');
select is((select outstanding_fils from public.order_payment_summary where order_id = :'w1'), 29000, 'AED 20 off what is left to pay');
select throws_ok(format($$ select public.points_redeem(%L, 100, %L) $$, :'cust', :'w1'), 'P0001', null, 'below the minimum is refused');
select throws_ok(format($$ select public.points_redeem(%L, 5000, %L) $$, :'cust', :'w1'), 'P0001', null, 'more than the balance is refused');

-- Abandoned for 24 h → points come back.
update public.orders set created_at = now() - interval '25 hours' where id = :'w1';
select public.points_release_stale();
select is(public.points_balance(:'cust'), 780, 'unpaid checkout gives the points back');

-- Birthday today: bonus once a year (needs a purchase and an email).
update public.customers set birth_month = extract(month from public.business_today()),
  birth_day = extract(day from public.business_today()) where id = :'cust';
select is((select count(*)::int from public.birthdays_due() where customer_id = :'cust'), 1, 'birthday is due today');
select is(public.points_birthday(:'cust'), 250, 'birthday bonus');
select is(public.points_birthday(:'cust'), 0, 'only once a year');
select is((select count(*)::int from public.birthdays_due() where customer_id = :'cust'), 0, 'not due again');

-- Switching off stops earning but keeps balances.
update public.rewards_settings set points_enabled = false where id = 1;
select pg_temp.paid_order(:'cust', 28000) as o5 \gset
select is(public.points_balance(:'cust'), 1030, 'switched off: balance kept, nothing new earned');

select * from finish();
rollback;
