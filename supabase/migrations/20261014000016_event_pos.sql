-- Event POS: one idempotent RPC per sale (offline-safe) + today's running totals.

/*
  Complete a POS sale at an event.
  p: { client_uuid, event_id, sold_at (ISO, from the device; used for the business day),
       customer_id?, customer_phone?, customer_name?,
       lines: [{ variant_id, qty }],
       payments: [{ method, amount_fils, reference? }] }
  - Idempotent by client_uuid (offline queue replays are safe).
  - Prices are the current catalogue prices; payments must cover the total exactly.
  - Stock leaves the event's own location (allowed to go negative — never block a sale at a booth;
    the event close-out reconciles it).
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

  if v_customer is null and nullif(trim(p ->> 'customer_phone'), '') is not null then
    v_customer := public.upsert_customer(p ->> 'customer_phone', null, p ->> 'customer_name', 'pos');
  end if;

  select * into v_settings from settings where id = 1;

  insert into orders (customer_id, channel, event_id, event_day, staff_id, status, fulfilment,
                      contact_name, contact_phone, vat_rate_bp, prices_include_vat, client_uuid, placed_at)
  select v_customer, 'pos', v_event.id, public.business_day(v_sold_at), auth.uid(), 'completed', 'handed_over',
         c.name, c.phone, v_settings.vat_rate_bp, v_settings.prices_include_vat,
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
    if (v_pay ->> 'method') not in ('cash', 'card_terminal', 'soft_pos', 'bank_transfer', 'other') then
      raise exception 'unsupported payment method' using errcode = '22023';
    end if;
    insert into payments (order_id, kind, amount_fils, method, status, reference, received_by, received_at)
    values (v_order.id, 'payment', (v_pay ->> 'amount_fils')::int, (v_pay ->> 'method')::public.payment_method,
            'succeeded', nullif(trim(v_pay ->> 'reference'), ''), auth.uid(), v_sold_at);
    v_paid := v_paid + (v_pay ->> 'amount_fils')::int;
  end loop;
  if v_paid <> v_total then
    raise exception 'payments (%) must equal the total (%)', v_paid, v_total using errcode = 'P0001';
  end if;

  perform public.settle_if_paid(v_order.id);
  return query select v_order.id, v_order.number, v_total, false;
end;
$$;

-- Running totals for an event day (Asia/Dubai): orders, units, revenue and payment-method split.
create or replace function public.pos_day_summary(p_event_id uuid, p_day date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with o as (
    select id, total_fils from orders
     where event_id = p_event_id and channel = 'pos' and status <> 'cancelled'
       and event_day = coalesce(p_day, public.business_today())
  )
  select case when not public.has_permission('pos.use') then null else jsonb_build_object(
    'orders', (select count(*) from o),
    'units', (select coalesce(sum(l.qty), 0) from order_lines l join o on o.id = l.order_id),
    'revenue_fils', (select coalesce(sum(total_fils), 0) from o),
    'by_method', coalesce((
      select jsonb_object_agg(method, amount) from (
        select p.method::text as method, sum(p.amount_fils) as amount
          from payments p join o on o.id = p.order_id
         where p.kind = 'payment' and p.status = 'succeeded'
         group by p.method) m), '{}'::jsonb)
  ) end;
$$;

revoke execute on function public.pos_complete_sale(jsonb) from public, anon;
revoke execute on function public.pos_day_summary(uuid, date) from public, anon;
grant execute on function public.pos_complete_sale(jsonb) to authenticated;
grant execute on function public.pos_day_summary(uuid, date) to authenticated;
