begin;
\ir helpers/setup.psql
select plan(25);

-- Roles: owner (financial with MFA), a report viewer (reports.view only), a finance role
-- (reports + financial, no expenses.manage), sales staff (no reports).
insert into public.roles (key, name) values ('report_viewer', 'Report viewer'), ('finance', 'Finance');
insert into public.role_permissions (role_id, permission_key)
select id, 'reports.view' from public.roles where key in ('report_viewer', 'finance');
insert into public.role_permissions (role_id, permission_key)
select id, 'reports.financial.view' from public.roles where key = 'finance';

select tests.create_staff('owner@test190.solei', 'owner') as owner_id \gset
select tests.create_staff('viewer@test190.solei', 'report_viewer') as viewer_id \gset
select tests.create_staff('finance@test190.solei', 'finance') as finance_id \gset
select tests.create_staff('sales@test190.solei', 'sales_staff') as sales_id \gset
select v.id as variant from public.product_variants v order by v.sku limit 1 \gset
select v.id as idle from public.product_variants v order by v.sku desc limit 1 \gset
select id as main from public.stock_locations where is_default \gset
insert into public.variant_costs (variant_id, cost_fils) values (:'variant', 7000)
on conflict (variant_id) do update set cost_fils = 7000;

insert into public.customers (name, phone) values ('T190 Old', '+971500190001') returning id as old_c \gset
insert into public.customers (name, phone) values ('T190 New', '+971500190002') returning id as new_c \gset

-- Old customer bought last year; in the range: two website orders (one refunded in part), a POS
-- sale stamped on the 1st though placed late on 31 May UTC, a cancelled and an unpaid order.
insert into public.orders (channel, customer_id, status, total_fils, subtotal_fils, vat_fils, placed_at)
values ('website', :'old_c', 'completed', 10500, 10500, 500, '2030-03-01 08:00+00');
insert into public.orders (channel, customer_id, status, total_fils, subtotal_fils, vat_fils, placed_at)
values ('website', :'old_c', 'completed', 21000, 21000, 1000, '2031-06-02 08:00+00') returning id as o1 \gset
insert into public.orders (channel, customer_id, status, total_fils, subtotal_fils, vat_fils, placed_at)
values ('whatsapp', :'new_c', 'delivered', 10500, 10500, 500, '2031-06-03 08:00+00') returning id as o2 \gset
insert into public.orders (channel, status, total_fils, subtotal_fils, vat_fils, placed_at)
values ('direct', 'completed', 10500, 10500, 500, '2031-05-31 21:00+00') returning id as o3 \gset
insert into public.orders (channel, status, total_fils, subtotal_fils, vat_fils, placed_at)
values ('website', 'cancelled', 10500, 10500, 500, '2031-06-04 08:00+00');
insert into public.orders (channel, status, total_fils, subtotal_fils, vat_fils, placed_at)
values ('website', 'pending_payment', 10500, 10500, 500, '2031-06-05 08:00+00');
insert into public.orders (channel, status, total_fils, subtotal_fils, vat_fils, placed_at)
values ('website', 'completed', 10500, 10500, 500, '2031-07-02 08:00+00');

insert into public.order_lines (order_id, variant_id, product_name, variant_label, sku, qty, list_price_fils, unit_price_fils, line_total_fils)
values (:'o1', :'variant', 'T190 Perfume', '50 ml', 'T190', 2, 10500, 10500, 21000) returning id as l1 \gset
insert into public.order_lines (order_id, variant_id, product_name, variant_label, sku, qty, list_price_fils, unit_price_fils, line_total_fils)
values (:'o2', :'variant', 'T190 Perfume', '50 ml', 'T190', 1, 10500, 10500, 10500);
insert into public.order_lines (order_id, variant_id, product_name, variant_label, sku, qty, list_price_fils, unit_price_fils, line_total_fils)
values (:'o3', :'variant', 'T190 Perfume', '50 ml', 'T190', 1, 10500, 10500, 10500);
insert into public.order_line_costs (order_line_id, unit_cost_fils) values (:'l1', 6000);

insert into public.payments (order_id, amount_fils, method, status) values
  (:'o1', 21000, 'online_card', 'succeeded'),
  (:'o2', 10500, 'payment_link', 'succeeded'),
  (:'o3', 10500, 'cash', 'failed');
insert into public.payments (order_id, kind, amount_fils, method, status)
values (:'o1', 'refund', 2100, 'online_card', 'succeeded');

insert into public.stock_movements (variant_id, location_id, qty, type) values (:'variant', :'main', 20, 'receive');

insert into public.events (name, type, status, start_date, end_date, participation_fee_fils, fee_payment_status)
values ('T190 Expo', 'exhibition', 'completed', '2031-06-10', '2031-06-11', 300000, 'paid') returning id as expo \gset
insert into public.events (name, type, status, start_date, end_date, participation_fee_fils, fee_payment_status)
values ('T190 Later', 'exhibition', 'confirmed', '2031-07-10', '2031-07-11', 100000, 'unpaid');
insert into public.event_expenses (event_id, category, amount_fils, incurred_on) values (:'expo', 'transport', 45000, '2031-05-20');

