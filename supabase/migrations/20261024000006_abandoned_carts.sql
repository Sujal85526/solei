-- Phase 2 abandoned carts. Signed-in customers' bags are mirrored here (the bag itself stays in the
-- browser); a bag left untouched gets up to two reminder emails, timed by the owner (Admin →
-- Abandoned carts → Settings). Customers can opt out from the email or their account. Paying for an
-- order closes the open bag; it counts as "recovered" when a reminder had gone out.
-- Mirrors src/modules/carts.

alter table public.settings
  add column cart_reminders_enabled boolean not null default true,
  add column cart_reminder_first_hours int not null default 4
    check (cart_reminder_first_hours between 1 and 168),
  -- null = one reminder only.
  add column cart_reminder_second_hours int default 48
    check (cart_reminder_second_hours between 2 and 720);
alter table public.settings add constraint settings_cart_reminder_order
  check (cart_reminder_second_hours is null or cart_reminder_second_hours > cart_reminder_first_hours);

create type public.cart_status as enum ('open', 'converted', 'emptied');

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  name text,
  status public.cart_status not null default 'open',
  -- [{ variant_id, qty }] as the customer left it.
  lines jsonb not null default '[]'::jsonb,
  item_count int not null default 0,
  -- Catalogue value when last changed (display only; the reminder re-prices).
  value_fils int not null default 0,
  reminders_sent int not null default 0 check (reminders_sent between 0 and 2),
  last_reminder_at timestamptz,
  link_opened_at timestamptz,
  order_id uuid references public.orders (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  -- Last change by the customer (reminder timing counts from here).
  updated_at timestamptz not null default now()
);
-- At most one open bag per customer.
create unique index carts_one_open on public.carts (user_id) where status = 'open';
create index carts_status_updated_idx on public.carts (status, updated_at desc);

create table public.cart_reminder_optouts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.carts enable row level security;
alter table public.cart_reminder_optouts enable row level security;
-- Staff read; customers read their own; all writes go through the functions below (service role).
create policy carts_staff_read on public.carts for select using (public.has_permission('customers.view'));
create policy carts_own_read on public.carts for select using (user_id = auth.uid());
create policy cart_optouts_own_read on public.cart_reminder_optouts
  for select using (user_id = auth.uid() or public.has_permission('customers.view'));

/*
  Mirror a signed-in customer's bag. Empty lines close the open bag ("emptied"). Prices come from
  the catalogue. Returns the open cart id (null when emptied).
*/
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
  select coalesce(jsonb_agg(jsonb_build_object('variant_id', v.id, 'qty', (l ->> 'qty')::int)
                            order by o), '[]'::jsonb),
         coalesce(sum((l ->> 'qty')::int), 0),
         coalesce(sum(v.price_fils * (l ->> 'qty')::int), 0)
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

-- A paid website order closes the buyer's open bag (matched by the account email) — or the bag the
-- order page just emptied, which can happen a moment before the payment is processed.
create or replace function public.cart_order_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from orders where id = p_order_id;
  if not found or v_order.channel <> 'website' or v_order.contact_email is null then return; end if;
  update carts set status = 'converted', order_id = p_order_id, closed_at = now()
   where email = lower(v_order.contact_email)
     and (status = 'open' or (status = 'emptied' and closed_at > now() - interval '1 hour'
                              and order_id is null));
end;
$$;

/*
  Open bags due a reminder now: idle for the first delay (no reminder yet) or the second delay (one
  sent), with reminders on, the customer not opted out or unsubscribed, and quiet for under 30 days
  (switching reminders on doesn't email ancient bags).
*/
create or replace function public.carts_due_for_reminder()
returns setof public.carts
language sql
stable
security definer
set search_path = public
as $$
  select c.*
    from carts c, settings s
   where s.id = 1 and s.cart_reminders_enabled
     and c.status = 'open' and c.item_count > 0
     and c.updated_at > now() - interval '30 days'
     and not exists (select 1 from cart_reminder_optouts o where o.user_id = c.user_id)
     and not exists (select 1 from customers cu where cu.email = c.email and cu.unsubscribed_at is not null)
     and (
       (c.reminders_sent = 0 and c.updated_at <= now() - make_interval(hours => s.cart_reminder_first_hours))
       or (c.reminders_sent = 1 and s.cart_reminder_second_hours is not null
           and c.updated_at <= now() - make_interval(hours => s.cart_reminder_second_hours))
     )
   order by c.updated_at
   limit 200;
$$;

create or replace function public.cart_reminder_sent(p_cart uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update carts set reminders_sent = least(reminders_sent + 1, 2), last_reminder_at = now() where id = p_cart;
$$;

create or replace function public.cart_set_optout(p_user uuid, p_out boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_out then
    insert into cart_reminder_optouts (user_id) values (p_user) on conflict do nothing;
  else
    delete from cart_reminder_optouts where user_id = p_user;
  end if;
end;
$$;

/*
  Admin figures since p_from: bags left (open and idle past the first delay), their value, reminders
  sent, and bags recovered (converted after a reminder) with their order value.
*/
create or replace function public.cart_stats(p_from timestamptz)
returns table (abandoned int, abandoned_fils int, reminded int, recovered int, recovered_fils int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from carts c, settings s
      where s.id = 1 and c.status = 'open' and c.item_count > 0
        and c.updated_at <= now() - make_interval(hours => s.cart_reminder_first_hours)),
    (select coalesce(sum(c.value_fils), 0)::int from carts c, settings s
      where s.id = 1 and c.status = 'open' and c.item_count > 0
        and c.updated_at <= now() - make_interval(hours => s.cart_reminder_first_hours)),
    (select count(*)::int from carts c where c.last_reminder_at >= p_from),
    (select count(*)::int from carts c
      where c.status = 'converted' and c.reminders_sent > 0 and c.closed_at >= p_from),
    (select coalesce(sum(o.total_fils), 0)::int from carts c join orders o on o.id = c.order_id
      where c.status = 'converted' and c.reminders_sent > 0 and c.closed_at >= p_from)
  where public.has_permission('customers.view');
$$;

revoke all on function public.cart_sync(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.cart_order_paid(uuid) from public, anon, authenticated;
revoke all on function public.carts_due_for_reminder() from public, anon, authenticated;
revoke all on function public.cart_reminder_sent(uuid) from public, anon, authenticated;
revoke all on function public.cart_set_optout(uuid, boolean) from public, anon, authenticated;
revoke all on function public.cart_stats(timestamptz) from public, anon;
grant execute on function public.cart_stats(timestamptz) to authenticated;

insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort) values
('cart_reminder', 'customer', 'Bag reminder', 'Sent when a signed-in customer leaves items in their bag (timing in Admin → Abandoned carts).',
 'Still thinking it over, {{customer_name}}?',
 E'Dear {{customer_name}},\n\nYou left a little piece of somewhere in your bag:\n\n{{cart_lines}}\n\n**{{cart_total}}**\n\n[Return to your bag]({{cart_link}})\n\nWith love,\nSolei\n\nDon''t want these reminders? [Turn them off]({{unsubscribe_link}}).',
 array['customer_name','cart_lines','cart_total','cart_link','unsubscribe_link'], 70)
on conflict (key) do nothing;
