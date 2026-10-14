-- Website checkout & payment confirmation.
-- Flow: create_web_order (pending_payment) → hosted checkout → verified webhook → confirm_payment
-- → after_order_paid (stock, later loyalty). Every step is idempotent.

-- Webhook deliveries, deduplicated by provider event id.
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  type text not null,
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, event_id)
);

alter table public.payment_events enable row level security;
create policy "orders.view reads payment events" on public.payment_events
  for select to authenticated using (public.has_permission('orders.view'));

/*
  Create a website order awaiting payment. Called by trusted server code (service role) after it
  priced the cart; prices are re-checked here against the catalog so a stale cart can't underpay.
  p: {
    client_uuid, fulfilment, emirate, notes, marketing_consent,
    contact: { name, phone, email }, address: { line1, line2, area, city, emirate, notes },
    lines: [{ variant_id, qty, unit_price_fils }],
    subtotal_fils, delivery_fee_fils, vat_fils, total_fils, vat_rate_bp, prices_include_vat
  }
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
  v_line jsonb;
  v_variant record;
  v_subtotal int := 0;
  v_line_id uuid;
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

  insert into orders (
    customer_id, channel, status, fulfilment, contact_name, contact_phone, contact_email,
    delivery_address, delivery_emirate, delivery_fee_fils, subtotal_fils, discount_fils, vat_fils,
    total_fils, vat_rate_bp, prices_include_vat, notes, client_uuid
  ) values (
    v_customer, 'website', 'pending_payment',
    coalesce((p ->> 'fulfilment')::public.fulfilment_type, 'delivery'),
    p -> 'contact' ->> 'name', p -> 'contact' ->> 'phone', lower(p -> 'contact' ->> 'email'),
    p -> 'address', (p ->> 'emirate')::public.emirate,
    (p ->> 'delivery_fee_fils')::int, (p ->> 'subtotal_fils')::int, 0, (p ->> 'vat_fils')::int,
    (p ->> 'total_fils')::int, (p ->> 'vat_rate_bp')::int, (p ->> 'prices_include_vat')::boolean,
    nullif(trim(p ->> 'notes'), ''), (p ->> 'client_uuid')::uuid
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

  perform public.write_audit('order.created', 'orders', v_order.id::text, null,
    jsonb_build_object('number', v_order.number, 'channel', 'website', 'total_fils', v_order.total_fils));
  return query select v_order.id, v_order.number, v_order.total_fils, false;
end;
$$;

/*
  Stock for a paid order: one `sale` (or `reward_redemption`) movement per line, from the order's
  event location (POS) or the default online location. Runs once per order.
*/
create or replace function public.apply_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location uuid;
  v_order public.orders;
begin
  select * into v_order from orders where id = p_order_id;
  if exists (
    select 1 from stock_movements m join order_lines l on l.id = m.order_line_id where l.order_id = p_order_id
  ) then
    return;
  end if;

  if v_order.event_id is not null then
    select id into v_location from stock_locations where event_id = v_order.event_id;
  end if;
  if v_location is null then
    select id into v_location from stock_locations
     where sells_online and active order by is_default desc, created_at limit 1;
  end if;
  if v_location is null then
    raise exception 'no stock location for order %', v_order.number;
  end if;

  insert into stock_movements (variant_id, location_id, qty, type, reason, order_line_id, event_id, created_by)
  select l.variant_id, v_location, -l.qty,
         case when l.is_reward then 'reward_redemption'::public.stock_movement_type else 'sale'::public.stock_movement_type end,
         'Order ' || v_order.number, l.id, v_order.event_id, auth.uid()
    from order_lines l
   where l.order_id = p_order_id;
end;
$$;

-- Everything that happens once an order is fully paid. Loyalty (feat/loyalty-passport) extends this.
create or replace function public.after_order_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_order_stock(p_order_id);
end;
$$;

/*
  Mark a provider payment as succeeded (from a verified webhook). Idempotent: a second delivery
  of the same payment is a no-op. Returns whether this call made the order fully paid.
*/
create or replace function public.confirm_payment(
  p_provider text,
  p_provider_ref text,
  p_amount_fils int,
  p_method public.payment_method,
  p_payload jsonb default null
)
returns table (order_id uuid, order_number text, newly_paid boolean, already_processed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_outstanding int;
begin
  select * into v_payment from payments
   where provider = p_provider and provider_ref = p_provider_ref
   for update;
  if not found then
    raise exception 'unknown payment %', p_provider_ref using errcode = 'P0002';
  end if;

  select * into v_order from orders where id = v_payment.order_id for update;

  if v_payment.status = 'succeeded' then
    return query select v_order.id, v_order.number, false, true;
    return;
  end if;

  update payments set
    status = 'succeeded',
    amount_fils = coalesce(p_amount_fils, amount_fils),
    method = p_method,
    received_at = now(),
    provider_payload = coalesce(p_payload, provider_payload)
  where id = v_payment.id;

  select s.outstanding_fils into v_outstanding from order_payment_summary s where s.order_id = v_order.id;

  if v_outstanding <= 0 and v_order.status = 'pending_payment' then
    update orders set status = 'new', placed_at = now() where id = v_order.id;
    perform public.after_order_paid(v_order.id);
    perform public.write_audit('order.paid', 'orders', v_order.id::text, null,
      jsonb_build_object('number', v_order.number, 'provider_ref', p_provider_ref, 'amount_fils', p_amount_fils));
    return query select v_order.id, v_order.number, true, false;
    return;
  end if;

  perform public.write_audit('payment.received', 'payments', v_payment.id::text, null,
    jsonb_build_object('order', v_order.number, 'amount_fils', p_amount_fils, 'outstanding_fils', v_outstanding));
  return query select v_order.id, v_order.number, false, false;
end;
$$;

-- Failed / expired provider payment. The order stays unpaid so the customer can retry.
create or replace function public.fail_payment(p_provider text, p_provider_ref text, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  update payments set status = 'failed', note = left(p_reason, 200)
   where provider = p_provider and provider_ref = p_provider_ref and status = 'pending'
  returning order_id into v_order_id;
  return v_order_id;
end;
$$;

revoke execute on function public.create_web_order(jsonb) from public, anon, authenticated;
revoke execute on function public.apply_order_stock(uuid) from public, anon, authenticated;
revoke execute on function public.after_order_paid(uuid) from public, anon, authenticated;
revoke execute on function public.confirm_payment(text, text, int, public.payment_method, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_payment(text, text, text) from public, anon, authenticated;
