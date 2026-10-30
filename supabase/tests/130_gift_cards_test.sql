begin;
\ir helpers/setup.psql
select plan(28);

-- Buy a AED 200 gift card online.
select order_id as buy_order from public.create_gift_card_order(jsonb_build_object(
  'client_uuid', gen_random_uuid(),
  'contact', jsonb_build_object('name', 'Gift Buyer', 'email', 'gift.buyer@solei.test'),
  'amount_fils', 20000, 'recipient_name', 'Mira', 'recipient_email', 'Mira@solei.test',
  'sender_name', 'Sara', 'message', 'Happy birthday')) \gset
select id as card, code as card_code from public.gift_cards where purchase_order_id = :'buy_order' \gset

select matches(:'card_code'::text, '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$', 'code looks like XXXX-XXXX-XXXX');
select is((select status::text from public.gift_cards where id = :'card'), 'pending', 'card waits for payment');
select is(public.gift_card_lookup(:'card_code') ->> 'reason', 'not_active', 'unpaid card cannot be spent');
select is((select recipient_email from public.gift_cards where id = :'card'), 'mira@solei.test', 'recipient email lower-cased');
select throws_ok(
  $$ select * from public.create_gift_card_order(jsonb_build_object('client_uuid', gen_random_uuid(),
       'contact', jsonb_build_object('email', 'x@solei.test'), 'amount_fils', 12345)) $$,
  'P0001', null, 'only the offered amounts can be bought');

-- Pay it (as the webhook would).
insert into public.payments (order_id, amount_fils, method, status) values (:'buy_order', 20000, 'online_card', 'succeeded');
select public.settle_if_paid(:'buy_order');
select is((select status::text from public.gift_cards where id = :'card'), 'active', 'paid card is active');
select is(public.gift_card_balance(:'card'), 20000, 'balance AED 200');
select ok((select expires_at > now() + interval '11 months' from public.gift_cards where id = :'card'), 'expires in 12 months');
select is((select status::text from public.orders where id = :'buy_order'), 'completed', 'purchase order is completed');
select is(public.gift_card_lookup(lower(replace(:'card_code', '-', ' '))) ->> 'balance_fils', '20000',
  'lookup ignores case, spaces and dashes');

-- Spend AED 150 of it on a AED 280 website order (rest by card later).
create function pg_temp.web_order(p_uuid uuid, p_gift text, p_gift_fils int)
returns uuid language sql as $$
  select order_id from public.create_web_order(jsonb_build_object(
    'client_uuid', p_uuid, 'emirate', 'abu_dhabi',
    'contact', jsonb_build_object('name', 'Mira', 'phone', '+971509998877', 'email', 'mira@solei.test'),
    'address', jsonb_build_object('line1', 'Street 1'),
    'lines', jsonb_build_array(jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'TST-P-CAN-50'), 'qty', 1, 'unit_price_fils', 28000)),
    'subtotal_fils', 28000, 'discount_fils', 0, 'delivery_fee_fils', 0,
    'vat_fils', 0, 'total_fils', 28000, 'vat_rate_bp', 0, 'prices_include_vat', true,
    'gift_card_code', p_gift, 'gift_card_fils', p_gift_fils));
$$;
select pg_temp.web_order(gen_random_uuid(), :'card_code', 15000) as o1 \gset
select is(public.gift_card_balance(:'card'), 5000, 'AED 150 spent, AED 50 left');
select is((select outstanding_fils from public.order_payment_summary where order_id = :'o1'), 13000, 'AED 130 left to pay by card');
select is((select status::text from public.orders where id = :'o1'), 'pending_payment', 'partly paid order waits for the card payment');
select throws_ok(
  format('select pg_temp.web_order(gen_random_uuid(), %L, 6000)', :'card_code'),
  'P0001', null, 'cannot spend more than the balance');

-- The checkout is abandoned: after 24 h the hold is released.
update public.orders set created_at = now() - interval '25 hours' where id = :'o1';
select is(public.gift_card_release_stale(), 1, 'stale hold released');
select is(public.gift_card_balance(:'card'), 20000, 'balance back to AED 200');
select is((select outstanding_fils from public.order_payment_summary where order_id = :'o1'), 28000, 'order owes the full amount again');