select id as rent from public.business_expense_categories where name = 'Rent' \gset
insert into public.business_expenses (category_id, amount_fils, spent_on) values
  (:'rent', 800000, '2031-06-01'), (:'rent', 800000, '2031-07-01');

-- ── Permissions ──
select tests.login_as(:'sales_id');
select throws_ok($$ select public.business_report_data('2031-06-01', '2031-06-30') $$,
  '42501', null, 'sales staff cannot read the business report');
select is((select count(*)::int from public.business_expenses), 0, 'sales staff see no business expenses');

select tests.login_as(:'viewer_id');
select public.business_report_data('2031-06-01', '2031-06-30') as vdoc \gset
select is((:'vdoc'::jsonb ->> 'financial')::boolean, false, 'viewer gets a non-financial report');
select ok((select bool_and(l ->> 'unit_cost_fils' is null) from jsonb_array_elements(:'vdoc'::jsonb -> 'lines') l),
  'viewer sees no line costs');
select ok((select bool_and(s ->> 'cost_fils' is null) from jsonb_array_elements(:'vdoc'::jsonb -> 'stock') s),
  'viewer sees no variant costs');
select is(jsonb_array_length(:'vdoc'::jsonb -> 'expenses') + jsonb_array_length(:'vdoc'::jsonb -> 'events'), 0,
  'viewer sees no expenses or event costs');
select is((select count(*)::int from public.business_expenses), 0, 'viewer cannot read the expenses table');

select tests.login_as(:'finance_id');
select throws_ok(format($$ insert into public.business_expenses (category_id, amount_fils) values (%L, 100) $$, :'rent'),
  '42501', null, 'financial viewers without expenses.manage cannot add expenses');
select ok((select count(*)::int from public.business_expenses) >= 2, 'financial viewers read expenses');

select tests.login_as(:'owner_id');
select lives_ok(format($$ insert into public.business_expenses (category_id, amount_fils, spent_on) values (%L, 100, '2030-01-01') $$, :'rent'),
  'the owner adds expenses');
select lives_ok($$ insert into public.business_expense_categories (name, sort) values ('Insurance', 60) $$,
  'the owner adds a category');
select throws_ok($$ insert into public.business_expense_categories (name) values ('rent') $$,
  '23505', null, 'category names are unique, ignoring case');

-- ── Facts ──
select public.business_report_data('2031-06-01', '2031-06-30') as doc \gset
select is((:'doc'::jsonb ->> 'financial')::boolean, true, 'owner with MFA gets the financial report');
select is(jsonb_array_length(:'doc'::jsonb -> 'orders'), 5, 'every order of the range, any status');
select is(
  (select o ->> 'day' from jsonb_array_elements(:'doc'::jsonb -> 'orders') o where o ->> 'id' = :'o3'),
  '2031-06-01', 'orders are bucketed by Asia/Dubai day');
select is(jsonb_array_length(:'doc'::jsonb -> 'lines'), 3, 'lines of counted orders only');
select is(
  (select sum((l ->> 'qty')::int * (l ->> 'unit_cost_fils')::int)::int from jsonb_array_elements(:'doc'::jsonb -> 'lines') l),
  2 * 6000 + 7000 + 7000, 'cost = the snapshot, else the variant cost');
select is(jsonb_array_length(:'doc'::jsonb -> 'payments'), 3, 'succeeded payments and refunds of counted orders');
select is(
  (select (e ->> 'fee_fils')::int + (e ->> 'expenses_fils')::int from jsonb_array_elements(:'doc'::jsonb -> 'events') e),
  345000, 'an event counts in the range it starts in: fee + all its expenses');
select is(
  (select (e ->> 'amount_fils')::int from jsonb_array_elements(:'doc'::jsonb -> 'expenses') e where e ->> 'category' = 'Rent'),
  800000, 'business expenses of the range, by category');
select is(
  (select c ->> 'first_day' from jsonb_array_elements(:'doc'::jsonb -> 'customers') c where c ->> 'id' = :'old_c'),
  '2030-03-01', 'customers carry their first order day');
select is(
  (select (m ->> 'revenue_fils')::int from jsonb_array_elements(:'doc'::jsonb -> 'months') m where m ->> 'month' = '2031-06'),
  21000 - 2100 + 10500 + 10500, 'month series: counted orders net of refunds');
select is(
  (select s ->> 'last_sold_day' from jsonb_array_elements(:'doc'::jsonb -> 'stock') s where s ->> 'variant_id' = :'variant'),
  '2031-06-03', 'stock rows carry the last day sold on any channel');
select is(
  jsonb_array_length(public.business_report_data('2031-06-01', '2031-06-30', false) -> 'stock'), 0,
  'the compact form leaves the stock list out');
select throws_ok($$ select public.business_report_data('2030-01-01', '2031-06-30') $$,
  '22023', null, 'at most 366 days');

select * from finish();
rollback;
