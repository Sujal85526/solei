begin;
\ir helpers/setup.psql
select plan(75);

select id as p1 from public.product_variants where sku = 'TST-P-CAN-50' \gset
select id as p2 from public.product_variants where sku = 'TST-P-CAP-50' \gset
select id as s1 from public.product_variants where sku = 'TST-S-SOH-100' \gset
select id as s2 from public.product_variants where sku = 'TST-S-MAY-100' \gset
select id as perfume_cat from public.categories where slug = 'perfume' \gset
select id as spray_cat from public.categories where slug = 'all_over_spray' \gset

-- A bag: pairs of (variant, qty).
create function pg_temp.bag(variadic p text[])
returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object('variant_id', p[i], 'qty', p[i + 1]::int) order by i), '[]')
    from generate_series(1, array_length(p, 1), 2) i;
$$;
create function pg_temp.price(p_lines jsonb, p_codes text[] default '{}', p_ctx jsonb default '{}')
returns jsonb language sql as $$
  select public.promo_price(p_lines, to_jsonb(p_codes), p_ctx);
$$;
create function pg_temp.code(p jsonb, p_code text)
returns jsonb language sql as $$
  select e from jsonb_array_elements(p -> 'codes') e where e ->> 'code' = p_code;
$$;

-- ── No promotions: catalogue prices, nothing off ──────────────────────────────────────────────
select is(pg_temp.price(pg_temp.bag(:'p1', '1', :'s1', '2')) ->> 'subtotal_fils', '66000', 'no offers: catalogue subtotal');
select is(pg_temp.price(pg_temp.bag(:'p1', '1')) -> 'applied', '[]'::jsonb, 'no offers: nothing applied');

-- ── 1. Sale prices ────────────────────────────────────────────────────────────────────────────
insert into public.offers (name, kind, percent_bp, category_ids)
values ('Sprays 15% off', 'sale', 1500, array[:'spray_cat'::uuid]) returning id as sale15 \gset
select is(pg_temp.price(pg_temp.bag(:'s1', '2')) -> 'lines' -> 0 ->> 'unit_price_fils', '16150', '15% sale: 190 → 161.50');
select is(pg_temp.price(pg_temp.bag(:'s1', '2', :'p1', '1')) ->> 'subtotal_fils', '60300', 'sale prices make the subtotal');
select is(pg_temp.price(pg_temp.bag(:'s1', '2')) ->> 'discount_fils', '0', 'sale prices are prices, not a discount');
select is(pg_temp.price(pg_temp.bag(:'s1', '2')) -> 'applied' -> 0 ->> 'discount_fils', '5700', 'sale saving in the snapshot (2 × 28.50)');
select is(pg_temp.price(pg_temp.bag(:'s1', '1'), '{}', '{"apply_offers": false}') -> 'lines' -> 0 ->> 'unit_price_fils', '19000', 'offers off (till offline): catalogue price');

-- Best sale wins: AED 30 off beats 15% (28.50).
insert into public.offers (name, kind, amount_fils, product_ids)
values ('Soho AED 30 off', 'sale', 3000, array[(select product_id from public.product_variants where id = :'s1')]) returning id as sale30 \gset
select is(pg_temp.price(pg_temp.bag(:'s1', '1')) -> 'lines' -> 0 ->> 'unit_price_fils', '16000', 'best sale for the item wins');
select is(pg_temp.price(pg_temp.bag(:'s2', '1')) -> 'lines' -> 0 ->> 'unit_price_fils', '16150', 'other sprays keep the 15% sale');
-- Rounding half-up to the fils: 33.33% of 190 = 63.327 → 63.33.
update public.offers set percent_bp = 3333 where id = :'sale15';
select is(pg_temp.price(pg_temp.bag(:'s2', '1')) -> 'lines' -> 0 ->> 'unit_price_fils', '12667', 'percent sale rounds to the fils');
-- Dates and channels.
update public.offers set starts_at = now() + interval '1 day' where id = :'sale15';
select is(pg_temp.price(pg_temp.bag(:'s2', '1')) -> 'lines' -> 0 ->> 'unit_price_fils', '19000', 'a sale that hasn''t started doesn''t apply');
update public.offers set starts_at = null, channels = '{pos}' where id = :'sale15';
select is(pg_temp.price(pg_temp.bag(:'s2', '1')) -> 'lines' -> 0 ->> 'unit_price_fils', '19000', 'a till-only sale doesn''t apply online');
select is(pg_temp.price(pg_temp.bag(:'s2', '1'), '{}', '{"channel": "pos"}') -> 'lines' -> 0 ->> 'unit_price_fils', '12667', '…but does at the till');
delete from public.offers where id in (:'sale15', :'sale30');

