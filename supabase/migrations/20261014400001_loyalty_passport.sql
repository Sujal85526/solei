-- Solei Passport (loyalty): versioned rules, a stamp ledger, rewards and passports.
--
-- Balance model (mirrored in src/modules/loyalty/engine.ts):
--   balance = sum(loyalty_stamps.stamps) for the customer = progress toward the next reward.
--   * earned   (+) one row per qualifying order line: qty × stamps_per_item, with the line's destination
--   * manual   (±) staff adjustment with a reason (loyalty.adjust)
--   * reversed (−) undoes an earned row when its order is cancelled / fully refunded
--   * redeemed (−) stamps exchanged for a reward the moment the threshold is crossed (+ when an unused
--                  reward is withdrawn because stamps were taken back)
--   * expired  (−) stamps past their expiry (only when the rule sets expiry_months; FIFO)
-- Rewards are separate rows (available → redeemed). Rules are versioned: a change is a new
-- row that applies from its effective_from; stamps already earned keep their rule_version_id.

create type public.loyalty_reward_type as enum ('choose_from_category', 'specific_products', 'fixed_amount', 'percent');
create type public.loyalty_stamp_kind as enum ('earned', 'manual', 'reversed', 'redeemed', 'expired');
create type public.loyalty_reward_status as enum ('available', 'redeemed', 'expired', 'revoked');
create type public.passport_issue_how as enum ('auto', 'request', 'manual');

-- Single programme row (id = 1). Phase 3 programme types (points, tiers) become new tables/rows.
create table public.loyalty_programs (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Solei Passport',
  enabled boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loyalty_rule_versions (
  id uuid primary key default gen_random_uuid(),
  program_id smallint not null default 1 references public.loyalty_programs (id),
  version int not null,
  stamps_per_item int not null check (stamps_per_item between 1 and 100),
  -- Both empty = every product qualifies; otherwise a line qualifies by category OR product.
  qualifying_category_ids uuid[] not null default '{}',
  qualifying_product_ids uuid[] not null default '{}',
  stamps_for_reward int not null check (stamps_for_reward between 1 and 1000),
  reward_type public.loyalty_reward_type not null,
  -- choose_from_category: { category_id } · specific_products: { product_ids: [] }
  -- fixed_amount: { amount_fils } · percent: { percent_bp }
  reward_config jsonb not null default '{}',
  reward_label text not null check (length(trim(reward_label)) between 3 and 120),
  -- null = passports only on request / issued by staff.
  issue_passport_after_purchases int check (issue_passport_after_purchases between 1 and 100),
  reward_items_earn_stamps boolean not null default false,
  expiry_months int check (expiry_months between 1 and 120),
  effective_from timestamptz not null default now(),
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (program_id, version)
);

create index loyalty_rule_versions_effective_idx on public.loyalty_rule_versions (program_id, effective_from desc);

create sequence public.passport_number_seq start 1001;

create table public.passports (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers (id) on delete cascade,
  number text not null unique default ('SP-' || lpad(nextval('public.passport_number_seq')::text, 5, '0')),
  how public.passport_issue_how not null,
  order_id uuid references public.orders (id) on delete set null,   -- purchase that triggered auto-issue
  issued_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz not null default now()
);

create table public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  status public.loyalty_reward_status not null default 'available',
  rule_version_id uuid not null references public.loyalty_rule_versions (id),
  -- Snapshot of the rule at unlock time, so later rule changes don't alter an earned reward.
  stamps_cost int not null check (stamps_cost > 0),
  reward_type public.loyalty_reward_type not null,
  reward_config jsonb not null default '{}',
  reward_label text not null,
  source_order_id uuid references public.orders (id) on delete set null,
  redeemed_order_id uuid references public.orders (id) on delete set null,
  redeemed_order_line_id uuid references public.order_lines (id) on delete set null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_rewards_redeemed check (status <> 'redeemed' or redeemed_at is not null)
);

create index loyalty_rewards_customer_idx on public.loyalty_rewards (customer_id, status);
create index loyalty_rewards_redeemed_order_idx on public.loyalty_rewards (redeemed_order_id) where redeemed_order_id is not null;

create table public.loyalty_stamps (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  order_line_id uuid references public.order_lines (id) on delete set null,
  destination_id uuid references public.destinations (id) on delete set null,
  reward_id uuid references public.loyalty_rewards (id) on delete set null,
  reverses_id uuid references public.loyalty_stamps (id) on delete set null,
  stamps int not null check (stamps <> 0),
  kind public.loyalty_stamp_kind not null,
  reason text,
  rule_version_id uuid references public.loyalty_rule_versions (id),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint loyalty_stamps_earned_positive check (kind <> 'earned' or stamps > 0),
  constraint loyalty_stamps_negative check (kind not in ('reversed', 'expired') or stamps < 0),
  constraint loyalty_stamps_manual_reason check (kind <> 'manual' or length(trim(coalesce(reason, ''))) >= 3),
  constraint loyalty_stamps_redeemed_reward check (kind <> 'redeemed' or reward_id is not null)
);

