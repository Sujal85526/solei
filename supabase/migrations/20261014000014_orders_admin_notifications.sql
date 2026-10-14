-- Order management (status, payments, refunds, cancellation) + notification templates & log.

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create type public.notification_channel as enum ('email', 'whatsapp');
create type public.notification_audience as enum ('customer', 'owner');
create type public.notification_status as enum ('sent', 'failed', 'skipped');

create table public.notification_templates (
  key text primary key check (key ~ '^[a-z_]+$'),
  audience public.notification_audience not null,
  channel public.notification_channel not null default 'email',
  name text not null,
  description text,
  subject text not null,
  body text not null,                     -- light markdown with {{variables}}
  variables text[] not null default '{}', -- documented placeholders for the editor
  enabled boolean not null default true,
  is_marketing boolean not null default false,
  sort int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table public.notification_log (
  id bigint generated always as identity primary key,
  template_key text references public.notification_templates (key) on delete set null,
  channel public.notification_channel not null default 'email',
  recipient text not null,
  subject text,
  customer_id uuid references public.customers (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  booking_id uuid,
  status public.notification_status not null,
  provider text,
  provider_id text,
  error text,
  -- Suppresses repeats (e.g. one low-stock alert per SKU per day); see the notifications service.
  dedupe_key text,
  created_at timestamptz not null default now()
);

create index notification_log_created_idx on public.notification_log (created_at desc);
create index notification_log_order_idx on public.notification_log (order_id) where order_id is not null;
create index notification_log_dedupe_idx on public.notification_log (template_key, dedupe_key, created_at desc)
  where dedupe_key is not null;

create trigger notification_templates_updated_at before update on public.notification_templates
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.notification_templates
  for each row execute function public.audit_row_change();

alter table public.notification_templates enable row level security;
alter table public.notification_log enable row level security;

create policy "notifications.manage reads templates" on public.notification_templates
  for select to authenticated using (public.has_permission('notifications.manage'));
create policy "notifications.manage updates templates" on public.notification_templates
  for update to authenticated
  using (public.has_permission('notifications.manage'))
  with check (public.has_permission('notifications.manage'));
create policy "staff read notification log" on public.notification_log
  for select to authenticated
  using (public.has_permission('notifications.manage') or public.has_permission('orders.view'));

insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort) values
('order_confirmation', 'customer', 'Order confirmation', 'Sent when an order is paid.',
 'Your Solei order {{order_number}} is confirmed',
 E'Dear {{customer_name}},\n\nThank you — your order **{{order_number}}** is confirmed and we''re preparing it with care.\n\n{{order_lines}}\n\n**Total: {{order_total}}**\n\nWe''ll let you know when it''s on its way. Track it anytime: [{{order_number}}]({{order_link}})\n\nWith love,\nSolei',
 array['customer_name','order_number','order_lines','order_total','order_link'], 10),
('payment_received', 'customer', 'Payment received', 'Sent when a later payment (e.g. a balance) is recorded.',
 'Payment received for {{order_number}}',
 E'Dear {{customer_name}},\n\nWe''ve received **{{amount}}** for order {{order_number}}. Outstanding balance: {{outstanding}}.\n\nThank you,\nSolei',
 array['customer_name','order_number','amount','outstanding'], 20),
('payment_failed', 'customer', 'Payment failed', 'Sent when an online payment fails or expires.',
 'Your payment for {{order_number}} didn''t go through',
 E'Dear {{customer_name}},\n\nThe payment for order **{{order_number}}** didn''t go through and no money was taken. Your order is saved — you can complete it here:\n\n[Complete payment]({{order_link}})\n\nSolei',
 array['customer_name','order_number','order_link'], 30),
('order_preparing', 'customer', 'Order preparing', 'Status changed to Preparing.',
 'We''re preparing your Solei order {{order_number}}',
 E'Dear {{customer_name}},\n\nYour order **{{order_number}}** is being prepared.\n\nSolei',
 array['customer_name','order_number','order_link'], 40),
('order_dispatched', 'customer', 'Order dispatched', 'Status changed to Dispatched.',
 'Your Solei order {{order_number}} is on its way',
 E'Dear {{customer_name}},\n\nGood news — order **{{order_number}}** is on its way.\n\n{{tracking}}\n\nTrack it: [{{order_number}}]({{order_link}})\n\nSolei',
 array['customer_name','order_number','tracking','order_link'], 50),
('order_delivered', 'customer', 'Order delivered', 'Status changed to Delivered.',
 'Your Solei order {{order_number}} has arrived',
 E'Dear {{customer_name}},\n\nYour order **{{order_number}}** has been delivered. We hope it takes you somewhere beautiful.\n\nMade to remain,\nSolei',
 array['customer_name','order_number'], 60),
('booking_received', 'customer', 'Booking received', 'Customer submitted an event booking request.',
 'We''ve received your Solei event request',
 E'Dear {{customer_name}},\n\nThank you for your request **{{booking_ref}}** for {{event_date}}. We''ll review it and send you a personal quotation shortly.\n\nSolei',
 array['customer_name','booking_ref','event_date'], 70),
('quote_sent', 'customer', 'Quotation sent', 'A booking quotation is ready.',
 'Your Solei quotation {{booking_ref}}',
 E'Dear {{customer_name}},\n\nYour quotation for **{{booking_ref}}** is ready: **{{quote_total}}**.\n\n[View and accept]({{quote_link}})\n\nSolei',
 array['customer_name','booking_ref','quote_total','quote_link'], 80),
('booking_confirmed', 'customer', 'Booking confirmed', 'Booking confirmed after acceptance/deposit.',
 'Your Solei event booking is confirmed',
 E'Dear {{customer_name}},\n\nYour booking **{{booking_ref}}** for {{event_date}} is confirmed. We can''t wait to be part of your day.\n\nSolei',
 array['customer_name','booking_ref','event_date'], 90),
('passport_stamp', 'customer', 'Passport stamp progress', 'After a purchase that earns stamps.',
 'You collected {{destination}} — {{stamps}}/{{stamps_for_reward}}',
 E'Dear {{customer_name}},\n\nYou collected **{{destination}}** in your Solei Passport. You now have **{{stamps}}/{{stamps_for_reward}}** stamps — {{remaining}} more to {{reward}}.\n\n[Open your passport]({{passport_link}})\n\nSolei',
 array['customer_name','destination','stamps','stamps_for_reward','remaining','reward','passport_link'], 100),
('reward_unlocked', 'customer', 'Reward unlocked', 'Customer completed a passport.',
 'Your Solei reward is ready',
 E'Dear {{customer_name}},\n\nYou''ve collected {{stamps_for_reward}} stamps — **{{reward}}** is yours. Redeem it online or at our next pop-up.\n\n[Open your passport]({{passport_link}})\n\nSolei',
 array['customer_name','stamps_for_reward','reward','passport_link'], 110),
('owner_new_order', 'owner', 'New order (owner)', 'Owner alert for every paid website order.',
 'New order {{order_number}} — {{order_total}}',
 E'New {{channel}} order **{{order_number}}** from {{customer_name}} ({{customer_phone}}).\n\n{{order_lines}}\n\n**Total: {{order_total}}** · Delivery: {{delivery_area}}\n\n[Open in admin]({{admin_link}})',
 array['order_number','order_total','channel','customer_name','customer_phone','order_lines','delivery_area','admin_link'], 200),
('owner_new_booking', 'owner', 'New booking (owner)', 'Owner alert for new event booking requests.',
 'New event request {{booking_ref}} — {{event_date}}',
 E'New booking request **{{booking_ref}}** from {{customer_name}} for {{event_date}}.\n\n[Open in admin]({{admin_link}})',
 array['booking_ref','customer_name','event_date','admin_link'], 210),
('owner_low_stock', 'owner', 'Low stock (owner)', 'A product dropped to its alert level.',
 'Low stock: {{product}} ({{on_hand}} left)',
 E'**{{product}}** ({{sku}}) is down to **{{on_hand}}** units (alert level {{threshold}}).\n\n[Open inventory]({{admin_link}})',
 array['product','sku','on_hand','threshold','admin_link'], 220);

-- ---------------------------------------------------------------------------
-- Admin order list view (RLS of orders applies)
-- ---------------------------------------------------------------------------
create view public.admin_orders
with (security_invoker = true) as
select
  o.id, o.number, o.channel, o.status, o.fulfilment, o.event_id, o.event_day, o.booking_id,
  o.customer_id, o.contact_name, o.contact_phone, o.contact_email, o.delivery_emirate,
  o.subtotal_fils, o.discount_fils, o.delivery_fee_fils, o.vat_fils, o.total_fils,
  o.tracking_number, o.courier, o.placed_at, o.created_at, o.staff_id,
  s.paid_fils, s.refunded_fils, s.outstanding_fils, s.payment_status,
  (select coalesce(sum(l.qty), 0)::int from public.order_lines l where l.order_id = o.id) as item_count,
  e.name as event_name
from public.orders o
join public.order_payment_summary s on s.order_id = o.id
left join public.events e on e.id = o.event_id;

-- ---------------------------------------------------------------------------
-- Order actions (permission-checked, audited). Staff change orders only through these
-- functions, so the status rules can't be bypassed with a direct table update.
-- ---------------------------------------------------------------------------
drop policy "orders.update writes orders" on public.orders;

-- Allowed manual status moves (mirrored in src/modules/orders/status.ts).
-- pending_payment → new happens on payment; cancelling has its own function.
create or replace function public.order_status_allowed(p_from public.order_status, p_to public.order_status)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'new' then p_to in ('preparing', 'dispatched', 'delivered', 'completed')
    when 'preparing' then p_to in ('new', 'dispatched', 'delivered', 'completed')
    when 'dispatched' then p_to in ('preparing', 'delivered', 'completed')
    when 'delivered' then p_to in ('dispatched', 'completed')
    when 'completed' then p_to in ('delivered')
    else false
  end;
$$;

create or replace function public.update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_note text default null,
  p_tracking_number text default null,
  p_courier text default null
)
returns public.order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  perform public.require_permission('orders.update');
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_order.status = p_status then return p_status; end if;
  if not public.order_status_allowed(v_order.status, p_status) then
    raise exception 'can''t move an order from % to %', v_order.status, p_status using errcode = 'P0001';
  end if;

  update orders set
    status = p_status,
    tracking_number = coalesce(nullif(trim(p_tracking_number), ''), tracking_number),
    courier = coalesce(nullif(trim(p_courier), ''), courier)
  where id = p_order_id;

  -- Attach the note to the history row the trigger just wrote.
  if nullif(trim(p_note), '') is not null then
    update order_status_history set note = left(trim(p_note), 500)
     where id = (select max(id) from order_status_history where order_id = p_order_id);
  end if;

  perform public.write_audit('order.status', 'orders', p_order_id::text,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', p_status, 'tracking_number', nullif(trim(p_tracking_number), ''),
                       'courier', nullif(trim(p_courier), '')));
  return p_status;
