-- Giveaway lines on every channel: the website (create_web_order, coupon_evaluate, cart_sync), the
-- till (pos_complete_sale) and staff manual orders (create_manual_order). Each line may carry
-- `options` and `giveaway_id`; the unit price and the choices are worked out here
-- (line_unit_price_fils / line_options_check, 3 arguments), snapshotted on order_lines.options, and
-- the giveaway is kept on order_lines.giveaway_product_id. Minimum quantities count per giveaway.
-- Same signatures as before; lines without options or a giveaway behave exactly as they did.
-- Redefines: create_web_order, coupon_evaluate, cart_sync (20261024000010), pos_complete_sale
-- (20261024000005), create_manual_order (20261014000015).

/*
  Products (or giveaways) on an order with fewer pieces than their minimum: lines bought through a
  giveaway count towards the giveaway's minimum, other lines towards their own product's.
*/
create or replace function public.order_min_qty_shortfalls(p_order uuid)
returns table (name text, min_order_qty int, qty bigint)
language sql
stable
security definer
set search_path = public
as $$
  select pr.name, pr.min_order_qty, sum(l.qty)
    from order_lines l
    join product_variants v on v.id = l.variant_id
    join products pr on pr.id = coalesce(l.giveaway_product_id, v.product_id)
   where l.order_id = p_order
   group by pr.id, pr.name, pr.min_order_qty
  having sum(l.qty) < pr.min_order_qty;
$$;
revoke all on function public.order_min_qty_shortfalls(uuid) from public, anon, authenticated;

