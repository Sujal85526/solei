-- Phase 2 CRM: automatic customer labels — New, Returning, VIP, Inactive — worked out from each
-- customer's purchases with rules the owner edits (Admin → Customers → Labels). Never typed by hand.
-- Additive for main: new settings columns with defaults; customer_summary keeps its columns and
-- gains two at the end; segment_members keeps its signature and gains a `labels` rule.

alter table public.settings
  -- VIP: spent at least this much (fils, after refunds) in the last N months.
  add column label_vip_spend_fils int not null default 200000 check (label_vip_spend_fils >= 0),
  add column label_vip_months int not null default 12 check (label_vip_months between 1 and 60),
  -- Inactive: no purchase in the last N days.
  add column label_inactive_days int not null default 180 check (label_inactive_days between 7 and 1825),
  -- New: first purchase in the last N days.
  add column label_new_days int not null default 30 check (label_new_days between 1 and 365),
  -- Returning: at least this many purchases.
  add column label_returning_orders int not null default 2 check (label_returning_orders between 2 and 50);

/*
  The label for a customer's purchase stats. First match wins: VIP, Inactive, New, Returning.
  Customers with no purchases (or one older purchase that is neither new nor inactive) have none.
  Mirrored in src/modules/customers/labels.ts.
*/
create or replace function public.customer_label(
  p_orders int, p_first timestamptz, p_last timestamptz, p_recent_spent int
)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(p_orders, 0) = 0 then null
    when coalesce(p_recent_spent, 0) >= s.label_vip_spend_fils and s.label_vip_spend_fils > 0 then 'vip'
    when p_last < now() - make_interval(days => s.label_inactive_days) then 'inactive'
    when p_first >= now() - make_interval(days => s.label_new_days) then 'new'
    when p_orders >= s.label_returning_orders then 'returning'
  end
  from settings s where s.id = 1;
$$;

-- Same view, two columns added at the end: spend in the VIP window and the label.
create or replace view public.customer_summary
with (security_invoker = true) as
select
  c.id,
  c.name,
  c.phone,
  c.email,
  c.emirate,
  c.source,
  c.marketing_consent,
  c.marketing_consent_at,
  c.marketing_channels,
  c.unsubscribed_at,
  c.created_at,
  coalesce(s.order_count, 0)::int as order_count,
  coalesce(s.total_spent_fils, 0)::int as total_spent_fils,
  s.first_purchase_at,
  s.last_purchase_at,
  coalesce(s.recent_spent_fils, 0)::int as recent_spent_fils,
  public.customer_label(s.order_count::int, s.first_purchase_at, s.last_purchase_at,
                        s.recent_spent_fils::int) as label
from public.customers c
left join (
  select
    o.customer_id,
    count(*) filter (where o.status not in ('pending_payment', 'cancelled')) as order_count,
    sum(ps.paid_fils - ps.refunded_fils) as total_spent_fils,
    min(o.placed_at) filter (where o.status not in ('pending_payment', 'cancelled')) as first_purchase_at,
    max(o.placed_at) filter (where o.status not in ('pending_payment', 'cancelled')) as last_purchase_at,
    sum(ps.paid_fils - ps.refunded_fils) filter (
      where o.placed_at >= now() - make_interval(months => st.label_vip_months)) as recent_spent_fils
  from public.orders o
  join public.order_payment_summary ps on ps.order_id = o.id
  cross join public.settings st
  where o.customer_id is not null and st.id = 1
  group by o.customer_id
) s on s.customer_id = c.id;

/*
  segment_members (20261024000007) with one more rule:
    labels    the customer's label is one of these ('new' | 'returning' | 'vip' | 'inactive')
*/
create or replace function public.segment_members(p_rules jsonb)
returns table (
  customer_id uuid, name text, email text, emirate public.emirate, total_spent_fils int, order_count int,
  last_purchase_at timestamptz, has_passport boolean, emailable boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r jsonb := coalesce(p_rules, '{}'::jsonb);
begin
  -- Staff with marketing.manage, or the sending service (service role).
  if not (public.has_permission('marketing.manage') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  with stats as (
    select o.customer_id as cid,
           count(*) filter (where o.status not in ('pending_payment', 'cancelled'))::int as orders,
           coalesce(sum(ps.paid_fils - ps.refunded_fils), 0)::int as spent,
           min(o.placed_at) filter (where o.status not in ('pending_payment', 'cancelled')) as first_at,
           max(o.placed_at) filter (where o.status not in ('pending_payment', 'cancelled')) as last_at,
           coalesce(sum(ps.paid_fils - ps.refunded_fils) filter (
             where o.placed_at >= now() - make_interval(months => st.label_vip_months)), 0)::int as recent
      from orders o join order_payment_summary ps on ps.order_id = o.id
      cross join settings st
     where o.customer_id is not null and st.id = 1
     group by o.customer_id
  )
  select c.id, c.name, c.email, c.emirate, coalesce(s.spent, 0), coalesce(s.orders, 0), s.last_at,
         exists (select 1 from passports p where p.customer_id = c.id),
         (c.email is not null and c.marketing_consent and 'email' = any (c.marketing_channels)
          and c.unsubscribed_at is null)
    from customers c
    left join stats s on s.cid = c.id
   where (r ->> 'min_spent_fils' is null or coalesce(s.spent, 0) >= (r ->> 'min_spent_fils')::int)
     and (r ->> 'max_spent_fils' is null or coalesce(s.spent, 0) <= (r ->> 'max_spent_fils')::int)
     and (r ->> 'min_orders' is null or coalesce(s.orders, 0) >= (r ->> 'min_orders')::int)
     and (r ->> 'purchased_within_days' is null
          or s.last_at >= now() - make_interval(days => (r ->> 'purchased_within_days')::int))
     and (r ->> 'not_purchased_days' is null or s.last_at is null
          or s.last_at < now() - make_interval(days => (r ->> 'not_purchased_days')::int))
     and (jsonb_array_length(coalesce(r -> 'destination_ids', '[]'::jsonb)) = 0
          or exists (
            select 1 from orders o join order_lines l on l.order_id = o.id
             where o.customer_id = c.id and o.status not in ('pending_payment', 'cancelled')
               and l.destination_id in (select (jsonb_array_elements_text(r -> 'destination_ids'))::uuid)))
     and (r ->> 'passport' is null
          or (r ->> 'passport' = 'has' and exists (select 1 from passports p where p.customer_id = c.id))
          or (r ->> 'passport' = 'none' and not exists (select 1 from passports p where p.customer_id = c.id))
          or (r ->> 'passport' = 'reward' and exists (
                select 1 from loyalty_rewards lr where lr.customer_id = c.id and lr.status = 'available')))
     and (jsonb_array_length(coalesce(r -> 'emirates', '[]'::jsonb)) = 0
          or c.emirate::text in (select jsonb_array_elements_text(r -> 'emirates')))
     and (jsonb_array_length(coalesce(r -> 'labels', '[]'::jsonb)) = 0
          or public.customer_label(s.orders, s.first_at, s.last_at, s.recent)
             in (select jsonb_array_elements_text(r -> 'labels')))
     and (coalesce(r ->> 'consent', 'any') <> 'opted_in'
          or (c.marketing_consent and c.unsubscribed_at is null))
   order by coalesce(s.spent, 0) desc, c.created_at;
end;
$$;

revoke all on public.customer_summary from anon;
grant select on public.customer_summary to authenticated;
