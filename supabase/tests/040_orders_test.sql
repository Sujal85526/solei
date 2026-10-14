begin;
\ir helpers/setup.psql
select plan(10);

insert into public.orders (channel, total_fils, contact_phone, status, fulfilment)
values ('whatsapp', 56000, '+971501234567', 'new', 'handed_over') returning id as order_id, number as order_no \gset

select matches(:'order_no'::text, '^SOL-\d{6}$'::text, 'order numbers look like SOL-000123');
select is((select payment_status from public.order_payment_summary where order_id = :'order_id'), 'pending', 'unpaid order is pending');

insert into public.payments (order_id, amount_fils, method, status) values (:'order_id', 20000, 'cash', 'succeeded');
select is((select payment_status from public.order_payment_summary where order_id = :'order_id'), 'partially_paid', 'partial payment');
select is((select outstanding_fils from public.order_payment_summary where order_id = :'order_id'), 36000, 'outstanding AED 360');

insert into public.payments (order_id, amount_fils, method, status) values (:'order_id', 36000, 'bank_transfer', 'failed');
select is((select payment_status from public.order_payment_summary where order_id = :'order_id'), 'partially_paid', 'failed payments do not count');

insert into public.payments (order_id, amount_fils, method, status) values (:'order_id', 36000, 'bank_transfer', 'succeeded');
select is((select payment_status from public.order_payment_summary where order_id = :'order_id'), 'paid', 'fully paid');

update public.orders set status = 'preparing' where id = :'order_id';
select is((select count(*)::int from public.order_status_history where order_id = :'order_id'), 2, 'status changes are recorded');

select tests.login_anon();
select is((select status::text from public.track_order(:'order_no', '+971501234567')), 'preparing', 'tracking with the right phone works');
select is((select count(*)::int from public.track_order(:'order_no', '+971500000000')), 0, 'tracking with a wrong phone reveals nothing');
select is((select count(*)::int from public.orders), 0, 'anon cannot list orders');

select * from finish();
rollback;