create or replace function public.create_web_order(p jsonb)
returns table (order_id uuid, order_number text, total_fils int, existing boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_customer uuid;
  v_line jsonb;
  v_variant record;
  v_subtotal int := 0;
  v_line_id uuid;
  v_code text := nullif(upper(trim(p ->> 'coupon_code')), '');
  v_coupon jsonb;
  v_coupon_row public.coupons;
  v_discount int := 0;
  v_delivery_discount int := coalesce((p ->> 'delivery_discount_fils')::int, 0);
  v_applied jsonb := '[]'::jsonb;
  v_left int;
  v_eligible_lines int;
  v_n int := 0;
  v_share int;
  v_expected int;
  v_gift_code text := nullif(trim(p ->> 'gift_card_code'), '');
  v_gift_fils int := coalesce((p ->> 'gift_card_fils')::int, 0);
  v_points int := coalesce((p ->> 'points')::int, 0);
  v_points_fils int := 0;
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

  if v_code is not null then
    select * into v_coupon_row from coupons where code = v_code for update;
    v_coupon := public.coupon_evaluate(v_code, p -> 'lines', p -> 'contact' ->> 'email');
    if not (v_coupon ->> 'ok')::boolean then
      raise exception 'the discount code % can no longer be used — remove it and try again', v_code
        using errcode = 'P0001';
    end if;
    v_discount := (v_coupon ->> 'discount_fils')::int;
    if v_discount <> coalesce((p ->> 'discount_fils')::int, 0) then
      raise exception 'your discount changed — please review your order' using errcode = 'P0001';
    end if;
    if v_coupon_row.kind = 'free_delivery' and (p ->> 'delivery_fee_fils')::int <> 0 then
      raise exception 'your discount changed — please review your order' using errcode = 'P0001';
    end if;
  end if;
  if v_delivery_discount < 0
     or (v_delivery_discount > 0 and (v_code is null or v_coupon_row.kind <> 'free_delivery')) then
    raise exception 'delivery discount without a free-delivery code' using errcode = '22023';
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

  if v_code is not null then
    v_applied := jsonb_build_array(jsonb_build_object(
      'coupon_id', v_coupon_row.id, 'code', v_code, 'kind', v_coupon_row.kind,
      'percent_bp', v_coupon_row.percent_bp, 'amount_fils', v_coupon_row.amount_fils,
      'discount_fils', v_discount, 'delivery_discount_fils', v_delivery_discount));
  end if;

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
    case when v_code is not null then v_coupon_row.id end, v_code, v_applied
  ) returning * into v_order;

  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    select v.id, v.sku, v.label, v.price_fils, v.active, pr.name as product_name, pr.active as product_active,
           pr.category_id, pr.destination_id, coalesce(c.cost_fils, 0) as cost_fils
      into v_variant
      from product_variants v
      join products pr on pr.id = v.product_id
      left join variant_costs c on c.variant_id = v.id
     where v.id = (v_line ->> 'variant_id')::uuid;

    if not found or not v_variant.active or not v_variant.product_active then
      raise exception 'a product in your cart is no longer available' using errcode = 'P0001';
    end if;
    -- Options (giveaways): checked against the product, priced here, snapshotted on the line.
    v_giveaway := nullif(v_line ->> 'giveaway_id', '')::uuid;
    v_opts := public.line_options_check(v_variant.id, v_line -> 'options', v_giveaway);
    if not (v_opts ->> 'ok')::boolean then
      raise exception '%', v_opts ->> 'error' using errcode = 'P0001';
    end if;
    v_unit := public.line_unit_price_fils(v_variant.id, v_line -> 'options', v_giveaway);
    if v_unit <> (v_line ->> 'unit_price_fils')::int then
      raise exception 'prices changed — please review your cart' using errcode = 'P0001';
    end if;

    insert into order_lines (order_id, variant_id, product_name, variant_label, sku, category_id, destination_id,
                             qty, list_price_fils, unit_price_fils, line_total_fils, options, giveaway_product_id)
    values (v_order.id, v_variant.id, v_variant.product_name, v_variant.label, v_variant.sku,
            v_variant.category_id, v_variant.destination_id, (v_line ->> 'qty')::int,
            v_unit, v_unit, v_unit * (v_line ->> 'qty')::int, v_opts -> 'snapshot', v_giveaway)
    returning id into v_line_id;

    insert into order_line_costs (order_line_id, unit_cost_fils) values (v_line_id, v_variant.cost_fils);
    v_subtotal := v_subtotal + v_unit * (v_line ->> 'qty')::int;
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

  -- Spread the discount over the in-scope lines, proportional to their totals.
  if v_discount > 0 then
    v_left := v_discount;
    select count(*) into v_eligible_lines
      from order_lines l join product_variants v on v.id = l.variant_id
      join products pr on pr.id = v.product_id
     where l.order_id = v_order.id and public.coupon_covers(v_coupon_row, pr.id, pr.category_id);
    for r in
      select l.id, l.line_total_fils
        from order_lines l join product_variants v on v.id = l.variant_id
        join products pr on pr.id = v.product_id
       where l.order_id = v_order.id and public.coupon_covers(v_coupon_row, pr.id, pr.category_id)
       order by l.line_total_fils, l.id
    loop
      v_n := v_n + 1;
      v_share := case when v_n = v_eligible_lines then v_left
                      else (v_discount::bigint * r.line_total_fils / (v_coupon ->> 'eligible_fils')::int)::int end;
      v_share := least(v_share, r.line_total_fils, v_left);
      update order_lines set discount_fils = v_share, line_total_fils = line_total_fils - v_share
       where id = r.id;
      v_left := v_left - v_share;
    end loop;
  end if;

  v_expected := v_subtotal - v_discount + (p ->> 'delivery_fee_fils')::int
    + case when (p ->> 'prices_include_vat')::boolean then 0 else (p ->> 'vat_fils')::int end;
  if v_expected <> (p ->> 'total_fils')::int then
    raise exception 'order total mismatch' using errcode = 'P0001';
  end if;

  -- Points first, then a gift card: both spent in the same transaction; the order settles at once
  -- when together they cover it.
  if v_points > 0 then
    -- The signed-in customer's record (the order's customer is matched by phone first).
    perform public.points_redeem(coalesce((p ->> 'points_customer')::uuid, v_customer), v_points, v_order.id);
    select v_points * point_value_fils into v_points_fils from rewards_settings where id = 1;
    if v_points_fils > v_order.total_fils then
      raise exception 'that''s more points than the order needs' using errcode = '22023';
    end if;
    perform public.settle_if_paid(v_order.id);
  end if;
  if v_gift_code is not null then
    if v_gift_fils <= 0 or v_gift_fils > v_order.total_fils - v_points_fils then
      raise exception 'gift card amount must be more than 0 and at most the total' using errcode = '22023';
    end if;
    perform public.gift_card_redeem(v_gift_code, v_gift_fils, v_order.id);
    perform public.settle_if_paid(v_order.id);
  end if;

  perform public.write_audit('order.created', 'orders', v_order.id::text, null,
    jsonb_build_object('number', v_order.number, 'channel', 'website', 'total_fils', v_order.total_fils,
                       'coupon_code', v_code, 'discount_fils', v_discount,
                       'delivery_discount_fils', v_delivery_discount, 'gift_card_fils', v_gift_fils,
                       'points', v_points));
  return query select v_order.id, v_order.number, v_order.total_fils, false;
