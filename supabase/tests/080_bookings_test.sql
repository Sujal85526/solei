begin;
\ir helpers/setup.psql
select plan(40);

-- ─── Config RLS ───────────────────────────────────────────────────────────────────────────
update public.booking_packages set active = false where name = 'Grand Destination';

select tests.login_anon();
select is((select count(*)::int from public.booking_event_types), 8, 'anon reads the owner''s 8 active event types (Birthday is off)');
select is((select count(*)::int from public.booking_packages), 2, 'anon only sees active packages');
select throws_ok($$ insert into public.booking_event_types (name) values ('Hack') $$, '42501', null,
  'anon cannot write config');
select is((select count(*)::int from public.bookings), 0, 'anon cannot list bookings');
select tests.logout();

select id as type_id from public.booking_event_types where name = 'Wedding' \gset
select id as pkg_id, base_price_fils as pkg_price from public.booking_packages where name = 'Signature' \gset
select id as grand_id from public.booking_packages where name = 'Grand Destination' \gset
select id as booth_id from public.booth_designs where name = 'Passport bar' \gset
select id as flower_id, price_fils as flower_price from public.flower_options where name = 'Burgundy' \gset
select booking_flower_base_fils as flower_base from public.settings \gset
select array_to_json(array_agg(id order by sort))::text as services from public.booking_service_types \gset
select min(v.price_fils) as perfume_from
  from public.product_variants v join public.products p on p.id = v.product_id
  join public.categories c on c.id = p.category_id where c.slug = 'perfume' and v.active and p.active \gset

-- ─── Estimate ─────────────────────────────────────────────────────────────────────────────
select is(
  (public.booking_estimate(jsonb_build_object('package_id', :'pkg_id', 'flowers', true,
    'flower_option_id', :'flower_id',
    'products_interest', '[{"category":"perfume","qty":10},{"category":"dukhoon","qty":5}]'::jsonb)) ->> 'total_fils')::int,
  :pkg_price + :flower_base + :flower_price + 10 * :perfume_from,
  'estimate = package + flowers (base + colour) + products from-price; unpriced categories excluded');
select is(
  jsonb_array_length(public.booking_estimate(jsonb_build_object(
    'products_interest', '[{"category":"dukhoon","qty":5},{"category":"perfume","qty":0}]'::jsonb)) -> 'lines'),
  1, 'zero quantities are dropped, unpriced categories stay listed');
select throws_ok(
  format($$ select public.booking_estimate('{"package_id":"%s"}'::jsonb) $$, :'grand_id'),
  'P0001', 'this package is no longer available', 'inactive packages cannot be estimated');

-- ─── Submit (anon) ────────────────────────────────────────────────────────────────────────
select tests.login_anon();
select format($json${
  "client_uuid": "11111111-1111-4111-8111-111111111111",
  "event_type_id": "%s", "event_date": "%s", "start_time": "18:00", "end_time": "23:30",
  "location": "Emirates Palace", "emirate": "abu_dhabi", "guests": 150,
  "service_type_ids": %s, "package_id": "%s", "booth_design_id": "%s",
  "flowers": true, "flower_option_id": "%s",
  "products_interest": [{"category": "perfume", "qty": 10}, {"category": "all_over_spray", "qty": 0}],
  "special_requests": "Pink theme",
  "contact": {"name": "Mariam Test", "phone": "+971501110001", "email": "Mariam@Example.com"},
  "consent": true, "estimated_total_fils": 1
}$json$, :'type_id', (public.business_today() + 30)::text, :'services', :'pkg_id', :'booth_id', :'flower_id') as req \gset

select * from public.submit_booking(:'req'::jsonb) \gset sub_
select matches(:'sub_ref'::text, '^BK-\d{4}$', 'booking refs look like BK-0001');
select is(:sub_estimated_total_fils::int, :pkg_price + :flower_base + :flower_price + 10 * :perfume_from,
  'estimate is computed server-side (client value ignored)');
select is((select ref from public.submit_booking(:'req'::jsonb)), :'sub_ref', 'submitting twice returns the same booking');
select throws_ok(
  format($$ select public.submit_booking(%L::jsonb) $$,
    jsonb_set(jsonb_set(:'req'::jsonb, '{client_uuid}', '"22222222-2222-4222-8222-222222222222"'), '{consent}', 'false')),
  'P0001', 'please agree to be contacted about your request', 'consent is required');
select throws_ok(
  format($$ select public.submit_booking(%L::jsonb) $$,
    jsonb_set(jsonb_set(:'req'::jsonb, '{client_uuid}', '"33333333-3333-4333-8333-333333333333"'), '{event_date}', '"2020-01-01"')),
  'P0001', 'choose a date in the future', 'past dates are refused');
select throws_ok(
  format($$ select public.submit_booking(%L::jsonb) $$,
    jsonb_set(jsonb_set(:'req'::jsonb, '{client_uuid}', '"44444444-4444-4444-8444-444444444444"'), '{service_type_ids}', '["00000000-0000-4000-9000-00000000dead"]')),
  'P0001', 'a service you chose is no longer available', 'an unknown service is refused (services are optional)');
select tests.logout();

select is((select status::text from public.bookings where id = :'sub_booking_id'), 'requested', 'new bookings are requested');
select is((select c.source::text || ' ' || c.email from public.customers c join public.bookings b on b.customer_id = c.id
           where b.id = :'sub_booking_id'), 'booking mariam@example.com', 'customer upserted from the request');
