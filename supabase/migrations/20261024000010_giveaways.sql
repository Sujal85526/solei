-- Phase 2 giveaways customiser: products with option groups (single choice, multiple choice or a
-- short text such as a name on a tag) and per-option price modifiers, plus a minimum order quantity
-- (event giveaways come in tens). The chosen options travel with the cart line and are snapshotted
-- on the order line. Prices are always worked out here (line_unit_price_fils), never trusted from
-- the browser. Mirrors src/modules/catalog/options.ts.

create type public.option_group_kind as enum ('single', 'multi', 'text');

create table public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  kind public.option_group_kind not null default 'single',
  required boolean not null default true,
  -- Text groups: longest allowed answer.
  max_length int not null default 40 check (max_length between 1 and 200),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_option_groups_product_idx on public.product_option_groups (product_id, sort);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.product_option_groups (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 60),
  -- Added to (or, if negative, taken off) the unit price when chosen.
  price_delta_fils int not null default 0 check (price_delta_fils between -10000000 and 10000000),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_options_group_idx on public.product_options (group_id, sort);

alter table public.products
  add column min_order_qty int not null default 1 check (min_order_qty between 1 and 10000);

-- What the customer chose: [{ group, kind, choices: [{ label, price_delta_fils }], text }].
alter table public.order_lines add column options jsonb;

create trigger product_option_groups_updated_at before update on public.product_option_groups
  for each row execute function public.set_updated_at();
create trigger product_options_updated_at before update on public.product_options
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.product_option_groups
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.product_options
  for each row execute function public.audit_row_change();

alter table public.product_option_groups enable row level security;
alter table public.product_options enable row level security;
create policy "read option groups of visible products" on public.product_option_groups
  for select using (
    exists (select 1 from public.products p where p.id = product_id
            and (p.active or public.has_permission('catalog.view')))
  );
create policy "read options of visible products" on public.product_options
  for select using (
    exists (select 1 from public.product_option_groups g join public.products p on p.id = g.product_id
             where g.id = group_id and (p.active or public.has_permission('catalog.view')))
  );
create policy "catalog.manage writes option groups" on public.product_option_groups for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy "catalog.manage writes options" on public.product_options for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

/*
  Unit price of a variant with the chosen options: the variant price plus the modifiers of the
  chosen active options of its own product (anything else is ignored — line_options_check refuses
  it). p_options = [{ group_id, option_ids: [..], text }].
*/
create or replace function public.line_unit_price_fils(p_variant uuid, p_options jsonb)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select v.price_fils + coalesce((
    select sum(o.price_delta_fils)::int
      from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) c
      cross join lateral jsonb_array_elements_text(coalesce(c -> 'option_ids', '[]'::jsonb)) oid
      join product_options o on o.id = oid::uuid and o.active
      join product_option_groups g on g.id = o.group_id and g.product_id = v.product_id
                                  and g.id = (c ->> 'group_id')::uuid
  ), 0)
  from product_variants v where v.id = p_variant;
$$;

