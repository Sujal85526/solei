-- Event calendar (milestone 11): staff assignments, expenses, documents, overlap detection,
-- per-event stock summary and the close-out RPC. Builds on `events` (…000006) and the stock
-- ledger (…000007).

-- ─── Staff on an event ────────────────────────────────────────────────────────────────────
create table public.event_staff (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.staff_profiles (user_id) on delete cascade,
  role text check (role is null or length(role) <= 80),      -- e.g. "Booth lead", "Sales"
  note text check (note is null or length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index event_staff_user_idx on public.event_staff (user_id);

alter table public.event_staff enable row level security;

create policy "events.view reads event staff" on public.event_staff
  for select to authenticated using (public.has_permission('events.view'));
create policy "events.manage writes event staff" on public.event_staff
  for all to authenticated
  using (public.has_permission('events.manage'))
  with check (public.has_permission('events.manage'));

create trigger audit after insert or update or delete on public.event_staff
  for each row execute function public.audit_row_change();

-- ─── Expenses (financial: need reports.financial.view to read or write) ─────────────────────
create type public.event_expense_category as enum (
  'staff', 'transport', 'setup', 'accommodation', 'marketing', 'other'
);

create table public.event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  category public.event_expense_category not null default 'other',
  amount_fils int not null check (amount_fils > 0),
  note text check (note is null or length(note) <= 500),
  receipt_path text,                                   -- object path in bucket `event-docs`
  incurred_on date not null default public.business_today(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_expenses_event_idx on public.event_expenses (event_id, incurred_on);

create trigger event_expenses_updated_at before update on public.event_expenses
  for each row execute function public.set_updated_at();

alter table public.event_expenses enable row level security;

create policy "financial staff read event expenses" on public.event_expenses
  for select to authenticated
  using (public.has_permission('events.view') and public.has_permission('reports.financial.view'));
create policy "financial managers write event expenses" on public.event_expenses
  for all to authenticated
  using (public.has_permission('events.manage') and public.has_permission('reports.financial.view'))
  with check (public.has_permission('events.manage') and public.has_permission('reports.financial.view'));

create trigger audit after insert or update or delete on public.event_expenses
  for each row execute function public.audit_row_change();

-- ─── Documents (contracts, floor plans, permits) ────────────────────────────────────────────
create table public.event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (length(trim(name)) > 0 and length(name) <= 200),
  storage_path text not null unique,                   -- object path in bucket `event-docs`
  mime text,
  size_bytes int check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index event_documents_event_idx on public.event_documents (event_id, created_at desc);

alter table public.event_documents enable row level security;

create policy "events.view reads event documents" on public.event_documents
  for select to authenticated using (public.has_permission('events.view'));
create policy "events.manage writes event documents" on public.event_documents
  for all to authenticated
  using (public.has_permission('events.manage'))
  with check (public.has_permission('events.manage'));

create trigger audit after insert or update or delete on public.event_documents
  for each row execute function public.audit_row_change();

-- ─── Private storage bucket ─────────────────────────────────────────────────────────────────
-- Layout: <event_id>/docs/<uuid>.<ext> and <event_id>/receipts/<uuid>.<ext>.
-- Receipts are financial, so they follow the expense rules.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-docs', 'event-docs', false, 10485760, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
])
on conflict (id) do nothing;

create or replace function public.can_access_event_object(p_name text, p_write boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_permission(case when p_write then 'events.manage' else 'events.view' end)
    and (
      coalesce((storage.foldername(p_name))[2], '') <> 'receipts'
      or public.has_permission('reports.financial.view')
    );
$$;

revoke execute on function public.can_access_event_object(text, boolean) from public, anon;
grant execute on function public.can_access_event_object(text, boolean) to authenticated;

create policy "event staff read event docs" on storage.objects
  for select to authenticated
  using (bucket_id = 'event-docs' and public.can_access_event_object(name, false));
create policy "event managers upload event docs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-docs' and public.can_access_event_object(name, true));
create policy "event managers update event docs" on storage.objects
  for update to authenticated
  using (bucket_id = 'event-docs' and public.can_access_event_object(name, true));
create policy "event managers delete event docs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-docs' and public.can_access_event_object(name, true));

-- ─── Staff picker ───────────────────────────────────────────────────────────────────────────
-- staff_profiles is readable only with staff.manage; the calendar needs names to assign and
-- show staff, so expose just name/position to anyone who can view events.
create or replace function public.event_staff_options()
returns table (user_id uuid, full_name text, "position" text, active boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_permission('events.view');
  return query
    select sp.user_id, sp.full_name, sp.position, sp.active
    from public.staff_profiles sp
    order by sp.active desc, sp.full_name;
end;
$$;

revoke execute on function public.event_staff_options() from public, anon;
grant execute on function public.event_staff_options() to authenticated;

-- ─── Overlap detection (a warning, never a block — DECISIONS D9) ─────────────────────────────
-- Other non-cancelled events whose dates intersect [p_start, p_end]. `same_location` flags a
-- clash at the same venue (case-insensitive) so the UI can make it louder. RLS applies.
create or replace function public.overlapping_events(
  p_start date,
  p_end date,
  p_exclude uuid default null,
  p_location text default null
)
returns table (
  id uuid,
  name text,
  type public.event_type,
  status public.event_status,
  start_date date,
  end_date date,
  location text,
  same_location boolean
)
language sql
stable
set search_path = public
as $$
  select e.id, e.name, e.type, e.status, e.start_date, e.end_date, e.location,
    coalesce(
      nullif(trim(p_location), '') is not null
        and lower(trim(e.location)) = lower(trim(p_location)),
      false
    ) as same_location
  from public.events e
  where e.status <> 'cancelled'
    and e.start_date <= p_end
    and e.end_date >= p_start
    and (p_exclude is null or e.id <> p_exclude)
  order by same_location desc, e.start_date, e.name;
$$;

grant execute on function public.overlapping_events(date, date, uuid, text) to authenticated;

-- ─── Per-event stock summary ────────────────────────────────────────────────────────────────
-- allocated = transfers in, sold = net sales (sales − refund returns), returned = transfers out,
-- damaged = breakage, other = corrections/receipts/rewards, remaining = on hand at the event.
create view public.event_stock_summary
with (security_invoker = true) as
select
  l.event_id,
  m.location_id,
  m.variant_id,
  coalesce(sum(m.qty) filter (where m.type = 'transfer_in'), 0)::int as allocated,
  coalesce(-sum(m.qty) filter (where m.type in ('sale', 'refund_return')), 0)::int as sold,
  coalesce(-sum(m.qty) filter (where m.type = 'transfer_out'), 0)::int as returned,
  coalesce(-sum(m.qty) filter (where m.type = 'damage'), 0)::int as damaged,
  coalesce(sum(m.qty) filter (where m.type in ('adjustment', 'receive', 'reward_redemption')), 0)::int as other,
  sum(m.qty)::int as remaining
from public.stock_movements m
join public.stock_locations l on l.id = m.location_id
where l.kind = 'event'
group by l.event_id, m.location_id, m.variant_id;

-- ─── Close-out ──────────────────────────────────────────────────────────────────────────────
-- Returns the remaining stock of an event to a warehouse (main by default) and records
-- breakage. For every variant still on hand at the event, returned + damaged must equal what
-- remains, so the event location ends at zero. Then marks the event completed.
--   p_returns: [{ "variant_id": uuid, "qty": int }]
--   p_damages: [{ "variant_id": uuid, "qty": int, "reason": text }]
create or replace function public.close_event_stock(
  p_event_id uuid,
  p_returns jsonb default '[]'::jsonb,
  p_to_location uuid default null,
  p_damages jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_loc uuid;
  v_to uuid := p_to_location;
  v_row record;
  v_returned int := 0;
  v_damaged int := 0;
begin
  perform public.require_permission('events.manage');
  perform public.require_permission('inventory.transfer');

  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if v_event.closed_at is not null then
    raise exception 'this event is already closed' using errcode = 'P0001';
  end if;

  select id into v_loc from public.stock_locations where event_id = p_event_id;
  if v_to is null then
    select id into v_to from public.stock_locations where is_default;
  end if;
  if v_to is null or v_to = v_loc
     or not exists (select 1 from public.stock_locations where id = v_to and kind <> 'event' and active) then
    raise exception 'choose a warehouse to return the stock to' using errcode = 'P0001';
  end if;

  if jsonb_typeof(coalesce(p_returns, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_damages, '[]'::jsonb)) <> 'array' then
    raise exception 'returns and damages must be arrays' using errcode = '22023';
  end if;

  -- One row per variant that has stock at the event or is mentioned in the input.
  for v_row in
    with ret as (
      select (r ->> 'variant_id')::uuid as variant_id, sum((r ->> 'qty')::int)::int as qty
      from jsonb_array_elements(coalesce(p_returns, '[]'::jsonb)) r
      group by 1
    ),
    dmg as (
      select (d ->> 'variant_id')::uuid as variant_id, sum((d ->> 'qty')::int)::int as qty,
        string_agg(nullif(trim(d ->> 'reason'), ''), '; ') as reason
      from jsonb_array_elements(coalesce(p_damages, '[]'::jsonb)) d
      group by 1
    ),
    onhand as (
      select variant_id, sum(qty)::int as qty
      from public.stock_movements where location_id = v_loc
      group by variant_id
    ),
    variants as (
      select variant_id from onhand where qty <> 0
      union select variant_id from ret
      union select variant_id from dmg
    )
    select v.variant_id,
      coalesce(o.qty, 0) as remaining,
      coalesce(r.qty, 0) as returning,
      coalesce(d.qty, 0) as damaged,
      d.reason
    from variants v
    left join onhand o using (variant_id)
    left join ret r using (variant_id)
    left join dmg d using (variant_id)
    order by v.variant_id
  loop
    -- Serialise with concurrent POS sales / transfers of this variant at the event.
    perform pg_advisory_xact_lock(hashtext(v_row.variant_id::text || v_loc::text));
    v_row.remaining := public.on_hand(v_row.variant_id, v_loc);

    if v_row.returning < 0 or v_row.damaged < 0 then
      raise exception 'quantities cannot be negative' using errcode = '22023';
    end if;
    if v_row.returning + v_row.damaged <> greatest(v_row.remaining, 0) then
      raise exception 'returned (%) + broken (%) must equal the % units remaining for each product',
        v_row.returning, v_row.damaged, greatest(v_row.remaining, 0) using errcode = 'P0001';
    end if;

    if v_row.returning > 0 then
      perform public.transfer_stock(v_row.variant_id, v_loc, v_to, v_row.returning,
        'Event close-out: ' || v_event.name);
      v_returned := v_returned + v_row.returning;
    end if;
    if v_row.damaged > 0 then
      insert into public.stock_movements (variant_id, location_id, qty, type, reason, event_id, created_by)
      values (v_row.variant_id, v_loc, -v_row.damaged, 'damage',
        coalesce(v_row.reason, 'Broken at event'), p_event_id, auth.uid());
      v_damaged := v_damaged + v_row.damaged;
    end if;
  end loop;

  update public.events
  set closed_at = now(),
      status = case when status = 'cancelled' then status else 'completed' end
  where id = p_event_id;

  perform public.write_audit('event.close', 'events', p_event_id::text, null,
    jsonb_build_object('returned', v_returned, 'damaged', v_damaged, 'to_location', v_to,
      'returns', p_returns, 'damages', p_damages));

  return jsonb_build_object('returned', v_returned, 'damaged', v_damaged);
end;
$$;

revoke execute on function public.close_event_stock(uuid, jsonb, uuid, jsonb) from public, anon;
grant execute on function public.close_event_stock(uuid, jsonb, uuid, jsonb) to authenticated;

-- Re-open a closed event (mistake fixes). Stock moves already made stay in the ledger.
create or replace function public.reopen_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_permission('events.manage');
  update public.events set closed_at = null, status = 'confirmed'
  where id = p_event_id and closed_at is not null;
  if not found then
    raise exception 'this event is not closed' using errcode = 'P0001';
  end if;
  perform public.write_audit('event.reopen', 'events', p_event_id::text, null, null);
end;
$$;

revoke execute on function public.reopen_event(uuid) from public, anon;
grant execute on function public.reopen_event(uuid) to authenticated;