select is((select products_interest from public.bookings where id = :'sub_booking_id'),
  '[{"qty": 10, "category": "perfume"}]'::jsonb, 'only positive product quantities are kept');

-- ─── Staff permissions ────────────────────────────────────────────────────────────────────
select tests.create_staff('owner@bk.solei', 'owner') as owner_id \gset
select tests.create_staff('sales@bk.solei', 'sales_staff') as sales_id \gset

select tests.login_as(:'sales_id');
select is((select count(*)::int from public.bookings where id = :'sub_booking_id'), 1, 'sales staff (bookings.view) can read bookings');
select throws_ok(format($$ select public.set_booking_status(%L, 'in_review') $$, :'sub_booking_id'),
  '42501', null, 'sales staff cannot change booking status');
select throws_ok(format($$ select * from public.send_booking_quote('{"booking_id":"%s","lines":[{"label":"x","qty":1,"unit_price_fils":1}]}'::jsonb) $$, :'sub_booking_id'),
  '42501', null, 'sales staff cannot send quotes');
select tests.logout();

select tests.login_as(:'owner_id', 'aal1');
select throws_ok(format($$ select public.set_booking_status(%L, 'in_review') $$, :'sub_booking_id'),
  '42501', null, 'owner without MFA cannot act');
select tests.logout();

-- ─── Review + quote ───────────────────────────────────────────────────────────────────────
select tests.login_as(:'owner_id');
select lives_ok(format($$ select public.set_booking_status(%L, 'in_review') $$, :'sub_booking_id'), 'owner marks in review');
select throws_ok(format($$ select public.set_booking_status(%L, 'rejected', '') $$, :'sub_booking_id'),
  'P0001', 'give a reason', 'rejecting needs a reason');

select * from public.send_booking_quote(format(
  '{"booking_id":"%s","lines":[{"label":"Signature booth","qty":1,"unit_price_fils":650000},{"label":"Giveaways","qty":150,"unit_price_fils":2500}],"discount_fils":12500}',
  :'sub_booking_id')::jsonb) \gset q1_
select is(:q1_total_fils::int, 650000 + 150 * 2500 - 12500, 'quote total = lines − discount');
select is(:q1_deposit_fils::int, (650000 + 150 * 2500 - 12500) / 2, 'deposit defaults to 50% of the total');

select * from public.send_booking_quote(format(
  '{"booking_id":"%s","lines":[{"label":"Signature booth","qty":1,"unit_price_fils":600000}],"deposit_fils":100000}',
  :'sub_booking_id')::jsonb) \gset q2_
select is(:q2_version::int, 2, 'each send creates a new version');
select is((select status::text from public.booking_quotes where token = :'q1_token'), 'superseded', 'older version superseded');
select tests.logout();

-- ─── Accept + pay (anon by token) ─────────────────────────────────────────────────────────
select tests.login_anon();
select is((public.get_booking_quote(:'q2_token') ->> 'total_fils')::int, 600000, 'anon reads a quote by token');
select is(public.get_booking_quote('nope'), null, 'unknown tokens reveal nothing');
select throws_ok(format($$ select * from public.accept_quote(%L) $$, :'q1_token'),
  'P0001', 'this quotation has been replaced — please use the latest one we sent you', 'superseded quotes cannot be accepted');
select throws_ok(format($$ select public.quote_payment_order(%L, 'deposit') $$, :'q2_token'),
  'P0001', 'accept the quotation first', 'no payment before acceptance');
select is((select status::text from public.accept_quote(:'q2_token')), 'accepted', 'customer accepts the latest quote');
select public.quote_payment_order(:'q2_token', 'deposit') as deposit_order \gset
select is(public.quote_payment_order(:'q2_token', 'deposit'), :'deposit_order'::uuid, 'the unpaid deposit order is reused');
select tests.logout();

select is((select channel::text || ' ' || status::text || ' ' || total_fils from public.orders where id = :'deposit_order'),
  'booking pending_payment 100000', 'deposit is a pending booking-channel order for the deposit amount');

-- Simulate the verified webhook: pending payment → confirm_payment.
insert into public.payments (order_id, amount_fils, method, status, provider, provider_ref)
values (:'deposit_order', 100000, 'online_card', 'pending', 'mock', 'mock_cs_bk_test');
select * from public.confirm_payment('mock', 'mock_cs_bk_test', 100000, 'online_card') \gset pay_

select is((select status::text from public.bookings where id = :'sub_booking_id'), 'confirmed', 'paid deposit confirms the booking');
select is((select e.type::text || ' ' || e.status::text || ' ' || (e.booking_id = b.id)
           from public.bookings b join public.events e on e.id = b.event_id where b.id = :'sub_booking_id'),
  'private_booking confirmed true', 'a confirmed private_booking event is linked both ways');
select is((select status::text from public.orders where id = :'deposit_order'), 'completed', 'the deposit order is closed');
select is((select count(*)::int from public.booking_messages where booking_id = :'sub_booking_id' and body like 'Payment received%'),
  1, 'the payment is logged on the booking');

select tests.login_anon();
select is((public.get_booking_quote(:'q2_token') ->> 'paid_fils')::int, 100000, 'quote page sees the paid amount');
select is((select total_fils from public.orders where id = public.quote_payment_order(:'q2_token', 'balance')), null,
  'anon cannot read the balance order (RLS) even though it was created');
select tests.logout();

select is((select o.total_fils from public.orders o where o.booking_id = :'sub_booking_id' and o.status = 'pending_payment'),
  500000, 'balance order = total − paid');

select * from finish();
rollback;
