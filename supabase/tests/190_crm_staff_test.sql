begin;
\ir helpers/setup.psql
select plan(31);

select tests.create_staff('crm-owner@solei.test', 'owner') as owner \gset
select tests.create_staff('crm-sales@solei.test', 'sales_staff') as sales \gset
select tests.create_staff('crm-manager@solei.test', 'manager') as manager \gset

-- ── Labels ─────────────────────────────────────────────────────────────────────────────────
-- Defaults: VIP ≥ AED 2,000 in 12 months, inactive after 180 days, new for 30 days, returning = 2+.
insert into public.customers (name, email) values ('Lbl New', 'lbl.new@solei.test') returning id as c_new \gset
insert into public.customers (name, email) values ('Lbl Back', 'lbl.back@solei.test') returning id as c_back \gset
insert into public.customers (name, email) values ('Lbl Vip', 'lbl.vip@solei.test') returning id as c_vip \gset
insert into public.customers (name, email) values ('Lbl Gone', 'lbl.gone@solei.test') returning id as c_gone \gset
insert into public.customers (name, email) values ('Lbl None', 'lbl.none@solei.test') returning id as c_none \gset

create function pg_temp.paid_order(p_customer uuid, p_fils int, p_days int, p_staff uuid default null)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.orders (customer_id, channel, status, total_fils, subtotal_fils, fulfilment, placed_at, staff_id)
  values (p_customer, 'pos', 'completed', p_fils, p_fils, 'handed_over', now() - make_interval(days => p_days), p_staff)
  returning id into v;
  insert into public.payments (order_id, amount_fils, method, status) values (v, p_fils, 'cash', 'succeeded');
  return v;
end $$;

select pg_temp.paid_order(:'c_new', 30000, 5);
select pg_temp.paid_order(:'c_back', 30000, 100);
select pg_temp.paid_order(:'c_back', 30000, 60);
select pg_temp.paid_order(:'c_vip', 150000, 40);
select pg_temp.paid_order(:'c_vip', 60000, 20);
select pg_temp.paid_order(:'c_gone', 30000, 400);
select pg_temp.paid_order(:'c_gone', 30000, 300);

select tests.login_as(:'sales');
select is((select label from public.customer_summary where id = :'c_new'), 'new', 'first purchase 5 days ago = new');
select is((select label from public.customer_summary where id = :'c_back'), 'returning', 'two purchases = returning');
select is((select label from public.customer_summary where id = :'c_vip'), 'vip', 'AED 2,100 in a year = VIP');
select is((select label from public.customer_summary where id = :'c_gone'), 'inactive', 'nothing for 300 days = inactive');
select is((select label from public.customer_summary where id = :'c_none'), null, 'no purchases = no label');
select is((select recent_spent_fils from public.customer_summary where id = :'c_vip'), 210000, 'spend in the VIP window');

-- The owner changes the rules: VIP from AED 2,500, so the VIP is just returning now.
reset role;
update public.settings set label_vip_spend_fils = 250000 where id = 1;
select tests.login_as(:'sales');
select is((select label from public.customer_summary where id = :'c_vip'), 'returning', 'rules are read live');
reset role;
update public.settings set label_vip_spend_fils = 200000 where id = 1;

select tests.login_as(:'owner');
select results_eq(
  format($$ select customer_id::text from public.segment_members('{"labels": ["vip", "new"]}') where customer_id in (%L, %L, %L) $$,
         :'c_new', :'c_vip', :'c_back'),
  array[:'c_vip', :'c_new'],
  'segments filter by label');

-- ── Complaints & suggestions ───────────────────────────────────────────────────────────────
select tests.login_as(:'sales');
insert into public.customer_feedback (customer_id, kind, message, assigned_to, created_by)
values (:'c_back', 'complaint', 'Cap was loose on arrival', :'owner', :'sales') returning id as fb \gset
select is((select count(*)::int from public.customer_feedback where customer_id = :'c_back'), 1, 'sales staff log a complaint (customers.manage)');
update public.customer_feedback set status = 'resolved', resolution = 'Sent a new cap' where id = :'fb';
select isnt((select resolved_at from public.customer_feedback where id = :'fb'), null, 'resolving stamps the date');
update public.customer_feedback set status = 'open' where id = :'fb';
select is((select resolved_at from public.customer_feedback where id = :'fb'), null, 'reopening clears it');
select throws_ok($$ insert into public.customer_feedback (kind, message) values ('other', 'about nobody') $$,
  '23514', null, 'feedback must be about a customer or an order');
select tests.login_anon();
select is((select count(*)::int from public.customer_feedback), 0, 'anon sees no feedback');

-- ── Rota ───────────────────────────────────────────────────────────────────────────────────
select tests.login_as(:'owner');
insert into public.staff_shifts (user_id, starts_at, ends_at, note)
values (:'sales', now() + interval '3 hours', now() + interval '11 hours', 'Mall pop-up') returning id as shift \gset
insert into public.staff_shifts (user_id, starts_at, ends_at) values (:'manager', now() + interval '2 days', now() + interval '2 days 8 hours');
select throws_ok(format($$ insert into public.staff_shifts (user_id, starts_at, ends_at) values (%L, now(), now() - interval '1 hour') $$, :'sales'),
  '23514', null, 'a shift ends after it starts');
