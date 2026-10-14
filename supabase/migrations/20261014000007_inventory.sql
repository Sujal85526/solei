-- Inventory is a movement ledger: on hand = sum(stock_movements.qty) per variant × location.
-- Movements are append-only; mistakes are fixed with a correcting movement.

create type public.location_kind as enum ('warehouse', 'event', 'other');

create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.location_kind not null default 'warehouse',
  event_id uuid unique references public.events (id) on delete restrict,
  -- Online orders draw from locations that sell online (normally just the main warehouse).
  sells_online boolean not null default false,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_locations_event_kind check ((kind = 'event') = (event_id is not null))
);

create unique index stock_locations_one_default on public.stock_locations (is_default) where is_default;

create type public.stock_movement_type as enum (
  'receive', 'sale', 'refund_return', 'transfer_out', 'transfer_in',
  'damage', 'adjustment', 'reward_redemption'
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id),
  location_id uuid not null references public.stock_locations (id),
  qty int not null check (qty <> 0),
  type public.stock_movement_type not null,
  reason text,
  order_line_id uuid,                 -- FK added with order_lines
  event_id uuid references public.events (id),
  transfer_id uuid,                   -- pairs transfer_out / transfer_in rows
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Sign must match the movement type.
  constraint stock_movements_sign check (
    case type
      when 'receive' then qty > 0
      when 'refund_return' then qty > 0
      when 'transfer_in' then qty > 0
      when 'sale' then qty < 0
      when 'transfer_out' then qty < 0
      when 'damage' then qty < 0
      when 'reward_redemption' then qty < 0
      else true
    end
  ),
  constraint stock_movements_reason_required check (
    type not in ('adjustment', 'damage') or length(trim(coalesce(reason, ''))) > 0
  )
);

create index stock_movements_variant_location_idx on public.stock_movements (variant_id, location_id);
create index stock_movements_location_idx on public.stock_movements (location_id, created_at desc);
create index stock_movements_event_idx on public.stock_movements (event_id) where event_id is not null;
create index stock_movements_order_line_idx on public.stock_movements (order_line_id) where order_line_id is not null;

create trigger stock_locations_updated_at before update on public.stock_locations
  for each row execute function public.set_updated_at();

-- On-hand per variant × location (RLS of the caller applies).
create view public.stock_levels
with (security_invoker = true) as
select variant_id, location_id, sum(qty)::int as on_hand, max(created_at) as last_movement_at
from public.stock_movements
group by variant_id, location_id;

alter table public.stock_locations enable row level security;
alter table public.stock_movements enable row level security;

create policy "inventory.view reads locations" on public.stock_locations
  for select to authenticated using (public.has_permission('inventory.view') or public.has_permission('pos.use'));
create policy "inventory.adjust writes locations" on public.stock_locations
  for all to authenticated
  using (public.has_permission('inventory.adjust'))
  with check (public.has_permission('inventory.adjust'));

create policy "inventory.view reads movements" on public.stock_movements
  for select to authenticated using (public.has_permission('inventory.view') or public.has_permission('pos.use'));
-- No insert/update/delete policies: movements are written only by RPCs.

create trigger audit after insert or update or delete on public.stock_locations
  for each row execute function public.audit_row_change();

-- Every new event gets its own stock location.
create or replace function public.create_event_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stock_locations (name, kind, event_id, sells_online)
  values (new.name, 'event', new.id, false);
  return new;
end;
$$;

create trigger events_create_location after insert on public.events
  for each row execute function public.create_event_location();

-- Keep the event location's name in sync.
create or replace function public.sync_event_location_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update public.stock_locations set name = new.name where event_id = new.id;
  end if;
  return new;
end;
$$;

create trigger events_sync_location_name after update of name on public.events
  for each row execute function public.sync_event_location_name();