end;
$$;

create or replace function public.coupon_evaluate(p_code text, p_lines jsonb, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.coupons;
  v_subtotal int := 0;
  v_eligible int := 0;
  v_discount int;
begin
  select * into c from coupons where code = upper(trim(p_code));
  if not found or not c.active then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if c.starts_at is not null and c.starts_at > now() then
    return jsonb_build_object('ok', false, 'reason', 'not_started');
  end if;
  if c.ends_at is not null and c.ends_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  select coalesce(sum(public.line_unit_price_fils(v.id, l -> 'options', nullif(l ->> 'giveaway_id', '')::uuid)
                      * (l ->> 'qty')::int), 0),
         coalesce(sum(public.line_unit_price_fils(v.id, l -> 'options', nullif(l ->> 'giveaway_id', '')::uuid)
                      * (l ->> 'qty')::int)
                    filter (where public.coupon_covers(c, p.id, p.category_id)), 0)
    into v_subtotal, v_eligible
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
    join product_variants v on v.id = (l ->> 'variant_id')::uuid
    join products p on p.id = v.product_id;

  if c.min_order_fils is not null and v_subtotal < c.min_order_fils then
    return jsonb_build_object('ok', false, 'reason', 'min_order', 'min_order_fils', c.min_order_fils);
  end if;
  if v_eligible = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_eligible_items');
  end if;
  if c.max_uses is not null and public.coupon_uses(c.id) >= c.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'used_up');
  end if;
  if coalesce(c.per_customer_limit, case when c.once_per_customer then 1 end) is not null
     and p_email is not null
     and public.coupon_uses(c.id, p_email)
         >= coalesce(c.per_customer_limit, case when c.once_per_customer then 1 end) then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;

  v_discount := case c.kind
    when 'percent' then (v_eligible::bigint * c.percent_bp + 5000) / 10000
    when 'fixed' then least(c.amount_fils, v_eligible)
    else 0
  end;
  return jsonb_build_object(
    'ok', true, 'coupon_id', c.id, 'code', c.code, 'kind', c.kind, 'discount_fils', v_discount,
    'eligible_fils', v_eligible, 'subtotal_fils', v_subtotal,
    'free_delivery', c.kind = 'free_delivery'
  );
end;
$$;