select tests.login_as(:'sales');
select is((select count(*)::int from public.staff_shifts), 1, 'staff see only their own shifts');
select throws_ok(format($$ insert into public.staff_shifts (user_id, starts_at, ends_at) values (%L, now(), now() + interval '1 hour') $$, :'sales'),
  '42501', null, 'only staff.manage plans shifts');

-- ── Staff performance ──────────────────────────────────────────────────────────────────────
reset role;
select pg_temp.paid_order(:'c_new', 45000, 1, :'sales') as sale \gset
insert into public.order_lines (order_id, variant_id, product_name, sku, qty, list_price_fils, unit_price_fils, line_total_fils)
select :'sale', v.id, 'Test', v.sku, 3, 15000, 15000, 45000 from public.product_variants v limit 1;
insert into public.staff_attendance (user_id, clock_in, clock_out)
values (:'sales', now() - interval '1 day 8 hours', now() - interval '1 day');
insert into public.staff_shifts (user_id, starts_at, ends_at)
values (:'sales', now() - interval '1 day 9 hours', now() - interval '1 day');
insert into public.events (name, start_date, end_date, status) values ('Perf Expo', current_date - 1, current_date, 'confirmed')
returning id as ev \gset
insert into public.event_staff (event_id, user_id) values (:'ev', :'sales');

select tests.login_as(:'owner');
select results_eq(
  format($$ select orders, units, sales_fils, worked_minutes, shifts_worked, planned_minutes, events_worked
              from public.staff_performance(current_date - 7, current_date) where user_id = %L $$, :'sales'),
  $$ values (1, 3, 45000, 480, 1, 1020, 1) $$,
  'sales, hours, planned hours (both shifts) and events per person');
select tests.login_as(:'manager');
select is((select worked_minutes from public.staff_performance(current_date - 7, current_date) where user_id = :'sales'),
  null, 'hours hidden without staff.manage');
select is((select sales_fils from public.staff_performance(current_date - 7, current_date) where user_id = :'sales'),
  45000, 'sales visible with reports.view');
select tests.login_as(:'sales');
select throws_ok($$ select * from public.staff_performance(current_date - 7, current_date) $$, '42501', null,
  'sales staff can''t see the report');

-- ── Feedback requests ──────────────────────────────────────────────────────────────────────
reset role;
insert into public.orders (customer_id, channel, status, total_fils, subtotal_fils, fulfilment, contact_email)
values (:'c_back', 'website', 'preparing', 30000, 30000, 'pickup', 'lbl.back@solei.test') returning id as web \gset
update public.orders set status = 'delivered' where id = :'web';
select is((select count(*)::int from public.feedback_requests_due() where order_id = :'web'), 0, 'not due on delivery day');
update public.order_status_history set created_at = now() - interval '4 days' where order_id = :'web';
select is((select count(*)::int from public.feedback_requests_due() where order_id = :'web'), 1, 'due 3 days after delivery');
update public.customers set feedback_optout_at = now() where id = :'c_back';
select is((select count(*)::int from public.feedback_requests_due() where order_id = :'web'), 0, 'opted out customers aren''t asked');
update public.customers set feedback_optout_at = null where id = :'c_back';
insert into public.feedback_requests (order_id, customer_id, email) values (:'web', :'c_back', 'lbl.back@solei.test');
select is((select count(*)::int from public.feedback_requests_due() where order_id = :'web'), 0, 'asked once per order');
select isnt(public.feedback_submit(:'web', 2, 'complaint', 'Box was dented'), null, 'customer answers');
select is((select status::text || '/' || source::text || '/' || rating from public.customer_feedback where order_id = :'web'),
  'open/email/2', 'the answer lands in the log, open');
select throws_ok(format($$ select public.feedback_submit(%L, 5, 'compliment', '') $$, :'web'), 'P0001', null, 'one answer per request');

-- ── Staff reminders ────────────────────────────────────────────────────────────────────────
select is((select count(*)::int from public.staff_reminders_due(24) where ref_id = :'shift'), 1, 'shift in 3 hours is due a reminder');
select is((select count(*)::int from public.staff_reminders_due(1) where ref_id = :'shift'), 0, 'not yet with a 1-hour lead');

-- ── Event news ─────────────────────────────────────────────────────────────────────────────
select public.event_news_opt_in('News.Fan@Solei.test', 'News Fan') as fan \gset
select is((select event_news from public.customers where id = :'fan'), true, 'event news sign-up creates an opted-in customer');
select public.customer_unsubscribe(:'fan');
select is((select event_news from public.customers where id = :'fan'), false, 'unsubscribing stops event news too');

select * from finish();
rollback;