-- ── 2. Bundles ────────────────────────────────────────────────────────────────────────────────
insert into public.offers (name, kind, bundle_price_fils, slots)
values ('Perfume + spray for AED 400', 'bundle', 40000, jsonb_build_array(
  jsonb_build_object('label', 'Perfume', 'category_ids', jsonb_build_array(:'perfume_cat'), 'qty', 1),
  jsonb_build_object('label', 'Spray', 'category_ids', jsonb_build_array(:'spray_cat'), 'qty', 1)))
returning id as bundle \gset
select is(pg_temp.price(pg_temp.bag(:'p1', '1', :'s1', '1')) ->> 'discount_fils', '7000', 'bundle: 280 + 190 → 400');
select is(pg_temp.price(pg_temp.bag(:'p1', '1', :'s1', '1')) -> 'lines' -> 0 ->> 'discount_fils', '4170', 'bundle saving split by price (perfume)');
select is(pg_temp.price(pg_temp.bag(:'p1', '1', :'s1', '1')) -> 'lines' -> 1 ->> 'discount_fils', '2830', '…and spray; shares add up exactly');
select is(pg_temp.price(pg_temp.bag(:'p1', '2', :'s1', '1')) ->> 'discount_fils', '7000', 'one spray → one bundle');
select is(pg_temp.price(pg_temp.bag(:'p1', '2', :'s1', '1', :'s2', '1')) -> 'applied' -> 0 ->> 'times', '2', 'two of each → two bundles');
select is(pg_temp.price(pg_temp.bag(:'p1', '2')) -> 'applied', '[]'::jsonb, 'an incomplete bundle gives nothing');
-- A bundle price above the items' price is no offer.
update public.offers set bundle_price_fils = 50000 where id = :'bundle';
select is(pg_temp.price(pg_temp.bag(:'p1', '1', :'s1', '1')) ->> 'discount_fils', '0', 'bundle price above the items: nothing off');
update public.offers set bundle_price_fils = 40000 where id = :'bundle';

-- ── 3. Buy X get Y ────────────────────────────────────────────────────────────────────────────
insert into public.offers (name, kind, percent_bp, buy_qty, get_qty, sort)
values ('Buy 2 get 1 free', 'buy_x_get_y', 10000, 2, 1, 1) returning id as b2g1 \gset
update public.offers set active = false where id = :'bundle';
select is(pg_temp.price(pg_temp.bag(:'p1', '2', :'s1', '1')) ->> 'discount_fils', '19000', 'buy 2 get 1: the cheapest item is free');
select is(pg_temp.price(pg_temp.bag(:'p1', '2')) ->> 'discount_fils', '0', 'two items: not yet');
select is(pg_temp.price(pg_temp.bag(:'p1', '3', :'s1', '3')) ->> 'discount_fils', '38000', 'six items: the two cheapest are free');
select is(pg_temp.price(pg_temp.bag(:'p1', '5')) ->> 'discount_fils', '28000', 'five items: one free');
-- An item counts towards one offer only: the bundle (sort 0) takes 1 perfume + 1 spray first.
update public.offers set active = true where id = :'bundle';
select is(pg_temp.price(pg_temp.bag(:'p1', '3', :'s1', '1')) ->> 'discount_fils', '7000', 'bundle first; the 2 perfumes left don''t make a buy 2 get 1');
select is(pg_temp.price(pg_temp.bag(:'p1', '4', :'s1', '1')) ->> 'discount_fils', '35000', 'bundle + buy 2 get 1 on the rest (7000 + 28000)');
delete from public.offers where id in (:'bundle', :'b2g1');

