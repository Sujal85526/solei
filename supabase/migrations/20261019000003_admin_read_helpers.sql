-- Admin read helpers (performance + correctness): totals the admin pages used to add up in the
-- app over every row (one extra round trip each, and wrong past the 1,000-row API cap).

-- On hand per variant, all locations (caller's RLS applies, like stock_levels). Lets the product
-- list / product page read stock alongside the products instead of after them.
create or replace function public.stock_on_hand_by_variant()
returns table (variant_id uuid, on_hand int)
language sql
stable
security invoker
set search_path = public
as $$
  select m.variant_id, sum(m.qty)::int
    from stock_movements m
   group by m.variant_id;
$$;

-- Uses and discount given per coupon — same counting rule as coupon_uses() (not cancelled; an
-- unpaid website checkout counts for 2 hours). Coupon managers only.
create or replace function public.coupon_usage()
returns table (coupon_id uuid, uses int, discount_fils int)
language sql
stable
security definer
set search_path = public
as $$
  select o.coupon_id, count(*)::int, coalesce(sum(o.discount_fils), 0)::int
    from orders o
   where public.has_permission('coupons.manage')
     and o.coupon_id is not null
     and o.status <> 'cancelled'
     and (o.status <> 'pending_payment' or o.placed_at > now() - interval '2 hours')
   group by o.coupon_id;
$$;
revoke all on function public.coupon_usage() from public, anon;

-- Reviews per status for the admin tabs (caller's RLS applies: reviews.manage sees all).
create or replace function public.review_status_counts()
returns table (status public.review_status, count int)
language sql
stable
security invoker
set search_path = public
as $$
  select r.status, count(*)::int from product_reviews r group by r.status;
$$;