create index loyalty_stamps_customer_idx on public.loyalty_stamps (customer_id, created_at desc);
create index loyalty_stamps_order_idx on public.loyalty_stamps (order_id) where order_id is not null;
-- Awarding is idempotent per order line; each entry is reversed at most once.
create unique index loyalty_stamps_earned_line_uniq on public.loyalty_stamps (order_line_id) where kind = 'earned';
create unique index loyalty_stamps_reverses_uniq on public.loyalty_stamps (reverses_id) where reverses_id is not null;

create trigger loyalty_programs_updated_at before update on public.loyalty_programs
  for each row execute function public.set_updated_at();
create trigger loyalty_rewards_updated_at before update on public.loyalty_rewards
  for each row execute function public.set_updated_at();

create trigger audit after insert or update or delete on public.loyalty_programs
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.loyalty_rule_versions
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.loyalty_stamps
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.loyalty_rewards
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.passports
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Launch rules (company profile p.3) — every value is editable in Admin → Loyalty.
-- ---------------------------------------------------------------------------
insert into public.loyalty_programs (id, name, enabled) values (1, 'Solei Passport', true);

insert into public.loyalty_rule_versions (
  version, stamps_per_item, stamps_for_reward, reward_type, reward_config, reward_label,
  issue_passport_after_purchases, reward_items_earn_stamps, expiry_months, effective_from, note
) values (
  1, 1, 12, 'choose_from_category',
  -- The catalogue may be seeded after migrations (local/CI): fall back to the category slug.
  coalesce((select jsonb_build_object('category_id', id) from public.categories where slug = 'all_over_spray'),
           '{"category_slug": "all_over_spray"}'::jsonb),
  'a free all-over spray of your choice', 2, false, null, '2026-01-01T00:00:00+04:00',
  'Launch rules (company profile p.3)'
);

-- ---------------------------------------------------------------------------
-- RLS: the programme and its rules are public (homepage, passport page); ledgers are readable
-- with loyalty.view or by the customer themselves (customers.auth_user_id). All writes go
-- through the security-definer functions below.
-- ---------------------------------------------------------------------------
create or replace function public.is_own_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from public.customers c where c.id = p_customer_id and c.auth_user_id = auth.uid());
$$;

alter table public.loyalty_programs enable row level security;
alter table public.loyalty_rule_versions enable row level security;
alter table public.loyalty_stamps enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.passports enable row level security;

create policy "public reads loyalty programme" on public.loyalty_programs
  for select to anon, authenticated using (true);
create policy "public reads loyalty rules" on public.loyalty_rule_versions
  for select to anon, authenticated using (true);
create policy "read stamps" on public.loyalty_stamps for select to authenticated
  using (public.has_permission('loyalty.view') or public.is_own_customer(customer_id));
create policy "read rewards" on public.loyalty_rewards for select to authenticated
  using (public.has_permission('loyalty.view') or public.is_own_customer(customer_id));
create policy "read passports" on public.passports for select to authenticated
  using (public.has_permission('loyalty.view') or public.is_own_customer(customer_id));

-- Per-customer totals (RLS of the caller applies).
create view public.loyalty_balances
with (security_invoker = true) as
select
  s.customer_id,
  sum(s.stamps)::int as balance,
  -- Net stamps collected over time (exchanges for rewards excluded).
  coalesce(sum(s.stamps) filter (where s.kind <> 'redeemed'), 0)::int as collected,
  max(s.created_at) as last_stamp_at
from public.loyalty_stamps s
group by s.customer_id;

-- ---------------------------------------------------------------------------
-- Rules engine (SQL side)
-- ---------------------------------------------------------------------------

-- The rule version in force at an instant (latest effective_from ≤ p_at).
create or replace function public.loyalty_active_rule(p_at timestamptz default now())
returns public.loyalty_rule_versions
language sql
stable
security definer
set search_path = public
as $$
  select * from public.loyalty_rule_versions
   where program_id = 1 and effective_from <= p_at
   order by effective_from desc, version desc
   limit 1;
$$;

