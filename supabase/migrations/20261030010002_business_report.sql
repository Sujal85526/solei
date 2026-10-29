-- Phase 2 reports: the business-wide report (Admin → Reports → Business) for any Asia/Dubai date
-- range of up to 366 days. One read-only SECURITY DEFINER function, same pattern as
-- event_report_data(): facts at order / line / payment grain, rolled up by
-- src/modules/reports/business.ts with the event-report rules (src/modules/reports/aggregate.ts):
--
--   · business day of an order = event_day (POS) else placed_at in Asia/Dubai
--   · counted orders: not cancelled and not an unpaid website checkout (pending_payment)
--   · refunds belong to the order (and so to its day), profit is ex VAT
--
-- Needs reports.view. Without reports.financial.view every cost figure is null / empty: line
-- costs, variant costs, event fees and expenses, business expenses.
--
-- p_detail = false (used for the previous-period comparison and the dashboard) leaves out the
-- slow parts: customers, the month-by-month series and the stock list.

create or replace function public.business_report_data(p_from date, p_to date, p_detail boolean default true)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fin boolean;
  v_year int;
  v_orders jsonb;
  v_counted uuid[];
  v_result jsonb;
begin
  perform public.require_permission('reports.view');
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid date range' using errcode = '22023';
  end if;
  if p_to - p_from > 366 then
    raise exception 'a report covers at most 366 days' using errcode = '22023';
  end if;
  v_fin := public.has_permission('reports.financial.view');
  v_year := extract(year from p_to)::int;

  -- Orders of the range (every status: the order report counts cancelled / pending too).
  -- placed_at is pre-filtered with two days of slack each side so the index is used; event_day
  -- can differ from placed_at around midnight.
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'day', x.day, 'status', x.status, 'channel', x.channel,
      'total_fils', x.total_fils, 'vat_fils', x.vat_fils, 'discount_fils', x.discount_fils,
      'customer_id', x.customer_id, 'event_id', x.event_id
    ) order by x.day, x.placed_at), '[]'::jsonb),
    coalesce(array_agg(x.id) filter (where x.status not in ('cancelled', 'pending_payment')), '{}')
  into v_orders, v_counted
  from (
    select o.*, coalesce(o.event_day, public.business_day(o.placed_at)) as day
    from orders o
    where o.placed_at >= (p_from - 2)::timestamptz and o.placed_at < (p_to + 3)::timestamptz
  ) x
  where x.day between p_from and p_to;

  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'financial', v_fin,
    'orders', v_orders,
    -- Lines of counted orders. Cost = the snapshot taken at sale, else today's variant cost.
    'lines', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'order_id', l.order_id,
          'variant_id', l.variant_id,
          'product_name', l.product_name,
          'variant_label', l.variant_label,
          'sku', l.sku,
          'category_id', l.category_id,
          'category_slug', c.slug,
          'category_name', c.name,
          'destination_id', l.destination_id,
          'destination_name', d.name,
          'qty', l.qty,
          'line_total_fils', l.line_total_fils,
          'is_reward', l.is_reward,
          'unit_cost_fils', case when v_fin then coalesce(lc.unit_cost_fils, vc.cost_fils) end
        ) order by l.created_at), '[]'::jsonb)
      from order_lines l
      left join categories c on c.id = l.category_id
      left join destinations d on d.id = l.destination_id
      left join order_line_costs lc on lc.order_line_id = l.id
      left join variant_costs vc on vc.variant_id = l.variant_id
      where l.order_id = any (v_counted)
    ),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'order_id', p.order_id, 'kind', p.kind, 'method', p.method, 'amount_fils', p.amount_fils
        ) order by p.created_at), '[]'::jsonb)
      from payments p
      where p.order_id = any (v_counted) and p.status = 'succeeded'
    ),
    -- Events count in the range they start in: their fee (unless waived) and all their expenses,
    -- so the figures match each event's own report.
    'events', case when v_fin then (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', e.id, 'name', e.name, 'start_date', e.start_date,
          'fee_fils', case when e.fee_payment_status = 'waived' then 0
                           else coalesce(e.participation_fee_fils, 0) end,
          'expenses_fils', coalesce((select sum(x.amount_fils) from event_expenses x where x.event_id = e.id), 0)
        ) order by e.start_date, e.name), '[]'::jsonb)
      from events e
      where e.start_date between p_from and p_to and e.status <> 'cancelled'
    ) else '[]'::jsonb end,
    'expenses', case when v_fin then (
      select coalesce(jsonb_agg(jsonb_build_object(
          'category', x.name, 'amount_fils', x.amount, 'count', x.n
        ) order by x.amount desc, x.name), '[]'::jsonb)
      from (
        select c.name, sum(be.amount_fils)::bigint as amount, count(*)::int as n
        from business_expenses be
        join business_expense_categories c on c.id = be.category_id
        where be.spent_on between p_from and p_to
        group by c.name
      ) x
    ) else '[]'::jsonb end,
    -- Customers who bought in the range: first counted order ever and lifetime counted orders.
    'customers', case when p_detail then (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', cu.id, 'name', cu.name, 'first_day', h.first_day, 'lifetime_orders', h.orders
        ) order by cu.name), '[]'::jsonb)
      from customers cu
      join lateral (
        select min(coalesce(o.event_day, public.business_day(o.placed_at))) as first_day,
          count(*)::int as orders
        from orders o
        where o.customer_id = cu.id and o.status not in ('cancelled', 'pending_payment')
      ) h on true
      where cu.id in (select o.customer_id from orders o where o.id = any (v_counted))
    ) else '[]'::jsonb end,
    -- Month by month for the year of p_to and the year before (growth and seasonality).
    'months', case when p_detail then (
      select coalesce(jsonb_agg(jsonb_build_object(
          'month', to_char(m.month, 'YYYY-MM'), 'orders', m.orders, 'revenue_fils', m.revenue
        ) order by m.month), '[]'::jsonb)
      from (
        select date_trunc('month', y.day)::date as month, count(*)::int as orders,
          sum(greatest(y.total_fils - coalesce(r.refunded, 0), 0))::bigint as revenue
        from (
          select o.id, o.total_fils, coalesce(o.event_day, public.business_day(o.placed_at)) as day
          from orders o
          where o.status not in ('cancelled', 'pending_payment')
            and o.placed_at >= make_date(v_year - 1, 1, 1)::timestamptz - interval '2 days'
            and o.placed_at < make_date(v_year + 1, 1, 1)::timestamptz + interval '2 days'
        ) y
        left join lateral (
          select sum(p.amount_fils) as refunded from payments p
          where p.order_id = y.id and p.kind = 'refund' and p.status = 'succeeded'
        ) r on true
        where y.day >= make_date(v_year - 1, 1, 1) and y.day < make_date(v_year + 1, 1, 1)
        group by 1
      ) m
    ) else '[]'::jsonb end,
    -- Every active variant (and any inactive one still holding stock): on hand at every location,
    -- unit cost (financial only) and the last day it sold on any channel.
    'stock', case when p_detail then (
      select coalesce(jsonb_agg(jsonb_build_object(
          'variant_id', v.id,
          'product_name', pr.name,
          'variant_label', v.label,
          'sku', v.sku,
          'category_name', c.name,
          'active', v.active and pr.active,
          'on_hand', coalesce(s.on_hand, 0),
          'cost_fils', case when v_fin then coalesce(vc.cost_fils, 0) end,
          'last_sold_day', ls.day
        ) order by pr.sort, pr.name, v.sort), '[]'::jsonb)
      from product_variants v
      join products pr on pr.id = v.product_id
      left join categories c on c.id = pr.category_id
      left join variant_costs vc on vc.variant_id = v.id
      left join lateral (
        select sum(m.qty)::int as on_hand from stock_movements m where m.variant_id = v.id
      ) s on true
      left join lateral (
        select max(coalesce(o.event_day, public.business_day(o.placed_at))) as day
        from order_lines l join orders o on o.id = l.order_id
        where l.variant_id = v.id and o.status not in ('cancelled', 'pending_payment')
      ) ls on true
      where (v.active and pr.active) or coalesce(s.on_hand, 0) <> 0
    ) else '[]'::jsonb end
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.business_report_data(date, date, boolean) from public, anon;
grant execute on function public.business_report_data(date, date, boolean) to authenticated;
