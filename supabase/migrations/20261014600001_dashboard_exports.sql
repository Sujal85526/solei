-- Milestone 16: owner dashboard + exports (BUILD_PROMPT §6.13, DECISIONS T90–T92).
--
-- Revenue follows the event reports (T73): an order counts unless cancelled or still awaiting
-- website payment; refunds net off on the day they were made. Periods are Asia/Dubai: today,
-- this week (from Monday) and this month, each with the same span of the previous period.
-- Money figures are only returned with reports.view; everyone with dashboard.view gets the
-- operational part (orders to handle, low stock, upcoming events, bookings if allowed).

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
    where o.status not in ('cancelled', 'pending_payment')
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

revoke execute on function public.dashboard_summary() from public, anon;
grant execute on function public.dashboard_summary() to authenticated;

-- Exports. One jsonb document each (no PostgREST row cap); permission-checked here.

create or replace function public.export_orders(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission('orders.view') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'number', o.number,
             'placed_day', public.business_day(o.placed_at),
             'channel', o.channel,
             'status', o.status,
             'event', e.name,
             'event_day', o.event_day,
             'customer', coalesce(c.name, o.contact_name),
             'phone', coalesce(c.phone, o.contact_phone),
             'email', coalesce(c.email, o.contact_email),
             'emirate', o.delivery_emirate,
             'fulfilment', o.fulfilment,
             'units', (select coalesce(sum(l.qty), 0) from order_lines l where l.order_id = o.id),
             'subtotal_fils', o.subtotal_fils,
             'discount_fils', o.discount_fils,
             'delivery_fils', o.delivery_fee_fils,
             'vat_fils', o.vat_fils,
             'total_fils', o.total_fils,
             'paid_fils', s.paid_fils,
             'refunded_fils', s.refunded_fils,
             'outstanding_fils', s.outstanding_fils,
             'payment_status', s.payment_status)
           order by o.placed_at, o.number)
    from orders o
    join order_payment_summary s on s.order_id = o.id
    left join customers c on c.id = o.customer_id
    left join events e on e.id = o.event_id
    where public.business_day(o.placed_at) between p_from and p_to
  ), '[]'::jsonb);
end;
$$;

create or replace function public.export_payments(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission('orders.view') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'day', public.business_day(coalesce(p.received_at, p.created_at)),
             'order_number', o.number,
             'channel', o.channel,
             'kind', p.kind,
             'method', p.method,
             'status', p.status,
             'amount_fils', p.amount_fils,
             'reference', p.reference,
             'event', e.name)
           order by coalesce(p.received_at, p.created_at))
    from payments p
    join orders o on o.id = p.order_id
    left join events e on e.id = o.event_id
    where public.business_day(coalesce(p.received_at, p.created_at)) between p_from and p_to
  ), '[]'::jsonb);
end;
$$;

-- On hand per variant × location (event locations included), matching the stock matrix.
create or replace function public.export_stock_levels()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission('inventory.view') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'sku', x.sku, 'product', x.product, 'variant', x.variant, 'location', x.location,
             'location_kind', x.kind, 'on_hand', x.on_hand, 'threshold', x.threshold)
           order by x.product, x.sku, x.kind, x.location)
    from (
      select v.sku, p.name as product, v.label as variant, l.name as location, l.kind::text as kind,
        sum(m.qty)::int as on_hand,
        coalesce(v.low_stock_threshold,
                 (select ps.low_stock_default from private_settings ps where ps.id = 1), 5)::int as threshold
      from stock_movements m
      join product_variants v on v.id = m.variant_id
      join products p on p.id = v.product_id
      join stock_locations l on l.id = m.location_id
      group by v.sku, p.name, v.label, l.name, l.kind, v.low_stock_threshold
      having sum(m.qty) <> 0 or l.kind <> 'event'
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.export_orders(date, date) from public, anon;
revoke execute on function public.export_payments(date, date) from public, anon;
revoke execute on function public.export_stock_levels() from public, anon;
grant execute on function public.export_orders(date, date) to authenticated;
grant execute on function public.export_payments(date, date) to authenticated;
grant execute on function public.export_stock_levels() to authenticated;
