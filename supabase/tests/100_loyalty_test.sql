begin;
\ir helpers/setup.psql
select plan(29);

-- Helpers: a paid manual order for a customer (1 line) and the card state.
create function tests.buy(p_customer uuid, p_sku text, p_qty int) returns uuid language plpgsql as $$
declare r record;
begin
  select * into r from public.create_manual_order(jsonb_build_object(
    'client_uuid', gen_random_uuid(), 'channel', 'direct', 'customer_id', p_customer, 'fulfilment', 'handed_over',
    'lines', jsonb_build_array(jsonb_build_object(
      'variant_id', (select id from public.product_variants where sku = p_sku), 'qty', p_qty))));
  perform public.record_payment(r.order_id, r.outstanding_fils, 'cash');
  return r.order_id;
end $$;
create function tests.balance(p_customer uuid) returns int language sql as $$
  select coalesce(sum(stamps), 0)::int from public.loyalty_stamps where customer_id = p_customer;
$$;
create function tests.rewards(p_customer uuid) returns text language sql as $$
  select coalesce(string_agg(status::text, ',' order by created_at), '') from public.loyalty_rewards where customer_id = p_customer;
$$;
grant execute on all functions in schema tests to authenticated;

select is((select count(*)::int from public.loyalty_rule_versions), 1, 'launch rule is seeded');
select is((select stamps_per_item || '/' || stamps_for_reward || '/' || issue_passport_after_purchases || '/' || reward_items_earn_stamps
           from public.loyalty_rule_versions), '1/12/2/false', 'launch rule: 1 per item, 12 for a reward, passport after 2, rewards do not earn');

select public.upsert_customer('+971507779901', 'layla.loyalty@example.com', 'Layla', 'pos') as a \gset
select public.upsert_customer('+971507779902', null, 'Mona', 'pos') as b \gset
select tests.create_staff('owner@loyalty.test', 'owner') as owner \gset
select tests.create_staff('sales@loyalty.test', 'sales_staff') as sales \gset
select tests.login_as(:'owner');

-- Cumulative 1 + 1 + 2 + 3 + 5
select tests.buy(:'a', 'SOL-P-CAP-50', 1) as a1 \gset
select is(tests.balance(:'a'), 1, 'first purchase: 1 stamp');
select is((select count(*)::int from public.passports where customer_id = :'a'), 0, 'no passport after 1 purchase');
select tests.buy(:'a', 'SOL-S-SOH-100', 1) as a2 \gset
select is((select how::text from public.passports where customer_id = :'a'), 'auto', 'passport auto-issued after 2 purchases');
select tests.buy(:'a', 'SOL-P-CAP-50', 2) as a3 \gset
select tests.buy(:'a', 'SOL-P-CAP-50', 3) as a4 \gset
select is(tests.balance(:'a'), 7, '1 + 1 + 2 + 3 = 7');
select tests.buy(:'a', 'SOL-S-SOH-100', 5) as a5 \gset
select is(tests.balance(:'a'), 0, '+5 = 12 → card exchanged for a reward');
select is(tests.rewards(:'a'), 'available', 'one reward unlocked');
select is((select d.slug from public.loyalty_stamps s join public.destinations d on d.id = s.destination_id
            where s.order_id = :'a2' and s.kind = 'earned'), 'soho', 'stamp carries the line destination');

-- Idempotent: paying hooks can't award twice.
select throws_ok(format('select public.loyalty_award_order(%L)', :'a1'), '42501', null, 'internal award hook is not callable by API users');
select tests.logout();
select public.loyalty_award_order(:'a1');
select tests.login_as(:'owner');
select is(tests.balance(:'a'), 0, 'award is idempotent per line');

