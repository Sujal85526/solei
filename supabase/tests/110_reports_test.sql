begin;
\ir helpers/setup.psql
select plan(24);

-- Roles: owner (financial with MFA), a report viewer (reports.view only), sales staff (no reports).
insert into public.roles (key, name) values ('report_viewer', 'Report viewer');
insert into public.role_permissions (role_id, permission_key)
select id, 'reports.view' from public.roles where key = 'report_viewer';

select tests.create_staff('owner@test110.solei', 'owner') as owner_id \gset
select tests.create_staff('viewer@test110.solei', 'report_viewer') as viewer_id \gset
select tests.create_staff('sales@test110.solei', 'sales_staff') as sales_id \gset
select id as variant from public.product_variants where sku = 'SOL-P-CAP-50' \gset
select id as main from public.stock_locations where is_default \gset

insert into public.events (name, type, status, start_date, end_date, participation_fee_fils, fee_payment_status)
values ('T110 Expo', 'exhibition', 'completed', '2031-05-10', '2031-05-12', 500000, 'paid')
returning id as expo \gset
insert into public.events (name, type, status, start_date, end_date)
values ('T110 Pop-up', 'popup', 'completed', '2031-06-01', '2031-06-01')
returning id as popup \gset
select id as loc from public.stock_locations where event_id = :'expo' \gset

-- Two POS sales and a cancelled one; the second has no event_day (bucketed by placed_at).
insert into public.orders (channel, event_id, event_day, status, total_fils, subtotal_fils, vat_fils, placed_at)
values ('pos', :'expo', '2031-05-10', 'completed', 56000, 56000, 2667, '2031-05-10 08:00+00')
returning id as o1 \gset
insert into public.orders (channel, event_id, event_day, status, total_fils, subtotal_fils, vat_fils, placed_at)
values ('pos', :'expo', null, 'completed', 28000, 28000, 1333, '2031-05-10 21:30+00')
returning id as o2 \gset
insert into public.orders (channel, event_id, event_day, status, total_fils, subtotal_fils, vat_fils, placed_at)
values ('pos', :'expo', '2031-05-11', 'cancelled', 28000, 28000, 1333, '2031-05-11 08:00+00')
returning id as o3 \gset

insert into public.order_lines (order_id, variant_id, product_name, variant_label, sku, qty, list_price_fils, unit_price_fils, line_total_fils)
values (:'o1', :'variant', 'Capri Perfume', '50 ml', 'SOL-P-CAP-50', 2, 28000, 28000, 56000)
returning id as l1 \gset
insert into public.order_lines (order_id, variant_id, product_name, variant_label, sku, qty, list_price_fils, unit_price_fils, line_total_fils)
values (:'o2', :'variant', 'Capri Perfume', '50 ml', 'SOL-P-CAP-50', 1, 28000, 28000, 28000);
insert into public.order_lines (order_id, variant_id, product_name, variant_label, sku, qty, list_price_fils, unit_price_fils, line_total_fils)
values (:'o3', :'variant', 'Capri Perfume', '50 ml', 'SOL-P-CAP-50', 1, 28000, 28000, 28000);
insert into public.order_line_costs (order_line_id, unit_cost_fils) values (:'l1', 9000);

insert into public.payments (order_id, amount_fils, method, status) values
  (:'o1', 56000, 'cash', 'succeeded'),
  (:'o2', 28000, 'card_terminal', 'succeeded'),
  (:'o2', 28000, 'soft_pos', 'failed');
insert into public.payments (order_id, kind, amount_fils, method, status)
values (:'o1', 'refund', 5600, 'cash', 'succeeded');

-- Stock: allocated the evening before (Dubai), a sale late on day 1 in UTC = day 2 in Dubai.
insert into public.stock_movements (variant_id, location_id, qty, type, event_id, created_at) values
  (:'variant', :'main', -10, 'transfer_out', :'expo', '2031-05-09 14:00+00'),
  (:'variant', :'loc', 10, 'transfer_in', :'expo', '2031-05-09 14:00+00'),
  (:'variant', :'loc', -1, 'sale', :'expo', '2031-05-10 21:30+00');

insert into public.event_expenses (event_id, category, amount_fils) values (:'expo', 'transport', 45000);

-- ── Permissions ──
select tests.login_as(:'sales_id', 'aal1');
select throws_ok(format($$ select public.event_report_data(array[%L]::uuid[]) $$, :'expo'),
  '42501', null, 'sales staff without reports.view cannot read reports');