/*
  Check the chosen options against the product's groups and return the snapshot for the order line:
  { ok: true, snapshot } or { ok: false, error }. Required groups must be answered; a single choice
  takes exactly one option; text fits max_length; unknown groups/options are refused.
*/
create or replace function public.line_options_check(p_variant uuid, p_options jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_product uuid;
  v_name text;
  grp record;
  c jsonb;
  v_ids uuid[];
  v_valid int;
  v_text text;
  v_snapshot jsonb := '[]'::jsonb;
begin
  select p.id, p.name into v_product, v_name
    from product_variants v join products p on p.id = v.product_id where v.id = p_variant;
  if v_product is null then
    return jsonb_build_object('ok', false, 'error', 'a product in your cart is no longer available');
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) x
              where not exists (select 1 from product_option_groups g
                                 where g.id = (x ->> 'group_id')::uuid and g.product_id = v_product)) then
    return jsonb_build_object('ok', false, 'error', format('the options for %s changed — please choose again', v_name));
  end if;

  for grp in select * from product_option_groups where product_id = v_product order by sort, created_at loop
    select x into c from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) x
     where (x ->> 'group_id')::uuid = grp.id limit 1;
    if grp.kind = 'text' then
      v_text := nullif(trim(coalesce(c ->> 'text', '')), '');
      if v_text is null and grp.required then
        return jsonb_build_object('ok', false, 'error', format('%s: please fill in “%s”', v_name, grp.name));
      end if;
      if v_text is not null and length(v_text) > grp.max_length then
        return jsonb_build_object('ok', false, 'error', format('%s: “%s” is too long', v_name, grp.name));
      end if;
      if v_text is not null then
        v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
          'group', grp.name, 'kind', grp.kind, 'choices', '[]'::jsonb, 'text', v_text));
      end if;
    else
      select coalesce(array_agg(distinct x::uuid), '{}') into v_ids
        from jsonb_array_elements_text(coalesce(c -> 'option_ids', '[]'::jsonb)) x;
      select count(*) into v_valid from product_options o
       where o.group_id = grp.id and o.active and o.id = any (v_ids);
      if v_valid <> cardinality(v_ids) then
        return jsonb_build_object('ok', false, 'error', format('%s: an option is no longer available — please choose again', v_name));
      end if;
      if (grp.kind = 'single' and (cardinality(v_ids) > 1 or (grp.required and cardinality(v_ids) = 0)))
         or (grp.kind = 'multi' and grp.required and cardinality(v_ids) = 0) then
        return jsonb_build_object('ok', false, 'error', format('%s: please choose “%s”', v_name, grp.name));
      end if;
      if cardinality(v_ids) > 0 then
        v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
          'group', grp.name, 'kind', grp.kind, 'text', null,
          'choices', (select jsonb_agg(jsonb_build_object('label', o.label, 'price_delta_fils', o.price_delta_fils)
                                       order by o.sort, o.label)
                        from product_options o where o.id = any (v_ids))));
      end if;
    end if;
  end loop;
  return jsonb_build_object('ok', true,
    'snapshot', case when jsonb_array_length(v_snapshot) = 0 then null else v_snapshot end);
end;
$$;

