-- Event POS + Passport (client 2026-10-19): the till takes the customer's email as well as the
-- phone (both optional), and staff can add a customer to a sale afterwards — the Passport stamps
-- for that purchase then go to them. Email is what links stamps to the customer's online account.

/*
  Same as before (20261014000016_event_pos.sql) plus p.customer_email; the order keeps the
  customer's email as its contact email.
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

/*
  Add (or complete) the customer on an order after the sale — e.g. a POS sale where the customer
  gave their email later. Finds or creates the customer from phone and/or email, links the order
  when it had no customer, fills a missing email / phone on its customer, and awards the Passport
  stamps for the purchase if it is paid (idempotent: lines already stamped are skipped).
  An order linked to a different customer is never moved. Returns the customer id.
*/
create or replace function public.order_attach_customer(
  p_order_id uuid, p_phone text, p_email text, p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_customer uuid;
  v_email text := nullif(lower(trim(p_email)), '');
  v_phone text := nullif(trim(p_phone), '');
begin
  perform public.require_permission('orders.update');
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_order.status = 'cancelled' then
    raise exception 'this order was cancelled' using errcode = 'P0001';
  end if;
  if v_phone is null and v_email is null then
    raise exception 'enter an email or a phone number' using errcode = '22023';
  end if;

  if v_order.customer_id is null then
    v_customer := public.upsert_customer(v_phone, v_email, p_name, 'pos');
    update orders
       set customer_id = v_customer,
           contact_name = coalesce(contact_name, (select name from customers where id = v_customer)),
           contact_phone = coalesce(contact_phone, (select phone from customers where id = v_customer)),
           contact_email = coalesce(contact_email, (select email from customers where id = v_customer))
     where id = p_order_id;
  else
    v_customer := v_order.customer_id;
    if v_phone is not null and exists (select 1 from customers where phone = v_phone and id <> v_customer) then
      raise exception 'that phone number belongs to another customer' using errcode = 'P0001';
    end if;
    update customers
       set email = coalesce(email, v_email),
           phone = coalesce(phone, v_phone),
           name = coalesce(name, nullif(trim(p_name), ''))
     where id = v_customer;
    update orders
       set contact_email = coalesce(contact_email, v_email),
           contact_phone = coalesce(contact_phone, v_phone)
     where id = p_order_id;
  end if;

  if v_order.paid_at is not null then
    perform public.loyalty_award_order(p_order_id);
  end if;
  perform public.write_audit('order.customer_attached', 'orders', p_order_id::text, null,
    jsonb_build_object('customer_id', v_customer, 'email', v_email, 'phone', v_phone));
  return v_customer;
end;
$$;
revoke execute on function public.order_attach_customer(uuid, text, text, text) from public, anon;