-- ── 4. Codes and combining ────────────────────────────────────────────────────────────────────
insert into public.offers (name, kind, percent_bp, category_ids)
values ('Sprays 15% off', 'sale', 1500, array[:'spray_cat'::uuid]) returning id as sale15 \gset
insert into public.coupons (code, kind, percent_bp) values ('TSTSOLO10', 'percent', 1000);
insert into public.coupons (code, kind, percent_bp, combinable) values ('TSTTEN', 'percent', 1000, true);
insert into public.coupons (code, kind, amount_fils, combinable) values ('TSTFIFTY', 'fixed', 5000, true);
insert into public.coupons (code, kind, percent_bp, buy_qty, get_qty, combinable)
values ('TSTB1G1HALF', 'buy_x_get_y', 5000, 1, 1, true);

select is(pg_temp.price(pg_temp.bag(:'p1', '1', :'s1', '1'), '{TSTSOLO10}') ->> 'discount_fils', '2800',
  'a code that doesn''t combine skips sale items');
select is(pg_temp.price(pg_temp.bag(:'p1', '1', :'s1', '1'), '{TSTTEN}') ->> 'discount_fils', '4415',
  'a combinable code also takes 10% off the sale price (28000 + 16150)');
select is(pg_temp.price(pg_temp.bag(:'s1', '1'), '{TSTSOLO10}') -> 'codes' -> 0 ->> 'reason', 'no_eligible_items',
  'only sale items: the non-combining code has nothing to discount');
select is(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTFIFTY,TSTTEN}') ->> 'discount_fils', '7800',
  '% codes before AED codes, whatever the order typed (2800 + 5000)');
select is(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTTEN,TSTSOLO10}') -> 'codes' -> 1 ->> 'reason', 'not_combinable',
  'a code that doesn''t combine can''t join another');
select is(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTSOLO10,TSTTEN}') -> 'codes' -> 1 ->> 'reason', 'not_combinable',
  '…in either order');
select is(jsonb_array_length(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTTEN,tstten}') -> 'codes'), 1, 'the same code twice counts once');
select is(pg_temp.price(pg_temp.bag(:'p1', '2'), '{TSTB1G1HALF}') ->> 'discount_fils', '14000', 'buy 1 get 1 half price code');
select is(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTB1G1HALF}') -> 'codes' -> 0 ->> 'reason', 'min_items',
  'buy X get Y code needs enough items');
select is(pg_temp.price(pg_temp.bag(:'p1', '2'), '{TSTB1G1HALF,TSTTEN}') ->> 'discount_fils', '18200',
  'buy X get Y code first, then 10% on what is left (14000 + 4200)');
-- A fixed code never takes more than the eligible goods.
select is(pg_temp.price(pg_temp.bag(:'s1', '1'), '{TSTFIFTY,TSTTEN}') ->> 'discount_fils', '6615',
  '10% of 161.50 = 16.15, then AED 50 (capped by what''s left)');
-- coupon_evaluate (main's shape) reports only its own code's discount.
select is(public.coupon_evaluate('TSTTEN', pg_temp.bag(:'s1', '1'), null) ->> 'discount_fils', '1615', 'coupon_evaluate on sale prices');

-- ── 5. Where a code works, and for whom ──────────────────────────────────────────────────────
insert into public.events (name, status, start_date, end_date)
values ('Promo Pop-up', 'confirmed', public.business_today(), public.business_today()) returning id as ev \gset
insert into public.events (name, status, start_date, end_date)
values ('Other Pop-up', 'confirmed', public.business_today(), public.business_today()) returning id as ev2 \gset
insert into public.coupons (code, kind, percent_bp, channels, event_id)
values ('TSTEXPO', 'percent', 2000, '{website,pos}', :'ev');
select is(pg_temp.code(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTSOLO10}', '{"channel": "pos"}'), 'TSTSOLO10') ->> 'reason',
  'not_here', 'a website code doesn''t work at the till');
select is(pg_temp.code(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTEXPO}', jsonb_build_object('channel', 'pos', 'event_id', :'ev2')), 'TSTEXPO') ->> 'reason',
  'not_here', 'an event''s code doesn''t work at another event');
select is(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTEXPO}', jsonb_build_object('channel', 'pos', 'event_id', :'ev')) ->> 'discount_fils',
  '5600', '…but does at its own event');
