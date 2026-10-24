-- Phase 2 promotions engine, built on the coupons table (client 2026-10-19). Adds:
--   · a "free delivery" code (kind = free_delivery; waives the delivery fee, never the goods)
--   · a per-customer use limit (null = no limit). The old once_per_customer flag stays (the live
--     site on main still writes it) and counts as a limit of 1 when no number is set; drop it in a
--     migration after phase-2 merges (docs/PHASE2_MERGE.md).
--   · category scope next to product scope (a line qualifies when either list matches)
--   · on the order: the delivery fee a code waived + a snapshot of the applied promotion(s)
--   · a promotions report (uses, discount given, sales) for Admin → Reports.
-- Mirrors src/modules/coupons.

update public.permissions
   set description = 'Create, edit and pause promotions (discount codes)'
 where key = 'coupons.manage';

alter table public.coupons
  add column per_customer_limit int check (per_customer_limit > 0),
  add column category_ids uuid[] not null default '{}';

alter table public.coupons drop constraint coupons_value;
alter table public.coupons add constraint coupons_value check (
  (kind = 'percent' and percent_bp is not null and amount_fils is null)
  or (kind = 'fixed' and amount_fils is not null and percent_bp is null)
  or (kind = 'free_delivery' and amount_fils is null and percent_bp is null)
);

alter table public.orders
  -- Delivery fee a free-delivery code waived (the order's delivery_fee_fils is then 0).
  add column delivery_discount_fils int not null default 0 check (delivery_discount_fils >= 0),
  -- Snapshot of what was applied: [{ coupon_id, code, kind, percent_bp, amount_fils,
  -- discount_fils, delivery_discount_fils }]. One entry today; a list so stacking can come later.
  add column applied_promotions jsonb not null default '[]'::jsonb;

-- Orders placed with a code before this migration get their snapshot.
update public.orders o
   set applied_promotions = jsonb_build_array(jsonb_build_object(
         'coupon_id', o.coupon_id, 'code', o.coupon_code, 'kind', c.kind, 'percent_bp', c.percent_bp,
         'amount_fils', c.amount_fils, 'discount_fils', o.discount_fils, 'delivery_discount_fils', 0))
  from public.coupons c
 where c.id = o.coupon_id and o.coupon_code is not null;

/*
  Does an order line's product fall inside the code's scope? Empty product and category lists
  = the whole bag.
*/
create or replace function public.coupon_covers(c public.coupons, p_product uuid, p_category uuid)
returns boolean
language sql
immutable
set search_path = public
as $$
  select (cardinality(c.product_ids) = 0 and cardinality(c.category_ids) = 0)
      or p_product = any (c.product_ids)
      or (p_category is not null and p_category = any (c.category_ids));
$$;

/*
  Check a code against a bag and say what it takes off. Prices come from the catalogue, not the
  caller. p_lines = [{ variant_id, qty }]. Returns
    { ok: true, coupon_id, code, kind, discount_fils, eligible_fils, subtotal_fils, free_delivery }
  or { ok: false, reason: invalid | not_started | expired | used_up | already_used | min_order |
                          no_eligible_items, min_order_fils? }.
  Goods discounts never touch delivery; a fixed amount is capped at the eligible goods. A free
  delivery code needs at least one in-scope item and takes nothing off the goods (the caller
  waives the fee).
*/
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

  select coalesce(sum(v.price_fils * (l ->> 'qty')::int), 0),
         coalesce(sum(v.price_fils * (l ->> 'qty')::int)
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

revoke all on function public.coupon_evaluate(text, jsonb, text) from public, anon, authenticated;

/*
  Website order with an optional p.coupon_code. The code is re-checked inside the order
  transaction (coupon row locked so a limited code can't be over-used). A goods discount is spread
  across the in-scope lines (largest share last, so line totals add up exactly). A free-delivery
  code needs p.delivery_fee_fils = 0 and records the waived fee (p.delivery_discount_fils).
  The order total must equal subtotal − discount + delivery (+ VAT when exclusive).
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

  perform public.write_audit('order.created', 'orders', v_order.id::text, null,
    jsonb_build_object('number', v_order.number, 'channel', 'website', 'total_fils', v_order.total_fils,
                       'coupon_code', v_code, 'discount_fils', v_discount,
                       'delivery_discount_fils', v_delivery_discount));
  return query select v_order.id, v_order.number, v_order.total_fils, false;
end;
$$;

-- Uses and value given per code (goods discount + waived delivery), for the promotions list.
create or replace function public.coupon_usage()
returns table (coupon_id uuid, uses int, discount_fils int)
language sql
stable
security definer
set search_path = public
as $$
  select o.coupon_id, count(*)::int, coalesce(sum(o.discount_fils + o.delivery_discount_fils), 0)::int
    from orders o
   where public.has_permission('coupons.manage')
     and o.coupon_id is not null
     and o.status <> 'cancelled'
     and (o.status <> 'pending_payment' or o.placed_at > now() - interval '2 hours')
   group by o.coupon_id;
$$;
revoke all on function public.coupon_usage() from public, anon;

/*
  Promotions report: paid orders that used a code, per code, placed between two business days
  (Asia/Dubai, inclusive). Paid = past pending_payment and not cancelled.
*/
create or replace function public.promotion_report(p_from date, p_to date)
returns table (
  code text, coupon_id uuid, orders int, discount_fils int, delivery_discount_fils int,
  sales_fils int, first_order_at timestamptz, last_order_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select o.coupon_code, (array_agg(o.coupon_id))[1], count(*)::int,
         coalesce(sum(o.discount_fils), 0)::int, coalesce(sum(o.delivery_discount_fils), 0)::int,
         coalesce(sum(o.total_fils), 0)::int, min(o.placed_at), max(o.placed_at)
    from orders o
   where public.has_permission('reports.view')
     and o.coupon_code is not null
     and o.status not in ('pending_payment', 'cancelled')
     and public.business_day(o.placed_at) between p_from and p_to
   group by o.coupon_code
   order by sum(o.discount_fils + o.delivery_discount_fils) desc, o.coupon_code;
$$;
revoke all on function public.promotion_report(date, date) from public, anon;