select throws_ok($$ select * from public.report_event_options() $$,
  '42501', null, 'sales staff cannot list report events');

select tests.login_as(:'viewer_id', 'aal1');
select public.event_report_data(array[:'expo']::uuid[]) -> 0 as viewer_doc \gset
select is((:'viewer_doc'::jsonb ->> 'financial')::boolean, false, 'viewer gets a non-financial report');
select is(:'viewer_doc'::jsonb #>> '{event,participation_fee_fils}', null, 'viewer does not see the fee');
select is(jsonb_array_length(:'viewer_doc'::jsonb -> 'expenses'), 0, 'viewer does not see expenses');
select ok(
  (select bool_and(l ->> 'unit_cost_fils' is null) from jsonb_array_elements(:'viewer_doc'::jsonb -> 'lines') l),
  'viewer does not see cost snapshots');
select is(jsonb_array_length(:'viewer_doc'::jsonb -> 'orders'), 3, 'viewer sees units/revenue facts');

select tests.login_as(:'owner_id', 'aal1');
-- T15: owner/manager permissions only count at aal2, so without MFA there is no report at all.
select throws_ok(format($$ select public.event_report_data(array[%L]::uuid[]) $$, :'expo'),
  '42501', null, 'owner without MFA cannot read reports');

select tests.login_as(:'owner_id');
select public.event_report_data(array[:'expo']::uuid[]) -> 0 as doc \gset
select is((:'doc'::jsonb ->> 'financial')::boolean, true, 'owner with MFA gets the financial report');
select is((:'doc'::jsonb #>> '{event,participation_fee_fils}')::int, 500000, 'owner sees the fee');
select is((select sum((e ->> 'amount_fils')::int)::int from jsonb_array_elements(:'doc'::jsonb -> 'expenses') e),
  45000, 'owner sees expenses');
select is(
  (select (l ->> 'unit_cost_fils')::int from jsonb_array_elements(:'doc'::jsonb -> 'lines') l where l ->> 'order_id' = :'o1'),
  9000, 'cost snapshot comes from order_line_costs');
select is(
  (select count(*)::int from jsonb_array_elements(:'doc'::jsonb -> 'lines') l where l ->> 'unit_cost_fils' is null),
  2, 'lines without a snapshot report a null cost');

-- ── Facts ──
select is(
  (select o ->> 'status' from jsonb_array_elements(:'doc'::jsonb -> 'orders') o where o ->> 'id' = :'o3'),
  'cancelled', 'orders carry their status so cancelled ones can be excluded');
select is(
  (select o ->> 'event_day' from jsonb_array_elements(:'doc'::jsonb -> 'orders') o where o ->> 'id' = :'o2'),
  null, 'event_day is passed through (null when the POS did not stamp it)');
select is(jsonb_array_length(:'doc'::jsonb -> 'payments'), 3, 'only succeeded payments and refunds');
select is(
  (select sum((p ->> 'amount_fils')::int)::int from jsonb_array_elements(:'doc'::jsonb -> 'payments') p where p ->> 'kind' = 'refund'),
  5600, 'refunds are included as kind = refund');
select is(
  (select s ->> 'day' from jsonb_array_elements(:'doc'::jsonb -> 'stock') s where s ->> 'type' = 'sale'),
  '2031-05-11', 'stock movements are bucketed by Asia/Dubai day');
select is(
  (select s ->> 'day' from jsonb_array_elements(:'doc'::jsonb -> 'stock') s where s ->> 'type' = 'transfer_in'),
  '2031-05-09', 'allocation keeps its own (pre-event) day');
select is(
  (select count(*)::int from jsonb_array_elements(:'doc'::jsonb -> 'stock') s where s ->> 'type' = 'transfer_out'),
  0, 'only movements at the event location are counted');

-- ── Picker, ordering, limits ──
select is(
  (select units from public.report_event_options() where id = :'expo'),
  3, 'picker units exclude the cancelled order');
select is(
  public.event_report_data(array[:'popup', :'expo']::uuid[]) #>> '{0,event,name}',
  'T110 Pop-up', 'events come back in the order asked');
select is(public.event_report_data(array[]::uuid[]), '[]'::jsonb, 'no ids, no report');
select throws_ok(
  $$ select public.event_report_data(array(select gen_random_uuid() from generate_series(1, 13))) $$,
  '22023', null, 'at most 12 events per call');

select * from finish();
rollback;
