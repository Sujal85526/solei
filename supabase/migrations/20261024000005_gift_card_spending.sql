-- Phase 2 gift cards, part 2: spend a card at website checkout (create_web_order) and at the till
-- (pos_complete_sale, method gift_card with the code as reference), and keep gift card purchase
-- orders out of dashboard revenue. Each function is the previous definition plus the gift card
-- steps (create_web_order from 20261024000002, pos_complete_sale from 20261019000004,
-- dashboard_summary from 20261014600001).

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
    if v_variant.price_fils <> (v_line ->> 'unit_price_fils')::int then
      raise exception 'prices changed — please review your cart' using errcode = 'P0001';
    end if;

    insert into order_lines (order_id, variant_id, product_name, variant_label, sku, category_id, destination_id,
                             qty, list_price_fils, unit_price_fils, line_total_fils)
    values (v_order.id, v_variant.id, v_variant.product_name, v_variant.label, v_variant.sku,
            v_variant.category_id, v_variant.destination_id, (v_line ->> 'qty')::int,
            v_variant.price_fils, v_variant.price_fils, v_variant.price_fils * (v_line ->> 'qty')::int)
    returning id into v_line_id;

    insert into order_line_costs (order_line_id, unit_cost_fils) values (v_line_id, v_variant.cost_fils);
    v_subtotal := v_subtotal + v_variant.price_fils * (v_line ->> 'qty')::int;
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

  -- Gift card: spent in the same transaction; settles the order at once when it covers it all.
  if v_gift_code is not null then
    if v_gift_fils <= 0 or v_gift_fils > v_order.total_fils then
      raise exception 'gift card amount must be more than 0 and at most the total' using errcode = '22023';
    end if;
    perform public.gift_card_redeem(v_gift_code, v_gift_fils, v_order.id);
    perform public.settle_if_paid(v_order.id);
  end if;

  perform public.write_audit('order.created', 'orders', v_order.id::text, null,
    jsonb_build_object('number', v_order.number, 'channel', 'website', 'total_fils', v_order.total_fils,
                       'coupon_code', v_code, 'discount_fils', v_discount,
                       'delivery_discount_fils', v_delivery_discount, 'gift_card_fils', v_gift_fils));
  return query select v_order.id, v_order.number, v_order.total_fils, false;
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

    insert into order_lines (order_id, variant_id, product_name, variant_label, sku, category_id, destination_id,
                             qty, list_price_fils, unit_price_fils, line_total_fils)
    values (v_order.id, v_variant.id, v_variant.product_name, v_variant.label, v_variant.sku,
            v_variant.category_id, v_variant.destination_id, (v_line ->> 'qty')::int,
            v_variant.price_fils, v_variant.price_fils, v_variant.price_fils * (v_line ->> 'qty')::int)
    returning id into v_line_id;
    insert into order_line_costs (order_line_id, unit_cost_fils) values (v_line_id, v_variant.cost_fils);
    insert into stock_movements (variant_id, location_id, qty, type, reason, order_line_id, event_id, created_by, created_at)
    values (v_variant.id, v_location, -(v_line ->> 'qty')::int, 'sale', 'POS ' || v_order.number,
            v_line_id, v_event.id, auth.uid(), v_sold_at);
    v_subtotal := v_subtotal + v_variant.price_fils * (v_line ->> 'qty')::int;
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

create or replace function public.dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := public.business_day(now());
  v_week date := v_today - (extract(isodow from v_today)::int - 1);
  v_month date := date_trunc('month', v_today)::date;
  v_money boolean := public.has_permission('reports.view');
  v_result jsonb;
