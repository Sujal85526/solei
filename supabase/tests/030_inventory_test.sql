begin;
-- One snapshot for the whole file: the test DB is shared, so rows others commit mid-run stay out of the checks.
set transaction isolation level repeatable read;
\ir helpers/setup.psql
select plan(9);

select tests.create_staff('owner@test.solei', 'owner') as owner_id \gset
select tests.create_staff('sales@test.solei', 'sales_staff') as sales_id \gset
select id as variant from public.product_variants where sku = 'SOL-P-CAP-50' \gset
select id as main from public.stock_locations where is_default \gset

-- Start from exactly 100 at main and nothing elsewhere, whatever the DB holds (seed gives 50).
insert into public.stock_movements (variant_id, location_id, qty, type, reason)
select :'variant', location_id, -sum(qty), 'adjustment', 'test baseline' from public.stock_movements
  where variant_id = :'variant' and location_id <> :'main' group by location_id having sum(qty) <> 0;
select (50 - public.on_hand(:'variant', :'main')) as top_up \gset
insert into public.stock_movements (variant_id, location_id, qty, type, reason)
select :'variant', :'main', :top_up, 'adjustment', 'test baseline' where :top_up <> 0;

select tests.login_as(:'owner_id');
select lives_ok(format($$ select public.record_stock_movement(%L, %L, 'receive', 50, 'Delivery #1') $$, :'variant', :'main'), 'owner receives stock');
select tests.logout();
select is(public.on_hand(:'variant', :'main'), 100, 'main stock is 100');

-- An event gets its own location automatically.
insert into public.events (name, start_date, end_date, status) values ('Abu Dhabi Expo', current_date, current_date + 2, 'confirmed') returning id as event_id \gset
select id as event_loc from public.stock_locations where event_id = :'event_id' \gset
select isnt(:'event_loc'::uuid, null::uuid, 'event location auto-created');

select tests.login_as(:'owner_id');
select lives_ok(format($$ select public.transfer_stock(%L, %L, %L, 30) $$, :'variant', :'main', :'event_loc'), 'allocate 30 to the event');
select tests.logout();

-- Sell 20 online + 10 WhatsApp from main, 30 at the event.
insert into public.stock_movements (variant_id, location_id, qty, type) values
  (:'variant', :'main', -20, 'sale'),
  (:'variant', :'main', -10, 'sale'),
  (:'variant', :'event_loc', -30, 'sale');

select is((select sum(on_hand)::int from public.stock_levels where variant_id = :'variant'), 40,
  '100 in stock − 20 web − 30 event − 10 WhatsApp = 40');
select is(public.on_hand(:'variant', :'event_loc'), 0, 'event location sold out');

select throws_ok(format($$ insert into public.stock_movements (variant_id, location_id, qty, type) values (%L, %L, 5, 'sale') $$, :'variant', :'main'),
  '23514', null, 'a sale cannot add stock');

select tests.login_as(:'sales_id', 'aal1');
select throws_ok(format($$ select public.record_stock_movement(%L, %L, 'adjustment', -1, 'count') $$, :'variant', :'main'),
  '42501', null, 'sales staff cannot adjust stock');
select tests.login_as(:'owner_id');
select throws_ok(format($$ select public.transfer_stock(%L, %L, %L, 999) $$, :'variant', :'main', :'event_loc'),
  'P0001', null, 'cannot transfer more than on hand');

select * from finish();
rollback;