create or replace function public.cart_sync(p_user uuid, p_email text, p_name text, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lines jsonb;
  v_count int;
  v_value int;
  v_id uuid;
begin
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                              'variant_id', v.id, 'qty', (l ->> 'qty')::int, 'options', l -> 'options',
                              'giveaway_id', nullif(l ->> 'giveaway_id', '')))
                            order by o), '[]'::jsonb),
         coalesce(sum((l ->> 'qty')::int), 0),
         coalesce(sum(public.line_unit_price_fils(v.id, l -> 'options', nullif(l ->> 'giveaway_id', '')::uuid)
                      * (l ->> 'qty')::int), 0)
    into v_lines, v_count, v_value
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as x(l, o)
    join product_variants v on v.id = (l ->> 'variant_id')::uuid
   where (l ->> 'qty')::int between 1 and 1000;

  select id into v_id from carts where user_id = p_user and status = 'open' for update;

  if v_count = 0 then
    if v_id is not null then
      update carts set status = 'emptied', lines = '[]', item_count = 0, value_fils = 0,
                       closed_at = now(), updated_at = now()
       where id = v_id;
    end if;
    return null;
  end if;

  if v_id is null then
    insert into carts (user_id, email, name, lines, item_count, value_fils)
    values (p_user, lower(p_email), nullif(trim(p_name), ''), v_lines, v_count, v_value)
    returning id into v_id;
  else
    update carts set lines = v_lines, item_count = v_count, value_fils = v_value,
                     email = lower(p_email), name = coalesce(nullif(trim(p_name), ''), name),
                     updated_at = now()
     where id = v_id and lines is distinct from v_lines;
  end if;
  return v_id;
end;
$$;

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
  v_pay jsonb;
  v_variant record;
  v_line_id uuid;
  v_subtotal int := 0;
  v_vat int;
  v_total int;
  v_paid int := 0;
  v_sold_at timestamptz := least(coalesce((p ->> 'sold_at')::timestamptz, now()), now());
  v_giveaway uuid;
  v_opts jsonb;
  v_unit int;
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

  -- Phone and/or email (both optional): finds the customer or creates one; fills a missing email
  -- or phone on an existing customer. Email is what links the sale to their online Passport.
  if v_customer is null and (nullif(trim(p ->> 'customer_phone'), '') is not null
                             or nullif(trim(p ->> 'customer_email'), '') is not null) then
    v_customer := public.upsert_customer(p ->> 'customer_phone', p ->> 'customer_email',
                                         p ->> 'customer_name', 'pos');
  end if;

  select * into v_settings from settings where id = 1;

  insert into orders (customer_id, channel, event_id, event_day, staff_id, status, fulfilment,
                      contact_name, contact_phone, contact_email, vat_rate_bp, prices_include_vat, client_uuid, placed_at)
  select v_customer, 'pos', v_event.id, public.business_day(v_sold_at), auth.uid(), 'completed', 'handed_over',
         c.name, c.phone, c.email, v_settings.vat_rate_bp, v_settings.prices_include_vat,
         (p ->> 'client_uuid')::uuid, v_sold_at
    from (select null::text as name, null::text as phone) d
    left join customers c on c.id = v_customer
  returning * into v_order;

  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    if coalesce((v_line ->> 'qty')::int, 0) < 1 then
      raise exception 'quantity must be at least 1' using errcode = '22023';
    end if;
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
    v_unit := public.line_unit_price_fils(v_variant.id, v_line -> 'options', v_giveaway);

    insert into order_lines (order_id, variant_id, product_name, variant_label, sku, category_id, destination_id,
                             qty, list_price_fils, unit_price_fils, line_total_fils, options, giveaway_product_id)
    values (v_order.id, v_variant.id, v_variant.product_name, v_variant.label, v_variant.sku,
            v_variant.category_id, v_variant.destination_id, (v_line ->> 'qty')::int,
            v_unit, v_unit, v_unit * (v_line ->> 'qty')::int, v_opts -> 'snapshot', v_giveaway)
    returning id into v_line_id;
    insert into order_line_costs (order_line_id, unit_cost_fils) values (v_line_id, v_variant.cost_fils);
    insert into stock_movements (variant_id, location_id, qty, type, reason, order_line_id, event_id, created_by, created_at)
    values (v_variant.id, v_location, -(v_line ->> 'qty')::int, 'sale', 'POS ' || v_order.number,
            v_line_id, v_event.id, auth.uid(), v_sold_at);
    v_subtotal := v_subtotal + v_unit * (v_line ->> 'qty')::int;
  end loop;
  for r in select * from public.order_min_qty_shortfalls(v_order.id) loop
    raise exception '% comes in at least % pieces', r.name, r.min_order_qty using errcode = 'P0001';
  end loop;

  if v_settings.prices_include_vat then
    v_total := v_subtotal;
    v_vat := case when v_settings.vat_rate_bp > 0
                  then floor((v_total::bigint * v_settings.vat_rate_bp * 2 + (10000 + v_settings.vat_rate_bp))
                             / (2 * (10000 + v_settings.vat_rate_bp)))::int else 0 end;
  else
    v_vat := floor((v_subtotal::bigint * v_settings.vat_rate_bp * 2 + 10000) / 20000)::int;
    v_total := v_subtotal + v_vat;
  end if;
  update orders set subtotal_fils = v_subtotal, vat_fils = v_vat, total_fils = v_total where id = v_order.id;

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

