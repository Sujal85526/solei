-- Phase 2 promotions, part 2 (docs/PHASE2_REVIEW.md §10, items 34–42). Adds:
--   · automatic offers (no code): sale prices, bundles ("perfume + spray for AED X") and buy X get Y
--   · on codes: buy X get Y, "combines with other promotions", where it works (website / event
--     till), a linked event, VIP tiers and/or chosen customers (a segment snapshot or one personal
--     birthday code)
--   · early access: a product can launch later for everyone and earlier for chosen tiers
--   · a points rewards catalogue (a product for N points)
--   · homepage promotion banners (under the hero) and the announcement bar
--   · a birthday discount code instead of / as well as birthday points
--   · one pricing function, promo_price(), used by the bag, checkout, the order RPC and the till.
--
-- Order of application (P2-61), all in whole fils:
--   1. sale prices (the best live sale for the item) — they are the item's price;
--   2. bundles and buy X get Y offers, in the admin's order; an item counts towards one offer only;
--   3. codes: buy X get Y codes, then % codes, then AED codes, then free delivery. Several codes only
--      when every one of them "combines"; a code that doesn't combine skips items already reduced in
--      steps 1–2;
--   4. points and gift cards pay for what is left (payments, unchanged).
-- Reward lines (bought with points) take no discounts.
--
-- Safe for main on the shared DB: new tables and columns with defaults; coupon_evaluate,
-- create_web_order and pos_complete_sale keep their signatures (20261030030003) and price exactly as
-- before while no offer exists. Mirrors src/modules/promotions.

-- ── Automatic offers ─────────────────────────────────────────────────────────────────────────
create type public.offer_kind as enum ('sale', 'bundle', 'buy_x_get_y');

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  -- Shown to customers ("Ramadan: 15% off sprays", "Perfume + spray for AED 450").
  name text not null check (length(trim(name)) between 1 and 80),
  kind public.offer_kind not null,
  -- sale: % off each item, or AED off each item. bundle: % off the bundle, or a bundle price.
  -- buy_x_get_y: % off the "get" items (10000 = free).
  percent_bp int check (percent_bp between 1 and 10000),
  amount_fils int check (amount_fils > 0),
  bundle_price_fils int check (bundle_price_fils >= 0),
  buy_qty int check (buy_qty between 1 and 20),
  get_qty int check (get_qty between 1 and 20),
  -- sale / buy_x_get_y: which items (empty = everything).
  product_ids uuid[] not null default '{}',
  category_ids uuid[] not null default '{}',
  -- bundle: [{ label, product_ids, category_ids, qty }], 2–6 slots, each filled from its own list.
  slots jsonb not null default '[]'::jsonb,
  channels text[] not null default '{website,pos}',
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  -- Lower first (bundles and buy X get Y are tried in this order).
  sort int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_channels check (cardinality(channels) > 0 and channels <@ array['website', 'pos']),
  constraint offers_dates check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint offers_value check (
    (kind = 'sale' and (percent_bp is null) <> (amount_fils is null)
       and bundle_price_fils is null and buy_qty is null and get_qty is null)
    or (kind = 'bundle' and (percent_bp is null) <> (bundle_price_fils is null)
       and amount_fils is null and buy_qty is null and get_qty is null
       and jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) between 2 and 6)
    or (kind = 'buy_x_get_y' and percent_bp is not null and buy_qty is not null and get_qty is not null
       and amount_fils is null and bundle_price_fils is null)
  )
);
create index offers_live_idx on public.offers (kind, sort) where active;

create trigger offers_updated_at before update on public.offers
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.offers
  for each row execute function public.audit_row_change();

alter table public.offers enable row level security;
-- Live offers are public (the shop shows sale prices); staff see and edit all of them.
create policy offers_read on public.offers for select
  using (active or public.has_permission('coupons.manage'));
create policy offers_write on public.offers for all to authenticated
  using (public.has_permission('coupons.manage')) with check (public.has_permission('coupons.manage'));