-- Threshold crossing in one order: 11 + 3 → 1 reward, 2 carried
select public.loyalty_adjust_stamps(:'b', 11, 'Paper passport from the Yas pop-up');
select tests.buy(:'b', 'SOL-P-CAP-50', 3) as b1 \gset
select is(tests.balance(:'b'), 2, '11 + 3 → 2 carried');
select is(tests.rewards(:'b'), 'available', '11 + 3 → 1 reward');

-- Cancel reverses the order's stamps and withdraws the unused reward.
select public.cancel_order(:'b1', 'Changed her mind', true);
select is(tests.balance(:'b'), 11, 'cancel: −3, reward withdrawn (+12) → 11');
select is(tests.rewards(:'b'), 'revoked', 'unused reward withdrawn');
select is((select count(*)::int from public.loyalty_stamps where order_id = :'b1' and kind = 'reversed'), 1, 'one reversal row');
select public.cancel_order(:'b1', 'Again', true);
select is((select count(*)::int from public.loyalty_stamps where order_id = :'b1' and kind = 'reversed'), 1, 'reversal happens once');

-- Manual removal is limited; reason required.
select throws_ok(format('select public.loyalty_adjust_stamps(%L, -50, %L)', :'b', 'Too many'), 'P0001', null, 'cannot remove more than the card holds');
select throws_ok(format('select public.loyalty_adjust_stamps(%L, 1, %L)', :'b', ''), '22023', null, 'manual stamps need a reason');

-- Redeem: zero-priced reward line, reward_redemption movement, no stamps for the reward.
select id as reward from public.loyalty_rewards where customer_id = :'a' and status = 'available' \gset
select order_id as ro from public.loyalty_redeem_reward(:'reward', (select id from public.product_variants where sku = 'SOL-S-SOH-100')) \gset
select is((select total_fils || '/' || (paid_at is not null) from public.orders where id = :'ro'), '0/true', 'reward order is free and settled');
select is((select string_agg(m.type::text || m.qty, ',') from public.stock_movements m
             join public.order_lines l on l.id = m.order_line_id where l.order_id = :'ro'), 'reward_redemption-1', 'reward leaves stock');
select is((select count(*)::int from public.loyalty_stamps where order_id = :'ro'), 0, 'reward items do not earn stamps');
select is(tests.rewards(:'a'), 'redeemed', 'reward marked redeemed');

-- Full refund reverses stamps.
select public.record_refund(:'a1', (select total_fils from public.orders where id = :'a1'), 'cash', 'Damaged bottle');
select is(tests.balance(:'a'), -1, 'full refund reverses the order stamp (card owes 1 after a redeemed reward)');

-- Rule change applies forward; old stamps keep their version.
select public.loyalty_save_rules(jsonb_build_object('enabled', true, 'stamps_per_item', 2, 'stamps_for_reward', 10,
  'reward_type', 'fixed_amount', 'reward_config', jsonb_build_object('amount_fils', 5000), 'reward_label', 'AED 50 off',
  'issue_passport_after_purchases', 2, 'reward_items_earn_stamps', false));
select tests.buy(:'a', 'SOL-P-CAP-50', 1) as a6 \gset
select is((select stamps from public.loyalty_stamps where order_id = :'a6' and kind = 'earned'), 2, 'new rule: 2 stamps per item');
select is((select count(distinct rule_version_id)::int from public.loyalty_stamps where customer_id = :'a' and kind = 'earned'), 2,
  'earlier stamps keep their rule version');

-- RLS: sales staff read; customers read only their own.
select tests.login_as(:'sales', 'aal1');
select throws_ok(format('select public.loyalty_adjust_stamps(%L, 1, %L)', :'b', 'Not allowed'), '42501', null, 'sales staff cannot adjust');
select tests.create_user('layla.loyalty@example.com') as layla \gset
select tests.login_as(:'layla', 'aal1');
select is(public.link_customer_account(), :'a'::uuid, 'customer login links by email');
select is((select count(distinct customer_id)::int from public.loyalty_stamps), 1, 'customer sees only their own stamps');

select * from finish();
rollback;
