-- One sales ledger: every sale from every channel is an order. Payments are separate rows;
-- payment status is derived (order_payment_summary), never typed in.

create type public.order_channel as enum ('website', 'pos', 'whatsapp', 'direct', 'payment_link', 'booking');
create type public.order_status as enum (
  'pending_payment', 'new', 'preparing', 'dispatched', 'delivered', 'completed', 'cancelled'
);
create type public.fulfilment_type as enum ('delivery', 'pickup', 'handed_over');
create type public.payment_method as enum (
  'online_card', 'apple_pay', 'cash', 'card_terminal', 'soft_pos', 'bank_transfer', 'payment_link', 'other'
);
create type public.payment_state as enum ('pending', 'succeeded', 'failed', 'cancelled');
create type public.payment_kind as enum ('payment', 'refund');

create sequence public.order_number_seq start 1001;

create or replace function public.next_order_number()
returns text
language sql
volatile
as $$
  select 'SOL-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default public.next_order_number(),
  customer_id uuid references public.customers (id) on delete set null,
  channel public.order_channel not null,
  event_id uuid references public.events (id) on delete set null,
  event_day date,
  booking_id uuid,                                  -- FK added with bookings
  staff_id uuid references auth.users (id) on delete set null,
  status public.order_status not null default 'new',
  fulfilment public.fulfilment_type not null default 'handed_over',
  -- Contact snapshot at time of order (customer record may change later).
  contact_name text,
  contact_phone text,
  contact_email text,
  delivery_address jsonb,
  delivery_emirate public.emirate,
  delivery_fee_fils int not null default 0 check (delivery_fee_fils >= 0),
  subtotal_fils int not null default 0 check (subtotal_fils >= 0),
  discount_fils int not null default 0 check (discount_fils >= 0),
  vat_fils int not null default 0 check (vat_fils >= 0),
  total_fils int not null default 0 check (total_fils >= 0),
  vat_rate_bp int not null default 0 check (vat_rate_bp between 0 and 10000),
  prices_include_vat boolean not null default true,
  notes text,
  internal_notes text,
  tracking_number text,
  courier text,
  client_uuid uuid unique,                          -- idempotency key from POS / checkout
  placed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_event_day_requires_event check (event_day is null or event_id is not null),
  constraint orders_delivery_has_address check (fulfilment <> 'delivery' or delivery_address is not null)
);

create index orders_customer_idx on public.orders (customer_id);
create index orders_channel_idx on public.orders (channel, placed_at desc);
create index orders_status_idx on public.orders (status, placed_at desc);
create index orders_event_idx on public.orders (event_id, event_day) where event_id is not null;
create index orders_placed_at_idx on public.orders (placed_at desc);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id),
  -- Snapshots so history survives catalog edits.
  product_name text not null,
  variant_label text not null default '',
  sku text not null,
  category_id uuid references public.categories (id),
  destination_id uuid references public.destinations (id),
  qty int not null check (qty > 0),
  list_price_fils int not null check (list_price_fils >= 0),
  unit_price_fils int not null check (unit_price_fils >= 0),
  price_override_reason text,
  discount_fils int not null default 0 check (discount_fils >= 0),
  line_total_fils int not null check (line_total_fils >= 0),
  is_reward boolean not null default false,
  created_at timestamptz not null default now(),
  constraint order_lines_override_reason check (
    unit_price_fils = list_price_fils or is_reward or length(trim(coalesce(price_override_reason, ''))) > 0
  ),
  constraint order_lines_total check (line_total_fils = unit_price_fils * qty - discount_fils)
);

create index order_lines_order_idx on public.order_lines (order_id);
create index order_lines_variant_idx on public.order_lines (variant_id);

alter table public.stock_movements
  add constraint stock_movements_order_line_fk foreign key (order_line_id)
  references public.order_lines (id) on delete restrict;

-- Cost snapshot (COGS) — only visible with reports.financial.view.
create table public.order_line_costs (
  order_line_id uuid primary key references public.order_lines (id) on delete cascade,
  unit_cost_fils int not null default 0 check (unit_cost_fils >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  kind public.payment_kind not null default 'payment',
  amount_fils int not null check (amount_fils > 0),
  method public.payment_method not null,
  status public.payment_state not null default 'pending',
  provider text,                                    -- 'stripe' | null for offline
  provider_ref text unique,                         -- checkout session / payment intent / refund id
  provider_payload jsonb,
  reference text,                                   -- bank transfer ref, terminal receipt no.
  note text,
  received_by uuid references auth.users (id) on delete set null,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status, received_at desc);

create type public.payment_link_status as enum ('active', 'paid', 'expired', 'cancelled');

create table public.payment_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  booking_id uuid,                                  -- FK added with bookings
  amount_fils int not null check (amount_fils > 0),
  description text,
  provider text not null default 'stripe',
  provider_id text unique,
  url text,
  expires_at timestamptz,
  status public.payment_link_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_links_target check (order_id is not null or booking_id is not null)
);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger payment_links_updated_at before update on public.payment_links
  for each row execute function public.set_updated_at();

