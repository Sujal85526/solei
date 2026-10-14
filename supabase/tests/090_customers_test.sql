begin;
\ir helpers/setup.psql
select plan(17);

-- A customer with orders across channels, partial payments and refunds.
select public.upsert_customer('+971501112233', 'noor@example.com', 'Noor', 'pos') as cust \gset
select public.upsert_customer('+971504445566', null, 'Sara', 'website') as other \gset

-- A: POS, fully paid 300
insert into public.orders (customer_id, channel, total_fils, status, placed_at)
values (:'cust', 'pos', 30000, 'completed', '2026-09-01 10:00+04') returning id as o_a \gset
insert into public.payments (order_id, amount_fils, method, status) values (:'o_a', 30000, 'cash', 'succeeded');
with line as (
  insert into public.order_lines (order_id, variant_id, product_name, sku, qty, list_price_fils, unit_price_fils, line_total_fils)
  select :'o_a', id, 'Cannes', sku, 1, 30000, 30000, 30000 from public.product_variants where sku = 'SOL-P-CAN-50'
  returning id
)
insert into public.order_line_costs (order_line_id, unit_cost_fils) select id, 9000 from line;
-- B: WhatsApp 200, part paid 50 (a failed payment doesn't count)
insert into public.orders (customer_id, channel, total_fils, status, placed_at)
values (:'cust', 'whatsapp', 20000, 'new', '2026-10-05 12:00+04') returning id as o_b \gset
insert into public.payments (order_id, amount_fils, method, status) values
  (:'o_b', 5000, 'bank_transfer', 'succeeded'),
  (:'o_b', 15000, 'bank_transfer', 'failed');
-- C: website 100, paid then partly refunded 40
insert into public.orders (customer_id, channel, total_fils, status, placed_at)
values (:'cust', 'website', 10000, 'delivered', '2026-09-20 09:00+04') returning id as o_c \gset
insert into public.payments (order_id, kind, amount_fils, method, status) values
  (:'o_c', 'payment', 10000, 'online_card', 'succeeded'),
  (:'o_c', 'refund', 4000, 'online_card', 'succeeded');
-- D: abandoned website checkout — not a purchase
insert into public.orders (customer_id, channel, total_fils, status, placed_at)
values (:'cust', 'website', 99900, 'pending_payment', '2026-10-10 09:00+04');
-- E: cancelled after payment, fully refunded — not a purchase, nets to zero
insert into public.orders (customer_id, channel, total_fils, status, placed_at)
values (:'cust', 'direct', 8000, 'cancelled', '2026-10-12 09:00+04') returning id as o_e \gset
insert into public.payments (order_id, kind, amount_fils, method, status) values
  (:'o_e', 'payment', 8000, 'cash', 'succeeded'),
  (:'o_e', 'refund', 8000, 'cash', 'succeeded');

select is((select order_count from public.customer_summary where id = :'cust'), 3,
  'orders count excludes pending-payment and cancelled orders');
select is((select total_spent_fils from public.customer_summary where id = :'cust'), 41000,
  'total spent = succeeded payments − refunds (300 + 50 + 100 − 40)');
select is((select first_purchase_at from public.customer_summary where id = :'cust'), '2026-09-01 10:00+04'::timestamptz,
  'first purchase');
select is((select last_purchase_at from public.customer_summary where id = :'cust'), '2026-10-05 12:00+04'::timestamptz,
  'last purchase ignores the abandoned and cancelled orders');
select is((select order_count || '/' || total_spent_fils || '/' || coalesce(last_purchase_at::text, 'null')
           from public.customer_summary where id = :'other'), '0/0/null', 'customer without orders has zero stats');

select is((select count(*)::int from public.order_line_costs where order_line_id in
  (select id from public.order_lines where order_id = :'o_a')), 1, 'cost snapshot exists');

-- Sales staff: can view customers and totals, can edit customers, can't see costs.
select tests.create_staff('sales@test.solei', 'sales_staff') as sales \gset
select tests.login_as(:'sales', 'aal1');
select is((select count(*)::int from public.customer_summary), 2, 'sales staff sees customers');
select is((select total_spent_fils from public.customer_summary where id = :'cust'), 41000, 'sales staff sees totals');
update public.customers set notes = 'Prefers Capri' where id = :'cust';
select is((select notes from public.customers where id = :'cust'), 'Prefers Capri', 'sales staff can edit notes (customers.manage)');
select throws_ok($$ update public.customers set phone = '+971504445566' where name = 'Noor' $$, '23505', null,
  'phone stays unique');
select is((select count(*)::int from public.order_line_costs where order_line_id in
  (select id from public.order_lines where order_id = :'o_a')), 0, 'sales staff cannot read cost snapshots');
select tests.logout();

-- A custom role with customers.view only: reads customers, can't edit, sees no order totals.
insert into public.roles (key, name) values ('front_desk', 'Front desk');
insert into public.role_permissions (role_id, permission_key)
select id, 'customers.view' from public.roles where key = 'front_desk';
select tests.create_staff('desk@test.solei', 'front_desk') as desk \gset
select tests.login_as(:'desk', 'aal1');
select is((select count(*)::int from public.customer_summary), 2, 'customers.view lists customers');
select is((select total_spent_fils from public.customer_summary where id = :'cust'), 0,
  'without orders.view the order totals stay hidden');
update public.customers set notes = 'hijack' where id = :'cust';
select is((select notes from public.customers where id = :'cust'), 'Prefers Capri', 'customers.view alone cannot edit');
select tests.logout();

-- Staff without customers.view and anonymous visitors see nothing.
insert into public.roles (key, name) values ('stock_only', 'Stock only');
insert into public.role_permissions (role_id, permission_key)
select id, 'inventory.view' from public.roles where key = 'stock_only';
select tests.create_staff('stock@test.solei', 'stock_only') as stock \gset
select tests.login_as(:'stock', 'aal1');
select is((select count(*)::int from public.customer_summary), 0, 'no customers.view → no customers');
select tests.logout();

select tests.login_anon();
select throws_ok($$ select count(*) from public.customer_summary $$, '42501', null, 'anon has no access to the view');
select tests.logout();

-- Edits are audited with the actor.
select is((select actor_id from public.audit_log where entity = 'customers' and entity_id = :'cust'
           and action = 'customers.update' order by id desc limit 1), :'sales'::uuid, 'customer edits are audited');

select * from finish();
rollback;