create or replace function public.loyalty_line_qualifies(
  r public.loyalty_rule_versions,
  p_category_id uuid,
  p_product_id uuid,
  p_is_reward boolean
)
returns boolean
language sql
immutable
as $$
  select (not coalesce(p_is_reward, false) or r.reward_items_earn_stamps)
     and (
       (cardinality(r.qualifying_category_ids) = 0 and cardinality(r.qualifying_product_ids) = 0)
       or p_category_id = any (r.qualifying_category_ids)
       or p_product_id = any (r.qualifying_product_ids)
     );
$$;

/*
  Expire stamps past expires_at that haven't been used yet. Negative entries consume the oldest
  positive stamps first (FIFO), so only the unconsumed part of an expired entry is written off.
  No-op unless a rule version with expiry_months stamped expires_at on earned rows.
*/
create or replace function public.loyalty_expire_stamps(p_customer_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_positive int;
  v_balance int;
  v_consumed int;
  v_expired int;
begin
  if not exists (
    select 1 from loyalty_stamps
     where customer_id = p_customer_id and expires_at <= now() and stamps > 0 and kind in ('earned', 'manual')
  ) then
    return 0;
  end if;
  select coalesce(sum(stamps) filter (where stamps > 0 and kind in ('earned', 'manual')), 0),
         coalesce(sum(stamps), 0)
    into v_positive, v_balance
    from loyalty_stamps where customer_id = p_customer_id;
  v_consumed := v_positive - v_balance;

  with pos as (
    select stamps, expires_at,
           sum(stamps) over (order by created_at, id) as cum_after
      from loyalty_stamps
     where customer_id = p_customer_id and stamps > 0 and kind in ('earned', 'manual')
  )
  select coalesce(sum(greatest(0, cum_after - greatest(cum_after - stamps, v_consumed))), 0)::int
    into v_expired
    from pos where expires_at <= now();

  if v_expired > 0 then
    insert into loyalty_stamps (customer_id, stamps, kind, reason, created_by)
    values (p_customer_id, -v_expired, 'expired', 'Stamps expired', auth.uid());
  end if;
  return v_expired;
end;
$$;

/*
  Bring a customer's card in line with the rules: withdraw unused rewards while the balance is
  negative (stamps were taken back), then unlock one reward per full card while the balance is at
  or above the active threshold — several in one go when an order crosses more than one.
  The remainder carries over. Returns the number of rewards unlocked.
*/
create or replace function public.loyalty_settle(p_customer_id uuid, p_order_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.loyalty_rule_versions;
  v_enabled boolean;
  v_balance int;
  v_reward public.loyalty_rewards;
  v_reward_id uuid;
  v_unlocked int := 0;
begin
  -- One settlement at a time per customer (two tills, webhook + manual payment…).
  perform 1 from customers where id = p_customer_id for update;
  perform public.loyalty_expire_stamps(p_customer_id);

  select coalesce(sum(stamps), 0) into v_balance from loyalty_stamps where customer_id = p_customer_id;

  while v_balance < 0 loop
    select * into v_reward from loyalty_rewards
     where customer_id = p_customer_id and status = 'available'
     order by created_at desc limit 1
     for update;
    exit when not found;
    update loyalty_rewards set status = 'revoked', revoked_at = now() where id = v_reward.id;
    insert into loyalty_stamps (customer_id, order_id, reward_id, stamps, kind, reason, rule_version_id, created_by)
    values (p_customer_id, p_order_id, v_reward.id, v_reward.stamps_cost, 'redeemed',
            'Reward withdrawn — stamps were taken back', v_reward.rule_version_id, auth.uid());
    v_balance := v_balance + v_reward.stamps_cost;
  end loop;

  select enabled into v_enabled from loyalty_programs where id = 1;
  v_rule := public.loyalty_active_rule();
  if not coalesce(v_enabled, false) or v_rule.id is null then
    return 0;
  end if;

  while v_balance >= v_rule.stamps_for_reward loop
    insert into loyalty_rewards (customer_id, rule_version_id, stamps_cost, reward_type, reward_config,
                                 reward_label, source_order_id)
    values (p_customer_id, v_rule.id, v_rule.stamps_for_reward, v_rule.reward_type, v_rule.reward_config,
            v_rule.reward_label, p_order_id)
    returning id into v_reward_id;
    insert into loyalty_stamps (customer_id, order_id, reward_id, stamps, kind, reason, rule_version_id, created_by)
    values (p_customer_id, p_order_id, v_reward_id, -v_rule.stamps_for_reward, 'redeemed',
            'Card complete — ' || v_rule.reward_label, v_rule.id, auth.uid());
    v_balance := v_balance - v_rule.stamps_for_reward;
    v_unlocked := v_unlocked + 1;
  end loop;
  return v_unlocked;
end;
$$;

/*
  Award stamps for a fully paid order (called once from after_order_paid). One earned row per
  qualifying line (qty × stamps_per_item, the line's destination), idempotent per line. Reward
  lines earn only when the rule says so. Auto-issues the passport after N paid purchases
  (orders with at least one non-reward line). Returns the stamps awarded.
*/
create or replace function public.loyalty_award_order(p_order_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_rule public.loyalty_rule_versions;
  v_enabled boolean;
  v_stamps int;
  v_purchases int;
begin
  select * into v_order from orders where id = p_order_id;
  if not found or v_order.customer_id is null or v_order.status = 'cancelled' then
    return 0;
  end if;
  select enabled into v_enabled from loyalty_programs where id = 1;
  v_rule := public.loyalty_active_rule();
  if not coalesce(v_enabled, false) or v_rule.id is null then
    return 0;
  end if;

  insert into loyalty_stamps (customer_id, order_id, order_line_id, destination_id, stamps, kind,
                              rule_version_id, created_by, expires_at)
  select v_order.customer_id, v_order.id, l.id, l.destination_id, l.qty * v_rule.stamps_per_item, 'earned',
         v_rule.id, auth.uid(),
         case when v_rule.expiry_months is not null then now() + make_interval(months => v_rule.expiry_months) end
    from order_lines l
    join product_variants pv on pv.id = l.variant_id
   where l.order_id = p_order_id
     and public.loyalty_line_qualifies(v_rule, l.category_id, pv.product_id, l.is_reward)
   order by l.created_at
  on conflict (order_line_id) where kind = 'earned' do nothing;

  select coalesce(sum(stamps), 0) into v_stamps
    from loyalty_stamps where order_id = p_order_id and kind = 'earned';

  if v_rule.issue_passport_after_purchases is not null
     and not exists (select 1 from passports where customer_id = v_order.customer_id) then
    select count(*) into v_purchases
      from orders o
     where o.customer_id = v_order.customer_id and o.paid_at is not null and o.status <> 'cancelled'
       and exists (select 1 from order_lines l where l.order_id = o.id and not l.is_reward);
    if v_purchases >= v_rule.issue_passport_after_purchases then
      insert into passports (customer_id, how, order_id, issued_by)
      values (v_order.customer_id, 'auto', p_order_id, auth.uid())
      on conflict (customer_id) do nothing;
    end if;
  end if;

  perform public.loyalty_settle(v_order.customer_id, p_order_id);
  return v_stamps;
end;
$$;

/*
  Undo an order's stamps (cancellation or full refund): one reversed row per earned row, once.
  p_restore_rewards (cancellation only) gives a reward redeemed on this order back to the customer.
  Settling afterwards withdraws an unused reward if the card went below zero.
*/
create or replace function public.loyalty_reverse_order(p_order_id uuid, p_reason text, p_restore_rewards boolean default false)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_reversed int;
  v_restored int := 0;
begin
  select customer_id into v_customer from orders where id = p_order_id;

  insert into loyalty_stamps (customer_id, order_id, order_line_id, destination_id, stamps, kind, reason,
                              rule_version_id, reverses_id, created_by)
  select s.customer_id, s.order_id, s.order_line_id, s.destination_id, -s.stamps, 'reversed', p_reason,
         s.rule_version_id, s.id, auth.uid()
    from loyalty_stamps s
   where s.order_id = p_order_id and s.kind = 'earned'
     and not exists (select 1 from loyalty_stamps r where r.reverses_id = s.id);
  get diagnostics v_reversed = row_count;

  if p_restore_rewards then
    update loyalty_rewards
       set status = 'available', redeemed_order_id = null, redeemed_order_line_id = null,
           redeemed_at = null, redeemed_by = null,
           note = concat_ws(' · ', note, 'Returned: ' || p_reason)
     where redeemed_order_id = p_order_id and status = 'redeemed';
    get diagnostics v_restored = row_count;
  end if;

  if v_customer is not null and (v_reversed > 0 or v_restored > 0) then
    perform public.loyalty_settle(v_customer, p_order_id);
  end if;
  return v_reversed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Order hooks. Loyalty must never break a payment or a cancellation: failures are caught and
-- written to the audit log ('loyalty.award_failed' / 'loyalty.reverse_failed') for follow-up.
-- ---------------------------------------------------------------------------
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
end;
$$;

create or replace function public.after_order_cancelled(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.loyalty_reverse_order(p_order_id, 'Order cancelled', true);
  exception when others then
    perform public.write_audit('loyalty.reverse_failed', 'orders', p_order_id::text, null,
      jsonb_build_object('error', sqlerrm, 'state', sqlstate));
  end;
end;
$$;

-- Full refund (payment status becomes 'refunded') reverses the order's stamps. Partial refunds keep them.
create or replace function public.loyalty_on_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from order_payment_summary s where s.order_id = new.order_id and s.payment_status = 'refunded'
  ) then
    begin
      perform public.loyalty_reverse_order(new.order_id, 'Order refunded', false);
    exception when others then
      perform public.write_audit('loyalty.reverse_failed', 'orders', new.order_id::text, null,
        jsonb_build_object('error', sqlerrm, 'state', sqlstate));
    end;
  end if;
  return null;
end;
$$;

create trigger loyalty_refund after insert or update of status on public.payments
  for each row when (new.kind = 'refund' and new.status = 'succeeded')
  execute function public.loyalty_on_refund();

-- ---------------------------------------------------------------------------
-- Staff actions
-- ---------------------------------------------------------------------------

-- Add (+) or remove (−) stamps by hand. Removing can't exceed the card plus unused rewards
-- (which are withdrawn first). Returns the new balance.
create or replace function public.loyalty_adjust_stamps(
  p_customer_id uuid,
  p_stamps int,
  p_reason text,
  p_destination_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_available int;
begin
  perform public.require_permission('loyalty.adjust');
  if p_stamps is null or p_stamps = 0 or abs(p_stamps) > 100 then
    raise exception 'stamps must be between -100 and 100 and not 0' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  perform 1 from customers where id = p_customer_id for update;
  if not found then raise exception 'customer not found' using errcode = 'P0002'; end if;

  select coalesce(sum(stamps), 0) into v_balance from loyalty_stamps where customer_id = p_customer_id;
  if p_stamps < 0 then
    select v_balance + coalesce(sum(stamps_cost), 0) into v_available
      from loyalty_rewards where customer_id = p_customer_id and status = 'available';
    if -p_stamps > v_available then
      raise exception 'only % stamps can be removed', greatest(v_available, 0) using errcode = 'P0001';
    end if;
  end if;

  insert into loyalty_stamps (customer_id, destination_id, stamps, kind, reason, rule_version_id, created_by)
  values (p_customer_id, p_destination_id, p_stamps, 'manual', left(trim(p_reason), 300),
          (public.loyalty_active_rule()).id, auth.uid());
  perform public.write_audit('loyalty.adjust', 'customers', p_customer_id::text,
    jsonb_build_object('balance', v_balance),
    jsonb_build_object('stamps', p_stamps, 'reason', trim(p_reason)));
  perform public.loyalty_settle(p_customer_id);

  select coalesce(sum(stamps), 0) into v_balance from loyalty_stamps where customer_id = p_customer_id;
  return v_balance;
end;
$$;

-- Issue a passport now (customer asked, or staff decided). Returns the passport number.
create or replace function public.loyalty_issue_passport(
  p_customer_id uuid,
  p_how public.passport_issue_how default 'request'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
begin
  perform public.require_permission('loyalty.adjust');
  if p_how = 'auto' then raise exception 'choose request or manual' using errcode = '22023'; end if;
  if not exists (select 1 from customers where id = p_customer_id) then
    raise exception 'customer not found' using errcode = 'P0002';
  end if;
  select number into v_number from passports where customer_id = p_customer_id;
  if found then return v_number; end if;
  insert into passports (customer_id, how, issued_by) values (p_customer_id, p_how, auth.uid())
  returning number into v_number;
  perform public.write_audit('loyalty.passport_issued', 'customers', p_customer_id::text, null,
    jsonb_build_object('number', v_number, 'how', p_how));
  return v_number;
end;
$$;

/*
  Programme settings. Turning the programme on/off is immediate; any change to the rule fields
  creates a new rule version effective now (history kept, earned stamps untouched).
  p: { enabled, stamps_per_item, qualifying_category_ids[], qualifying_product_ids[],
       stamps_for_reward, reward_type, reward_config{}, reward_label,
       issue_passport_after_purchases|null, reward_items_earn_stamps, expiry_months|null, note }
  Returns the active rule version id.
*/
create or replace function public.loyalty_save_rules(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.loyalty_rule_versions;
  v_new public.loyalty_rule_versions;
  v_cats uuid[] := coalesce((select array_agg(x::uuid order by x) from jsonb_array_elements_text(coalesce(p -> 'qualifying_category_ids', '[]')) x), '{}');
  v_products uuid[] := coalesce((select array_agg(x::uuid order by x) from jsonb_array_elements_text(coalesce(p -> 'qualifying_product_ids', '[]')) x), '{}');
  v_type public.loyalty_reward_type := (p ->> 'reward_type')::public.loyalty_reward_type;
  v_config jsonb := coalesce(p -> 'reward_config', '{}');
  v_id uuid;
begin
  perform public.require_permission('loyalty.manage');

  update loyalty_programs set enabled = coalesce((p ->> 'enabled')::boolean, enabled), updated_by = auth.uid()
   where id = 1 and enabled is distinct from coalesce((p ->> 'enabled')::boolean, enabled);

  -- Validate the reward definition.
  if v_type = 'choose_from_category' then
    if not exists (select 1 from categories where id = (v_config ->> 'category_id')::uuid) then
      raise exception 'choose the reward category' using errcode = '22023';
    end if;
    v_config := jsonb_build_object('category_id', v_config ->> 'category_id');
  elsif v_type = 'specific_products' then
    if jsonb_array_length(coalesce(v_config -> 'product_ids', '[]')) = 0 then
      raise exception 'choose at least one reward product' using errcode = '22023';
    end if;
    v_config := jsonb_build_object('product_ids', v_config -> 'product_ids');
  elsif v_type = 'fixed_amount' then
    if coalesce((v_config ->> 'amount_fils')::int, 0) <= 0 then
      raise exception 'enter the reward amount' using errcode = '22023';
    end if;
    v_config := jsonb_build_object('amount_fils', (v_config ->> 'amount_fils')::int);
  elsif v_type = 'percent' then
    if coalesce((v_config ->> 'percent_bp')::int, 0) not between 1 and 10000 then
      raise exception 'enter a percentage between 0.01 and 100' using errcode = '22023';
    end if;
    v_config := jsonb_build_object('percent_bp', (v_config ->> 'percent_bp')::int);
  else
    raise exception 'choose a reward type' using errcode = '22023';
  end if;

  v_current := public.loyalty_active_rule();
  if v_current.id is not null
     and v_current.stamps_per_item = (p ->> 'stamps_per_item')::int
     and v_current.qualifying_category_ids = v_cats
     and v_current.qualifying_product_ids = v_products
     and v_current.stamps_for_reward = (p ->> 'stamps_for_reward')::int
     and v_current.reward_type = v_type
     and v_current.reward_config = v_config
     and v_current.reward_label = trim(p ->> 'reward_label')
     and v_current.issue_passport_after_purchases is not distinct from nullif(p ->> 'issue_passport_after_purchases', '')::int
     and v_current.reward_items_earn_stamps = coalesce((p ->> 'reward_items_earn_stamps')::boolean, false)
     and v_current.expiry_months is not distinct from nullif(p ->> 'expiry_months', '')::int then
    return v_current.id;
  end if;

  insert into loyalty_rule_versions (
    version, stamps_per_item, qualifying_category_ids, qualifying_product_ids, stamps_for_reward,
    reward_type, reward_config, reward_label, issue_passport_after_purchases, reward_items_earn_stamps,
    expiry_months, effective_from, note, created_by
  ) values (
    coalesce((select max(version) from loyalty_rule_versions where program_id = 1), 0) + 1,
    (p ->> 'stamps_per_item')::int, v_cats, v_products, (p ->> 'stamps_for_reward')::int,
    v_type, v_config, trim(p ->> 'reward_label'),
    nullif(p ->> 'issue_passport_after_purchases', '')::int,
    coalesce((p ->> 'reward_items_earn_stamps')::boolean, false),
    nullif(p ->> 'expiry_months', '')::int, now(), nullif(trim(p ->> 'note'), ''), auth.uid()
  ) returning * into v_new;

  perform public.write_audit('loyalty.rules_changed', 'loyalty_rule_versions', v_new.id::text,
    to_jsonb(v_current), to_jsonb(v_new));
  return v_new.id;
end;
$$;

-- Variants a reward can be taken as (item rewards only), with warehouse stock for staff.
create or replace function public.loyalty_reward_options(p_reward_id uuid)
returns table (
  variant_id uuid, product_name text, variant_label text, sku text, price_fils int,
  destination_name text, on_hand int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reward public.loyalty_rewards;
begin
  select * into v_reward from loyalty_rewards where id = p_reward_id;
  if not found or not (public.has_permission('loyalty.view') or public.has_permission('pos.use')
                      or public.is_own_customer(v_reward.customer_id)) then
    return;
  end if;
  return query
  select v.id, pr.name, v.label, v.sku, v.price_fils, d.name,
         case when public.is_staff() then coalesce((
           select sum(m.qty) from stock_movements m join stock_locations sl on sl.id = m.location_id
            where m.variant_id = v.id and sl.kind <> 'event'), 0)::int end
    from product_variants v
    join products pr on pr.id = v.product_id
    left join destinations d on d.id = pr.destination_id
    left join categories c on c.id = pr.category_id
   where v.active and pr.active
     and case v_reward.reward_type
           when 'choose_from_category' then
             pr.category_id = nullif(v_reward.reward_config ->> 'category_id', '')::uuid
             or c.slug = v_reward.reward_config ->> 'category_slug'
           when 'specific_products' then
             pr.id::text in (select jsonb_array_elements_text(coalesce(v_reward.reward_config -> 'product_ids', '[]')))
           else false
         end
   order by pr.sort, pr.name, v.price_fils;
end;
$$;

/*
  Redeem a reward. Item rewards add a zero-priced `is_reward` line: on a new order (channel
  'direct', total 0 — settles as paid at once) or on an existing open order of the same customer
  (e.g. POS). Stock leaves as a `reward_redemption` movement. Value rewards (fixed amount / %)
  are marked used against an existing order (the discount itself is applied by staff — the
  promotions engine is Phase 2). Staff with loyalty.adjust or pos.use can redeem.
*/
create or replace function public.loyalty_redeem_reward(
  p_reward_id uuid,
  p_variant_id uuid default null,
  p_order_id uuid default null,
  p_location_id uuid default null,
  p_note text default null
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.loyalty_rewards;
  v_customer public.customers;
  v_order public.orders;
  v_settings public.settings;
  v_variant record;
  v_line_id uuid;
  v_location uuid := p_location_id;
  v_new boolean := false;
begin
  if not (public.has_permission('loyalty.adjust') or public.has_permission('pos.use')) then
    raise exception 'permission denied: loyalty.adjust' using errcode = '42501';
  end if;
  select * into v_reward from loyalty_rewards where id = p_reward_id for update;
  if not found then raise exception 'reward not found' using errcode = 'P0002'; end if;
  if v_reward.status <> 'available' then
    raise exception 'this reward is no longer available' using errcode = 'P0001';
  end if;
  select * into v_customer from customers where id = v_reward.customer_id;

  if p_order_id is not null then
    select * into v_order from orders where id = p_order_id for update;
    if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
    if v_order.customer_id is distinct from v_reward.customer_id then
      raise exception 'the order belongs to another customer' using errcode = 'P0001';
    end if;
    if v_order.status = 'cancelled' then raise exception 'order is cancelled' using errcode = 'P0001'; end if;
  end if;

  if v_reward.reward_type in ('choose_from_category', 'specific_products') then
    if p_variant_id is null then raise exception 'choose the product' using errcode = '22023'; end if;
    if not exists (select 1 from public.loyalty_reward_options(p_reward_id) o where o.variant_id = p_variant_id) then
      raise exception 'this product isn''t part of the reward' using errcode = 'P0001';
    end if;
    select v.id, v.sku, v.label, v.price_fils, pr.name as product_name, pr.category_id, pr.destination_id,
           coalesce(c.cost_fils, 0) as cost_fils
      into v_variant
      from product_variants v join products pr on pr.id = v.product_id
      left join variant_costs c on c.variant_id = v.id
     where v.id = p_variant_id;

    if v_order.id is null then
      select * into v_settings from settings where id = 1;
      insert into orders (customer_id, channel, staff_id, status, fulfilment, contact_name, contact_phone,
                          contact_email, vat_rate_bp, prices_include_vat, notes, internal_notes)
      values (v_customer.id, 'direct', auth.uid(), 'new', 'handed_over', v_customer.name, v_customer.phone,
              v_customer.email, v_settings.vat_rate_bp, v_settings.prices_include_vat,
              'Solei Passport reward', nullif(trim(p_note), ''))
      returning * into v_order;
      v_new := true;
    end if;

    insert into order_lines (order_id, variant_id, product_name, variant_label, sku, category_id, destination_id,
                             qty, list_price_fils, unit_price_fils, line_total_fils, is_reward)
    values (v_order.id, v_variant.id, v_variant.product_name, v_variant.label, v_variant.sku,
            v_variant.category_id, v_variant.destination_id, 1, v_variant.price_fils, 0, 0, true)
    returning id into v_line_id;
    insert into order_line_costs (order_line_id, unit_cost_fils) values (v_line_id, v_variant.cost_fils);

    -- Stock: a new reward order deducts now; an existing order whose stock already left gets a
    -- movement from the same location; otherwise apply_order_stock handles it on payment.
    if v_location is null and not v_new then
      select m.location_id into v_location
        from stock_movements m join order_lines l on l.id = m.order_line_id
       where l.order_id = v_order.id and m.type in ('sale', 'reward_redemption')
       order by m.created_at limit 1;
    end if;
    if v_location is not null then
      insert into stock_movements (variant_id, location_id, qty, type, reason, order_line_id, event_id, created_by)
      values (v_variant.id, v_location, -1, 'reward_redemption', 'Passport reward · ' || v_order.number, v_line_id,
              (select event_id from stock_locations where id = v_location), auth.uid());
    elsif v_new then
      perform public.apply_order_stock(v_order.id);
    end if;
    if v_new then
      perform public.settle_if_paid(v_order.id);
      perform public.write_audit('order.created', 'orders', v_order.id::text, null,
        jsonb_build_object('number', v_order.number, 'channel', 'direct', 'total_fils', 0, 'reward_id', p_reward_id));
    end if;
  else
    if v_order.id is null then
      raise exception 'choose the order this reward was used on' using errcode = '22023';
    end if;
  end if;

  update loyalty_rewards set
    status = 'redeemed', redeemed_order_id = v_order.id, redeemed_order_line_id = v_line_id,
    redeemed_at = now(), redeemed_by = auth.uid(), note = coalesce(nullif(trim(p_note), ''), note)
  where id = p_reward_id;
  perform public.write_audit('loyalty.redeem', 'loyalty_rewards', p_reward_id::text, null,
    jsonb_build_object('order', v_order.number, 'variant_id', p_variant_id, 'customer_id', v_reward.customer_id));
  return query select v_order.id, v_order.number;
end;
$$;

-- Programme overview numbers for the admin.
create or replace function public.loyalty_overview()
returns table (
  members int, passports_issued int, stamps_collected int, stamps_on_cards int,
  rewards_available int, rewards_redeemed int, stamps_30d int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('loyalty.view');
  return query select
    (select count(distinct customer_id) from loyalty_stamps)::int,
    (select count(*) from passports)::int,
    (select coalesce(sum(stamps) filter (where kind <> 'redeemed'), 0) from loyalty_stamps)::int,
    (select coalesce(sum(stamps), 0) from loyalty_stamps)::int,
    (select count(*) from loyalty_rewards where status = 'available')::int,
    (select count(*) from loyalty_rewards where status = 'redeemed')::int,
    (select coalesce(sum(stamps), 0) from loyalty_stamps where kind = 'earned' and created_at > now() - interval '30 days')::int;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer passport login: link the signed-in (email-confirmed) auth user to the customer with
-- the same email, once. Creates nothing; returns null when no customer matches.
-- ---------------------------------------------------------------------------
create or replace function public.link_customer_account()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_id uuid;
begin
  if v_uid is null then return null; end if;
  select id into v_id from customers where auth_user_id = v_uid;
  if found then return v_id; end if;
  select lower(email) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then return null; end if;
  -- Oldest record with that email (phone-keyed duplicates can share an email).
  update customers set auth_user_id = v_uid
   where id = (select c.id from customers c where c.email = v_email and c.auth_user_id is null
                order by c.created_at limit 1)
  returning id into v_id;
  return v_id;
end;
$$;

-- Internal helpers: not callable by API users.
revoke execute on function public.loyalty_active_rule(timestamptz) from public, anon, authenticated;
revoke execute on function public.loyalty_line_qualifies(public.loyalty_rule_versions, uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.loyalty_expire_stamps(uuid) from public, anon, authenticated;
revoke execute on function public.loyalty_settle(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.loyalty_award_order(uuid) from public, anon, authenticated;
revoke execute on function public.loyalty_reverse_order(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.loyalty_on_refund() from public, anon, authenticated;
revoke execute on function public.after_order_paid(uuid) from public, anon, authenticated;
revoke execute on function public.after_order_cancelled(uuid) from public, anon, authenticated;
revoke execute on function public.is_own_customer(uuid) from public, anon;

-- Staff / customer RPCs (each checks permissions or ownership itself).
revoke execute on function public.loyalty_adjust_stamps(uuid, int, text, uuid) from public, anon;
revoke execute on function public.loyalty_issue_passport(uuid, public.passport_issue_how) from public, anon;
revoke execute on function public.loyalty_save_rules(jsonb) from public, anon;
revoke execute on function public.loyalty_reward_options(uuid) from public, anon;
revoke execute on function public.loyalty_redeem_reward(uuid, uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.loyalty_overview() from public, anon;
revoke execute on function public.link_customer_account() from public, anon;
grant execute on function public.is_own_customer(uuid) to authenticated;
grant execute on function public.loyalty_adjust_stamps(uuid, int, text, uuid) to authenticated;
grant execute on function public.loyalty_issue_passport(uuid, public.passport_issue_how) to authenticated;
grant execute on function public.loyalty_save_rules(jsonb) to authenticated;
grant execute on function public.loyalty_reward_options(uuid) to authenticated;
grant execute on function public.loyalty_redeem_reward(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.loyalty_overview() to authenticated;
grant execute on function public.link_customer_account() to authenticated;
