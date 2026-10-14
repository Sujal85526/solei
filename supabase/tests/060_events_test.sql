begin;
\ir helpers/setup.psql
select plan(28);

select tests.create_staff('owner@test60.solei', 'owner') as owner_id \gset
select tests.create_staff('manager@test60.solei', 'manager') as manager_id \gset
select tests.create_staff('sales@test60.solei', 'sales_staff') as sales_id \gset
select id as variant from public.product_variants where sku = 'SOL-P-CAP-50' \gset
select id as main from public.stock_locations where is_default \gset
select public.on_hand(:'variant', :'main') as main_before \gset

-- Two overlapping events far in the future (independent of other data), one cancelled.
insert into public.events (name, type, status, location, start_date, end_date)
values ('T60 Expo', 'exhibition', 'confirmed', 'ADNEC Hall 3', '2031-03-10', '2031-03-12')
returning id as expo \gset
insert into public.events (name, type, status, location, start_date, end_date)
values ('T60 Pop-up', 'popup', 'potential', 'Yas Mall', '2031-03-12', '2031-03-14')
returning id as popup \gset
insert into public.events (name, type, status, location, start_date, end_date)
values ('T60 Cancelled', 'exhibition', 'cancelled', 'ADNEC Hall 3', '2031-03-11', '2031-03-11')
returning id as cancelled \gset
select id as event_loc from public.stock_locations where event_id = :'expo' \gset

-- ── Overlap detection ──
select tests.login_as(:'sales_id', 'aal1');
select is(
  (select count(*)::int from public.overlapping_events('2031-03-10', '2031-03-12', null, null) where name like 'T60%'),
  2, 'overlap finds both active events, ignores the cancelled one');
select is(
  (select array_agg(name order by name) from public.overlapping_events('2031-03-01', '2031-03-11', :'expo', null) where name like 'T60%'),
  null::text[], 'an event does not overlap itself; the pop-up starts later');
select is(
  (select name from public.overlapping_events('2031-03-12', '2031-03-12', :'popup', 'adnec hall 3 ') where name like 'T60%'),
  'T60 Expo', 'touching end date counts as overlap');
select ok(
  (select same_location from public.overlapping_events('2031-03-12', '2031-03-12', :'popup', 'adnec hall 3 ') where name like 'T60%'),
  'same venue is flagged (case/space-insensitive)');
select is(
  (select count(*)::int from public.overlapping_events('2031-03-15', '2031-03-20', null, null) where name like 'T60%'),
  0, 'no overlap after both events end');

-- ── RLS: calendar visible to sales staff, expenses are financial ──
select tests.logout();
insert into public.event_expenses (event_id, category, amount_fils, note)
values (:'expo', 'transport', 45000, 'Van hire');
insert into public.event_staff (event_id, user_id, role) values (:'expo', :'sales_id', 'Sales');

select tests.login_as(:'sales_id', 'aal1');
select is((select count(*)::int from public.events where id = :'expo'), 1, 'sales staff sees the event');
select is((select count(*)::int from public.event_staff where event_id = :'expo'), 1, 'sales staff sees assigned staff');
select is((select count(*)::int from public.event_expenses where event_id = :'expo'), 0, 'sales staff cannot see expenses');
select ok((select count(*) > 0 from public.event_staff_options()), 'sales staff can list staff names for events');
select throws_ok(
  format($$ insert into public.event_expenses (event_id, amount_fils) values (%L, 100) $$, :'expo'),
  '42501', null, 'sales staff cannot add expenses');
select throws_ok(
  format($$ insert into public.event_documents (event_id, name, storage_path) values (%L, 'x', 'x/docs/x.pdf') $$, :'expo'),
  '42501', null, 'sales staff cannot add documents');
select is(public.can_access_event_object(:'expo' || '/receipts/a.jpg', false), false, 'sales staff cannot read receipts');
select is(public.can_access_event_object(:'expo' || '/docs/a.pdf', false), true, 'sales staff can read documents');