select is(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTEXPO}') ->> 'discount_fils', '5600', '…and on the website');

insert into public.customers (name, email, phone) values ('Vip Buyer', 'vip.buyer@solei.test', '+971501230001') returning id as vip \gset
insert into public.customers (name, email, phone) values ('New Buyer', 'new.buyer@solei.test', '+971501230002') returning id as newbie \gset
insert into public.orders (customer_id, channel, status, total_fils, subtotal_fils, fulfilment)
values (:'vip', 'pos', 'completed', 150000, 150000, 'handed_over') returning id as vip_order \gset
insert into public.payments (order_id, amount_fils, method, status) values (:'vip_order', 150000, 'cash', 'succeeded');
select public.settle_if_paid(:'vip_order');
insert into public.coupons (code, kind, percent_bp, tier_ids)
values ('TSTVIP', 'percent', 2000, array[(select id from public.loyalty_tiers where name = 'Voyager')]);
insert into public.coupons (code, kind, amount_fils, customer_ids)
values ('TSTJUSTYOU', 'fixed', 2500, array[:'newbie'::uuid]);
select is(pg_temp.code(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTVIP}'), 'TSTVIP') ->> 'reason', 'not_eligible', 'VIP code needs a customer');
select is(pg_temp.code(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTVIP}', '{"email": "new.buyer@solei.test"}'), 'TSTVIP') ->> 'reason',
  'not_eligible', 'VIP code refused below the tier');
select is(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTVIP}', '{"email": "VIP.Buyer@solei.test"}') ->> 'discount_fils', '5600', 'VIP code for a Voyager');
select is(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTJUSTYOU}', jsonb_build_object('customer_id', :'newbie')) ->> 'discount_fils',
  '2500', 'personal code for its customer');
select is(pg_temp.code(pg_temp.price(pg_temp.bag(:'p1', '1'), '{TSTJUSTYOU}', jsonb_build_object('customer_id', :'vip')), 'TSTJUSTYOU') ->> 'reason',
  'not_eligible', '…and nobody else');

-- ── 6. Website order: sale + code, snapshot, use counting ─────────────────────────────────────
create function pg_temp.web_order(p_lines jsonb, p_codes text[], p_subtotal int, p_discount int, p_total int)
returns uuid language sql as $$
  select order_id from public.create_web_order(jsonb_build_object(
    'client_uuid', gen_random_uuid(), 'emirate', 'abu_dhabi',
    'contact', jsonb_build_object('name', 'Promo Two', 'phone', '+971501239999', 'email', 'promo.two@solei.test'),
    'address', jsonb_build_object('line1', 'Street 1'),
    'lines', p_lines, 'subtotal_fils', p_subtotal, 'coupon_codes', to_jsonb(p_codes), 'discount_fils', p_discount,
    'delivery_fee_fils', 0, 'delivery_discount_fils', 0,
    'vat_fils', 0, 'total_fils', p_total, 'vat_rate_bp', 0, 'prices_include_vat', true));
$$;
select pg_temp.web_order(
  jsonb_build_array(jsonb_build_object('variant_id', :'p1', 'qty', 1, 'unit_price_fils', 28000),
                    jsonb_build_object('variant_id', :'s1', 'qty', 1, 'unit_price_fils', 16150)),
  '{TSTFIFTY,TSTTEN}', 44150, 9415, 34735) as wo \gset
select is((select unit_price_fils from public.order_lines where order_id = :'wo' and variant_id = :'s1'), 16150, 'order line at the sale price');
select is((select list_price_fils || ' / ' || price_override_reason from public.order_lines where order_id = :'wo' and variant_id = :'s1'),
  '19000 / Sale: Sprays 15% off', 'list price and the sale kept on the line');