-- Record every status change.
create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger orders_status_history after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- Derived payment status per order.
create view public.order_payment_summary
with (security_invoker = true) as
select
  o.id as order_id,
  o.total_fils,
  coalesce(sum(p.amount_fils) filter (where p.kind = 'payment' and p.status = 'succeeded'), 0)::int as paid_fils,
  coalesce(sum(p.amount_fils) filter (where p.kind = 'refund' and p.status = 'succeeded'), 0)::int as refunded_fils,
  (o.total_fils
    - coalesce(sum(p.amount_fils) filter (where p.kind = 'payment' and p.status = 'succeeded'), 0)
    + coalesce(sum(p.amount_fils) filter (where p.kind = 'refund' and p.status = 'succeeded'), 0))::int as outstanding_fils,
  case
    when coalesce(sum(p.amount_fils) filter (where p.kind = 'refund' and p.status = 'succeeded'), 0) > 0
         and coalesce(sum(p.amount_fils) filter (where p.kind = 'refund' and p.status = 'succeeded'), 0)
             >= coalesce(sum(p.amount_fils) filter (where p.kind = 'payment' and p.status = 'succeeded'), 0)
      then 'refunded'
    when o.total_fils
         - coalesce(sum(p.amount_fils) filter (where p.kind = 'payment' and p.status = 'succeeded'), 0)
         + coalesce(sum(p.amount_fils) filter (where p.kind = 'refund' and p.status = 'succeeded'), 0) <= 0
      then 'paid'
    when coalesce(sum(p.amount_fils) filter (where p.kind = 'payment' and p.status = 'succeeded'), 0) > 0
      then 'partially_paid'
    else 'pending'
  end as payment_status
from public.orders o
left join public.payments p on p.order_id = o.id
group by o.id;

alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_line_costs enable row level security;
alter table public.payments enable row level security;
alter table public.payment_links enable row level security;
alter table public.order_status_history enable row level security;

-- Staff with orders.view see everything; a signed-in customer sees their own orders.
create or replace function public.is_own_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o join public.customers c on c.id = o.customer_id
    where o.id = p_order_id and c.auth_user_id = auth.uid() and auth.uid() is not null
  );
$$;

create policy "read orders" on public.orders for select to authenticated
  using (public.has_permission('orders.view') or public.is_own_order(id));
create policy "orders.update writes orders" on public.orders for update to authenticated
  using (public.has_permission('orders.update')) with check (public.has_permission('orders.update'));

create policy "read order lines" on public.order_lines for select to authenticated
  using (public.has_permission('orders.view') or public.is_own_order(order_id));

create policy "financial reads line costs" on public.order_line_costs for select to authenticated
  using (public.has_permission('reports.financial.view'));

create policy "read payments" on public.payments for select to authenticated
  using (public.has_permission('orders.view') or public.is_own_order(order_id));

create policy "read payment links" on public.payment_links for select to authenticated
  using (public.has_permission('orders.view'));

create policy "read status history" on public.order_status_history for select to authenticated
  using (public.has_permission('orders.view') or public.is_own_order(order_id));

create trigger audit after insert or update or delete on public.orders
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.payments
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.payment_links
  for each row execute function public.audit_row_change();

-- Public order tracking: order number + the phone used on the order.
create or replace function public.track_order(p_number text, p_phone text)
returns table (
  number text,
  status public.order_status,
  fulfilment public.fulfilment_type,
  placed_at timestamptz,
  tracking_number text,
  courier text,
  total_fils int,
  payment_status text,
  history jsonb,
  lines jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.number, o.status, o.fulfilment, o.placed_at, o.tracking_number, o.courier, o.total_fils,
    s.payment_status,
    (select jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at) order by h.created_at)
       from order_status_history h where h.order_id = o.id),
    (select jsonb_agg(jsonb_build_object('name', l.product_name, 'variant', l.variant_label, 'qty', l.qty) order by l.created_at)
       from order_lines l where l.order_id = o.id)
  from orders o
  join order_payment_summary s on s.order_id = o.id
  where upper(o.number) = upper(trim(p_number))
    and o.contact_phone = p_phone
    and o.channel in ('website', 'whatsapp', 'direct', 'payment_link')
  limit 1;
$$;

revoke execute on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
