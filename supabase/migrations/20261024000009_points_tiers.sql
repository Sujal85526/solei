-- Phase 2 loyalty: points, VIP tiers and a birthday bonus, beside the Solei Passport (which is not
-- touched: stamps keep working exactly as before). Everything is off until the owner switches it
-- on (rewards_settings.points_enabled = false); every rate, threshold and reward is editable in
-- Admin → Loyalty → Points & tiers. Mirrors src/modules/points.
--
--   · earn: when an order is paid — whole AED actually paid (not by gift card or points) × points
--     per AED × the customer's tier multiplier. Gift card purchases don't earn.
--   · tiers: by spend in the last 12 months (paid orders, same basis); multiplier + perks text.
--   · spend: at website checkout, as a payment (payments.method = loyalty_points) worth
--     point_value_fils each, from min_redeem_points up. Refunds/cancellations give points back.
--   · birthday: bonus points once a year on the customer's birthday (day + month only), with an
--     email; sent by /api/cron/birthdays or "Send today's birthday bonuses" in the admin.
--   · balance = sum of points_ledger (never a mutable column).

create table public.rewards_settings (
  id smallint primary key default 1 check (id = 1),
  points_enabled boolean not null default false,
  points_per_aed int not null default 1 check (points_per_aed between 1 and 100),
  -- What one point is worth when spent (5 fils = AED 0.05 → 100 points = AED 5).
  point_value_fils int not null default 5 check (point_value_fils between 1 and 10000),
  min_redeem_points int not null default 200 check (min_redeem_points >= 1),
  birthday_enabled boolean not null default true,
  birthday_points int not null default 250 check (birthday_points between 1 and 100000),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.rewards_settings (id) values (1);

create table public.loyalty_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 40),
  -- Spend in the last 12 months needed to be in this tier (the lowest tier has 0).
  min_spend_fils int not null check (min_spend_fils >= 0),
  -- 10000 = ×1 points; 15000 = ×1.5.
  points_multiplier_bp int not null default 10000 check (points_multiplier_bp between 10000 and 50000),
  perks text check (length(perks) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index loyalty_tiers_min_spend_key on public.loyalty_tiers (min_spend_fils);
insert into public.loyalty_tiers (name, min_spend_fils, points_multiplier_bp, perks) values
  ('Explorer', 0, 10000, 'Points on every order and a birthday bonus.'),
  ('Voyager', 100000, 12500, '×1.25 points.'),
  ('Globetrotter', 300000, 15000, '×1.5 points and first look at new destinations.');

alter table public.customers
  add column birth_month smallint check (birth_month between 1 and 12),
  add column birth_day smallint check (birth_day between 1 and 31);

create type public.points_entry as enum ('earn', 'redeem', 'refund', 'reverse', 'adjust', 'birthday');

create table public.points_ledger (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.customers (id) on delete cascade,
  entry public.points_entry not null,
  points int not null check (points <> 0),
  -- Money behind the entry where there is some (spent / given back), for the reports.
  value_fils int,
  order_id uuid references public.orders (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  birthday_year int,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index points_ledger_customer_idx on public.points_ledger (customer_id, created_at desc);
-- One earn per order; one birthday bonus per customer per year.
create unique index points_ledger_one_earn on public.points_ledger (order_id) where entry = 'earn';
create unique index points_ledger_one_birthday on public.points_ledger (customer_id, birthday_year)
  where entry = 'birthday';

create trigger rewards_settings_updated_at before update on public.rewards_settings
  for each row execute function public.set_updated_at();
create trigger loyalty_tiers_updated_at before update on public.loyalty_tiers
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.rewards_settings
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.loyalty_tiers
  for each row execute function public.audit_row_change();

alter table public.rewards_settings enable row level security;
alter table public.loyalty_tiers enable row level security;
alter table public.points_ledger enable row level security;
-- The programme (settings, tiers) is public, like the Passport rules; edits need loyalty.manage.
create policy rewards_settings_read on public.rewards_settings for select using (true);
create policy rewards_settings_write on public.rewards_settings for update
  using (public.has_permission('loyalty.manage')) with check (public.has_permission('loyalty.manage'));
create policy loyalty_tiers_read on public.loyalty_tiers for select using (true);
create policy loyalty_tiers_write on public.loyalty_tiers for all
  using (public.has_permission('loyalty.manage')) with check (public.has_permission('loyalty.manage'));
create policy points_ledger_read on public.points_ledger for select
  using (public.has_permission('loyalty.view') or public.is_own_customer(customer_id));

create or replace function public.points_balance(p_customer uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(points), 0)::int from points_ledger where customer_id = p_customer;
$$;

-- What the customer actually paid on an order (not by gift card or points), net of refunds.
create or replace function public.order_cash_paid(p_order_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, coalesce(sum(case when kind = 'payment' then amount_fils else -amount_fils end), 0))::int
    from payments
   where order_id = p_order_id and status = 'succeeded'
     and method not in ('gift_card', 'loyalty_points');
$$;

-- Spend that counts for tiers: paid orders in the last 12 months (gift card purchases excluded).
create or replace function public.customer_tier_spend(p_customer uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(public.order_cash_paid(o.id)), 0)::int
    from orders o
   where o.customer_id = p_customer and o.paid_at is not null and o.status <> 'cancelled'
     and not o.gift_card_purchase and o.paid_at > now() - interval '12 months';
$$;

create or replace function public.customer_tier(p_customer uuid)
returns public.loyalty_tiers
language sql
stable
security definer
set search_path = public
as $$
  select t.* from loyalty_tiers t
   where t.min_spend_fils <= public.customer_tier_spend(p_customer)
   order by t.min_spend_fils desc
   limit 1;
$$;

/*
  Points for a paid order (called from after_order_paid; idempotent per order). The tier is the one
  the customer held before this order.
*/
create or replace function public.points_award_order(p_order_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.rewards_settings;
  o public.orders;
  v_tier public.loyalty_tiers;
  v_spend int;
  v_points int;
begin
  select * into s from rewards_settings where id = 1;
  if not s.points_enabled then return 0; end if;
  select * into o from orders where id = p_order_id;
  if o.customer_id is null or o.gift_card_purchase then return 0; end if;
  if exists (select 1 from points_ledger where order_id = p_order_id and entry = 'earn') then return 0; end if;

  -- Tier before this order: its own spend doesn't count yet.
  v_spend := public.customer_tier_spend(o.customer_id) - public.order_cash_paid(p_order_id);
  select * into v_tier from loyalty_tiers where min_spend_fils <= greatest(v_spend, 0)
   order by min_spend_fils desc limit 1;

  v_points := (public.order_cash_paid(p_order_id) / 100)::bigint * s.points_per_aed
              * coalesce(v_tier.points_multiplier_bp, 10000) / 10000;
  if v_points <= 0 then return 0; end if;
  insert into points_ledger (customer_id, entry, points, order_id, note)
  values (o.customer_id, 'earn', v_points, p_order_id, coalesce(v_tier.name, 'Points'));
  return v_points;
end;
$$;

-- A cancelled order takes back the points it earned (spent points come back via its refund).
create or replace function public.points_reverse_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
begin
  for e in select * from points_ledger where order_id = p_order_id and entry = 'earn' loop
    if not exists (select 1 from points_ledger where order_id = p_order_id and entry = 'reverse') then
      insert into points_ledger (customer_id, entry, points, order_id, note, created_by)
      values (e.customer_id, 'reverse', -e.points, p_order_id, 'Order cancelled', auth.uid());
    end if;
  end loop;
end;
$$;

/*
  Same 24-hour rule as gift cards: points held by a website checkout that was never paid go back
  (a refund payment, which the trigger below turns into points).
*/
create or replace function public.points_release_stale()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select o.id,
           sum(p.amount_fils) filter (where p.kind = 'payment') as paid,
           coalesce(sum(p.amount_fils) filter (where p.kind = 'refund'), 0) as refunded
      from orders o
      join payments p on p.order_id = o.id and p.method = 'loyalty_points' and p.status = 'succeeded'
     where o.status = 'pending_payment' and o.created_at < now() - interval '24 hours'
     group by o.id
    having sum(p.amount_fils) filter (where p.kind = 'payment')
           > coalesce(sum(p.amount_fils) filter (where p.kind = 'refund'), 0)
  loop
    insert into payments (order_id, kind, amount_fils, method, status, note, received_at)
    values (r.id, 'refund', r.paid - r.refunded, 'loyalty_points', 'succeeded',
            'Checkout not completed in 24 hours — points given back', now());
    n := n + 1;
  end loop;
  return n;
end;
$$;

/*
  Spend points on an order: p_points × point_value_fils as a succeeded loyalty_points payment and a
  ledger debit, with the customer's row locked. Needs the programme on, at least min_redeem_points
  and enough balance. Returns the payment id.
*/
create or replace function public.points_redeem(p_customer uuid, p_points int, p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.rewards_settings;
  v_balance int;
  v_value int;
  v_payment uuid;
begin
  select * into s from rewards_settings where id = 1;
  if not s.points_enabled then
    raise exception 'points can''t be used right now' using errcode = 'P0001';
  end if;
  perform public.points_release_stale();
  perform 1 from customers where id = p_customer for update;
  v_balance := public.points_balance(p_customer);
  if p_points is null or p_points < s.min_redeem_points then
    raise exception 'use at least % points', s.min_redeem_points using errcode = 'P0001';
  end if;
  if p_points > v_balance then
    raise exception 'your points balance changed — please review your order' using errcode = 'P0001';
  end if;
  v_value := p_points * s.point_value_fils;
  insert into payments (order_id, kind, amount_fils, method, status, reference, received_by, received_at)
  values (p_order_id, 'payment', v_value, 'loyalty_points', 'succeeded', p_points || ' points',
          auth.uid(), now())
  returning id into v_payment;
  insert into points_ledger (customer_id, entry, points, value_fils, order_id, payment_id, created_by)
  values (p_customer, 'redeem', -p_points, v_value, p_order_id, v_payment, auth.uid());
  return v_payment;
end;
$$;

-- A loyalty_points refund gives the points back at the rate they were spent.
create or replace function public.points_on_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_points int;
  v_fils int;
  v_back int;
begin
  select customer_id, -sum(points), sum(value_fils) into v_customer, v_points, v_fils
    from points_ledger where order_id = new.order_id and entry = 'redeem'
   group by customer_id;
  if v_customer is null or coalesce(v_fils, 0) = 0 then
    raise exception 'this order wasn''t paid with points' using errcode = 'P0001';
  end if;
  v_back := round(new.amount_fils::numeric * v_points / v_fils)::int;
  if v_back > 0 then
    insert into points_ledger (customer_id, entry, points, value_fils, order_id, payment_id, note, created_by)
    values (v_customer, 'refund', v_back, new.amount_fils, new.order_id, new.id, new.note, auth.uid());
  end if;
  return new;
end;
$$;
create trigger points_refund after insert on public.payments
  for each row when (new.kind = 'refund' and new.method = 'loyalty_points' and new.status = 'succeeded')
  execute function public.points_on_refund();

-- Staff add or take off points by hand (loyalty.adjust), never below zero.
create or replace function public.points_adjust(p_customer uuid, p_points int, p_reason text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  perform public.require_permission('loyalty.adjust');
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  if p_points is null or p_points = 0 then raise exception 'enter points' using errcode = '22023'; end if;
  perform 1 from customers where id = p_customer for update;
  v_balance := public.points_balance(p_customer);
  if v_balance + p_points < 0 then
    raise exception 'the balance can''t go below zero' using errcode = 'P0001';
  end if;
  insert into points_ledger (customer_id, entry, points, note, created_by)
  values (p_customer, 'adjust', p_points, left(trim(p_reason), 300), auth.uid());
  return v_balance + p_points;
end;
$$;

/*
  Today's birthdays (Asia/Dubai) not yet given this year's bonus: customers with an email who have
  bought at least once. 29 February birthdays are celebrated on 28 February in other years.
*/
create or replace function public.birthdays_due()
returns table (customer_id uuid, name text, email text)
language sql
stable
security definer
set search_path = public
as $$
  with today as (select public.business_today() as d)
  select c.id, c.name, c.email
    from customers c, today, rewards_settings s
   where s.id = 1 and s.points_enabled and s.birthday_enabled
     and c.email is not null and c.birth_month is not null and c.birth_day is not null
     and c.birth_month = extract(month from today.d)
     and (c.birth_day = extract(day from today.d)
          or (c.birth_month = 2 and c.birth_day = 29 and extract(day from today.d) = 28
              and extract(day from (today.d + 1)) = 1))
     and exists (select 1 from orders o where o.customer_id = c.id and o.paid_at is not null
                   and o.status <> 'cancelled')
     and not exists (select 1 from points_ledger l where l.customer_id = c.id and l.entry = 'birthday'
                       and l.birthday_year = extract(year from today.d));
$$;

-- Give this year's birthday bonus (idempotent per year). Returns the points given (0 if already).
create or replace function public.points_birthday(p_customer uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.rewards_settings;
  v_year int := extract(year from public.business_today());
begin
  select * into s from rewards_settings where id = 1;
  if not (s.points_enabled and s.birthday_enabled) then return 0; end if;
  insert into points_ledger (customer_id, entry, points, birthday_year, note)
  values (p_customer, 'birthday', s.birthday_points, v_year, 'Happy birthday')
  on conflict do nothing;
  return case when found then s.birthday_points else 0 end;
end;
$$;

/*
  A customer's points page: balance and its value, tier (with the next one and how far), and the
  latest entries. Staff with loyalty.view, or the customer themselves.
*/
create or replace function public.points_summary(p_customer uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.rewards_settings;
  v_spend int;
  v_tier public.loyalty_tiers;
  v_next public.loyalty_tiers;
  v_balance int;
begin
  if not (public.has_permission('loyalty.view') or public.is_own_customer(p_customer)
          or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into s from rewards_settings where id = 1;
  v_spend := public.customer_tier_spend(p_customer);
  select * into v_tier from loyalty_tiers where min_spend_fils <= v_spend order by min_spend_fils desc limit 1;
  select * into v_next from loyalty_tiers where min_spend_fils > v_spend order by min_spend_fils limit 1;
  v_balance := public.points_balance(p_customer);
  return jsonb_build_object(
    'enabled', s.points_enabled,
    'balance', v_balance,
    'balance_value_fils', v_balance * s.point_value_fils,
    'min_redeem_points', s.min_redeem_points,
    'point_value_fils', s.point_value_fils,
    'spend_12m_fils', v_spend,
    'tier', case when v_tier.id is null then null else jsonb_build_object(
      'name', v_tier.name, 'multiplier_bp', v_tier.points_multiplier_bp, 'perks', v_tier.perks) end,
    'next_tier', case when v_next.id is null then null else jsonb_build_object(
      'name', v_next.name, 'min_spend_fils', v_next.min_spend_fils,
      'to_go_fils', v_next.min_spend_fils - v_spend) end,
    'recent', coalesce((select jsonb_agg(jsonb_build_object('entry', l.entry, 'points', l.points,
                         'note', l.note, 'order_id', l.order_id, 'created_at', l.created_at)
                         order by l.id desc)
                       from (select * from points_ledger where customer_id = p_customer
                              order by id desc limit 20) l), '[]'::jsonb)
  );
end;
$$;

-- Admin figures: members with points, points outstanding and their value, earned / spent in 30 days.
create or replace function public.points_overview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'members', (select count(*) from (select customer_id from points_ledger group by customer_id
                                       having sum(points) > 0) m),
    'outstanding_points', (select coalesce(sum(points), 0) from points_ledger),
    'outstanding_value_fils', (select coalesce(sum(points), 0) from points_ledger)
                               * (select point_value_fils from rewards_settings where id = 1),
    'earned_30d', (select coalesce(sum(points), 0) from points_ledger
                    where entry in ('earn', 'birthday') and created_at > now() - interval '30 days'),
    'spent_30d', (select coalesce(-sum(points), 0) from points_ledger
                   where entry = 'redeem' and created_at > now() - interval '30 days'),
    'tiers', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'members', t.n) order by t.min_spend_fils), '[]'::jsonb)
                from (select lt.name, lt.min_spend_fils,
                             (select count(*) from customers c where (public.customer_tier(c.id)).id = lt.id
                                and exists (select 1 from orders o where o.customer_id = c.id and o.paid_at is not null)) as n
                        from loyalty_tiers lt) t)
  )
  where public.has_permission('loyalty.view');
$$;

revoke all on function public.order_cash_paid(uuid) from public, anon, authenticated;
revoke all on function public.customer_tier_spend(uuid) from public, anon, authenticated;
revoke all on function public.customer_tier(uuid) from public, anon, authenticated;
revoke all on function public.points_award_order(uuid) from public, anon, authenticated;
revoke all on function public.points_reverse_order(uuid) from public, anon, authenticated;
revoke all on function public.points_release_stale() from public, anon, authenticated;
revoke all on function public.points_redeem(uuid, int, uuid) from public, anon, authenticated;
revoke all on function public.points_on_refund() from public, anon, authenticated;
revoke all on function public.birthdays_due() from public, anon, authenticated;
revoke all on function public.points_birthday(uuid) from public, anon, authenticated;
revoke all on function public.points_balance(uuid) from public, anon;
revoke all on function public.points_adjust(uuid, int, text) from public, anon;
revoke all on function public.points_summary(uuid) from public, anon;
revoke all on function public.points_overview() from public, anon;
grant execute on function public.points_adjust(uuid, int, text) to authenticated;
grant execute on function public.points_summary(uuid) to authenticated;
grant execute on function public.points_overview() to authenticated;

insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort) values
('birthday_points', 'customer', 'Birthday bonus', 'Sent on the customer''s birthday with their bonus points (Admin → Loyalty → Points & tiers).',
 'Happy birthday, {{customer_name}}',
 E'Dear {{customer_name}},\n\nHappy birthday from all of us at Solei. We''ve added **{{points}} points** to your account — you now have {{balance}} points, worth {{balance_value}}.\n\n[Choose your next destination]({{shop_link}})\n\nWith love,\nSolei',
 array['customer_name','points','balance','balance_value','shop_link'], 75)
on conflict (key) do nothing;

-- ── Redefinitions: the previous definition plus the points steps ─────────────────────────────
-- after_order_paid / after_order_cancelled from 20261024000004, create_web_order from 20261024000005.

create or replace function public.after_order_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_order_stock(p_order_id);
  begin
    perform public.loyalty_award_order(p_order_id);
  exception when others then
    perform public.write_audit('loyalty.award_failed', 'orders', p_order_id::text, null,
      jsonb_build_object('error', sqlerrm, 'state', sqlstate));
  end;
  perform public.gift_cards_activate_for_order(p_order_id);
  -- Points never block a payment (like the Passport stamps).
  begin
    perform public.points_award_order(p_order_id);
  exception when others then
    perform public.write_audit('points.award_failed', 'orders', p_order_id::text, null,
      jsonb_build_object('error', sqlerrm, 'state', sqlstate));
  end;
end;
$$;

create or replace function public.after_order_cancelled(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_net int;
  v_method public.payment_method;
  r record;
begin
  begin
    perform public.loyalty_reverse_order(p_order_id, 'Order cancelled', true);
  exception when others then
    perform public.write_audit('loyalty.reverse_failed', 'orders', p_order_id::text, null,
      jsonb_build_object('error', sqlerrm, 'state', sqlstate));
  end;

  -- Gift card money and points spent on the order go back (refund payments; triggers credit them).
  foreach v_method in array array['gift_card', 'loyalty_points']::public.payment_method[] loop
    select coalesce(sum(case when kind = 'payment' then amount_fils else -amount_fils end), 0)
      into v_net
      from payments
     where order_id = p_order_id and method = v_method and status = 'succeeded';
    if v_net > 0 then
      insert into payments (order_id, kind, amount_fils, method, status, note, received_by, received_at)
      values (p_order_id, 'refund', v_net, v_method, 'succeeded', 'Order cancelled', auth.uid(), now());
    end if;
  end loop;

  begin
    perform public.points_reverse_order(p_order_id);
  exception when others then
    perform public.write_audit('points.reverse_failed', 'orders', p_order_id::text, null,
      jsonb_build_object('error', sqlerrm, 'state', sqlstate));
  end;

  for r in select id, status from gift_cards where purchase_order_id = p_order_id and status <> 'void' loop
    if r.status = 'active' and public.gift_card_balance(r.id) > 0 then
      insert into gift_card_ledger (gift_card_id, entry, amount_fils, order_id, note, created_by)
      values (r.id, 'void', -public.gift_card_balance(r.id), p_order_id, 'Purchase cancelled', auth.uid());
    end if;
    update gift_cards set status = 'void', voided_at = now(), void_reason = 'Purchase cancelled'
     where id = r.id;
  end loop;
end;
$$;

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

  -- Points first, then a gift card: both spent in the same transaction; the order settles at once
  -- when together they cover it.
  if v_points > 0 then
    perform public.points_redeem(v_customer, v_points, v_order.id);
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