select is((select sum(discount_fils)::int from public.order_lines where order_id = :'wo'), 9415, 'line discounts add up to the order discount');
select is((select sum(line_total_fils)::int from public.order_lines where order_id = :'wo'), 34735, 'line totals add up to the total');
select is((select jsonb_agg(e ->> 'type' order by e ->> 'type') from public.orders o, jsonb_array_elements(o.applied_promotions) e where o.id = :'wo'),
  '["code", "code", "sale"]'::jsonb, 'snapshot: the sale and both codes');
select is((select coupon_code from public.orders where id = :'wo'), 'TSTFIFTY', 'first code kept in coupon_code');
select is(public.coupon_uses((select id from public.coupons where code = 'TSTTEN')), 1, 'second code counted as used');
select throws_ok(format($$ select pg_temp.web_order(jsonb_build_array(jsonb_build_object('variant_id', %L, 'qty', 1, 'unit_price_fils', 19000)), '{}', 19000, 0, 19000) $$, :'s1'),
  'P0001', 'prices changed — please review your cart', 'the catalogue price is refused while a sale runs');
delete from public.offers where id = :'sale15';

-- ── 7. Early access ───────────────────────────────────────────────────────────────────────────
update public.products set launch_at = now() + interval '7 days',
       early_access_tier_ids = array[(select id from public.loyalty_tiers where name = 'Voyager')]
 where id = (select product_id from public.product_variants where id = :'p2');
select ok(not public.product_buyable_by((select product_id from public.product_variants where id = :'p2'), :'newbie'), 'not launched: not for everyone');
select ok(public.product_buyable_by((select product_id from public.product_variants where id = :'p2'), :'vip'), 'early access for the tier');
select throws_ok(format($$ select pg_temp.web_order(jsonb_build_array(jsonb_build_object('variant_id', %L, 'qty', 1, 'unit_price_fils', 28000)), '{}', 28000, 0, 28000) $$, :'p2'),
  'P0001', 'Capri Perfume isn''t available yet', 'the order refuses a product before its launch');

-- ── 8. Till: event code + points + a reward, then a cancellation gives points back ────────────
select tests.login_as(tests.create_staff('promo-owner@solei.test', 'owner'));
reset role;
update public.rewards_settings set points_enabled = true where id = 1;
insert into public.points_ledger (customer_id, entry, points, note) values (:'vip', 'adjust', 1000, 'test');
insert into public.points_rewards (variant_id, points) values (:'s2', 500) returning id as reward \gset
select tests.login_as((select user_id from public.staff_profiles where email = 'promo-owner@solei.test'));
select is(public.pos_quote(jsonb_build_object('event_id', :'ev', 'customer_id', :'vip', 'coupon_codes', '["TSTEXPO"]'::jsonb,
  'lines', pg_temp.bag(:'p1', '1'))) ->> 'discount_fils', '5600', 'till quote with the event code');
select order_id as till from public.pos_complete_sale(jsonb_build_object(
  'client_uuid', gen_random_uuid(), 'event_id', :'ev', 'customer_id', :'vip', 'coupon_codes', '["tstexpo"]'::jsonb, 'points', 200,
  'lines', jsonb_build_array(jsonb_build_object('variant_id', :'p1', 'qty', 1),
                             jsonb_build_object('variant_id', :'s2', 'qty', 1, 'reward_id', :'reward')),
  'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_fils', 21400)))) \gset
select is((select total_fils from public.orders where id = :'till'), 41400, 'till total: 280 − 20% + reward 190');
select is((select discount_fils from public.orders where id = :'till'), 5600, 'the code takes nothing off the reward');
select is(public.points_balance(:'vip'), 567, '1000 − 500 for the reward − 200 as AED 10 off + 267 earned on AED 214 cash (Voyager ×1.25)');
select is((select sum(amount_fils)::int from public.payments where order_id = :'till' and method = 'loyalty_points'), 20000,
  'points payments: reward 19000 + 1000');