select tests.login_as(:'manager_id');
select is((select sum(amount_fils)::int from public.event_expenses where event_id = :'expo'), 45000, 'manager sees expenses');
select lives_ok(
  format($$ insert into public.event_documents (event_id, name, storage_path, mime, size_bytes) values (%L, 'Contract.pdf', %L, 'application/pdf', 1200) $$,
    :'expo', :'expo' || '/docs/contract.pdf'),
  'manager adds a document');

select tests.login_as(:'owner_id', 'aal1');
select is((select count(*)::int from public.event_expenses where event_id = :'expo'), 0, 'owner without MFA sees no expenses');

-- ── Allocation → sale → close-out ──
select tests.login_as(:'owner_id');
select throws_ok(
  format($$ select public.allocate_event_stock(%L, '[{"variant_id": "%s", "qty": 999999}]'::jsonb) $$, :'expo', :'variant'),
  'P0001', null, 'cannot allocate more than main stock holds');
select is(
  public.allocate_event_stock(:'expo', format('[{"variant_id": "%s", "qty": 12}, {"variant_id": "%s", "qty": 8}]', :'variant', :'variant')::jsonb),
  20, 'allocate 20 to the event from main stock');
select tests.logout();
insert into public.stock_movements (variant_id, location_id, qty, type, event_id)
values (:'variant', :'event_loc', -6, 'sale', :'expo'), (:'variant', :'event_loc', 1, 'refund_return', :'expo');

select tests.login_as(:'owner_id');
select results_eq(
  format($$ select allocated, sold, returned, damaged, remaining from public.event_stock_summary where event_id = %L and variant_id = %L $$, :'expo', :'variant'),
  $$ values (20, 5, 0, 0, 15) $$,
  'summary before close: 20 allocated, 5 net sold, 15 remaining');

select throws_ok(
  format($$ select public.close_event_stock(%L, '[{"variant_id": "%s", "qty": 14}]'::jsonb) $$, :'expo', :'variant'),
  'P0001', null, 'close-out refuses when units are unaccounted for');

select tests.login_as(:'sales_id', 'aal1');
select throws_ok(
  format($$ select public.close_event_stock(%L, '[{"variant_id": "%s", "qty": 15}]'::jsonb) $$, :'expo', :'variant'),
  '42501', null, 'sales staff cannot close an event');

select tests.login_as(:'owner_id');
select is(
  public.close_event_stock(:'expo',
    format('[{"variant_id": "%s", "qty": 14}]', :'variant')::jsonb, null,
    format('[{"variant_id": "%s", "qty": 1, "reason": "Dropped tester"}]', :'variant')::jsonb),
  '{"returned": 14, "damaged": 1}'::jsonb, 'close-out returns 14 and records 1 broken');

select results_eq(
  format($$ select allocated, sold, returned, damaged, remaining from public.event_stock_summary where event_id = %L and variant_id = %L $$, :'expo', :'variant'),
  $$ values (20, 5, 14, 1, 0) $$,
  'summary after close: 14 returned, 1 damaged, 0 remaining');
select tests.logout();
select is(public.on_hand(:'variant', :'main'), :main_before - 20 + 14, 'main stock got the 14 back');
select is((select status::text from public.events where id = :'expo'), 'completed', 'event is completed');
select is(
  (select reason from public.stock_movements where location_id = :'event_loc' and type = 'damage'),
  'Dropped tester', 'breakage keeps its reason');

select tests.login_as(:'owner_id');
select throws_ok(
  format($$ select public.close_event_stock(%L, '[]'::jsonb) $$, :'expo'),
  'P0001', 'this event is already closed', 'an event closes only once');
select throws_ok(
  format($$ select public.allocate_event_stock(%L, '[{"variant_id": "%s", "qty": 1}]'::jsonb) $$, :'expo', :'variant'),
  'P0001', null, 'no allocation to a closed event');

select * from finish();
rollback;