create or replace function public.create_manual_order(p jsonb)
returns table (order_id uuid, order_number text, total_fils int, outstanding_fils int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_existing public.orders;
  v_customer public.customers;
  v_settings public.settings;
  v_line jsonb;
  v_pay jsonb;
  v_variant record;
  v_line_id uuid;
  v_price int;
  v_subtotal int := 0;
  v_delivery int := coalesce((p ->> 'delivery_fee_fils')::int, 0);
  v_total int;
  v_vat int;
  v_location uuid := nullif(p ->> 'location_id', '')::uuid;
  v_channel public.order_channel := coalesce((p ->> 'channel')::public.order_channel, 'whatsapp');
  v_outstanding int;
  v_giveaway uuid;
  v_opts jsonb;
  v_list int;
  r record;
begin
  perform public.require_permission('orders.create');
  if v_channel not in ('whatsapp', 'direct') then
    raise exception 'manual orders are WhatsApp or direct' using errcode = '22023';
  end if;

  select * into v_existing from orders o where o.client_uuid = (p ->> 'client_uuid')::uuid;
  if found then
    select s.outstanding_fils into v_outstanding from order_payment_summary s where s.order_id = v_existing.id;
    return query select v_existing.id, v_existing.number, v_existing.total_fils, v_outstanding;
    return;
  end if;

  select * into v_customer from customers where id = (p ->> 'customer_id')::uuid;
  if not found then raise exception 'choose a customer' using errcode = '22023'; end if;
  if jsonb_array_length(coalesce(p -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'add at least one product' using errcode = '22023';
  end if;
  if v_delivery < 0 then raise exception 'delivery fee can''t be negative' using errcode = '22023'; end if;
  select * into v_settings from settings where id = 1;

  insert into orders (customer_id, channel, staff_id, status, fulfilment, contact_name, contact_phone,
                      contact_email, delivery_address, delivery_emirate, delivery_fee_fils,
                      vat_rate_bp, prices_include_vat, notes, client_uuid)
  values (v_customer.id, v_channel, auth.uid(), 'new',
          coalesce((p ->> 'fulfilment')::public.fulfilment_type, 'handed_over'),
          v_customer.name, v_customer.phone, v_customer.email,
          p -> 'delivery_address', nullif(p ->> 'delivery_emirate', '')::public.emirate, v_delivery,
          v_settings.vat_rate_bp, v_settings.prices_include_vat, nullif(trim(p ->> 'notes'), ''),
          (p ->> 'client_uuid')::uuid)
  returning * into v_order;

  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    select v.id, v.sku, v.label, v.price_fils, pr.name as product_name, pr.category_id, pr.destination_id,
           coalesce(c.cost_fils, 0) as cost_fils
      into v_variant
      from product_variants v join products pr on pr.id = v.product_id
      left join variant_costs c on c.variant_id = v.id
     where v.id = (v_line ->> 'variant_id')::uuid;
    if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
    if coalesce((v_line ->> 'qty')::int, 0) < 1 then raise exception 'quantity must be at least 1' using errcode = '22023'; end if;

    -- Giveaway choices: checked and priced here (the list price), snapshotted on the line.
    v_giveaway := nullif(v_line ->> 'giveaway_id', '')::uuid;
    v_opts := public.line_options_check(v_variant.id, v_line -> 'options', v_giveaway);
    if not (v_opts ->> 'ok')::boolean then
      raise exception '%', v_opts ->> 'error' using errcode = '22023';
    end if;
    v_list := public.line_unit_price_fils(v_variant.id, v_line -> 'options', v_giveaway);

    v_price := coalesce((v_line ->> 'unit_price_fils')::int, v_list);
    if v_price < 0 then raise exception 'price can''t be negative' using errcode = '22023'; end if;
    if v_price <> v_list then
      perform public.require_permission('orders.price_override');
      if length(trim(coalesce(v_line ->> 'override_reason', ''))) < 3 then
        raise exception 'give a reason for the price change on %', v_variant.product_name using errcode = '22023';
      end if;
    end if;

    insert into order_lines (order_id, variant_id, product_name, variant_label, sku, category_id, destination_id,
                             qty, list_price_fils, unit_price_fils, price_override_reason, line_total_fils,
                             options, giveaway_product_id)
    values (v_order.id, v_variant.id, v_variant.product_name, v_variant.label, v_variant.sku,
            v_variant.category_id, v_variant.destination_id, (v_line ->> 'qty')::int, v_list,
            v_price, case when v_price <> v_list then trim(v_line ->> 'override_reason') end,
            v_price * (v_line ->> 'qty')::int, v_opts -> 'snapshot', v_giveaway)
    returning id into v_line_id;
    insert into order_line_costs (order_line_id, unit_cost_fils) values (v_line_id, v_variant.cost_fils);
    v_subtotal := v_subtotal + v_price * (v_line ->> 'qty')::int;
  end loop;
  for r in select * from public.order_min_qty_shortfalls(v_order.id) loop
    raise exception '% comes in at least % pieces', r.name, r.min_order_qty using errcode = '22023';
  end loop;

  if v_settings.prices_include_vat then
    v_total := v_subtotal + v_delivery;
    v_vat := case when v_settings.vat_rate_bp > 0
                  then floor((v_total::bigint * v_settings.vat_rate_bp * 2 + (10000 + v_settings.vat_rate_bp))
                             / (2 * (10000 + v_settings.vat_rate_bp)))::int else 0 end;
  else
    v_vat := floor(((v_subtotal + v_delivery)::bigint * v_settings.vat_rate_bp * 2 + 10000) / 20000)::int;
    v_total := v_subtotal + v_delivery + v_vat;
  end if;
  update orders set subtotal_fils = v_subtotal, vat_fils = v_vat, total_fils = v_total where id = v_order.id;

  -- Stock leaves now (the sale is agreed); a later cancellation returns it.
  if v_location is not null then
    insert into stock_movements (variant_id, location_id, qty, type, reason, order_line_id, event_id, created_by)
    select l.variant_id, v_location, -l.qty, 'sale', 'Order ' || v_order.number, l.id,
           (select event_id from stock_locations where id = v_location), auth.uid()
      from order_lines l where l.order_id = v_order.id;
  else
    perform public.apply_order_stock(v_order.id);
  end if;

  for v_pay in select * from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) loop
    if coalesce((v_pay ->> 'amount_fils')::int, 0) > 0 then
      perform public.require_permission('payments.record');
      insert into payments (order_id, kind, amount_fils, method, status, reference, received_by, received_at)
      values (v_order.id, 'payment', (v_pay ->> 'amount_fils')::int, (v_pay ->> 'method')::public.payment_method,
              'succeeded', nullif(trim(v_pay ->> 'reference'), ''), auth.uid(), now());
    end if;
  end loop;

  select s.outstanding_fils into v_outstanding from order_payment_summary s where s.order_id = v_order.id;
  if v_outstanding < 0 then
    raise exception 'payments are more than the order total' using errcode = 'P0001';
  end if;
  perform public.settle_if_paid(v_order.id);

  perform public.write_audit('order.created', 'orders', v_order.id::text, null,
    jsonb_build_object('number', v_order.number, 'channel', v_channel, 'total_fils', v_total));
  return query select v_order.id, v_order.number, v_total, v_outstanding;
end;
$$;