-- Spend all of a fresh order: paid at once, no card payment needed.
select pg_temp.web_order(gen_random_uuid(), :'card_code', 20000) as o2 \gset
-- (AED 280 order, AED 200 card → still AED 80 due; check a fully covered order with a 2nd card)
select tests.login_as(tests.create_staff('gift-owner@solei.test', 'owner'));
select public.gift_card_issue(jsonb_build_object('amount_fils', 50000, 'note', 'Goodwill')) as card2 \gset
select code as card2_code from public.gift_cards where id = :'card2' \gset
select is(public.gift_card_balance(:'card2'), 50000, 'staff-issued card is live at once');
reset role;
select pg_temp.web_order(gen_random_uuid(), :'card2_code', 28000) as o3 \gset
select ok((select paid_at is not null and status = 'new' from public.orders where id = :'o3'), 'fully covered order is paid immediately');

-- Cancelling gives the money back to the card.
select tests.login_as((select user_id from public.staff_profiles where email = 'gift-owner@solei.test'));
select public.cancel_order(:'o3', 'Customer changed mind');
select is(public.gift_card_balance(:'card2'), 50000, 'cancelled order refunds the gift card');

-- Adjust and void.
select is(public.gift_card_adjust(:'card2', -10000, 'Correction'), 40000, 'manual adjustment');
select public.gift_card_void(:'card2', 'Lost card');
select is(public.gift_card_balance(:'card2'), 0, 'void writes off the balance');
reset role;
select is(public.gift_card_lookup(:'card2_code') ->> 'reason', 'void', 'void card cannot be spent');

-- Gift card sales stay out of the dashboard revenue.
select tests.login_as((select user_id from public.staff_profiles where email = 'gift-owner@solei.test'));
select is(
  (select (public.dashboard_summary() -> 'periods' -> 'today' ->> 'orders')::int),
  (select count(*)::int from public.orders o
    where o.status not in ('cancelled', 'pending_payment') and not o.gift_card_purchase
      and public.business_day(o.placed_at) = public.business_today()),
  'dashboard counts only non-gift-card orders');

-- At the till: AED 280 sale = AED 200 from a card + AED 80 cash.
reset role;
insert into public.events (name, status, start_date, end_date)
values ('Gift Test Pop-up', 'confirmed', public.business_today(), public.business_today()) returning id as ev \gset
select tests.login_as((select user_id from public.staff_profiles where email = 'gift-owner@solei.test'));
select public.gift_card_issue(jsonb_build_object('amount_fils', 20000)) as card3 \gset
select code as card3_code from public.gift_cards where id = :'card3' \gset
create function pg_temp.till_sale(p_event uuid, p_code text)
returns uuid language sql as $$
  select order_id from public.pos_complete_sale(jsonb_build_object(
    'client_uuid', gen_random_uuid(), 'event_id', p_event,
    'lines', jsonb_build_array(jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'TST-P-CAN-50'), 'qty', 1)),
    'payments', jsonb_build_array(
      jsonb_build_object('method', 'gift_card', 'amount_fils', 20000, 'reference', p_code),
      jsonb_build_object('method', 'cash', 'amount_fils', 8000))));
$$;
select isnt(pg_temp.till_sale(:'ev', lower(:'card3_code')), null, 'till sale with a gift card and cash');
select is(public.gift_card_balance(:'card3'), 0, 'card spent at the till');

-- The owner switches till redemption off.
select public.gift_card_issue(jsonb_build_object('amount_fils', 20000)) as card4 \gset
select code as card4_code from public.gift_cards where id = :'card4' \gset
reset role;
update public.settings set gift_cards_at_pos = false where id = 1;
select tests.login_as((select user_id from public.staff_profiles where email = 'gift-owner@solei.test'));
select throws_ok(format('select pg_temp.till_sale(%L, %L)', :'ev', :'card4_code'),
  'P0001', 'gift cards can''t be used at the till', 'till refuses cards when switched off');
select is(public.gift_card_balance(:'card4'), 20000, 'refused card keeps its balance');

select * from finish();
rollback;