-- ── Codes ─────────────────────────────────────────────────────────────────────────────────────
alter table public.coupons
  add column buy_qty int check (buy_qty between 1 and 20),
  add column get_qty int check (get_qty between 1 and 20),
  -- Can be used together with other codes and on items an automatic offer already reduced.
  add column combinable boolean not null default false,
  -- Where the code works. Codes made before this migration stay website-only.
  add column channels text[] not null default '{website}',
  -- An event's code: shown per event in the report; at the till it works at that event only.
  add column event_id uuid references public.events (id) on delete set null,
  -- Who may use it: anyone (both empty), customers in these tiers, or these customers.
  add column tier_ids uuid[] not null default '{}',
  add column customer_ids uuid[] not null default '{}',
  -- The segment customer_ids was taken from (for "refresh"), if any.
  add column segment_id uuid references public.customer_segments (id) on delete set null,
  -- Birthday codes: one per customer per year.
  add column birthday_customer_id uuid references public.customers (id) on delete cascade,
  add column birthday_year int,
  add constraint coupons_channels check (cardinality(channels) > 0 and channels <@ array['website', 'pos']);

alter table public.coupons drop constraint coupons_value;
alter table public.coupons add constraint coupons_value check (
  (kind = 'percent' and percent_bp is not null and amount_fils is null)
  or (kind = 'fixed' and amount_fils is not null and percent_bp is null)
  or (kind = 'free_delivery' and amount_fils is null and percent_bp is null)
  or (kind = 'buy_x_get_y' and percent_bp is not null and amount_fils is null
      and buy_qty is not null and get_qty is not null)
);
create unique index coupons_birthday_key on public.coupons (birthday_customer_id, birthday_year)
  where birthday_customer_id is not null;
create index coupons_event_idx on public.coupons (event_id) where event_id is not null;

-- Uses of a code across all of an order's codes (several codes per order from now on).
create index orders_applied_promotions_idx on public.orders using gin (applied_promotions jsonb_path_ops);

-- ── Early access ─────────────────────────────────────────────────────────────────────────────
alter table public.products
  -- Before this moment only the early-access tiers may buy it (null = launched).
  add column launch_at timestamptz,
  add column early_access_tier_ids uuid[] not null default '{}';

