-- Phase 2 promotions, part 2: the order RPCs price through promo_price() (20261030030002), so sale
-- prices, bundles, buy X get Y, several codes, codes at the till, points at the till and points
-- rewards work on every channel. Same signatures; the new inputs are optional keys of `p`:
--   create_web_order:  coupon_codes [..] (else coupon_code), customer_id (signed-in customer),
--                      lines[].reward_id
--   pos_complete_sale: coupon_codes [..], points, apply_offers (false = priced offline at catalogue
--                      prices), lines[].reward_id
-- Without offers, extra codes or rewards they behave exactly as before, so main's checkout keeps
-- working on the shared DB. Built on the 20261030020003 (giveaways) bodies.

/*
  Spend points on a reward line: a loyalty_points payment worth the line's price, so refunds and
  cancellations give the points back through the usual path (points_on_refund). No minimum.
*/
create or replace function public.points_redeem_reward(p_customer uuid, p_points int, p_value_fils int, p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.rewards_settings;
  v_payment uuid;
begin
  select * into s from rewards_settings where id = 1;
  if not s.points_enabled then
    raise exception 'points can''t be used right now' using errcode = 'P0001';
  end if;
  if p_customer is null then
    raise exception 'sign in to use your points' using errcode = 'P0001';
  end if;
  perform public.points_release_stale();
  perform 1 from customers where id = p_customer for update;
  if p_points > public.points_balance(p_customer) then
    raise exception 'not enough points for your rewards' using errcode = 'P0001';
  end if;
  insert into payments (order_id, kind, amount_fils, method, status, reference, received_by, received_at)
  values (p_order_id, 'payment', p_value_fils, 'loyalty_points', 'succeeded', p_points || ' points (reward)',
          auth.uid(), now())
  returning id into v_payment;
  insert into points_ledger (customer_id, entry, points, value_fils, order_id, payment_id, note, created_by)
  values (p_customer, 'redeem', -p_points, p_value_fils, p_order_id, v_payment, 'Reward', auth.uid());
  return v_payment;
end;
$$;
revoke all on function public.points_redeem_reward(uuid, int, int, uuid) from public, anon, authenticated;

-- Reward lines of a bag must be live rewards for exactly that variant, one piece each line max 5.
create or replace function public.promo_check_rewards(p_lines jsonb)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l jsonb;
begin
  for l in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    continue when nullif(l ->> 'reward_id', '') is null;
    if not exists (select 1 from points_rewards r where r.id = (l ->> 'reward_id')::uuid and r.active
                     and r.variant_id = (l ->> 'variant_id')::uuid)
       or nullif(l ->> 'giveaway_id', '') is not null
       or jsonb_array_length(coalesce(l -> 'options', '[]'::jsonb)) > 0 then
      raise exception 'a reward in your bag is no longer available' using errcode = 'P0001';
    end if;
    if (l ->> 'qty')::int > 5 then
      raise exception 'at most 5 of a reward per order' using errcode = '22023';
    end if;
  end loop;
end;
$$;
revoke all on function public.promo_check_rewards(jsonb) from public, anon, authenticated;

-- One code against a bag (the shape main expects), now priced with the automatic offers.
create or replace function public.coupon_evaluate(p_code text, p_lines jsonb, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_price jsonb := public.promo_price(p_lines, jsonb_build_array(coalesce(p_code, '')),
                                      jsonb_build_object('channel', 'website', 'email', p_email));
  v_res jsonb := coalesce(v_price -> 'codes' -> 0, jsonb_build_object('ok', false, 'reason', 'invalid'));
begin
  if not (v_res ->> 'ok')::boolean then
    return jsonb_strip_nulls(jsonb_build_object('ok', false, 'reason', v_res ->> 'reason',
      'min_order_fils', (v_res ->> 'min_order_fils')::int));
  end if;
  return jsonb_build_object(
    'ok', true, 'coupon_id', v_res -> 'coupon_id', 'code', v_res -> 'code', 'kind', v_res -> 'kind',
    'discount_fils', (v_res ->> 'discount_fils')::int, 'eligible_fils', (v_res ->> 'eligible_fils')::int,
    'subtotal_fils', (v_price ->> 'subtotal_fils')::int, 'free_delivery', (v_res ->> 'free_delivery')::boolean);
end;
$$;
revoke all on function public.coupon_evaluate(text, jsonb, text) from public, anon, authenticated;

/*
  The bag's prices for the storefront (bag, checkout summary): promo_price with the signed-in
  customer. Service role only (the server action calls it after resolving the account).
*/
create or replace function public.cart_quote(p_lines jsonb, p_codes jsonb, p_email text, p_customer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.promo_price(p_lines, p_codes,
    jsonb_build_object('channel', 'website', 'email', p_email, 'customer_id', p_customer));
$$;
revoke all on function public.cart_quote(jsonb, jsonb, text, uuid) from public, anon, authenticated;

/*
  The till's prices for a sale in progress (pos.use): promo_price at the event, with the customer
  when known (VIP / personal codes, per-customer limits).
*/
create or replace function public.pos_quote(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_customer uuid := nullif(p ->> 'customer_id', '')::uuid;
  v_email text := nullif(trim(p ->> 'customer_email'), '');
begin
  perform public.require_permission('pos.use');
  if v_customer is null and nullif(trim(p ->> 'customer_phone'), '') is not null then
    select id into v_customer from customers where phone = trim(p ->> 'customer_phone');
  end if;
  if v_email is null and v_customer is not null then
    select email into v_email from customers where id = v_customer;
  end if;
  return public.promo_price(p -> 'lines', coalesce(p -> 'coupon_codes', '[]'::jsonb),
    jsonb_build_object('channel', 'pos', 'event_id', p ->> 'event_id', 'email', v_email,
                       'customer_id', v_customer)) ||
    jsonb_build_object('customer_id', v_customer,
      'points_balance', case when v_customer is not null then public.points_balance(v_customer) end);
end;
$$;
revoke all on function public.pos_quote(jsonb) from public, anon;
grant execute on function public.pos_quote(jsonb) to authenticated;

/*
  Website order. Prices, sale prices, offers and codes come from promo_price (re-checked inside the
  order transaction with the code rows locked); the browser's unit prices, discount and totals must
  match. Lines carry their sale price (price_override_reason = the sale) and their share of the
  discounts; orders.applied_promotions keeps every promotion; coupon_id / coupon_code keep the first
  code (older reports). Early-access products need the customer's tier before their launch. Reward
  lines and points are spent from the signed-in customer (p.customer_id / p.points_customer).
*/
create or replace function public.create_web_order(p jsonb)
returns table (order_id uuid, order_number text, total_fils int, existing boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_customer uuid;
  v_buyer uuid := coalesce(nullif(p ->> 'customer_id', '')::uuid, nullif(p ->> 'points_customer', '')::uuid);
  v_line jsonb;
  v_n int;
  v_variant record;
  v_subtotal int := 0;
  v_line_id uuid;
  v_codes jsonb := coalesce(p -> 'coupon_codes',
                            case when nullif(trim(p ->> 'coupon_code'), '') is not null
                                 then jsonb_build_array(p ->> 'coupon_code') else '[]'::jsonb end);
  v_price jsonb;
  v_pl jsonb;
  v_first jsonb;
  v_bad text;
  v_discount int := 0;
  v_delivery_discount int := coalesce((p ->> 'delivery_discount_fils')::int, 0);
  v_applied jsonb;
  v_expected int;
  v_gift_code text := nullif(trim(p ->> 'gift_card_code'), '');
  v_gift_fils int := coalesce((p ->> 'gift_card_fils')::int, 0);
  v_points int := coalesce((p ->> 'points')::int, 0);
  v_points_fils int := 0;
  v_reward_points int := 0;
  v_reward_fils int := 0;
  v_unit int;
  v_opts jsonb;
  v_giveaway uuid;
  r record;
begin
  -- Idempotency: the same checkout submit returns the same order.
  select * into v_order from orders o where o.client_uuid = (p ->> 'client_uuid')::uuid;
  if found then
    return query select v_order.id, v_order.number, v_order.total_fils, true;
    return;
  end if;

  if jsonb_array_length(coalesce(p -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'cart is empty' using errcode = '22023';
  end if;
  perform public.promo_check_rewards(p -> 'lines');

  -- Lock the codes so a limited code can't be over-used, then price the bag.
  perform 1 from coupons
   where code in (select upper(trim(x)) from jsonb_array_elements_text(v_codes) x) for update;
  v_price := public.promo_price(p -> 'lines', v_codes,
    jsonb_build_object('channel', 'website', 'email', p -> 'contact' ->> 'email', 'customer_id', v_buyer));
  select e ->> 'code' into v_bad from jsonb_array_elements(v_price -> 'codes') e
   where not (e ->> 'ok')::boolean limit 1;
  if v_bad is not null then
    raise exception 'the discount code % can no longer be used — remove it and try again', v_bad
      using errcode = 'P0001';
  end if;
  select e into v_first from jsonb_array_elements(v_price -> 'codes') e limit 1;
  v_discount := (v_price ->> 'discount_fils')::int;
  if v_discount <> coalesce((p ->> 'discount_fils')::int, 0) then
    raise exception 'your discount changed — please review your order' using errcode = 'P0001';
  end if;
  if (v_price ->> 'free_delivery')::boolean and (p ->> 'delivery_fee_fils')::int <> 0 then
    raise exception 'your discount changed — please review your order' using errcode = 'P0001';
  end if;
  if v_delivery_discount < 0 or (v_delivery_discount > 0 and not (v_price ->> 'free_delivery')::boolean) then
    raise exception 'delivery discount without a free-delivery code' using errcode = '22023';
  end if;
  if jsonb_array_length(v_price -> 'lines') <> jsonb_array_length(p -> 'lines') then
    raise exception 'a product in your cart is no longer available' using errcode = 'P0001';
  end if;

  v_customer := public.upsert_customer(
    p -> 'contact' ->> 'phone',
    p -> 'contact' ->> 'email',
    p -> 'contact' ->> 'name',
    'website',
    (p ->> 'emirate')::public.emirate,
    p -> 'address',
    coalesce((p ->> 'marketing_consent')::boolean, false),
    case when coalesce((p ->> 'marketing_consent')::boolean, false) then 'email' end
  );

  -- The waived delivery fee goes on the free-delivery code's entry.
  select coalesce(jsonb_agg(case when e ->> 'kind' = 'free_delivery'
                                 then e || jsonb_build_object('delivery_discount_fils', v_delivery_discount)
                                 else e end order by ord), '[]'::jsonb)
    into v_applied
    from jsonb_array_elements(v_price -> 'applied') with ordinality as t(e, ord);

  insert into orders (
    customer_id, channel, status, fulfilment, contact_name, contact_phone, contact_email,
    delivery_address, delivery_emirate, delivery_fee_fils, delivery_discount_fils, subtotal_fils,
    discount_fils, vat_fils, total_fils, vat_rate_bp, prices_include_vat, notes, client_uuid,
    coupon_id, coupon_code, applied_promotions
  ) values (
    v_customer, 'website', 'pending_payment',
    coalesce((p ->> 'fulfilment')::public.fulfilment_type, 'delivery'),
    p -> 'contact' ->> 'name', p -> 'contact' ->> 'phone', lower(p -> 'contact' ->> 'email'),
    p -> 'address', (p ->> 'emirate')::public.emirate,
    (p ->> 'delivery_fee_fils')::int, v_delivery_discount, (p ->> 'subtotal_fils')::int, v_discount,
    (p ->> 'vat_fils')::int, (p ->> 'total_fils')::int, (p ->> 'vat_rate_bp')::int,
    (p ->> 'prices_include_vat')::boolean, nullif(trim(p ->> 'notes'), ''), (p ->> 'client_uuid')::uuid,
    (v_first ->> 'coupon_id')::uuid, v_first ->> 'code', v_applied
  ) returning * into v_order;

  for v_line, v_n in select x, ord from jsonb_array_elements(p -> 'lines') with ordinality as t(x, ord) loop
    v_pl := v_price -> 'lines' -> (v_n - 1);
    select v.id, v.sku, v.label, v.price_fils, v.active, pr.id as product_id, pr.name as product_name,
           pr.active as product_active, pr.category_id, pr.destination_id, coalesce(c.cost_fils, 0) as cost_fils
      into v_variant
      from product_variants v
      join products pr on pr.id = v.product_id
      left join variant_costs c on c.variant_id = v.id
     where v.id = (v_line ->> 'variant_id')::uuid;

    if not found or not v_variant.active or not v_variant.product_active then
      raise exception 'a product in your cart is no longer available' using errcode = 'P0001';
    end if;
    if not public.product_buyable_by(v_variant.product_id, coalesce(v_buyer, v_customer)) then
      raise exception '% isn''t available yet' , v_variant.product_name using errcode = 'P0001';
    end if;
    -- Options (giveaways): checked against the product, priced here, snapshotted on the line.
    v_giveaway := nullif(v_line ->> 'giveaway_id', '')::uuid;
    v_opts := public.line_options_check(v_variant.id, v_line -> 'options', v_giveaway);
    if not (v_opts ->> 'ok')::boolean then
      raise exception '%', v_opts ->> 'error' using errcode = 'P0001';
    end if;
    -- The price after any sale (promo_price); the browser must have shown the same.
    v_unit := (v_pl ->> 'unit_price_fils')::int;
    if v_unit <> (v_line ->> 'unit_price_fils')::int then
      raise exception 'prices changed — please review your cart' using errcode = 'P0001';
    end if;

    insert into order_lines (order_id, variant_id, product_name, variant_label, sku, category_id, destination_id,
                             qty, list_price_fils, unit_price_fils, price_override_reason, discount_fils,
                             line_total_fils, options, giveaway_product_id)
    values (v_order.id, v_variant.id, v_variant.product_name, v_variant.label, v_variant.sku,
            v_variant.category_id, v_variant.destination_id, (v_line ->> 'qty')::int,
            (v_pl ->> 'list_unit_fils')::int, v_unit,
            case when nullif(v_pl ->> 'sale_name', '') is not null then left('Sale: ' || (v_pl ->> 'sale_name'), 120) end,
            (v_pl ->> 'discount_fils')::int,
            v_unit * (v_line ->> 'qty')::int - (v_pl ->> 'discount_fils')::int, v_opts -> 'snapshot', v_giveaway)
    returning id into v_line_id;

    insert into order_line_costs (order_line_id, unit_cost_fils) values (v_line_id, v_variant.cost_fils);
    v_subtotal := v_subtotal + v_unit * (v_line ->> 'qty')::int;
    if nullif(v_pl ->> 'reward_id', '') is not null then
      v_reward_points := v_reward_points + (v_pl ->> 'reward_points')::int;
      v_reward_fils := v_reward_fils + v_unit * (v_line ->> 'qty')::int;
    end if;
  end loop;

  -- Minimum quantities (giveaways), per product — or per giveaway — across its lines.
  for r in
    select * from public.order_min_qty_shortfalls(v_order.id)
  loop
    raise exception '% comes in at least % pieces', r.name, r.min_order_qty using errcode = 'P0001';
  end loop;

  if v_subtotal <> (p ->> 'subtotal_fils')::int then
    raise exception 'order subtotal mismatch' using errcode = 'P0001';
  end if;

  v_expected := v_subtotal - v_discount + (p ->> 'delivery_fee_fils')::int
    + case when (p ->> 'prices_include_vat')::boolean then 0 else (p ->> 'vat_fils')::int end;
  if v_expected <> (p ->> 'total_fils')::int then
    raise exception 'order total mismatch' using errcode = 'P0001';
  end if;

  -- Rewards first, then points as money off, then a gift card: all spent in the same transaction;
  -- the order settles at once when together they cover it.
  if v_reward_points > 0 then
    perform public.points_redeem_reward(v_buyer, v_reward_points, v_reward_fils, v_order.id);
    perform public.settle_if_paid(v_order.id);
  end if;
  if v_points > 0 then
    -- The signed-in customer's record (the order's customer is matched by phone first).
    perform public.points_redeem(coalesce((p ->> 'points_customer')::uuid, v_customer), v_points, v_order.id);
    select v_points * point_value_fils into v_points_fils from rewards_settings where id = 1;
    if v_points_fils > v_order.total_fils - v_reward_fils then
      raise exception 'that''s more points than the order needs' using errcode = '22023';
    end if;
    perform public.settle_if_paid(v_order.id);
  end if;
  if v_gift_code is not null then
    if v_gift_fils <= 0 or v_gift_fils > v_order.total_fils - v_reward_fils - v_points_fils then
      raise exception 'gift card amount must be more than 0 and at most the total' using errcode = '22023';
    end if;
    perform public.gift_card_redeem(v_gift_code, v_gift_fils, v_order.id);
    perform public.settle_if_paid(v_order.id);
  end if;

  perform public.write_audit('order.created', 'orders', v_order.id::text, null,
    jsonb_build_object('number', v_order.number, 'channel', 'website', 'total_fils', v_order.total_fils,
                       'coupon_code', v_first ->> 'code', 'coupon_codes', v_codes, 'discount_fils', v_discount,
                       'delivery_discount_fils', v_delivery_discount, 'gift_card_fils', v_gift_fils,
                       'points', v_points, 'reward_points', v_reward_points));
  return query select v_order.id, v_order.number, v_order.total_fils, false;
end;
$$;

/*
  Till sale. Priced by promo_price at the event and the sale's time: sale prices and offers (unless
  p.apply_offers = false — a sale rung up offline at catalogue prices), codes (p.coupon_codes; only
  codes that work at the till, and an event's code only at its event), points (p.points, as money
  off) and reward lines, both from the sale's customer. Payments (+ points) must equal the total.
*/
create or replace function public.pos_complete_sale(p jsonb)
returns table (order_id uuid, order_number text, total_fils int, existing boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.orders;
  v_event public.events;
  v_location uuid;
  v_customer uuid := nullif(p ->> 'customer_id', '')::uuid;
  v_settings public.settings;
  v_order public.orders;
  v_line jsonb;
  v_n int;
  v_pay jsonb;
  v_variant record;
  v_line_id uuid;
  v_subtotal int := 0;
  v_discount int;
  v_vat int;
  v_total int;
  v_paid int := 0;
  v_sold_at timestamptz := least(coalesce((p ->> 'sold_at')::timestamptz, now()), now());
  v_giveaway uuid;
  v_opts jsonb;
  v_unit int;
  v_codes jsonb := coalesce(p -> 'coupon_codes', '[]'::jsonb);
  v_price jsonb;
  v_pl jsonb;
  v_first jsonb;
  v_bad text;
  v_points int := coalesce((p ->> 'points')::int, 0);
  v_points_fils int := 0;
  v_reward_points int := 0;
  v_reward_fils int := 0;
  r record;
begin
  perform public.require_permission('pos.use');

  select * into v_existing from orders o where o.client_uuid = (p ->> 'client_uuid')::uuid;
  if found then
    return query select v_existing.id, v_existing.number, v_existing.total_fils, true;
    return;
  end if;

  select * into v_event from events where id = (p ->> 'event_id')::uuid;
  if not found then raise exception 'event not found' using errcode = 'P0002'; end if;
  if v_event.status = 'cancelled' then raise exception 'this event was cancelled' using errcode = 'P0001'; end if;
  if v_event.closed_at is not null and v_sold_at > v_event.closed_at then
    raise exception 'this event is closed — reopen it to sell' using errcode = 'P0001';
  end if;
  select id into v_location from stock_locations where event_id = v_event.id;
  if v_location is null then raise exception 'event has no stock location' using errcode = 'P0001'; end if;

  if jsonb_array_length(coalesce(p -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'add at least one product' using errcode = '22023';
  end if;
  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    if coalesce((v_line ->> 'qty')::int, 0) < 1 then
      raise exception 'quantity must be at least 1' using errcode = '22023';
    end if;
  end loop;
  perform public.promo_check_rewards(p -> 'lines');

  -- Phone and/or email (both optional): finds the customer or creates one; fills a missing email
  -- or phone on an existing customer. Email is what links the sale to their online Passport.
  if v_customer is null and (nullif(trim(p ->> 'customer_phone'), '') is not null
                             or nullif(trim(p ->> 'customer_email'), '') is not null) then
    v_customer := public.upsert_customer(p ->> 'customer_phone', p ->> 'customer_email',
                                         p ->> 'customer_name', 'pos');
  end if;

  perform 1 from coupons
   where code in (select upper(trim(x)) from jsonb_array_elements_text(v_codes) x) for update;
  v_price := public.promo_price(p -> 'lines', v_codes, jsonb_build_object(
    'channel', 'pos', 'event_id', v_event.id, 'at', v_sold_at, 'customer_id', v_customer,
    'email', (select email from customers where id = v_customer),
    'apply_offers', coalesce((p ->> 'apply_offers')::boolean, true)));
  select e ->> 'code' into v_bad from jsonb_array_elements(v_price -> 'codes') e
   where not (e ->> 'ok')::boolean limit 1;
  if v_bad is not null then
    raise exception 'the code % can''t be used on this sale', v_bad using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_price -> 'lines') <> jsonb_array_length(p -> 'lines') then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  select e into v_first from jsonb_array_elements(v_price -> 'codes') e limit 1;
  v_discount := (v_price ->> 'discount_fils')::int;

  select * into v_settings from settings where id = 1;

  insert into orders (customer_id, channel, event_id, event_day, staff_id, status, fulfilment,
                      contact_name, contact_phone, contact_email, vat_rate_bp, prices_include_vat, client_uuid,
                      placed_at, coupon_id, coupon_code, applied_promotions)
  select v_customer, 'pos', v_event.id, public.business_day(v_sold_at), auth.uid(), 'completed', 'handed_over',
         c.name, c.phone, c.email, v_settings.vat_rate_bp, v_settings.prices_include_vat,
         (p ->> 'client_uuid')::uuid, v_sold_at, (v_first ->> 'coupon_id')::uuid, v_first ->> 'code',
         v_price -> 'applied'
    from (select null::text as name, null::text as phone) d
    left join customers c on c.id = v_customer
  returning * into v_order;

  for v_line, v_n in select x, ord from jsonb_array_elements(p -> 'lines') with ordinality as t(x, ord) loop
    v_pl := v_price -> 'lines' -> (v_n - 1);
    select v.id, v.sku, v.label, v.price_fils, pr.name as product_name, pr.category_id, pr.destination_id,
           coalesce(c.cost_fils, 0) as cost_fils
      into v_variant
      from product_variants v join products pr on pr.id = v.product_id
      left join variant_costs c on c.variant_id = v.id
     where v.id = (v_line ->> 'variant_id')::uuid;
    if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
    -- Giveaway choices: checked and priced here, snapshotted on the line.
    v_giveaway := nullif(v_line ->> 'giveaway_id', '')::uuid;
    v_opts := public.line_options_check(v_variant.id, v_line -> 'options', v_giveaway);
    if not (v_opts ->> 'ok')::boolean then
      raise exception '%', v_opts ->> 'error' using errcode = 'P0001';
    end if;
    v_unit := (v_pl ->> 'unit_price_fils')::int;

    insert into order_lines (order_id, variant_id, product_name, variant_label, sku, category_id, destination_id,
                             qty, list_price_fils, unit_price_fils, price_override_reason, discount_fils,
                             line_total_fils, options, giveaway_product_id)
    values (v_order.id, v_variant.id, v_variant.product_name, v_variant.label, v_variant.sku,
            v_variant.category_id, v_variant.destination_id, (v_line ->> 'qty')::int,
            (v_pl ->> 'list_unit_fils')::int, v_unit,
            case when nullif(v_pl ->> 'sale_name', '') is not null then left('Sale: ' || (v_pl ->> 'sale_name'), 120) end,
            (v_pl ->> 'discount_fils')::int,
            v_unit * (v_line ->> 'qty')::int - (v_pl ->> 'discount_fils')::int, v_opts -> 'snapshot', v_giveaway)
    returning id into v_line_id;
    insert into order_line_costs (order_line_id, unit_cost_fils) values (v_line_id, v_variant.cost_fils);
    insert into stock_movements (variant_id, location_id, qty, type, reason, order_line_id, event_id, created_by, created_at)
    values (v_variant.id, v_location, -(v_line ->> 'qty')::int, 'sale', 'POS ' || v_order.number,
            v_line_id, v_event.id, auth.uid(), v_sold_at);
    v_subtotal := v_subtotal + v_unit * (v_line ->> 'qty')::int;
    if nullif(v_pl ->> 'reward_id', '') is not null then
      v_reward_points := v_reward_points + (v_pl ->> 'reward_points')::int;
      v_reward_fils := v_reward_fils + v_unit * (v_line ->> 'qty')::int;
    end if;
  end loop;
  for r in select * from public.order_min_qty_shortfalls(v_order.id) loop
    raise exception '% comes in at least % pieces', r.name, r.min_order_qty using errcode = 'P0001';
  end loop;

  -- VAT on the goods after discounts (no delivery at the till).
  if v_settings.prices_include_vat then
    v_total := v_subtotal - v_discount;
    v_vat := case when v_settings.vat_rate_bp > 0
                  then floor((v_total::bigint * v_settings.vat_rate_bp * 2 + (10000 + v_settings.vat_rate_bp))
                             / (2 * (10000 + v_settings.vat_rate_bp)))::int else 0 end;
  else
    v_vat := floor(((v_subtotal - v_discount)::bigint * v_settings.vat_rate_bp * 2 + 10000) / 20000)::int;
    v_total := v_subtotal - v_discount + v_vat;
  end if;
  update orders set subtotal_fils = v_subtotal, discount_fils = v_discount, vat_fils = v_vat,
                    total_fils = v_total
   where id = v_order.id;

  -- Rewards, then points as money off, from the sale's customer.
  if v_reward_points > 0 then
    perform public.points_redeem_reward(v_customer, v_reward_points, v_reward_fils, v_order.id);
    v_paid := v_paid + v_reward_fils;
  end if;
  if v_points > 0 then
    if v_customer is null then
      raise exception 'add the customer to use their points' using errcode = 'P0001';
    end if;
    perform public.points_redeem(v_customer, v_points, v_order.id);
    select v_points * point_value_fils into v_points_fils from rewards_settings where id = 1;
    if v_points_fils > v_total - v_reward_fils then
      raise exception 'that''s more points than the sale needs' using errcode = '22023';
    end if;
    v_paid := v_paid + v_points_fils;
  end if;

  for v_pay in select * from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) loop
    if coalesce((v_pay ->> 'amount_fils')::int, 0) <= 0 then continue; end if;
    if (v_pay ->> 'method') = 'gift_card' then
      -- The card code is the reference; the owner can switch till redemption off.
      if not v_settings.gift_cards_at_pos then
        raise exception 'gift cards can''t be used at the till' using errcode = 'P0001';
      end if;
      perform public.gift_card_redeem(v_pay ->> 'reference', (v_pay ->> 'amount_fils')::int, v_order.id);
    else
      if (v_pay ->> 'method') not in ('cash', 'card_terminal', 'soft_pos', 'bank_transfer', 'other') then
        raise exception 'unsupported payment method' using errcode = '22023';
      end if;
      insert into payments (order_id, kind, amount_fils, method, status, reference, received_by, received_at)
      values (v_order.id, 'payment', (v_pay ->> 'amount_fils')::int, (v_pay ->> 'method')::public.payment_method,
              'succeeded', nullif(trim(v_pay ->> 'reference'), ''), auth.uid(), v_sold_at);
    end if;
    v_paid := v_paid + (v_pay ->> 'amount_fils')::int;
  end loop;
  if v_paid <> v_total then
    raise exception 'payments (%) must equal the total (%)', v_paid, v_total using errcode = 'P0001';
  end if;

  perform public.settle_if_paid(v_order.id);
  return query select v_order.id, v_order.number, v_total, false;
end;
$$;