end;
$$;

-- Staff-only notes (never shown to the customer).
create or replace function public.update_order_notes(p_order_id uuid, p_internal_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_permission('orders.update');
  update orders set internal_notes = nullif(left(trim(coalesce(p_internal_notes, '')), 2000), '')
   where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
end;
$$;

/*
  Record an offline / manual payment (cash, card terminal, soft POS, bank transfer…).
  Online methods only ever come from a verified webhook (confirm_payment).
  If it completes payment of an order awaiting payment, the order is confirmed and stock deducted once.
*/
create or replace function public.record_payment(
  p_order_id uuid,
  p_amount_fils int,
  p_method public.payment_method,
  p_reference text default null,
  p_note text default null
)
returns table (payment_id uuid, newly_paid boolean, outstanding_fils int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment_id uuid;
  v_outstanding int;
begin
  perform public.require_permission('payments.record');
  if p_amount_fils is null or p_amount_fils <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;
  if p_method in ('online_card', 'apple_pay', 'payment_link') then
    raise exception 'online payments are recorded automatically' using errcode = '22023';
  end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_order.status = 'cancelled' then raise exception 'order is cancelled' using errcode = 'P0001'; end if;

  select s.outstanding_fils into v_outstanding from order_payment_summary s where s.order_id = p_order_id;
  if p_amount_fils > v_outstanding then
    raise exception 'amount is more than the outstanding balance (% fils)', v_outstanding using errcode = 'P0001';
  end if;

  insert into payments (order_id, kind, amount_fils, method, status, reference, note, received_by, received_at)
  values (p_order_id, 'payment', p_amount_fils, p_method, 'succeeded', nullif(trim(p_reference), ''),
          nullif(trim(p_note), ''), auth.uid(), now())
  returning id into v_payment_id;

  v_outstanding := v_outstanding - p_amount_fils;
  perform public.write_audit('payment.recorded', 'payments', v_payment_id::text, null,
    jsonb_build_object('order', v_order.number, 'amount_fils', p_amount_fils, 'method', p_method,
                       'outstanding_fils', v_outstanding));

  if v_outstanding <= 0 and v_order.status = 'pending_payment' then
    -- Paid offline: older online attempts can no longer complete it.
    update payments set status = 'cancelled', note = 'Paid offline'
     where order_id = p_order_id and status = 'pending' and kind = 'payment';
    update orders set status = 'new', placed_at = now() where id = p_order_id;
    perform public.after_order_paid(p_order_id);
    return query select v_payment_id, true, v_outstanding;
    return;
  end if;
  return query select v_payment_id, false, v_outstanding;
end;
$$;

-- Record a refund made outside the system (cash back, bank transfer, terminal refund).
create or replace function public.record_refund(
  p_order_id uuid,
  p_amount_fils int,
  p_method public.payment_method,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_paid int;
  v_refunded int;
  v_id uuid;
begin
  perform public.require_permission('orders.refund');
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  select s.paid_fils, s.refunded_fils into v_paid, v_refunded
    from order_payment_summary s where s.order_id = p_order_id;
  if p_amount_fils is null or p_amount_fils <= 0 or p_amount_fils > v_paid - v_refunded then
    raise exception 'refund must be more than 0 and at most the amount paid (% fils)', v_paid - v_refunded
      using errcode = 'P0001';
  end if;
  insert into payments (order_id, kind, amount_fils, method, status, note, received_by, received_at)
  values (p_order_id, 'refund', p_amount_fils, p_method, 'succeeded', left(trim(p_reason), 500), auth.uid(), now())
  returning id into v_id;
  perform public.write_audit('order.refund', 'orders', p_order_id::text, null,
    jsonb_build_object('order', v_order.number, 'amount_fils', p_amount_fils, 'method', p_method,
                       'reason', trim(p_reason)));
  return v_id;
end;
$$;

-- Hook for things to undo on cancellation (loyalty reversal is added in feat/loyalty-passport).
create or replace function public.after_order_cancelled(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  null;
end;
$$;

/*
  Cancel an order. Stock that was deducted goes back to the location it left from, once
  (p_restock = false keeps it out, e.g. goods damaged). Refunds are recorded separately.
  Returns the number of restock movements written.
*/
create or replace function public.cancel_order(p_order_id uuid, p_reason text, p_restock boolean default true)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_restocked int := 0;
begin
  perform public.require_permission('orders.cancel');
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_order.status = 'cancelled' then return 0; end if;

  update orders set status = 'cancelled', cancelled_at = now(), cancel_reason = left(trim(p_reason), 500)
   where id = p_order_id;
  update order_status_history set note = left(trim(p_reason), 500)
   where id = (select max(id) from order_status_history where order_id = p_order_id);

  if coalesce(p_restock, true) then
    insert into stock_movements (variant_id, location_id, qty, type, reason, order_line_id, event_id, created_by)
    select m.variant_id, m.location_id, -m.qty, 'refund_return', 'Cancelled ' || v_order.number, m.order_line_id,
           m.event_id, auth.uid()
      from stock_movements m
      join order_lines l on l.id = m.order_line_id
     where l.order_id = p_order_id and m.type in ('sale', 'reward_redemption')
       and not exists (
         select 1 from stock_movements r
          where r.order_line_id = m.order_line_id and r.type = 'refund_return'
       );
    get diagnostics v_restocked = row_count;
  end if;

  -- Pending online payments can no longer complete this order.
  update payments set status = 'cancelled', note = 'Order cancelled'
   where order_id = p_order_id and status = 'pending';

  perform public.after_order_cancelled(p_order_id);
  perform public.write_audit('order.cancel', 'orders', p_order_id::text,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'cancelled', 'reason', trim(p_reason), 'restock', coalesce(p_restock, true)));
  return v_restocked;
end;
$$;

/*
  Stock alert data for variants: units on hand outside event locations (the same total as the
  admin stock matrix) and the alert level (variant override, else the business default).
  Used by trusted server code after stock-reducing actions to email the owner.
*/
create or replace function public.variant_stock_alerts(p_variant_ids uuid[])
returns table (
  variant_id uuid, sku text, product_name text, variant_label text, on_hand int, threshold int, is_low boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select v.id, v.sku, p.name, v.label,
      coalesce((
        select sum(m.qty) from stock_movements m
          join stock_locations l on l.id = m.location_id
         where m.variant_id = v.id and l.kind <> 'event'
      ), 0)::int as on_hand,
      coalesce(v.low_stock_threshold,
               (select ps.low_stock_default from private_settings ps where ps.id = 1), 5)::int as threshold
    from product_variants v
    join products p on p.id = v.product_id
    where v.id = any(p_variant_ids) and v.active and p.active
  )
  select b.id, b.sku, b.name, b.label, b.on_hand, b.threshold, b.on_hand <= b.threshold from base b;
$$;

revoke execute on function public.update_order_status(uuid, public.order_status, text, text, text) from public, anon;
revoke execute on function public.update_order_notes(uuid, text) from public, anon;
revoke execute on function public.record_payment(uuid, int, public.payment_method, text, text) from public, anon;
revoke execute on function public.record_refund(uuid, int, public.payment_method, text) from public, anon;
revoke execute on function public.cancel_order(uuid, text, boolean) from public, anon;
revoke execute on function public.after_order_cancelled(uuid) from public, anon, authenticated;
revoke execute on function public.variant_stock_alerts(uuid[]) from public, anon, authenticated;
grant execute on function public.update_order_status(uuid, public.order_status, text, text, text) to authenticated;
grant execute on function public.update_order_notes(uuid, text) to authenticated;
grant execute on function public.record_payment(uuid, int, public.payment_method, text, text) to authenticated;
grant execute on function public.record_refund(uuid, int, public.payment_method, text) to authenticated;
grant execute on function public.cancel_order(uuid, text, boolean) to authenticated;