-- Units available to sell online per variant (sum across sells_online locations). Public.
create or replace function public.online_availability(p_variant_ids uuid[])
returns table (variant_id uuid, available int)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, coalesce(sum(m.qty), 0)::int
  from unnest(p_variant_ids) as v(id)
  left join public.stock_movements m on m.variant_id = v.id
    and m.location_id in (select id from public.stock_locations where sells_online and active)
  group by v.id;
$$;

grant execute on function public.online_availability(uuid[]) to anon, authenticated;

-- On hand for one variant at one location (internal helper for RPCs).
create or replace function public.on_hand(p_variant_id uuid, p_location_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(qty), 0)::int from public.stock_movements
  where variant_id = p_variant_id and location_id = p_location_id;
$$;

-- Record a single-location movement (receive / damage / adjustment).
create or replace function public.record_stock_movement(
  p_variant_id uuid,
  p_location_id uuid,
  p_type public.stock_movement_type,
  p_qty int,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_event uuid;
begin
  if p_type = 'receive' then
    perform public.require_permission('inventory.receive');
  elsif p_type in ('damage', 'adjustment') then
    perform public.require_permission('inventory.adjust');
  else
    raise exception 'use the dedicated function for % movements', p_type using errcode = '22023';
  end if;

  select event_id into v_event from stock_locations where id = p_location_id;

  insert into stock_movements (variant_id, location_id, qty, type, reason, event_id, created_by)
  values (p_variant_id, p_location_id, p_qty, p_type, nullif(trim(p_reason), ''), v_event, auth.uid())
  returning id into v_id;

  perform public.write_audit('stock.' || p_type, 'stock_movements', v_id::text, null,
    jsonb_build_object('variant_id', p_variant_id, 'location_id', p_location_id, 'qty', p_qty, 'reason', p_reason));
  return v_id;
end;
$$;

-- Move stock between two locations atomically.
create or replace function public.transfer_stock(
  p_variant_id uuid,
  p_from_location uuid,
  p_to_location uuid,
  p_qty int,
  p_reason text default null,
  p_allow_negative boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer uuid := gen_random_uuid();
  v_from_event uuid;
  v_to_event uuid;
begin
  perform public.require_permission('inventory.transfer');
  if p_qty <= 0 then
    raise exception 'quantity must be positive' using errcode = '22023';
  end if;
  if p_from_location = p_to_location then
    raise exception 'choose two different locations' using errcode = '22023';
  end if;
  -- Serialise concurrent transfers of the same variant.
  perform pg_advisory_xact_lock(hashtext(p_variant_id::text || p_from_location::text));
  if not p_allow_negative and public.on_hand(p_variant_id, p_from_location) < p_qty then
    raise exception 'not enough stock to transfer (on hand %)', public.on_hand(p_variant_id, p_from_location)
      using errcode = 'P0001';
  end if;

  select event_id into v_from_event from stock_locations where id = p_from_location;
  select event_id into v_to_event from stock_locations where id = p_to_location;

  insert into stock_movements (variant_id, location_id, qty, type, reason, event_id, transfer_id, created_by)
  values
    (p_variant_id, p_from_location, -p_qty, 'transfer_out', p_reason, coalesce(v_to_event, v_from_event), v_transfer, auth.uid()),
    (p_variant_id, p_to_location, p_qty, 'transfer_in', p_reason, coalesce(v_to_event, v_from_event), v_transfer, auth.uid());

  perform public.write_audit('stock.transfer', 'stock_movements', v_transfer::text, null,
    jsonb_build_object('variant_id', p_variant_id, 'from', p_from_location, 'to', p_to_location, 'qty', p_qty));
  return v_transfer;
end;
$$;

revoke execute on function public.on_hand(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.record_stock_movement(uuid, uuid, public.stock_movement_type, int, text) from public, anon;
revoke execute on function public.transfer_stock(uuid, uuid, uuid, int, text, boolean) from public, anon;
grant execute on function public.record_stock_movement(uuid, uuid, public.stock_movement_type, int, text) to authenticated;
grant execute on function public.transfer_stock(uuid, uuid, uuid, int, text, boolean) to authenticated;