-- ── Points rewards catalogue ─────────────────────────────────────────────────────────────────
create table public.points_rewards (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  points int not null check (points between 1 and 1000000),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index points_rewards_variant_key on public.points_rewards (variant_id);
create trigger points_rewards_updated_at before update on public.points_rewards
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.points_rewards
  for each row execute function public.audit_row_change();
alter table public.points_rewards enable row level security;
create policy points_rewards_read on public.points_rewards for select
  using (active or public.has_permission('loyalty.view'));
create policy points_rewards_write on public.points_rewards for all to authenticated
  using (public.has_permission('loyalty.manage')) with check (public.has_permission('loyalty.manage'));

-- ── Banners ──────────────────────────────────────────────────────────────────────────────────
create table public.promo_banners (
  id uuid primary key default gen_random_uuid(),
  -- announcement: the thin bar above the header; homepage: a banner under the hero.
  placement text not null check (placement in ('announcement', 'homepage')),
  title text check (length(title) <= 80),
  body text not null check (length(trim(body)) between 1 and 200),
  link_url text check (link_url ~ '^(/|https://)' and length(link_url) <= 300),
  link_label text check (length(link_label) <= 40),
  image_url text check (length(image_url) <= 500),
  image_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_banners_dates check (starts_at is null or ends_at is null or ends_at > starts_at)
);
create trigger promo_banners_updated_at before update on public.promo_banners
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.promo_banners
  for each row execute function public.audit_row_change();
alter table public.promo_banners enable row level security;
create policy promo_banners_read on public.promo_banners for select
  using ((active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
         or public.has_permission('coupons.manage'));
create policy promo_banners_write on public.promo_banners for all to authenticated
  using (public.has_permission('coupons.manage')) with check (public.has_permission('coupons.manage'));

-- Own bucket: main's hero banners (20261030000001) use `banners` with settings.manage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promo-banners', 'promo-banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;
create policy "public reads promotion banner images" on storage.objects
  for select using (bucket_id = 'promo-banners');
create policy "coupons.manage uploads promotion banner images" on storage.objects
  for insert to authenticated with check (bucket_id = 'promo-banners' and public.has_permission('coupons.manage'));
create policy "coupons.manage deletes promotion banner images" on storage.objects
  for delete to authenticated using (bucket_id = 'promo-banners' and public.has_permission('coupons.manage'));

-- ── Birthday code ────────────────────────────────────────────────────────────────────────────
alter table public.rewards_settings
  -- points (as before), code, or both.
  add column birthday_reward text not null default 'points'
    check (birthday_reward in ('points', 'code', 'both')),
  add column birthday_code_percent_bp int default 1000 check (birthday_code_percent_bp between 1 and 10000),
  add column birthday_code_amount_fils int check (birthday_code_amount_fils > 0),
  add column birthday_code_valid_days int not null default 30 check (birthday_code_valid_days between 1 and 365),
  add column birthday_code_min_order_fils int check (birthday_code_min_order_fils > 0),
  add constraint rewards_settings_birthday_code check (
    (birthday_code_percent_bp is null) <> (birthday_code_amount_fils is null));

-- ── Pricing ──────────────────────────────────────────────────────────────────────────────────

-- Is an item (its product, category, or the giveaway it was bought through) in a scope? Empty
-- lists = everything.
create or replace function public.promo_covers(
  p_products uuid[], p_categories uuid[], p_product uuid, p_category uuid, p_giveaway uuid default null
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select (cardinality(p_products) = 0 and cardinality(p_categories) = 0)
      or p_product = any (p_products)
      or (p_giveaway is not null and p_giveaway = any (p_products))
      or (p_category is not null and p_category = any (p_categories));
$$;

create or replace function public.promo_uuids(p jsonb)
returns uuid[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(x::uuid), '{}') from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) x;
$$;

/*
  Split p_total over items in proportion to their weights, in whole fils, so the shares add up to
  exactly p_total (largest remainder; ties to the earlier item). p_total must not exceed the sum.
*/
create or replace function public.promo_allocate(p_total int, p_weights int[])
returns int[]
language plpgsql
immutable
set search_path = public
as $$
declare
  n int := coalesce(array_length(p_weights, 1), 0);
  w bigint;
  v_out int[] := '{}';
  v_left int;
  i int;
begin
  if n = 0 then return v_out; end if;
  select coalesce(sum(x), 0) into w from unnest(p_weights) x;
  if w = 0 or p_total <= 0 then return array_fill(0, array[n]); end if;
  for i in 1..n loop
    v_out := v_out || (p_total::bigint * p_weights[i] / w)::int;
  end loop;
  v_left := p_total - (select sum(x) from unnest(v_out) x);
  for i in
    select k from generate_series(1, n) k
     order by (p_total::bigint * p_weights[k]) % w desc, k
     limit v_left
  loop
    v_out[i] := v_out[i] + 1;
  end loop;
  return v_out;
end;
$$;

-- Is an offer running at p_at on a channel?
create or replace function public.offer_live(o public.offers, p_at timestamptz, p_channel text)
returns boolean
language sql
stable
set search_path = public
as $$
  select o.active and (o.starts_at is null or o.starts_at <= p_at) and (o.ends_at is null or o.ends_at > p_at)
     and p_channel = any (o.channels);
$$;

-- The unit price of a cart line before promotions (variant, options, giveaway).
create or replace function public.promo_line_unit(l jsonb)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select public.line_unit_price_fils((l ->> 'variant_id')::uuid, l -> 'options',
                                     nullif(l ->> 'giveaway_id', '')::uuid);
$$;

-- A sale's reduction on one item.
create or replace function public.offer_sale_off(o public.offers, p_unit int)
returns int
language sql
immutable
set search_path = public
as $$
  select case when o.percent_bp is not null then least(p_unit, (p_unit::bigint * o.percent_bp + 5000) / 10000)
              else least(o.amount_fils, p_unit) end::int;
$$;

/*
  Price a bag. p_lines = [{ variant_id, qty, options?, giveaway_id?, reward_id? }]; p_codes = a
  JSON array of codes in the order they were entered; p_ctx = { channel: website | pos, event_id?,
  email?, customer_id?, at? (default now), apply_offers? (default true) }. Prices come from the
  catalogue, never the caller. Returns
    { subtotal_fils,            -- at sale prices, reward lines included
      list_subtotal_fils,       -- before sale prices
      discount_fils,            -- offers + codes off the goods (sale prices not included)
      offer_discount_fils, code_discount_fils, sale_fils, free_delivery,
      lines: [{ variant_id, qty, list_unit_fils, unit_price_fils, sale_offer_id, sale_name,
                discount_fils, reward_id, reward_points }],
      applied: [{ type: sale | offer | code, … discount_fils }],   -- order snapshot
      codes: [{ code, ok, reason?, coupon_id?, kind?, discount_fils?, eligible_fils?, free_delivery?,
                min_order_fils?, min_items? }] }                    -- one per code, as entered
  Code refusals: invalid | not_started | expired | not_here | not_eligible | min_order | used_up |
  already_used | not_combinable | no_eligible_items | min_items.
*/
create or replace function public.promo_price(p_lines jsonb, p_codes jsonb, p_ctx jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_at timestamptz := coalesce((p_ctx ->> 'at')::timestamptz, now());
  v_channel text := coalesce(nullif(p_ctx ->> 'channel', ''), 'website');
  v_event uuid := nullif(p_ctx ->> 'event_id', '')::uuid;
  v_email text := lower(nullif(trim(p_ctx ->> 'email'), ''));
  v_customer uuid := nullif(p_ctx ->> 'customer_id', '')::uuid;
  v_customer_done boolean := false;
  v_tier uuid;
  v_offers_on boolean := coalesce((p_ctx ->> 'apply_offers')::boolean, true);
  -- Lines (1-based, as given).
  n_lines int := 0;
  ln jsonb;
  ln_variant uuid[] := '{}';
  ln_qty int[] := '{}';
  ln_list int[] := '{}';
  ln_unit int[] := '{}';
  ln_sale uuid[] := '{}';
  ln_sale_name text[] := '{}';
  ln_reward uuid[] := '{}';
  ln_reward_points int[] := '{}';
  ln_product uuid[] := '{}';
  ln_category uuid[] := '{}';
  ln_giveaway uuid[] := '{}';
  -- Units: one per piece of a non-reward line.
  u_line int[] := '{}';
  u_price int[] := '{}';
  u_disc int[] := '{}';
  u_offer boolean[] := '{}';
  u_used boolean[] := '{}';
  n_units int := 0;
  -- Working values.
  v_list int;
  v_unit int;
  v_qty int;
  v_off int;
  v_sale_id uuid;
  v_sale_nm text;
  v_info record;
  i int;
  k int;
  o public.offers;
  c public.coupons;
  s jsonb;
  v_idx int[];
  v_pick int[];
  v_chosen int[];
  v_weights int[];
  v_shares int[];
  v_n int;
  v_groups int;
  v_need int;
  v_sum int;
  v_disc int;
  v_total int;
  v_times int;
  v_ok boolean;
  v_subtotal int := 0;
  v_list_subtotal int := 0;
  v_goods int := 0;
  v_offer_disc int := 0;
  v_code_disc int := 0;
  v_sale_fils int := 0;
  v_free_delivery boolean := false;
  v_applied jsonb := '[]'::jsonb;
  v_results jsonb := '[]'::jsonb;
  v_lines_out jsonb := '[]'::jsonb;
  v_code text;
  v_seen text[] := '{}';
  v_pos int := 0;
  v_reason text;
  v_limit int;
  -- Accepted codes: coupon id, input position, kind rank.
  a_ids uuid[] := '{}';
  a_pos int[] := '{}';
  a_combinable boolean := true;
  r record;
begin
  -- 1. Lines and sale prices.
  for ln in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_qty := coalesce((ln ->> 'qty')::int, 0);
    select p.id as product_id, p.category_id into v_info
      from product_variants v join products p on p.id = v.product_id
     where v.id = (ln ->> 'variant_id')::uuid;
    if not found or v_qty < 1 then continue; end if;
    n_lines := n_lines + 1;
    ln_variant := ln_variant || (ln ->> 'variant_id')::uuid;
    ln_qty := ln_qty || v_qty;
    ln_product := ln_product || v_info.product_id;
    ln_category := ln_category || v_info.category_id;
    ln_giveaway := ln_giveaway || nullif(ln ->> 'giveaway_id', '')::uuid;
    v_list := coalesce(public.promo_line_unit(ln), 0);
    ln_list := ln_list || v_list;

    if nullif(ln ->> 'reward_id', '') is not null then
      -- Bought with points: full price (paid by points), no promotions.
      ln_reward := ln_reward || (ln ->> 'reward_id')::uuid;
      ln_reward_points := ln_reward_points
        || (select pr.points * v_qty from points_rewards pr where pr.id = (ln ->> 'reward_id')::uuid);
      ln_unit := ln_unit || v_list;
      ln_sale := ln_sale || null::uuid;
      ln_sale_name := ln_sale_name || null::text;
      v_subtotal := v_subtotal + v_list * v_qty;
      v_list_subtotal := v_list_subtotal + v_list * v_qty;
      continue;
    end if;
    ln_reward := ln_reward || null::uuid;
    ln_reward_points := ln_reward_points || null::int;

    v_sale_id := null;
    v_sale_nm := null;
    v_off := 0;
    if v_offers_on then
      select x.id, x.name, public.offer_sale_off(x, v_list) into v_sale_id, v_sale_nm, v_off
        from offers x
       where x.kind = 'sale' and public.offer_live(x, v_at, v_channel)
         and public.promo_covers(x.product_ids, x.category_ids, v_info.product_id, v_info.category_id,
                                 ln_giveaway[n_lines])
       order by public.offer_sale_off(x, v_list) desc, x.sort, x.created_at
       limit 1;
    end if;
    v_off := coalesce(v_off, 0);
    v_unit := v_list - v_off;
    ln_unit := ln_unit || v_unit;
    ln_sale := ln_sale || case when v_off > 0 then v_sale_id end;
    ln_sale_name := ln_sale_name || case when v_off > 0 then v_sale_nm end;
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_list_subtotal := v_list_subtotal + v_list * v_qty;
    v_goods := v_goods + v_unit * v_qty;
    if v_off > 0 then
      v_sale_fils := v_sale_fils + v_off * v_qty;
      v_applied := public.promo_applied_add(v_applied, jsonb_build_object(
        'type', 'sale', 'offer_id', v_sale_id, 'kind', 'sale', 'name', v_sale_nm), v_off * v_qty);
    end if;
    for k in 1..v_qty loop
      n_units := n_units + 1;
      u_line := u_line || n_lines;
      u_price := u_price || v_unit;
      u_disc := u_disc || 0;
      u_offer := u_offer || (v_off > 0);
      u_used := u_used || false;
    end loop;
  end loop;

  -- 2. Bundles and buy X get Y offers, in the admin's order.
  if v_offers_on and n_units > 0 then
    for o in
      select * from offers x
       where x.kind in ('bundle', 'buy_x_get_y') and public.offer_live(x, v_at, v_channel)
       order by x.sort, x.created_at
    loop
      v_total := 0;
      v_times := 0;
      if o.kind = 'buy_x_get_y' then
        select coalesce(array_agg(q.j order by q.net desc, q.j), '{}') into v_idx
          from (select j, u_price[j] - u_disc[j] as net from generate_series(1, n_units) j) q
         where not u_used[q.j] and q.net > 0
           and public.promo_covers(o.product_ids, o.category_ids, ln_product[u_line[q.j]],
                                   ln_category[u_line[q.j]], ln_giveaway[u_line[q.j]]);
        v_n := cardinality(v_idx);
        v_groups := v_n / (o.buy_qty + o.get_qty);
        if v_groups > 0 then
          -- The most expensive items are bought, the cheapest ones are the "get" items.
          for k in 1..(v_groups * o.buy_qty) loop
            u_used[v_idx[k]] := true;
          end loop;
          for k in (v_n - v_groups * o.get_qty + 1)..v_n loop
            i := v_idx[k];
            v_disc := ((u_price[i] - u_disc[i])::bigint * o.percent_bp + 5000) / 10000;
            u_disc[i] := u_disc[i] + v_disc;
            u_used[i] := true;
            u_offer[i] := true;
            v_total := v_total + v_disc;
          end loop;
          v_times := v_groups;
        end if;
      else
        loop
          exit when v_times >= 50;
          v_chosen := '{}';
          v_ok := true;
          for s in select * from jsonb_array_elements(o.slots) loop
            v_need := greatest(coalesce((s ->> 'qty')::int, 1), 1);
            select coalesce(array_agg(q.j order by q.net desc, q.j), '{}') into v_pick
              from (select j, u_price[j] - u_disc[j] as net from generate_series(1, n_units) j) q
             where not u_used[q.j] and q.net > 0 and not (q.j = any (v_chosen))
               and public.promo_covers(public.promo_uuids(s -> 'product_ids'),
                                       public.promo_uuids(s -> 'category_ids'),
                                       ln_product[u_line[q.j]], ln_category[u_line[q.j]],
                                       ln_giveaway[u_line[q.j]]);
            if cardinality(v_pick) < v_need then
              v_ok := false;
              exit;
            end if;
            v_chosen := v_chosen || v_pick[1:v_need];
          end loop;
          exit when not v_ok;
          select coalesce(array_agg(u_price[x] - u_disc[x] order by ord), '{}'), coalesce(sum(u_price[x] - u_disc[x]), 0)
            into v_weights, v_sum
            from unnest(v_chosen) with ordinality as t(x, ord);
          v_disc := case when o.percent_bp is not null then (v_sum::bigint * o.percent_bp + 5000) / 10000
                         else greatest(0, v_sum - o.bundle_price_fils) end;
          -- A bundle price above what the items cost anyway is no offer: stop.
          exit when v_disc <= 0;
          v_shares := public.promo_allocate(v_disc, v_weights);
          for k in 1..cardinality(v_chosen) loop
            i := v_chosen[k];
            u_disc[i] := u_disc[i] + v_shares[k];
            u_used[i] := true;
            u_offer[i] := true;
          end loop;
          v_total := v_total + v_disc;
          v_times := v_times + 1;
        end loop;
      end if;
      if v_total > 0 then
        v_offer_disc := v_offer_disc + v_total;
        v_applied := public.promo_applied_add(v_applied, jsonb_build_object(
          'type', 'offer', 'offer_id', o.id, 'kind', o.kind, 'name', o.name, 'times', v_times), v_total);
      end if;
    end loop;
  end if;

  -- 3. Codes: check each one as entered, then apply the accepted ones in the fixed order.
  for v_code in select upper(trim(x)) from jsonb_array_elements_text(case when jsonb_typeof(p_codes) = 'array' then p_codes else '[]'::jsonb end) x loop
    v_pos := v_pos + 1;
    continue when v_code = '' or v_code = any (v_seen);
    v_seen := v_seen || v_code;
    v_reason := null;
    select * into c from coupons where code = v_code;
    if not found or not c.active then
      v_reason := 'invalid';
    elsif c.starts_at is not null and c.starts_at > v_at then
      v_reason := 'not_started';
    elsif c.ends_at is not null and c.ends_at <= v_at then
      v_reason := 'expired';
    elsif not (v_channel = any (c.channels))
          or (v_channel = 'pos' and c.event_id is not null and c.event_id is distinct from v_event) then
      v_reason := 'not_here';
    end if;
    if v_reason is null and (cardinality(c.tier_ids) > 0 or cardinality(c.customer_ids) > 0) then
      if not v_customer_done then
        if v_customer is null and v_email is not null then
          select id into v_customer from customers where lower(email) = v_email
           order by created_at limit 1;
        end if;
        if v_customer is not null then v_tier := (public.customer_tier(v_customer)).id; end if;
        v_customer_done := true;
      end if;
      if v_customer is null
         or not (v_customer = any (c.customer_ids) or (v_tier is not null and v_tier = any (c.tier_ids))) then
        v_reason := 'not_eligible';
      end if;
    end if;
    if v_reason is null and c.min_order_fils is not null and v_goods < c.min_order_fils then
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'code', v_code, 'ok', false, 'reason', 'min_order', 'min_order_fils', c.min_order_fils));
      continue;
    end if;
    if v_reason is null and c.max_uses is not null and public.coupon_uses(c.id) >= c.max_uses then
      v_reason := 'used_up';
    end if;
    v_limit := coalesce(c.per_customer_limit, case when c.once_per_customer then 1 end);
    if v_reason is null and v_limit is not null and v_email is not null
       and public.coupon_uses(c.id, v_email) >= v_limit then
      v_reason := 'already_used';
    end if;
    if v_reason is null and cardinality(a_ids) > 0 and not (c.combinable and a_combinable) then
      v_reason := 'not_combinable';
    end if;
    if v_reason is not null then
      v_results := v_results || jsonb_build_array(jsonb_build_object('code', v_code, 'ok', false, 'reason', v_reason));
      continue;
    end if;
    a_ids := a_ids || c.id;
    a_pos := a_pos || cardinality(v_seen);
    a_combinable := a_combinable and c.combinable;
    -- Placeholder, filled in below.
    v_results := v_results || jsonb_build_array(jsonb_build_object('code', v_code, 'ok', true, 'coupon_id', c.id));
  end loop;

  for r in
    select x.id, x.code
      from unnest(a_ids, a_pos) as t(cid, pos) join coupons x on x.id = t.cid
     order by case x.kind when 'buy_x_get_y' then 0 when 'percent' then 1 when 'fixed' then 2 else 3 end, t.pos
  loop
    select * into c from coupons where id = r.id;
    select coalesce(array_agg(q.j order by q.net desc, q.j), '{}'), coalesce(sum(q.net), 0)
      into v_idx, v_sum
      from (select j, u_price[j] - u_disc[j] as net from generate_series(1, n_units) j) q
     where q.net > 0 and (c.combinable or not u_offer[q.j])
       and public.promo_covers(c.product_ids, c.category_ids, ln_product[u_line[q.j]],
                               ln_category[u_line[q.j]], ln_giveaway[u_line[q.j]]);
    v_reason := null;
    v_disc := 0;
    if v_sum = 0 then
      v_reason := 'no_eligible_items';
    elsif c.kind = 'buy_x_get_y' then
      v_n := cardinality(v_idx);
      v_groups := v_n / (c.buy_qty + c.get_qty);
      if v_groups = 0 then
        v_reason := 'min_items';
      else
        for k in (v_n - v_groups * c.get_qty + 1)..v_n loop
          i := v_idx[k];
          v_off := ((u_price[i] - u_disc[i])::bigint * c.percent_bp + 5000) / 10000;
          u_disc[i] := u_disc[i] + v_off;
          v_disc := v_disc + v_off;
        end loop;
      end if;
    elsif c.kind in ('percent', 'fixed') then
      v_disc := case c.kind when 'percent' then ((v_sum::bigint * c.percent_bp + 5000) / 10000)::int
                            else least(c.amount_fils, v_sum) end;
      select coalesce(array_agg(u_price[x] - u_disc[x] order by ord), '{}') into v_weights
        from unnest(v_idx) with ordinality as t(x, ord);
      v_shares := public.promo_allocate(v_disc, v_weights);
      for k in 1..cardinality(v_idx) loop
        u_disc[v_idx[k]] := u_disc[v_idx[k]] + v_shares[k];
      end loop;
    end if;

    select (ord - 1)::int into k from jsonb_array_elements(v_results) with ordinality as t(e, ord)
     where e ->> 'code' = r.code;
    if v_reason is not null then
      v_results := jsonb_set(v_results, array[k::text], jsonb_strip_nulls(jsonb_build_object(
        'code', r.code, 'ok', false, 'reason', v_reason,
        'min_items', case when v_reason = 'min_items' then c.buy_qty + c.get_qty end)));
      continue;
    end if;
    v_code_disc := v_code_disc + v_disc;
    v_free_delivery := v_free_delivery or c.kind = 'free_delivery';
    v_results := jsonb_set(v_results, array[k::text], jsonb_build_object(
      'code', r.code, 'ok', true, 'coupon_id', c.id, 'kind', c.kind, 'discount_fils', v_disc,
      'eligible_fils', v_sum, 'free_delivery', c.kind = 'free_delivery'));
    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'type', 'code', 'coupon_id', c.id, 'code', c.code, 'kind', c.kind, 'percent_bp', c.percent_bp,
      'amount_fils', c.amount_fils, 'event_id', c.event_id, 'discount_fils', v_disc,
      'delivery_discount_fils', 0));
  end loop;

  -- Line results.
  for i in 1..n_lines loop
    v_lines_out := v_lines_out || jsonb_build_array(jsonb_build_object(
      'variant_id', ln_variant[i], 'qty', ln_qty[i], 'list_unit_fils', ln_list[i],
      'unit_price_fils', ln_unit[i], 'sale_offer_id', ln_sale[i], 'sale_name', ln_sale_name[i],
      'discount_fils', coalesce((select sum(u_disc[j]) from generate_series(1, n_units) j where u_line[j] = i), 0),
      'reward_id', ln_reward[i], 'reward_points', ln_reward_points[i]));
  end loop;

  return jsonb_build_object(
    'subtotal_fils', v_subtotal, 'list_subtotal_fils', v_list_subtotal,
    'discount_fils', v_offer_disc + v_code_disc, 'offer_discount_fils', v_offer_disc,
    'code_discount_fils', v_code_disc, 'sale_fils', v_sale_fils, 'free_delivery', v_free_delivery,
    'lines', v_lines_out, 'applied', v_applied, 'codes', v_results);
