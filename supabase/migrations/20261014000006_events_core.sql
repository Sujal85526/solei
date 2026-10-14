-- Events (exhibitions, pop-ups, private bookings). Core table here because orders and
-- stock locations reference it; calendar features extend it in feat/event-calendar.

create type public.event_type as enum ('exhibition', 'popup', 'private_booking', 'other');
create type public.event_status as enum ('potential', 'confirmed', 'completed', 'cancelled');
create type public.fee_payment_status as enum ('unpaid', 'partially_paid', 'paid', 'waived', 'not_applicable');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  type public.event_type not null default 'exhibition',
  status public.event_status not null default 'potential',
  name text not null check (length(trim(name)) > 0),
  organiser_name text,
  organiser_contact text,
  organiser_phone text,
  organiser_email text,
  location text,
  emirate public.emirate,
  start_date date not null,
  end_date date not null,
  daily_hours jsonb not null default '{}'::jsonb,   -- { "2026-11-01": { "open": "10:00", "close": "22:00" }, ... } or { "default": {...} }
  booth_details text,
  participation_fee_fils int not null default 0 check (participation_fee_fils >= 0),
  fee_payment_status public.fee_payment_status not null default 'not_applicable',
  notes text,
  booking_id uuid,                                  -- FK added with bookings
  closed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_dates_ordered check (end_date >= start_date)
);

create index events_dates_idx on public.events (start_date, end_date);
create index events_status_idx on public.events (status);

create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

create policy "events.view reads events" on public.events
  for select to authenticated using (public.has_permission('events.view'));
create policy "events.manage writes events" on public.events
  for all to authenticated
  using (public.has_permission('events.manage'))
  with check (public.has_permission('events.manage'));

create trigger audit after insert or update or delete on public.events
  for each row execute function public.audit_row_change();