revoke all on function public.line_unit_price_fils(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.line_options_check(uuid, jsonb) from public, anon, authenticated;

-- ── Redefinitions: the previous definition with option-aware prices ──────────────────────────
-- create_web_order from 20261024000009, coupon_evaluate from 20261024000002, cart_sync from
-- 20261024000006.

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
  v_points int := coalesce((p ->> 'points')::int, 0);
  v_points_fils int := 0;
  v_unit int;
  v_opts jsonb;
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
    -- Options (giveaways): checked against the product, priced here, snapshotted on the line.
    v_opts := public.line_options_check(v_variant.id, v_line -> 'options');
    if not (v_opts ->> 'ok')::boolean then
      raise exception '%', v_opts ->> 'error' using errcode = 'P0001';
    end if;
    v_unit := public.line_unit_price_fils(v_variant.id, v_line -> 'options');
    if v_unit <> (v_line ->> 'unit_price_fils')::int then
      raise exception 'prices changed — please review your cart' using errcode = 'P0001';
    end if;

    insert into order_lines (order_id, variant_id, product_name, variant_label, sku, category_id, destination_id,
                             qty, list_price_fils, unit_price_fils, line_total_fils, options)
    values (v_order.id, v_variant.id, v_variant.product_name, v_variant.label, v_variant.sku,
            v_variant.category_id, v_variant.destination_id, (v_line ->> 'qty')::int,
            v_unit, v_unit, v_unit * (v_line ->> 'qty')::int, v_opts -> 'snapshot')
    returning id into v_line_id;

    insert into order_line_costs (order_line_id, unit_cost_fils) values (v_line_id, v_variant.cost_fils);
    v_subtotal := v_subtotal + v_unit * (v_line ->> 'qty')::int;
  end loop;

  -- Minimum quantities (giveaways), per product across its lines.
  for r in
    select pr.name, pr.min_order_qty, sum(l.qty) as qty
      from order_lines l join product_variants v on v.id = l.variant_id join products pr on pr.id = v.product_id
     where l.order_id = v_order.id
     group by pr.id, pr.name, pr.min_order_qty
    having sum(l.qty) < pr.min_order_qty
  loop
    raise exception '% comes in at least % pieces', r.name, r.min_order_qty using errcode = 'P0001';
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

  -- Points first, then a gift card: both spent in the same transaction; the order settles at once
  -- when together they cover it.
  if v_points > 0 then
    -- The signed-in customer's record (the order's customer is matched by phone first).
    perform public.points_redeem(coalesce((p ->> 'points_customer')::uuid, v_customer), v_points, v_order.id);
    select v_points * point_value_fils into v_points_fils from rewards_settings where id = 1;
    if v_points_fils > v_order.total_fils then
      raise exception 'that''s more points than the order needs' using errcode = '22023';
    end if;
    perform public.settle_if_paid(v_order.id);
  end if;
  if v_gift_code is not null then
    if v_gift_fils <= 0 or v_gift_fils > v_order.total_fils - v_points_fils then
      raise exception 'gift card amount must be more than 0 and at most the total' using errcode = '22023';
    end if;
    perform public.gift_card_redeem(v_gift_code, v_gift_fils, v_order.id);
    perform public.settle_if_paid(v_order.id);
  end if;

  perform public.write_audit('order.created', 'orders', v_order.id::text, null,
    jsonb_build_object('number', v_order.number, 'channel', 'website', 'total_fils', v_order.total_fils,
                       'coupon_code', v_code, 'discount_fils', v_discount,
                       'delivery_discount_fils', v_delivery_discount, 'gift_card_fils', v_gift_fils,
                       'points', v_points));
  return query select v_order.id, v_order.number, v_order.total_fils, false;
end;
$$;

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

  select coalesce(sum(public.line_unit_price_fils(v.id, l -> 'options') * (l ->> 'qty')::int), 0),
         coalesce(sum(public.line_unit_price_fils(v.id, l -> 'options') * (l ->> 'qty')::int)
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

create or replace function public.cart_sync(p_user uuid, p_email text, p_name text, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lines jsonb;
  v_count int;
  v_value int;
  v_id uuid;
begin
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                              'variant_id', v.id, 'qty', (l ->> 'qty')::int, 'options', l -> 'options'))
                            order by o), '[]'::jsonb),
         coalesce(sum((l ->> 'qty')::int), 0),
         coalesce(sum(public.line_unit_price_fils(v.id, l -> 'options') * (l ->> 'qty')::int), 0)
    into v_lines, v_count, v_value
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as x(l, o)
    join product_variants v on v.id = (l ->> 'variant_id')::uuid
   where (l ->> 'qty')::int between 1 and 99;

  select id into v_id from carts where user_id = p_user and status = 'open' for update;

  if v_count = 0 then
    if v_id is not null then
      update carts set status = 'emptied', lines = '[]', item_count = 0, value_fils = 0,
                       closed_at = now(), updated_at = now()
       where id = v_id;
    end if;
    return null;
  end if;

  if v_id is null then
    insert into carts (user_id, email, name, lines, item_count, value_fils)
    values (p_user, lower(p_email), nullif(trim(p_name), ''), v_lines, v_count, v_value)
    returning id into v_id;
  else
    update carts set lines = v_lines, item_count = v_count, value_fils = v_value,
                     email = lower(p_email), name = coalesce(nullif(trim(p_name), ''), name),
                     updated_at = now()
     where id = v_id and lines is distinct from v_lines;
  end if;
  return v_id;
end;
$$;
