-- Customers CRM (milestone 10): one row per customer with purchase stats across every channel.
--
-- security_invoker: the caller's RLS applies to customers, orders and payments, so a staff
-- member sees a customer only with customers.view and order totals only with orders.view.
--
-- Purchases = orders that are not awaiting online payment and not cancelled.
-- total_spent_fils = money actually received for the customer's orders: succeeded payments
-- minus succeeded refunds (partial payments count for what was paid; refunds net out).

create view public.customer_summary
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
  s.last_purchase_at
from public.customers c
left join (
  select
    o.customer_id,
    count(*) filter (where o.status not in ('pending_payment', 'cancelled')) as order_count,
    sum(ps.paid_fils - ps.refunded_fils) as total_spent_fils,
    min(o.placed_at) filter (where o.status not in ('pending_payment', 'cancelled')) as first_purchase_at,
    max(o.placed_at) filter (where o.status not in ('pending_payment', 'cancelled')) as last_purchase_at
  from public.orders o
  join public.order_payment_summary ps on ps.order_id = o.id
  where o.customer_id is not null
  group by o.customer_id
) s on s.customer_id = c.id;

revoke all on public.customer_summary from anon;
grant select on public.customer_summary to authenticated;

-- Admin search matches part of an email address (name and phone already have trigram indexes).
create index customers_email_trgm_idx on public.customers using gin (email extensions.gin_trgm_ops);
