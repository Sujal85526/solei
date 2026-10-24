-- Phase 2 operations: WhatsApp order updates, courier bookings (fulfilments) and staff attendance.
-- WhatsApp and the courier go through provider interfaces (src/providers/messaging, …/courier)
-- with stand-in implementations until the real accounts exist; everything here is provider-neutral.
-- No new permission keys (the live site's role editor on main can't save unknown keys): couriers use
-- orders.update, attendance is open to every staff member for themselves and staff.manage for all.

-- ── WhatsApp order updates ───────────────────────────────────────────────────────────────────
-- Off until the owner turns it on (Settings → Notifications) and a WhatsApp Business account is
-- connected. Transactional only: order confirmed / dispatched, to the order's mobile number.
alter table public.settings add column whatsapp_updates_enabled boolean not null default false;

insert into public.notification_templates (key, audience, channel, name, description, subject, body, variables, sort) values
('order_confirmation_whatsapp', 'customer', 'whatsapp', 'Order confirmed (WhatsApp)',
 'WhatsApp message when an order is paid (if WhatsApp updates are on).', 'Order {{order_number}} confirmed',
 E'Hi {{customer_name}}, thank you for your Solei order {{order_number}} ({{order_total}}). We''re preparing it now and will message you when it''s on its way.',
 array['customer_name','order_number','order_total','order_link'], 110),
('order_dispatched_whatsapp', 'customer', 'whatsapp', 'Order on its way (WhatsApp)',
 'WhatsApp message when an order is dispatched (if WhatsApp updates are on).', 'Order {{order_number}} is on its way',
 E'Hi {{customer_name}}, your Solei order {{order_number}} is on its way. {{tracking}}',
 array['customer_name','order_number','tracking','order_link'], 111)
on conflict (key) do nothing;

-- ── Courier bookings ─────────────────────────────────────────────────────────────────────────
create type public.fulfilment_status as enum (
  'booked', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled'
);

create table public.fulfilments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- Which provider booked it ('mock' until a courier account exists) and the courier's name.
  provider text not null,
  courier text not null,
  tracking_number text not null,
  label_url text,
  status public.fulfilment_status not null default 'booked',
  -- Courier scans, newest last: [{ at, status, description }].
  events jsonb not null default '[]'::jsonb,
  booked_by uuid references auth.users (id) on delete set null,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fulfilments_order_idx on public.fulfilments (order_id);
create index fulfilments_open_idx on public.fulfilments (status) where status not in ('delivered', 'failed', 'cancelled');
create unique index fulfilments_tracking_key on public.fulfilments (provider, tracking_number);

create trigger fulfilments_updated_at before update on public.fulfilments
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.fulfilments
  for each row execute function public.audit_row_change();

alter table public.fulfilments enable row level security;
create policy fulfilments_read on public.fulfilments for select using (public.has_permission('orders.view'));
create policy fulfilments_write on public.fulfilments for all
  using (public.has_permission('orders.update')) with check (public.has_permission('orders.update'));

-- ── Staff attendance ─────────────────────────────────────────────────────────────────────────
create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The event worked at (pop-up / exhibition), when there is one.
  event_id uuid references public.events (id) on delete set null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  note text check (length(note) <= 300),
  edited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_attendance_order check (clock_out is null or clock_out > clock_in)
);
create index staff_attendance_user_idx on public.staff_attendance (user_id, clock_in desc);
-- One open shift per person.
create unique index staff_attendance_one_open on public.staff_attendance (user_id) where clock_out is null;

create trigger staff_attendance_updated_at before update on public.staff_attendance
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.staff_attendance
  for each row execute function public.audit_row_change();

alter table public.staff_attendance enable row level security;
create policy attendance_read on public.staff_attendance for select
  using (user_id = auth.uid() or public.has_permission('staff.manage'));

-- Clock in (now), optionally at an event. Refuses a second open shift.
create or replace function public.attendance_clock_in(p_event uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into staff_attendance (user_id, event_id, clock_in) values (auth.uid(), p_event, now())
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'you''re already clocked in' using errcode = 'P0001';
end;
$$;

create or replace function public.attendance_clock_out(p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  update staff_attendance set clock_out = greatest(now(), clock_in + interval '1 minute'),
         note = coalesce(nullif(trim(p_note), ''), note)
   where user_id = auth.uid() and clock_out is null
  returning id into v_id;
  if v_id is null then raise exception 'you''re not clocked in' using errcode = 'P0001'; end if;
  return v_id;
end;
$$;

/*
  Staff with staff.manage add or correct a shift (forgotten clock-out, paper timesheet). p = { id?,
  user_id, event_id?, clock_in, clock_out?, note }.
*/
create or replace function public.attendance_save(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  perform public.require_permission('staff.manage');
  if v_id is null then
    insert into staff_attendance (user_id, event_id, clock_in, clock_out, note, edited_by)
    values ((p ->> 'user_id')::uuid, nullif(p ->> 'event_id', '')::uuid, (p ->> 'clock_in')::timestamptz,
            nullif(p ->> 'clock_out', '')::timestamptz, nullif(trim(p ->> 'note'), ''), auth.uid())
    returning id into v_id;
  else
    update staff_attendance set event_id = nullif(p ->> 'event_id', '')::uuid,
           clock_in = (p ->> 'clock_in')::timestamptz, clock_out = nullif(p ->> 'clock_out', '')::timestamptz,
           note = nullif(trim(p ->> 'note'), ''), edited_by = auth.uid()
     where id = v_id;
    if not found then raise exception 'shift not found' using errcode = 'P0002'; end if;
  end if;
  return v_id;
exception
  when unique_violation then raise exception 'this person already has an open shift' using errcode = 'P0001';
  when check_violation then raise exception 'clock-out must be after clock-in' using errcode = 'P0001';
end;
$$;

create or replace function public.attendance_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_permission('staff.manage');
  delete from staff_attendance where id = p_id;
end;
$$;

revoke all on function public.attendance_clock_in(uuid) from public, anon;
revoke all on function public.attendance_clock_out(text) from public, anon;
revoke all on function public.attendance_save(jsonb) from public, anon;
revoke all on function public.attendance_delete(uuid) from public, anon;
grant execute on function public.attendance_clock_in(uuid) to authenticated;
grant execute on function public.attendance_clock_out(text) to authenticated;
grant execute on function public.attendance_save(jsonb) to authenticated;
grant execute on function public.attendance_delete(uuid) to authenticated;