begin
  if not public.has_permission('dashboard.view') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with counted as (
    select o.id, o.channel, o.total_fils, public.business_day(o.placed_at) as day
    from orders o
    where o.status not in ('cancelled', 'pending_payment') and not o.gift_card_purchase
      and o.placed_at >= (v_month - interval '1 month' - interval '1 day')
  ),
  refunds as (
    select p.amount_fils, public.business_day(coalesce(p.received_at, p.created_at)) as day
    from payments p
    where p.kind = 'refund' and p.status = 'succeeded'
      and coalesce(p.received_at, p.created_at) >= (v_month - interval '1 month' - interval '1 day')
  ),
  periods (key, from_day, to_day, prev_from, prev_to) as (
    values
      ('today', v_today, v_today, v_today - 1, v_today - 1),
      ('week', v_week, v_today, v_week - 7, v_today - 7),
      ('month', v_month, v_today, (v_month - interval '1 month')::date,
        least((v_month - interval '1 month')::date + (v_today - v_month), v_month - 1))
  ),
  period_figures as (
    select per.key,
      (select count(*) from counted c where c.day between per.from_day and per.to_day) as orders,
      (select coalesce(sum(c.total_fils), 0) from counted c where c.day between per.from_day and per.to_day)
        - (select coalesce(sum(r.amount_fils), 0) from refunds r where r.day between per.from_day and per.to_day)
        as revenue,
      (select count(*) from counted c where c.day between per.prev_from and per.prev_to) as prev_orders,
      (select coalesce(sum(c.total_fils), 0) from counted c where c.day between per.prev_from and per.prev_to)
        - (select coalesce(sum(r.amount_fils), 0) from refunds r where r.day between per.prev_from and per.prev_to)
        as prev_revenue
    from periods per
  )
  select jsonb_build_object(
    'today', v_today,
    'week_start', v_week,
    'month_start', v_month,
    'money', v_money,
    'periods', (
      select jsonb_object_agg(f.key, jsonb_build_object(
        'orders', f.orders,
        'prev_orders', f.prev_orders,
        'revenue_fils', case when v_money then f.revenue end,
        'prev_revenue_fils', case when v_money then f.prev_revenue end
      ))
      from period_figures f
    ),
    'by_channel', case when v_money then coalesce((
      select jsonb_agg(jsonb_build_object('channel', x.channel, 'orders', x.orders, 'revenue_fils', x.revenue)
                       order by x.revenue desc)
      from (
        select c.channel, count(*) as orders, sum(c.total_fils)::int as revenue
        from counted c where c.day >= v_month group by c.channel
      ) x
    ), '[]'::jsonb) end,
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product', x.product_name, 'units', x.units,
               'revenue_fils', case when v_money then x.revenue end)
             order by x.units desc, x.revenue desc)
      from (
        select l.product_name, sum(l.qty)::int as units, sum(l.line_total_fils)::int as revenue
        from order_lines l join counted c on c.id = l.order_id
        where c.day >= v_month and not l.is_reward
        group by l.product_name
        order by units desc, revenue desc
        limit 5
      ) x
    ), '[]'::jsonb),
    'outstanding', case when v_money then (
      select jsonb_build_object('orders', count(*), 'total_fils', coalesce(sum(s.outstanding_fils), 0))
      from order_payment_summary s join orders o on o.id = s.order_id
      where o.status not in ('cancelled', 'pending_payment') and s.outstanding_fils > 0
    ) end,
    'to_handle', (
      select jsonb_build_object(
        'new', count(*) filter (where o.status = 'new'),
        'preparing', count(*) filter (where o.status = 'preparing'),
        'dispatched', count(*) filter (where o.status = 'dispatched'))
      from orders o where o.status in ('new', 'preparing', 'dispatched')
    ),
    'low_stock', case when public.has_permission('inventory.view') then coalesce((
      select jsonb_agg(jsonb_build_object(
               'sku', a.sku, 'product', a.product_name, 'variant', a.variant_label,
               'on_hand', a.on_hand, 'threshold', a.threshold)
             order by a.on_hand, a.product_name)
      from (
        select * from public.variant_stock_alerts(array(select v.id from product_variants v where v.active))
        where is_low
        order by on_hand, product_name
        limit 8
      ) a
    ), '[]'::jsonb) end,
    'upcoming_events', case when public.has_permission('events.view') then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'name', e.name, 'status', e.status, 'start_date', e.start_date,
               'end_date', e.end_date, 'location', e.location)
             order by e.start_date, e.name)
      from (
        select * from events e
        where e.status in ('potential', 'confirmed') and e.end_date >= v_today
          and e.start_date <= v_today + 45
        order by e.start_date, e.name
        limit 6
      ) e
    ), '[]'::jsonb) end,
    'pending_bookings', case when public.has_permission('bookings.view') then (
      select jsonb_build_object(
        'count', (select count(*) from bookings b where b.status in ('requested', 'in_review')),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'id', b.id, 'ref', b.ref, 'name', b.contact_name, 'event_date', b.event_date,
                   'status', b.status, 'created_at', b.created_at)
                 order by b.created_at)
          from (
            select * from bookings b where b.status in ('requested', 'in_review')
            order by b.created_at limit 5
          ) b
        ), '[]'::jsonb))
    ) end
  ) into v_result;

  return v_result;
end;
$$;
