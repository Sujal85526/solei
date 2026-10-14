-- Event reports (milestone 13). Two read-only SECURITY DEFINER functions:
--
--   report_event_options()          events to pick from, with how much they sold
--   event_report_data(event ids[])  per-event facts the report is rolled up from
--
-- Both need `reports.view`. Costs (line cost snapshots), expenses and the participation fee
-- are only included when the caller also has `reports.financial.view` — they come back as
-- null / empty otherwise, so a report can never leak them to a sales-only viewer.
--
-- Facts are returned at order / line / payment grain (the volume of one event is small) and
-- rolled up by `src/modules/reports/aggregate.ts`, the single place where the rules live
-- (cancelled + unpaid website checkouts excluded, refunds net off revenue, profit ex VAT).
-- Stock movements are aggregated here per Asia/Dubai day × variant × type.

-- ─── Picker ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.report_event_options()
returns table (
  id uuid,
  name text,
  type public.event_type,
  status public.event_status,
  start_date date,
  end_date date,
  location text,
  emirate public.emirate,
  order_count int,
  units int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('reports.view');
  return query
    select e.id, e.name, e.type, e.status, e.start_date, e.end_date, e.location, e.emirate,
      coalesce(s.order_count, 0)::int, coalesce(s.units, 0)::int
    from public.events e
    left join lateral (
      select count(distinct o.id) as order_count, sum(l.qty) as units
      from public.orders o
      left join public.order_lines l on l.order_id = o.id
      where o.event_id = e.id and o.status not in ('cancelled', 'pending_payment')
    ) s on true
    order by e.start_date desc, e.name;
end;
$$;

revoke execute on function public.report_event_options() from public, anon;
grant execute on function public.report_event_options() to authenticated;

-- ─── Facts ──────────────────────────────────────────────────────────────────────────────────
-- Returns a JSON array (same order as p_event_ids; unknown ids are skipped) of
-- { event, financial, orders[], lines[], payments[], stock[], expenses[] }.
--   orders       = every order of the event with its status (the TS layer decides what counts);
--                  the business day is event_day (stamped by the POS), else placed_at in Asia/Dubai
--   payments     = succeeded rows only (kind payment | refund)
--   stock.day    = Asia/Dubai date of the movement at the event's stock location
create or replace function public.event_report_data(p_event_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fin boolean;
  v_result jsonb;
begin
  perform public.require_permission('reports.view');
  if p_event_ids is null or cardinality(p_event_ids) = 0 then
    return '[]'::jsonb;
  end if;
  if cardinality(p_event_ids) > 12 then
    raise exception 'a report covers at most 12 events' using errcode = '22023';
  end if;
  v_fin := public.has_permission('reports.financial.view');

  select coalesce(jsonb_agg(x.doc order by x.ord), '[]'::jsonb) into v_result
  from (
    select array_position(p_event_ids, e.id) as ord,
      jsonb_build_object(
        'event', jsonb_build_object(
          'id', e.id,
          'name', e.name,
          'type', e.type,
          'status', e.status,
          'start_date', e.start_date,
          'end_date', e.end_date,
          'location', e.location,
          'emirate', e.emirate,
          'closed_at', e.closed_at,
          'participation_fee_fils', case when v_fin then e.participation_fee_fils end,
          'fee_payment_status', case when v_fin then e.fee_payment_status end
        ),
        'financial', v_fin,
        'orders', (
          select coalesce(jsonb_agg(jsonb_build_object(
              'id', o.id,
              'number', o.number,
              'event_day', o.event_day,
              'placed_at', o.placed_at,
              'status', o.status,
              'channel', o.channel,
              'total_fils', o.total_fils,
              'vat_fils', o.vat_fils,
              'discount_fils', o.discount_fils
            ) order by o.placed_at), '[]'::jsonb)
          from public.orders o
          where o.event_id = e.id
        ),
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
              'unit_cost_fils', case when v_fin then lc.unit_cost_fils end
            ) order by l.created_at), '[]'::jsonb)
          from public.orders o
          join public.order_lines l on l.order_id = o.id
          left join public.categories c on c.id = l.category_id
          left join public.destinations d on d.id = l.destination_id
          left join public.order_line_costs lc on lc.order_line_id = l.id
          where o.event_id = e.id
        ),
        'payments', (
          select coalesce(jsonb_agg(jsonb_build_object(
              'order_id', p.order_id,
              'kind', p.kind,
              'method', p.method,
              'amount_fils', p.amount_fils
            ) order by p.created_at), '[]'::jsonb)
          from public.orders o
          join public.payments p on p.order_id = o.id
          where o.event_id = e.id and p.status = 'succeeded'
        ),
        'stock', (
          select coalesce(jsonb_agg(jsonb_build_object(
              'day', s.day,
              'variant_id', s.variant_id,
              'product_name', pr.name,
              'variant_label', v.label,
              'sku', v.sku,
              'sort', pr.sort,
              'type', s.type,
              'qty', s.qty
            ) order by s.day, pr.sort, pr.name, v.sort, s.type), '[]'::jsonb)
          from (
            select (m.created_at at time zone 'Asia/Dubai')::date as day, m.variant_id, m.type,
              sum(m.qty)::int as qty
            from public.stock_movements m
            join public.stock_locations sl on sl.id = m.location_id
            where sl.event_id = e.id
            group by 1, 2, 3
          ) s
          join public.product_variants v on v.id = s.variant_id
          join public.products pr on pr.id = v.product_id
        ),
        'expenses', case when v_fin then (
          select coalesce(jsonb_agg(jsonb_build_object(
              'category', ex.category,
              'amount_fils', ex.amount_fils,
              'incurred_on', ex.incurred_on,
              'note', ex.note
            ) order by ex.incurred_on, ex.created_at), '[]'::jsonb)
          from public.event_expenses ex
          where ex.event_id = e.id
        ) else '[]'::jsonb end
      ) as doc
    from public.events e
    where e.id = any (p_event_ids)
  ) x;

  return v_result;
end;
$$;

revoke execute on function public.event_report_data(uuid[]) from public, anon;
grant execute on function public.event_report_data(uuid[]) to authenticated;