select throws_ok(format($$ select public.pos_complete_sale(jsonb_build_object('client_uuid', gen_random_uuid(), 'event_id', %L,
  'customer_id', %L, 'lines', jsonb_build_array(jsonb_build_object('variant_id', %L, 'qty', 1, 'reward_id', %L)),
  'payments', '[]'::jsonb)) $$, :'ev', :'newbie', :'s2', :'reward'),
  'P0001', 'not enough points for your rewards', 'a reward needs the points');
select public.cancel_order(:'till', 'Test', false);
select is(public.points_balance(:'vip'), 1000, 'cancelling gives every point back');

-- ── 9. Report ─────────────────────────────────────────────────────────────────────────────────
select order_id as till2 from public.pos_complete_sale(jsonb_build_object(
  'client_uuid', gen_random_uuid(), 'event_id', :'ev', 'coupon_codes', '["TSTEXPO"]'::jsonb,
  'lines', pg_temp.bag(:'p1', '1'), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_fils', 22400)))) \gset
select is((select orders || ' / ' || discount_fils || ' / ' || event_name from public.promotion_performance(public.business_today(), public.business_today())
            where code = 'TSTEXPO'), '1 / 5600 / Promo Pop-up', 'report: the event code, its event and its discount');

-- ── 10. Birthday code ─────────────────────────────────────────────────────────────────────────
reset role;
update public.rewards_settings set birthday_reward = 'code', birthday_code_percent_bp = 1500, birthday_code_valid_days = 30 where id = 1;
update public.customers set birth_month = extract(month from public.business_today()), birth_day = extract(day from public.business_today())
 where id = :'vip';
select ok(exists (select 1 from public.birthdays_due() where customer_id = :'vip'), 'birthday due (code reward)');
select public.birthday_code_issue(:'vip') ->> 'code' as bday \gset
select is(public.birthday_code_issue(:'vip') ->> 'code', :'bday', 'one birthday code per year');
select is(public.points_birthday(:'vip'), 0, 'code only: no birthday points');
select ok(not exists (select 1 from public.birthdays_due() where customer_id = :'vip'), 'celebrated once');
select is(pg_temp.price(pg_temp.bag(:'p1', '1'), array[:'bday'], jsonb_build_object('customer_id', :'vip')) ->> 'discount_fils', '4200',
  'birthday code: 15% for its customer');
select is(pg_temp.code(pg_temp.price(pg_temp.bag(:'p1', '1'), array[:'bday'], jsonb_build_object('customer_id', :'newbie')), :'bday') ->> 'reason',
  'not_eligible', 'birthday code is personal');

-- ── 11. Saving the tiers keeps their ids (VIP codes and early access keep working) ─────────────
select id as voyager from public.loyalty_tiers where name = 'Voyager' \gset
select tests.login_as((select user_id from public.staff_profiles where email = 'promo-owner@solei.test'));
select public.loyalty_tiers_save(jsonb_build_array(
  jsonb_build_object('name', 'Explorer', 'min_spend_fils', 0, 'points_multiplier_bp', 10000),
  jsonb_build_object('name', 'Voyager Plus', 'min_spend_fils', 120000, 'points_multiplier_bp', 12500),
  jsonb_build_object('name', 'Globetrotter', 'min_spend_fils', 300000, 'points_multiplier_bp', 15000)));
reset role;
select is((select name from public.loyalty_tiers where id = :'voyager'), 'Voyager Plus', 'a renamed, re-priced tier keeps its id');
select ok((select :'voyager'::uuid = any (tier_ids) from public.coupons where code = 'TSTVIP'), 'the VIP code still points at it');
select tests.login_as((select user_id from public.staff_profiles where email = 'promo-owner@solei.test'));
select public.loyalty_tiers_save(jsonb_build_array(
  jsonb_build_object('name', 'Explorer', 'min_spend_fils', 0, 'points_multiplier_bp', 10000)));
reset role;
select is((select tier_ids from public.coupons where code = 'TSTVIP'), '{}'::uuid[], 'a removed tier is taken out of codes');

select * from finish();
rollback;
