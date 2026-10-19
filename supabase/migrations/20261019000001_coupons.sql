-- Discount coupons (client 2026-10-19): website checkout only. The owner names each code and picks
-- its rules when creating it — percentage or fixed AED off, optional start/end dates, total-use
-- limit, once per customer, minimum order and specific products. Mirrors src/modules/coupons.

insert into public.permissions (key, "group", description, sort) values
  ('coupons.manage', 'Sales', 'Create, edit and pause discount coupons', 31);
insert into public.role_permissions (role_id, permission_key)
select r.id, 'coupons.manage' from public.roles r where r.key in ('owner', 'manager');

create type public.coupon_kind as enum ('percent', 'fixed');

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  -- Stored upper-case; customers may type it in any case.
  code text not null,
  description text,
  kind public.coupon_kind not null,
  percent_bp int check (percent_bp between 1 and 10000),
  amount_fils int check (amount_fils > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses int check (max_uses > 0),
  once_per_customer boolean not null default false,
  min_order_fils int check (min_order_fils > 0),
  -- Empty = the whole bag; otherwise only these products are discounted.
  product_ids uuid[] not null default '{}',
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_format check (code ~ '^[A-Z0-9_-]{3,32}$'),
  constraint coupons_value check (
    (kind = 'percent' and percent_bp is not null and amount_fils is null)
    or (kind = 'fixed' and amount_fils is not null and percent_bp is null)
  ),
  constraint coupons_dates check (starts_at is null or ends_at is null or ends_at > starts_at)
);
create unique index coupons_code_key on public.coupons (code);

create trigger coupons_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.coupons
  for each row execute function public.audit_row_change();

alter table public.coupons enable row level security;
create policy coupons_staff_read on public.coupons
  for select using (public.has_permission('coupons.manage'));
create policy coupons_staff_insert on public.coupons
  for insert with check (public.has_permission('coupons.manage'));
create policy coupons_staff_update on public.coupons
  for update using (public.has_permission('coupons.manage'))
  with check (public.has_permission('coupons.manage'));
create policy coupons_staff_delete on public.coupons
  for delete using (public.has_permission('coupons.manage'));

-- Which code an order used (the code is a snapshot so history survives a deleted coupon).
alter table public.orders
  add column coupon_id uuid references public.coupons (id) on delete set null,
  add column coupon_code text;
create index orders_coupon_idx on public.orders (coupon_id) where coupon_id is not null;

/*
  Orders that count as a use of the coupon: not cancelled, and website orders still awaiting
  payment only for 2 hours (an abandoned checkout gives the use back).
*/
create or replace function public.coupon_uses(p_coupon uuid, p_email text default null)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from orders o
   where o.coupon_id = p_coupon
     and o.status <> 'cancelled'
     and (o.status <> 'pending_payment' or o.placed_at > now() - interval '2 hours')
     and (p_email is null or lower(o.contact_email) = lower(p_email));
$$;

/*
  Check a code against a bag and say how much it takes off. Prices come from the catalogue, not
  the caller. p_lines = [{ variant_id, qty }]. Returns
    { ok: true, coupon_id, code, discount_fils, eligible_fils, subtotal_fils }
  or { ok: false, reason: invalid | not_started | expired | used_up | already_used | min_order |
                          no_eligible_items, min_order_fils? }.
  Delivery is never discounted; a fixed amount is capped at the eligible goods.
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
                    filter (where cardinality(c.product_ids) = 0 or v.product_id = any (c.product_ids)), 0)
    into v_subtotal, v_eligible
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
    join product_variants v on v.id = (l ->> 'variant_id')::uuid;

  if c.min_order_fils is not null and v_subtotal < c.min_order_fils then
    return jsonb_build_object('ok', false, 'reason', 'min_order', 'min_order_fils', c.min_order_fils);
  end if;
  if v_eligible = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_eligible_items');
  end if;
  if c.max_uses is not null and public.coupon_uses(c.id) >= c.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'used_up');
  end if;
  if c.once_per_customer and p_email is not null and public.coupon_uses(c.id, p_email) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;

  v_discount := case c.kind
    when 'percent' then (v_eligible::bigint * c.percent_bp + 5000) / 10000
    else least(c.amount_fils, v_eligible)
  end;
  return jsonb_build_object(
    'ok', true, 'coupon_id', c.id, 'code', c.code, 'discount_fils', v_discount,
    'eligible_fils', v_eligible, 'subtotal_fils', v_subtotal
  );
end;
$$;

revoke all on function public.coupon_uses(uuid, text) from public, anon, authenticated;
revoke all on function public.coupon_evaluate(text, jsonb, text) from public, anon, authenticated;

/*
  Website order, now with an optional p.coupon_code. The coupon is re-checked here (inside the
  order transaction, with the coupon row locked so a limited code can't be over-used), the
  discount is spread across the discounted lines (largest share last, so line totals add up
  exactly) and the order total must equal subtotal − discount + delivery (+ VAT when exclusive).
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
    total_fils, vat_rate_bp, prices_include_vat, notes, client_uuid, coupon_id, coupon_code
  ) values (
    v_customer, 'website', 'pending_payment',
    coalesce((p ->> 'fulfilment')::public.fulfilment_type, 'delivery'),
    p -> 'contact' ->> 'name', p -> 'contact' ->> 'phone', lower(p -> 'contact' ->> 'email'),
    p -> 'address', (p ->> 'emirate')::public.emirate,
    (p ->> 'delivery_fee_fils')::int, (p ->> 'subtotal_fils')::int, v_discount, (p ->> 'vat_fils')::int,
    (p ->> 'total_fils')::int, (p ->> 'vat_rate_bp')::int, (p ->> 'prices_include_vat')::boolean,
    nullif(trim(p ->> 'notes'), ''), (p ->> 'client_uuid')::uuid,
    case when v_code is not null then v_coupon_row.id end, v_code
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

  -- Spread the discount over the discounted lines, proportional to their totals.
  if v_discount > 0 then
    v_left := v_discount;
    select count(*) into v_eligible_lines
      from order_lines l join product_variants v on v.id = l.variant_id
     where l.order_id = v_order.id
       and (cardinality(v_coupon_row.product_ids) = 0 or v.product_id = any (v_coupon_row.product_ids));
    for r in
      select l.id, l.line_total_fils
        from order_lines l join product_variants v on v.id = l.variant_id
       where l.order_id = v_order.id
         and (cardinality(v_coupon_row.product_ids) = 0 or v.product_id = any (v_coupon_row.product_ids))
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
                       'coupon_code', v_code, 'discount_fils', v_discount));
  return query select v_order.id, v_order.number, v_order.total_fils, false;
end;
$$;
