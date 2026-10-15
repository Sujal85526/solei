-- Admin stat chips computed in the database (one request, exact past the 1,000-row API cap).
-- security invoker: the caller's RLS applies, exactly as with the previous row-by-row reads.

create or replace function public.admin_order_stats(p_day_start timestamptz, p_day_end timestamptz)
returns table (today_count bigint, today_revenue_fils bigint, outstanding_count bigint, outstanding_fils bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) filter (where placed_at >= p_day_start and placed_at < p_day_end),
    coalesce(sum(total_fils) filter (where placed_at >= p_day_start and placed_at < p_day_end), 0),
    count(*) filter (where outstanding_fils > 0),
    coalesce(sum(outstanding_fils) filter (where outstanding_fils > 0), 0)
  from admin_orders
  where status not in ('pending_payment', 'cancelled');
$$;

create or replace function public.booking_status_counts()
returns table (status public.booking_status, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select status, count(*) from bookings group by status;
$$;

revoke execute on function public.admin_order_stats(timestamptz, timestamptz) from public, anon;
revoke execute on function public.booking_status_counts() from public, anon;
grant execute on function public.admin_order_stats(timestamptz, timestamptz) to authenticated;
grant execute on function public.booking_status_counts() to authenticated;