end;
$$;

-- Add an amount to the snapshot entry for the same offer (or a new entry).
create or replace function public.promo_applied_add(p_applied jsonb, p_entry jsonb, p_fils int)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  k int;
begin
  select (ord - 1)::int into k from jsonb_array_elements(p_applied) with ordinality as t(e, ord)
   where e ->> 'offer_id' = p_entry ->> 'offer_id';
  if k is null then
    return p_applied || jsonb_build_array(p_entry || jsonb_build_object('discount_fils', p_fils));
  end if;
  return jsonb_set(p_applied, array[k::text, 'discount_fils'],
                   to_jsonb((p_applied -> k ->> 'discount_fils')::int + p_fils));
end;
$$;

revoke all on function public.promo_price(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.promo_line_unit(jsonb) from public, anon, authenticated;

/*
  Orders that count as a use of a code: any of its codes (applied_promotions), or the order's
  first code (orders placed before several codes were possible). Same rules as before: not
  cancelled, and checkouts awaiting payment only for 2 hours.
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
   where (o.coupon_id = p_coupon
          or o.applied_promotions @> jsonb_build_array(jsonb_build_object('coupon_id', p_coupon)))
     and o.status <> 'cancelled'
     and (o.status <> 'pending_payment' or o.placed_at > now() - interval '2 hours')
     and (p_email is null or lower(o.contact_email) = lower(p_email));
$$;

/*
  May this customer buy this product now? Launched products (launch_at null or past) yes; before
  the launch only customers in one of its early-access tiers.
*/
create or replace function public.product_buyable_by(p_product uuid, p_customer uuid, p_at timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p.launch_at is null or p.launch_at <= p_at
      or (p_customer is not null and cardinality(p.early_access_tier_ids) > 0
          and (public.customer_tier(p_customer)).id = any (p.early_access_tier_ids))
    from products p where p.id = p_product;
$$;
revoke all on function public.product_buyable_by(uuid, uuid, timestamptz) from public, anon;

-- ── Promotions report ────────────────────────────────────────────────────────────────────────
/*
  Every promotion used on paid orders placed between two business days (Asia/Dubai, inclusive):
  codes, sale prices, bundles and buy X get Y offers, from orders.applied_promotions. Per promotion:
  orders, goods discount, delivery waived, sales (order totals) and the event a code belongs to.
*/
create or replace function public.promotion_performance(p_from date, p_to date)
returns table (
  kind text, promotion_id uuid, name text, code text, event_id uuid, event_name text, orders int,
  discount_fils int, delivery_discount_fils int, sales_fils int, first_order_at timestamptz,
  last_order_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with used as (
    select o.id as order_id, o.total_fils, o.placed_at, e
      from orders o, jsonb_array_elements(o.applied_promotions) e
     where public.has_permission('reports.view')
       and o.status not in ('pending_payment', 'cancelled')
       and public.business_day(o.placed_at) between p_from and p_to
  )
  select case when u.e ->> 'type' = 'code' then 'code' else u.e ->> 'kind' end,
         coalesce(u.e ->> 'coupon_id', u.e ->> 'offer_id')::uuid,
         coalesce(max(off.name), max(cp.description), max(u.e ->> 'name'), max(u.e ->> 'code')),
         max(u.e ->> 'code'),
         max(coalesce(cp.event_id::text, u.e ->> 'event_id'))::uuid,
         max(ev.name),
         count(distinct u.order_id)::int,
         coalesce(sum((u.e ->> 'discount_fils')::int), 0)::int,
         coalesce(sum(coalesce((u.e ->> 'delivery_discount_fils')::int, 0)), 0)::int,
         coalesce(sum(u.total_fils), 0)::int,
         min(u.placed_at), max(u.placed_at)
    from used u
    left join coupons cp on cp.id = (u.e ->> 'coupon_id')::uuid
    left join offers off on off.id = (u.e ->> 'offer_id')::uuid
    left join events ev on ev.id = coalesce(cp.event_id, (u.e ->> 'event_id')::uuid)
   group by 1, 2, coalesce(u.e ->> 'code', '')
   order by sum((u.e ->> 'discount_fils')::int + coalesce((u.e ->> 'delivery_discount_fils')::int, 0)) desc, 3;
$$;
revoke all on function public.promotion_performance(date, date) from public, anon;
