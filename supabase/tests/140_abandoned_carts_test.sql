begin;
\ir helpers/setup.psql
select plan(16);

select tests.create_user('cart.shopper@solei.test') as shopper \gset
select id as perfume from public.product_variants where sku = 'SOL-P-CAN-50' \gset
select id as spray from public.product_variants where sku = 'SOL-S-SOH-100' \gset
update public.settings set cart_reminders_enabled = true, cart_reminder_first_hours = 4,
  cart_reminder_second_hours = 48 where id = 1;

-- Sync a bag: priced from the catalogue.
select public.cart_sync(:'shopper', 'Cart.Shopper@solei.test', 'Layla',
  jsonb_build_array(jsonb_build_object('variant_id', :'perfume', 'qty', 2),
                    jsonb_build_object('variant_id', :'spray', 'qty', 1))) as cart \gset
select is((select value_fils from public.carts where id = :'cart'), 75000, 'bag value from catalogue prices');
select is((select email from public.carts where id = :'cart'), 'cart.shopper@solei.test', 'email lower-cased');
select is(public.cart_sync(:'shopper', 'cart.shopper@solei.test', null,
  jsonb_build_array(jsonb_build_object('variant_id', :'perfume', 'qty', 1)))::text, :'cart', 'same open bag updated');
select is((select item_count from public.carts where id = :'cart'), 1, 'lines replaced');

-- Not due yet; due after 4 h; second reminder after 48 h.
select is((select count(*)::int from public.carts_due_for_reminder() where id = :'cart'), 0, 'fresh bag is not due');
update public.carts set updated_at = now() - interval '5 hours' where id = :'cart';
select is((select count(*)::int from public.carts_due_for_reminder() where id = :'cart'), 1, 'idle 5 h → first reminder due');
select public.cart_reminder_sent(:'cart');
select is((select count(*)::int from public.carts_due_for_reminder() where id = :'cart'), 0, 'not due again straight away');
update public.carts set updated_at = now() - interval '49 hours' where id = :'cart';
select is((select count(*)::int from public.carts_due_for_reminder() where id = :'cart'), 1, 'second reminder after 48 h');
select public.cart_reminder_sent(:'cart');
select is((select count(*)::int from public.carts_due_for_reminder() where id = :'cart'), 0, 'never more than two');

-- Opt-out and the owner switch.
update public.carts set reminders_sent = 0 where id = :'cart';
select public.cart_set_optout(:'shopper', true);
select is((select count(*)::int from public.carts_due_for_reminder() where id = :'cart'), 0, 'opted-out customers get nothing');
select public.cart_set_optout(:'shopper', false);
update public.settings set cart_reminders_enabled = false where id = 1;
select is((select count(*)::int from public.carts_due_for_reminder() where id = :'cart'), 0, 'switched off → nothing due');
update public.settings set cart_reminders_enabled = true where id = 1;
select is((select count(*)::int from public.carts_due_for_reminder() where id = :'cart'), 1, 'back on → due');

-- Paying for an order closes the bag; a reminder had gone out → recovered.
select public.cart_reminder_sent(:'cart');
insert into public.orders (channel, status, total_fils, contact_email, fulfilment)
values ('website', 'new', 28000, 'cart.shopper@solei.test', 'handed_over') returning id as ord \gset
select public.cart_order_paid(:'ord');
select is((select status::text from public.carts where id = :'cart'), 'converted', 'paid order converts the bag');
select tests.login_as(tests.create_staff('cart-owner@solei.test', 'owner'));
select is((select recovered from public.cart_stats(now() - interval '1 day')), 1, 'counted as recovered');

-- Emptying the bag closes it.
reset role;
select public.cart_sync(:'shopper', 'cart.shopper@solei.test', null,
  jsonb_build_array(jsonb_build_object('variant_id', :'spray', 'qty', 1))) as cart2 \gset
select is(public.cart_sync(:'shopper', 'cart.shopper@solei.test', null, '[]'::jsonb), null, 'empty bag returns no cart');
select is((select status::text from public.carts where id = :'cart2'), 'emptied', 'emptied bag is closed');

select * from finish();
rollback;
