-- Phase 2 gift cards. Sold online in fixed amounts (admin-editable), the code emailed to the buyer
-- or the person they name; redeemed as a payment method (payments.method = gift_card) at checkout
-- and — when the owner allows it — at the event till. Balance = sum of the card's ledger (never a
-- mutable column). Mirrors src/modules/gift-cards.
--
-- How money moves:
--   · buying: an order with no item lines (orders.gift_card_purchase) paid like any website order;
--     the card is created `pending` and activated (ledger `issue`) when the order is paid.
--   · spending: a succeeded `gift_card` payment on the order + a ledger `redeem` debit.
--   · giving back: any succeeded `gift_card` refund payment credits the card (trigger) — used when an
--     order is cancelled, when staff refund to the gift card, and when an unpaid checkout's hold
--     lapses (24 h, released lazily by gift_card_release_stale()).
--   · gift card sales are not revenue (that's counted when the card is spent): the dashboard and
--     order stats leave gift card purchase orders out.

insert into public.permissions (key, "group", description, sort) values
  ('gift_cards.view', 'Sales', 'See gift cards and their balances', 32),
  ('gift_cards.manage', 'Sales', 'Issue, void and adjust gift cards; gift card settings', 33);
-- The owner holds every permission implicitly. Manager grants wait for the merge: the live
-- site's role editor (main) rejects permission keys it doesn't know (docs/PHASE2_MERGE.md).

-- Owner-editable rules (Admin → Gift cards → Settings).
alter table public.settings
  add column gift_cards_enabled boolean not null default true,
  add column gift_card_amounts_fils int[] not null default '{10000,20000,30000,50000}'
    check (cardinality(gift_card_amounts_fils) between 1 and 8 and 0 < all (gift_card_amounts_fils)),
  -- null = cards never expire.
  add column gift_card_expiry_months int default 12 check (gift_card_expiry_months between 1 and 120),
  add column gift_cards_at_pos boolean not null default true;

create type public.gift_card_status as enum ('pending', 'active', 'void');
create type public.gift_card_entry as enum ('issue', 'redeem', 'refund', 'adjust', 'void');

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  -- XXXX-XXXX-XXXX from an unambiguous alphabet; a bearer secret, shown to gift_cards.view staff.
  code text not null unique check (code ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  initial_fils int not null check (initial_fils > 0),
  status public.gift_card_status not null default 'pending',
  expires_at timestamptz,
  -- Sold online (the purchase order) or issued by staff.
  purchase_order_id uuid references public.orders (id) on delete restrict,
  buyer_customer_id uuid references public.customers (id) on delete set null,
  issued_by uuid references auth.users (id) on delete set null,
  recipient_name text check (length(recipient_name) <= 80),
  recipient_email text check (length(recipient_email) <= 200),
  sender_name text check (length(sender_name) <= 80),
  message text check (length(message) <= 300),
  note text check (length(note) <= 300),
  activated_at timestamptz,
  sent_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gift_cards_purchase_idx on public.gift_cards (purchase_order_id) where purchase_order_id is not null;
create index gift_cards_created_idx on public.gift_cards (created_at desc);

create table public.gift_card_ledger (
  id bigint generated always as identity primary key,
  gift_card_id uuid not null references public.gift_cards (id) on delete restrict,
  entry public.gift_card_entry not null,
  -- + adds to the balance (issue, refund, positive adjust), − takes from it.
  amount_fils int not null check (amount_fils <> 0),
  order_id uuid references public.orders (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete restrict,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index gift_card_ledger_card_idx on public.gift_card_ledger (gift_card_id, created_at);
create index gift_card_ledger_order_idx on public.gift_card_ledger (order_id) where order_id is not null;

alter table public.orders add column gift_card_purchase boolean not null default false;

create trigger gift_cards_updated_at before update on public.gift_cards
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.gift_cards
  for each row execute function public.audit_row_change();

alter table public.gift_cards enable row level security;
alter table public.gift_card_ledger enable row level security;
-- Reads for staff; every write goes through the functions below.
create policy gift_cards_staff_read on public.gift_cards
  for select using (public.has_permission('gift_cards.view'));
create policy gift_card_ledger_staff_read on public.gift_card_ledger
  for select using (public.has_permission('gift_cards.view'));

create or replace function public.gift_card_balance(p_card uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_fils), 0)::int from gift_card_ledger where gift_card_id = p_card;
$$;

-- "abcd efgh-2345" → "ABCD-EFGH-2345" (null when it can't be a code).
create or replace function public.gift_card_normalize(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when length(c) = 12 then substr(c, 1, 4) || '-' || substr(c, 5, 4) || '-' || substr(c, 9, 4) end
    from (select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) as c) x;
$$;

-- 12 random characters from 32 unambiguous ones (no 0/O, 1/I): 32^12 ≈ 1.2e18 codes.
create or replace function public.gift_card_new_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_raw text;
begin
  loop
    v_bytes := gen_random_bytes(12);
    v_raw := '';
    for i in 0..11 loop
      v_raw := v_raw || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    v_raw := public.gift_card_normalize(v_raw);
    exit when not exists (select 1 from gift_cards where code = v_raw);
  end loop;
  return v_raw;
end;
$$;

/*
  Give back gift card money held by website checkouts that were never paid: after 24 hours a
  pending_payment order's gift card payments are refunded (the trigger below credits the card).
  Called lazily before every lookup/redemption, so no scheduler is needed. If that customer pays
  the old payment page later, the order shows the remaining amount outstanding.
*/
create or replace function public.gift_card_release_stale()
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
    select o.id, o.number,
           sum(p.amount_fils) filter (where p.kind = 'payment') as paid,
           coalesce(sum(p.amount_fils) filter (where p.kind = 'refund'), 0) as refunded
      from orders o
      join payments p on p.order_id = o.id and p.method = 'gift_card' and p.status = 'succeeded'
     where o.status = 'pending_payment' and o.created_at < now() - interval '24 hours'
     group by o.id, o.number
    having sum(p.amount_fils) filter (where p.kind = 'payment')
           > coalesce(sum(p.amount_fils) filter (where p.kind = 'refund'), 0)
  loop
    insert into payments (order_id, kind, amount_fils, method, status, note, received_at)
    values (r.id, 'refund', r.paid - r.refunded, 'gift_card', 'succeeded',
            'Checkout not completed in 24 hours — gift card balance released', now());
    n := n + 1;
  end loop;
  return n;
end;
$$;

/*
  Look a code up for spending: { ok: true, id, code, balance_fils, expires_at } or
  { ok: false, reason: invalid | not_active | void | expired | empty }.
*/
create or replace function public.gift_card_lookup(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c public.gift_cards;
  v_balance int;
begin
  perform public.gift_card_release_stale();
  select * into c from gift_cards where code = public.gift_card_normalize(p_code);
  if not found then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if c.status = 'void' then return jsonb_build_object('ok', false, 'reason', 'void'); end if;
  if c.status = 'pending' then return jsonb_build_object('ok', false, 'reason', 'not_active'); end if;
  if c.expires_at is not null and c.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  v_balance := public.gift_card_balance(c.id);
  if v_balance <= 0 then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  return jsonb_build_object('ok', true, 'id', c.id, 'code', c.code, 'balance_fils', v_balance,
                            'expires_at', c.expires_at);
end;
$$;

/*
  Spend p_amount from a card on an order: a succeeded gift_card payment + a ledger debit, with the
  card row locked so two orders can't spend the same balance. Returns the payment id.
*/
create or replace function public.gift_card_redeem(p_code text, p_amount int, p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check jsonb := public.gift_card_lookup(p_code);
  v_order public.orders;
  v_balance int;
  v_payment uuid;
begin
  if not (v_check ->> 'ok')::boolean then
    raise exception '%', case v_check ->> 'reason'
      when 'expired' then 'this gift card has expired'
      when 'empty' then 'this gift card has no balance left'
      when 'void' then 'this gift card is no longer valid'
      when 'not_active' then 'this gift card is not active yet'
      else 'this gift card code isn''t valid' end
      using errcode = 'P0001';
  end if;
  perform 1 from gift_cards where id = (v_check ->> 'id')::uuid for update;
  v_balance := public.gift_card_balance((v_check ->> 'id')::uuid);
  select * into v_order from orders where id = p_order_id;
  if v_order.gift_card_purchase then
    raise exception 'gift cards can''t be bought with a gift card' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'gift card amount must be more than 0' using errcode = '22023';
  end if;
  if p_amount > v_balance then
    raise exception 'the gift card balance changed — please review your order' using errcode = 'P0001';
  end if;

  insert into payments (order_id, kind, amount_fils, method, status, reference, received_by, received_at)
  values (p_order_id, 'payment', p_amount, 'gift_card', 'succeeded', v_check ->> 'code', auth.uid(), now())
  returning id into v_payment;
  insert into gift_card_ledger (gift_card_id, entry, amount_fils, order_id, payment_id, created_by)
  values ((v_check ->> 'id')::uuid, 'redeem', -p_amount, p_order_id, v_payment, auth.uid());
  return v_payment;
end;
$$;

-- A gift_card refund puts the money back on the card(s) the order spent, newest first.
create or replace function public.gift_card_on_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left int := new.amount_fils;
  v_take int;
  r record;
begin
  for r in
    select l.gift_card_id, -sum(l.amount_fils)::int as net
      from gift_card_ledger l
     where l.order_id = new.order_id and l.entry in ('redeem', 'refund')
     group by l.gift_card_id
    having -sum(l.amount_fils) > 0
     order by max(l.id) desc
  loop
    exit when v_left <= 0;
    v_take := least(v_left, r.net);
    insert into gift_card_ledger (gift_card_id, entry, amount_fils, order_id, payment_id, note, created_by)
    values (r.gift_card_id, 'refund', v_take, new.order_id, new.id, new.note, auth.uid());
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    raise exception 'refund to gift card is more than the order spent from gift cards' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger gift_card_refund after insert on public.payments
  for each row when (new.kind = 'refund' and new.method = 'gift_card' and new.status = 'succeeded')
  execute function public.gift_card_on_refund();

-- Paid gift card purchase → the cards go live (expiry from today) and the order is done.
create or replace function public.gift_cards_activate_for_order(p_order_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_months int;
  n int;
begin
  select gift_card_expiry_months into v_months from settings where id = 1;
  with activated as (
    update gift_cards set status = 'active', activated_at = now(),
           expires_at = case when v_months is null then null else now() + make_interval(months => v_months) end
     where purchase_order_id = p_order_id and status = 'pending'
    returning id, initial_fils
  )
  insert into gift_card_ledger (gift_card_id, entry, amount_fils, order_id)
  select id, 'issue', initial_fils, p_order_id from activated;
  get diagnostics n = row_count;
  if n > 0 then
    update orders set status = 'completed' where id = p_order_id and status = 'new';
  end if;
  return n;
end;
$$;

-- Keeps the stock and loyalty calls of the earlier definitions.
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
end;
$$;

/*
  Cancelled order: gift card money it spent goes back to the card(s); cards it bought are voided
  (their remaining balance written off in the ledger). Keeps the loyalty reversal.
*/
create or replace function public.after_order_cancelled(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_net int;
  r record;
begin
  begin
    perform public.loyalty_reverse_order(p_order_id, 'Order cancelled', true);
  exception when others then
    perform public.write_audit('loyalty.reverse_failed', 'orders', p_order_id::text, null,
      jsonb_build_object('error', sqlerrm, 'state', sqlstate));
  end;

  select coalesce(sum(case when kind = 'payment' then amount_fils else -amount_fils end), 0)
    into v_net
    from payments
   where order_id = p_order_id and method = 'gift_card' and status = 'succeeded';
  if v_net > 0 then
    insert into payments (order_id, kind, amount_fils, method, status, note, received_by, received_at)
    values (p_order_id, 'refund', v_net, 'gift_card', 'succeeded', 'Order cancelled', auth.uid(), now());
  end if;

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

/*
  Website gift card purchase for the signed-in buyer (server action, service role). p = {
    client_uuid, contact: { name, email, phone? }, amount_fils, recipient_name?, recipient_email?,
    sender_name?, message? }. The amount must be one the owner offers.
*/
create or replace function public.create_gift_card_order(p jsonb)
returns table (order_id uuid, order_number text, total_fils int, existing boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.settings;
  v_order public.orders;
  v_customer uuid;
  v_amount int := (p ->> 'amount_fils')::int;
begin
  select * into v_order from orders o where o.client_uuid = (p ->> 'client_uuid')::uuid;
  if found then
    return query select v_order.id, v_order.number, v_order.total_fils, true;
    return;
  end if;

  select * into v_settings from settings where id = 1;
  if not v_settings.gift_cards_enabled then
    raise exception 'gift cards aren''t available right now' using errcode = 'P0001';
  end if;
  if v_amount is null or not (v_amount = any (v_settings.gift_card_amounts_fils)) then
    raise exception 'choose one of the gift card amounts' using errcode = 'P0001';
  end if;

  v_customer := public.upsert_customer(p -> 'contact' ->> 'phone', p -> 'contact' ->> 'email',
                                       p -> 'contact' ->> 'name', 'website');

  insert into orders (customer_id, channel, status, fulfilment, contact_name, contact_phone, contact_email,
                      subtotal_fils, total_fils, vat_rate_bp, prices_include_vat, client_uuid, gift_card_purchase)
  values (v_customer, 'website', 'pending_payment', 'handed_over', p -> 'contact' ->> 'name',
          nullif(p -> 'contact' ->> 'phone', ''), lower(p -> 'contact' ->> 'email'),
          -- Gift cards are vouchers: no VAT when sold (it's charged when the card is spent).
          v_amount, v_amount, 0, true, (p ->> 'client_uuid')::uuid, true)
  returning * into v_order;

  insert into gift_cards (code, initial_fils, purchase_order_id, buyer_customer_id, recipient_name,
                          recipient_email, sender_name, message)
  values (public.gift_card_new_code(), v_amount, v_order.id, v_customer,
          nullif(trim(p ->> 'recipient_name'), ''), nullif(lower(trim(p ->> 'recipient_email')), ''),
          nullif(trim(p ->> 'sender_name'), ''), nullif(trim(p ->> 'message'), ''));

  perform public.write_audit('order.created', 'orders', v_order.id::text, null,
    jsonb_build_object('number', v_order.number, 'channel', 'website', 'total_fils', v_amount,
                       'gift_card_purchase', true));
  return query select v_order.id, v_order.number, v_order.total_fils, false;
end;
$$;

-- Staff issue a card by hand (a goodwill gesture, a prize…): active at once.
create or replace function public.gift_card_issue(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount int := (p ->> 'amount_fils')::int;
  v_months int;
  v_id uuid;
begin
  perform public.require_permission('gift_cards.manage');
  if v_amount is null or v_amount <= 0 or v_amount > 10000000 then
    raise exception 'enter an amount' using errcode = '22023';
  end if;
  select gift_card_expiry_months into v_months from settings where id = 1;
  insert into gift_cards (code, initial_fils, status, expires_at, issued_by, recipient_name, recipient_email,
                          message, note, activated_at)
  values (public.gift_card_new_code(), v_amount, 'active',
          case when v_months is null then null else now() + make_interval(months => v_months) end,
          auth.uid(), nullif(trim(p ->> 'recipient_name'), ''), nullif(lower(trim(p ->> 'recipient_email')), ''),
          nullif(trim(p ->> 'message'), ''), nullif(trim(p ->> 'note'), ''), now())
  returning id into v_id;
  insert into gift_card_ledger (gift_card_id, entry, amount_fils, note, created_by)
  values (v_id, 'issue', v_amount, nullif(trim(p ->> 'note'), ''), auth.uid());
  return v_id;
end;
$$;

create or replace function public.gift_card_void(p_card uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.gift_cards;
  v_balance int;
begin
  perform public.require_permission('gift_cards.manage');
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  select * into c from gift_cards where id = p_card for update;
  if not found then raise exception 'gift card not found' using errcode = 'P0002'; end if;
  if c.status = 'void' then return; end if;
  v_balance := public.gift_card_balance(p_card);
  if v_balance > 0 then
    insert into gift_card_ledger (gift_card_id, entry, amount_fils, note, created_by)
    values (p_card, 'void', -v_balance, left(trim(p_reason), 300), auth.uid());
  end if;
  update gift_cards set status = 'void', voided_at = now(), void_reason = left(trim(p_reason), 300)
   where id = p_card;
end;
$$;

-- Correct a balance by hand (+ or −) with a reason; never below zero.
create or replace function public.gift_card_adjust(p_card uuid, p_amount int, p_reason text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.gift_cards;
  v_balance int;
begin
  perform public.require_permission('gift_cards.manage');
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'enter an amount' using errcode = '22023';
  end if;
  select * into c from gift_cards where id = p_card for update;
  if not found then raise exception 'gift card not found' using errcode = 'P0002'; end if;
  if c.status <> 'active' then raise exception 'only active cards can be adjusted' using errcode = 'P0001'; end if;
  v_balance := public.gift_card_balance(p_card);
  if v_balance + p_amount < 0 then
    raise exception 'the balance can''t go below zero' using errcode = 'P0001';
  end if;
  insert into gift_card_ledger (gift_card_id, entry, amount_fils, note, created_by)
  values (p_card, 'adjust', p_amount, left(trim(p_reason), 300), auth.uid());
  return v_balance + p_amount;
end;
$$;

-- Admin list figures: live cards and their outstanding value (what customers can still spend).
create or replace function public.gift_card_summary()
returns table (active_cards int, outstanding_fils int, sold_this_month_fils int, redeemed_this_month_fils int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from gift_cards c
      where c.status = 'active' and (c.expires_at is null or c.expires_at > now())
        and public.gift_card_balance(c.id) > 0),
    (select coalesce(sum(public.gift_card_balance(c.id)), 0)::int from gift_cards c
      where c.status = 'active' and (c.expires_at is null or c.expires_at > now())),
    (select coalesce(sum(l.amount_fils), 0)::int from gift_card_ledger l
      where l.entry = 'issue' and public.business_day(l.created_at) >= date_trunc('month', public.business_today())::date),
    (select coalesce(-sum(l.amount_fils), 0)::int from gift_card_ledger l
      where l.entry in ('redeem', 'refund')
        and public.business_day(l.created_at) >= date_trunc('month', public.business_today())::date)
  where public.has_permission('gift_cards.view');
$$;

-- Gift card sales aren't revenue (the spend is): leave purchase orders out of the stat chips.
create or replace function public.admin_order_stats(p_day_start timestamptz, p_day_end timestamptz)
returns table (today_count bigint, today_revenue_fils bigint, outstanding_count bigint, outstanding_fils bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*) filter (where a.placed_at >= p_day_start and a.placed_at < p_day_end),
    coalesce(sum(a.total_fils) filter (where a.placed_at >= p_day_start and a.placed_at < p_day_end), 0),
    count(*) filter (where a.outstanding_fils > 0),
    coalesce(sum(a.outstanding_fils) filter (where a.outstanding_fils > 0), 0)
  from admin_orders a
  join orders o on o.id = a.id
  where a.status not in ('pending_payment', 'cancelled') and not o.gift_card_purchase;
$$;

revoke all on function public.gift_card_balance(uuid) from public, anon;
revoke all on function public.gift_card_new_code() from public, anon, authenticated;
revoke all on function public.gift_card_release_stale() from public, anon, authenticated;
revoke all on function public.gift_card_lookup(text) from public, anon, authenticated;
revoke all on function public.gift_card_redeem(text, int, uuid) from public, anon, authenticated;
revoke all on function public.gift_card_on_refund() from public, anon, authenticated;
revoke all on function public.gift_cards_activate_for_order(uuid) from public, anon, authenticated;
revoke all on function public.after_order_paid(uuid) from public, anon, authenticated;
revoke all on function public.after_order_cancelled(uuid) from public, anon, authenticated;
revoke all on function public.create_gift_card_order(jsonb) from public, anon, authenticated;
revoke all on function public.gift_card_issue(jsonb) from public, anon;
revoke all on function public.gift_card_void(uuid, text) from public, anon;
revoke all on function public.gift_card_adjust(uuid, int, text) from public, anon;
revoke all on function public.gift_card_summary() from public, anon;
grant execute on function public.gift_card_issue(jsonb) to authenticated;
grant execute on function public.gift_card_void(uuid, text) to authenticated;
grant execute on function public.gift_card_adjust(uuid, int, text) to authenticated;
grant execute on function public.gift_card_summary() to authenticated;
grant execute on function public.gift_card_balance(uuid) to authenticated;

insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort) values
('gift_card_delivered', 'customer', 'Gift card', 'The gift card itself: code, amount and message — to the recipient (or the buyer when it''s for them).',
 '{{sender_name}} sent you a Solei gift card',
 E'Dear {{recipient_name}},\n\n{{sender_name}} sent you a **{{amount}}** Solei gift card.\n\n{{message}}\n\nYour code: **{{code}}**\n\nUse it at checkout on our website{{at_pop_ups}}. {{expiry}}\n\n[Choose your scent]({{shop_link}})\n\nWith love,\nSolei',
 array['recipient_name','sender_name','amount','message','code','expiry','at_pop_ups','shop_link'], 60),
('gift_card_purchased', 'customer', 'Gift card bought', 'Receipt to the buyer once the gift card is paid.',
 'Your Solei gift card is on its way',
 E'Dear {{customer_name}},\n\nThank you — your **{{amount}}** Solei gift card ({{order_number}}) is paid. We''ve emailed it to {{recipient}}.\n\nWith love,\nSolei',
 array['customer_name','amount','order_number','recipient'], 61)
on conflict (key) do nothing;
