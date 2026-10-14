-- Manual (WhatsApp / direct) orders, payment links and a single "fully paid" path.

-- ---------------------------------------------------------------------------
-- One idempotent settlement step for every payment route (webhook, manual, link).
-- `paid_at` is set exactly once, when the outstanding balance first reaches zero, and is
-- what triggers after_order_paid (stock for website orders; loyalty later).
-- ---------------------------------------------------------------------------
alter table public.orders add column paid_at timestamptz;

update public.orders o set paid_at = coalesce(o.placed_at, o.created_at)
 where o.status <> 'pending_payment'
   and exists (select 1 from public.order_payment_summary s where s.order_id = o.id and s.outstanding_fils <= 0);

create or replace function public.settle_if_paid(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_outstanding int;
begin
  select * into v_order from orders where id = p_order_id for update;
  if v_order.paid_at is not null or v_order.status = 'cancelled' then
    return false;
  end if;
  select s.outstanding_fils into v_outstanding from order_payment_summary s where s.order_id = p_order_id;
  if v_outstanding > 0 then
    return false;
  end if;
  update orders set
    paid_at = now(),
    status = case when status = 'pending_payment' then 'new'::public.order_status else status end,
    placed_at = case when status = 'pending_payment' then now() else placed_at end
  where id = p_order_id;
  perform public.after_order_paid(p_order_id);
  perform public.write_audit('order.paid', 'orders', p_order_id::text, null,
    jsonb_build_object('number', v_order.number));
  return true;
end;
$$;

-- Webhook confirmation now settles through settle_if_paid and closes the matching payment link.
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
  v_newly boolean;
begin
  select * into v_payment from payments
   where provider = p_provider and provider_ref = p_provider_ref
   for update;
  if not found then
    raise exception 'unknown payment %', p_provider_ref using errcode = 'P0002';
  end if;
  select * into v_order from orders where id = v_payment.order_id;

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

  update payment_links set status = 'paid' where provider = p_provider and provider_id = p_provider_ref;

  v_newly := public.settle_if_paid(v_order.id);
  if not v_newly then
    perform public.write_audit('payment.received', 'payments', v_payment.id::text, null,
      jsonb_build_object('order', v_order.number, 'amount_fils', p_amount_fils));
  end if;
  return query select v_order.id, v_order.number, v_newly, false;
end;
$$;

-- Manual payment recording settles through the same path.
create or replace function public.record_payment(
  p_order_id uuid,
  p_amount_fils int,
  p_method public.payment_method,
  p_reference text default null,
  p_note text default null
)
returns table (payment_id uuid, newly_paid boolean, outstanding_fils int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment_id uuid;
  v_outstanding int;
begin
  perform public.require_permission('payments.record');
  if p_amount_fils is null or p_amount_fils <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;
  select * into v_order from orders where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_order.status = 'cancelled' then raise exception 'order is cancelled' using errcode = 'P0001'; end if;

  select s.outstanding_fils into v_outstanding from order_payment_summary s where s.order_id = p_order_id;
  if p_amount_fils > v_outstanding then
    raise exception 'amount is more than the outstanding %', v_outstanding using errcode = 'P0001';
  end if;

  insert into payments (order_id, kind, amount_fils, method, status, reference, note, received_by, received_at)
  values (p_order_id, 'payment', p_amount_fils, p_method, 'succeeded', nullif(trim(p_reference), ''),
          nullif(trim(p_note), ''), auth.uid(), now())
  returning id into v_payment_id;

  return query select v_payment_id, public.settle_if_paid(p_order_id), v_outstanding - p_amount_fils;
end;
$$;

-- ---------------------------------------------------------------------------
-- Manual order (WhatsApp / direct). Staff-confirmed: stock is deducted immediately
-- (from p.location_id or the default online location); payment may come now, partly or later.
-- p: { client_uuid, channel, customer_id, fulfilment, delivery_address, delivery_emirate,
--      delivery_fee_fils, notes, location_id,
--      lines: [{ variant_id, qty, unit_price_fils, override_reason }],
--      payments: [{ method, amount_fils, reference }] }
-- ---------------------------------------------------------------------------
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

    v_price := coalesce((v_line ->> 'unit_price_fils')::int, v_variant.price_fils);
    if v_price < 0 then raise exception 'price can''t be negative' using errcode = '22023'; end if;
    if v_price <> v_variant.price_fils then
      perform public.require_permission('orders.price_override');
      if length(trim(coalesce(v_line ->> 'override_reason', ''))) < 3 then
        raise exception 'give a reason for the price change on %', v_variant.product_name using errcode = '22023';
      end if;
    end if;

    insert into order_lines (order_id, variant_id, product_name, variant_label, sku, category_id, destination_id,
                             qty, list_price_fils, unit_price_fils, price_override_reason, line_total_fils)
    values (v_order.id, v_variant.id, v_variant.product_name, v_variant.label, v_variant.sku,
            v_variant.category_id, v_variant.destination_id, (v_line ->> 'qty')::int, v_variant.price_fils,
            v_price, case when v_price <> v_variant.price_fils then trim(v_line ->> 'override_reason') end,
            v_price * (v_line ->> 'qty')::int)
    returning id into v_line_id;
    insert into order_line_costs (order_line_id, unit_cost_fils) values (v_line_id, v_variant.cost_fils);
    v_subtotal := v_subtotal + v_price * (v_line ->> 'qty')::int;
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

revoke execute on function public.settle_if_paid(uuid) from public, anon, authenticated;
revoke execute on function public.create_manual_order(jsonb) from public, anon;
grant execute on function public.create_manual_order(jsonb) to authenticated;

-- Staff can create payment links (inserted by trusted server code after a permission check).
create policy "payment_links.create writes links" on public.payment_links
  for insert to authenticated with check (public.has_permission('payment_links.create'));

insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort) values
('payment_reminder', 'customer', 'Payment reminder', 'Friendly reminder with a payment link for an outstanding balance.',
 'A gentle reminder for order {{order_number}}',
 E'Dear {{customer_name}},\n\nA little reminder that **{{outstanding}}** is still due on your Solei order {{order_number}}. You can pay securely here:\n\n[Pay {{outstanding}}]({{payment_link}})\n\nThank you,\nSolei',
 array['customer_name','order_number','outstanding','payment_link'], 35)
on conflict (key) do nothing;
