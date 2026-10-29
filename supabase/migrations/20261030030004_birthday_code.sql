-- Phase 2 loyalty: the birthday reward can be a personal one-time discount code (% or AED off, valid
-- for N days), instead of or as well as the bonus points (rewards_settings.birthday_reward). The code
-- works only for that customer (coupons.customer_ids), once, on the website and at the till, and is
-- sent in the birthday email (template birthday_code). Redefines birthdays_due and points_birthday
-- from 20261024000009 (same signatures).

-- Today's birthdays (Asia/Dubai) not yet celebrated this year: customers with an email who have
-- bought at least once. 29 February birthdays are celebrated on 28 February in other years.
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
   where s.id = 1 and s.birthday_enabled
     and ((s.points_enabled and s.birthday_reward in ('points', 'both')) or s.birthday_reward in ('code', 'both'))
     and c.email is not null and c.birth_month is not null and c.birth_day is not null
     and c.birth_month = extract(month from today.d)
     and (c.birth_day = extract(day from today.d)
          or (c.birth_month = 2 and c.birth_day = 29 and extract(day from today.d) = 28
              and extract(day from (today.d + 1)) = 1))
     and exists (select 1 from orders o where o.customer_id = c.id and o.paid_at is not null
                   and o.status <> 'cancelled')
     and not exists (select 1 from points_ledger l where l.customer_id = c.id and l.entry = 'birthday'
                       and l.birthday_year = extract(year from today.d))
     and not exists (select 1 from coupons k where k.birthday_customer_id = c.id
                       and k.birthday_year = extract(year from today.d));
$$;

-- This year's birthday points, when the birthday reward includes points (idempotent per year).
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
  if not (s.points_enabled and s.birthday_enabled and s.birthday_reward in ('points', 'both')) then
    return 0;
  end if;
  insert into points_ledger (customer_id, entry, points, birthday_year, note)
  values (p_customer, 'birthday', s.birthday_points, v_year, 'Happy birthday')
  on conflict do nothing;
  return case when found then s.birthday_points else 0 end;
end;
$$;

/*
  This year's personal birthday code, when the birthday reward includes a code: one use, only for
  this customer, website and till, valid birthday_code_valid_days days from today. Idempotent per
  year (returns the same code). Returns { code, percent_bp, amount_fils, min_order_fils, ends_at }
  or null when the reward has no code.
*/
create or replace function public.birthday_code_issue(p_customer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.rewards_settings;
  v_year int := extract(year from public.business_today());
  v_code text;
  k public.coupons;
  v_name text;
  i int;
begin
  select * into s from rewards_settings where id = 1;
  if not (s.birthday_enabled and s.birthday_reward in ('code', 'both')) then return null; end if;
  select * into k from coupons where birthday_customer_id = p_customer and birthday_year = v_year;
  if not found then
    select name into v_name from customers where id = p_customer;
    for i in 1..10 loop
      v_code := 'BDAY-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                                                     1 + floor(random() * 32)::int, 1), '')
                              from generate_series(1, 6));
      exit when not exists (select 1 from coupons where code = v_code);
    end loop;
    insert into coupons (code, description, kind, percent_bp, amount_fils, starts_at, ends_at, max_uses,
                         per_customer_limit, min_order_fils, channels, customer_ids, combinable,
                         birthday_customer_id, birthday_year)
    values (v_code, left('Birthday ' || v_year || ' — ' || coalesce(v_name, 'customer'), 200),
            case when s.birthday_code_percent_bp is not null then 'percent' else 'fixed' end::public.coupon_kind,
            s.birthday_code_percent_bp, s.birthday_code_amount_fils, now(),
            (public.business_today() + s.birthday_code_valid_days)::timestamp at time zone 'Asia/Dubai',
            1, 1, s.birthday_code_min_order_fils, '{website,pos}', array[p_customer], false,
            p_customer, v_year)
    returning * into k;
  end if;
  return jsonb_build_object('code', k.code, 'percent_bp', k.percent_bp, 'amount_fils', k.amount_fils,
                            'min_order_fils', k.min_order_fils, 'ends_at', k.ends_at);
end;
$$;
revoke all on function public.birthday_code_issue(uuid) from public, anon, authenticated;

insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort) values
('birthday_code', 'customer', 'Birthday code', 'Sent on the customer''s birthday when the birthday reward includes a discount code (Admin → Loyalty → Points & tiers).',
 'Happy birthday, {{customer_name}} — a gift from Solei',
 E'Dear {{customer_name}},\n\nHappy birthday from all of us at Solei. Here is your personal birthday code: **{{code}}** — {{discount}} your next order, online or at our events, until {{valid_until}}.\n\n{{points_note}}\n\n[Choose your next destination]({{shop_link}})\n\nWith love,\nSolei',
 array['customer_name','code','discount','valid_until','points_note','shop_link'], 76)
on conflict (key) do nothing;
