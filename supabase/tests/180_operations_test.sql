begin;
\ir helpers/setup.psql
select plan(11);

select tests.create_staff('ops-sales@solei.test', 'sales_staff') as sales \gset
select tests.create_staff('ops-owner@solei.test', 'owner') as owner \gset
-- Shifts already in the database (e2e runs leave some behind).
select count(*)::int as before from public.staff_attendance \gset

-- Attendance: sales staff clock themselves in and out.
select tests.login_as(:'sales');
select isnt(public.attendance_clock_in(), null, 'clock in');
select throws_ok($$ select public.attendance_clock_in() $$, 'P0001', null, 'no second open shift');
select isnt(public.attendance_clock_out('Pop-up close'), null, 'clock out');
select throws_ok($$ select public.attendance_clock_out() $$, 'P0001', null, 'not clocked in any more');
select is((select count(*)::int from public.staff_attendance), 1, 'sees own shift');
select throws_ok($$ select public.attendance_save('{}'::jsonb) $$, '42501', null, 'sales can''t edit timesheets');

-- The owner sees everyone and corrects a forgotten clock-out.
select tests.login_as(:'owner');
select public.attendance_clock_in() as open_shift \gset
select is((select count(*)::int from public.staff_attendance), :before + 2, 'owner sees every shift');
select public.attendance_save(jsonb_build_object('id', :'open_shift', 'user_id', :'owner',
  'clock_in', now() - interval '8 hours', 'clock_out', now() - interval '1 hour', 'note', 'Forgot to clock out'));
select is((select round(extract(epoch from clock_out - clock_in) / 3600)::int from public.staff_attendance where id = :'open_shift'),
  7, 'corrected to a 7-hour shift');
select throws_ok(format($$ select public.attendance_save(jsonb_build_object('id', %L, 'user_id', %L,
  'clock_in', now(), 'clock_out', now() - interval '1 hour')) $$, :'open_shift', :'owner'),
  'P0001', null, 'clock-out before clock-in is refused');

-- Courier bookings: readable with orders.view; anon sees nothing.
reset role;
insert into public.orders (channel, status, total_fils, fulfilment) values ('whatsapp', 'preparing', 28000, 'handed_over')
returning id as ord \gset
insert into public.fulfilments (order_id, provider, courier, tracking_number) values (:'ord', 'mock', 'Mock Express', 'MOCK-1');
select tests.login_as(:'sales');
select is((select count(*)::int from public.fulfilments where order_id = :'ord'), 1, 'sales staff can see couriers on orders');
select tests.login_anon();
select is((select count(*)::int from public.fulfilments), 0, 'anon sees no courier bookings');

select * from finish();
rollback;
