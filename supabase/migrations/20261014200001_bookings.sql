-- Customer event booking ("Plan your event", milestone 14): admin-editable configuration,
-- booking requests, versioned quotes with a public accept link, message log, deposit payments
-- through the normal order/payment ledger and automatic calendar events on confirmation.
--
-- Flow: submit_booking (anon, estimate computed here) → requested → in_review → send_booking_quote
-- (new version each send) → quoted → accept_quote (anon, by token) → accepted → deposit order
-- (channel 'booking', paid via the verified webhook → confirm_payment) → confirmed (+ events row).
-- Staff can also confirm manually (confirm_booking).

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
alter table public.settings
  add column booking_flower_base_fils int not null default 80000
    check (booking_flower_base_fils >= 0),
  add column booking_quote_validity_days int not null default 14
    check (booking_quote_validity_days between 1 and 365);

-- ---------------------------------------------------------------------------
-- Configuration (public reads active rows; bookings.manage writes)
-- ---------------------------------------------------------------------------
create table public.booking_event_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (description is null or length(description) <= 500),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (description is null or length(description) <= 1000),
  inclusions text[] not null default '{}',
  base_price_fils int not null default 0 check (base_price_fils >= 0),
  images text[] not null default '{}',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booth_designs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (description is null or length(description) <= 1000),
  photos text[] not null default '{}',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Flower decoration: price = settings.booking_flower_base_fils + the colour's surcharge.
create table public.flower_options (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  hex text not null default '#F7CDD0' check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  price_fils int not null default 0 check (price_fils >= 0),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create type public.booking_status as enum (
  'requested', 'in_review', 'quoted', 'accepted', 'confirmed', 'completed', 'rejected', 'cancelled'
);
create type public.booking_quote_status as enum ('sent', 'accepted', 'superseded', 'withdrawn');
create type public.booking_message_direction as enum ('in', 'out', 'note');
create type public.booking_message_channel as enum ('email', 'whatsapp_link', 'internal');

create sequence public.booking_ref_seq start 1;

create or replace function public.next_booking_ref()
returns text
language sql
volatile
as $$
  select 'BK-' || lpad(nextval('public.booking_ref_seq')::text, 4, '0');
$$;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default public.next_booking_ref(),
  customer_id uuid references public.customers (id) on delete set null,
  -- Contact snapshot (the customer record may change later).
  contact_name text not null,
  contact_phone text not null check (contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  contact_email text not null check (contact_email = lower(contact_email) and contact_email like '%_@_%'),
  event_type_id uuid not null references public.booking_event_types (id) on delete restrict,
  event_date date not null,
  start_time time not null,
  end_time time not null,                            -- may be after midnight (end < start)
  location text not null,
  emirate public.emirate not null,
  guests int not null check (guests between 1 and 10000),
  products_interest jsonb not null default '[]'::jsonb, -- [{ category: slug, qty }]
  service_type_ids uuid[] not null default '{}',
  package_id uuid references public.booking_packages (id) on delete restrict,
  booth_design_id uuid references public.booth_designs (id) on delete restrict,
  flowers boolean not null default false,
  flower_option_id uuid references public.flower_options (id) on delete restrict,
  special_requests text check (special_requests is null or length(special_requests) <= 2000),
  estimate jsonb not null default '{}'::jsonb,       -- { lines: [...], total_fils } computed server-side
  estimated_total_fils int not null default 0 check (estimated_total_fils >= 0),
  status public.booking_status not null default 'requested',
  reject_reason text,
  event_id uuid references public.events (id) on delete set null,
  consent_at timestamptz,
  client_uuid uuid unique,                           -- idempotent submit
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_times check (end_time <> start_time),
  constraint bookings_flower_choice check (not flowers or flower_option_id is not null)
);

create index bookings_status_idx on public.bookings (status, created_at desc);
create index bookings_event_date_idx on public.bookings (event_date);
create index bookings_customer_idx on public.bookings (customer_id);

create table public.booking_quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  version int not null check (version > 0),
  status public.booking_quote_status not null default 'sent',
  lines jsonb not null,                              -- [{ label, qty, unit_price_fils, total_fils }]
  subtotal_fils int not null check (subtotal_fils >= 0),
  discount_fils int not null default 0 check (discount_fils >= 0),
  total_fils int not null check (total_fils >= 0),
  deposit_fils int not null check (deposit_fils >= 0),
  valid_until date not null,
  notes text check (notes is null or length(notes) <= 2000),
  -- Unguessable accept-link token (2 × 122 random bits).
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (booking_id, version),
  constraint booking_quotes_totals check (
    total_fils = subtotal_fils - discount_fils and deposit_fils <= total_fils
  )
);

create table public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  direction public.booking_message_direction not null,
  channel public.booking_message_channel not null default 'internal',
  body text not null check (length(trim(body)) between 1 and 5000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index booking_messages_booking_idx on public.booking_messages (booking_id, created_at);

-- Foreign keys reserved on earlier tables.
alter table public.events
  add constraint events_booking_id_fkey foreign key (booking_id)
  references public.bookings (id) on delete set null;
alter table public.orders
  add constraint orders_booking_id_fkey foreign key (booking_id)
  references public.bookings (id) on delete set null;
alter table public.payment_links
  add constraint payment_links_booking_id_fkey foreign key (booking_id)
  references public.bookings (id) on delete cascade;
create index orders_booking_idx on public.orders (booking_id) where booking_id is not null;

-- notification_log arrives with the notifications milestone; link it when present.
do $$
begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log
      add constraint notification_log_booking_id_fkey foreign key (booking_id)
      references public.bookings (id) on delete set null;
  end if;
  if to_regclass('public.notification_templates') is not null then
    insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort)
    values ('booking_message', 'customer', 'Booking message', 'A personal message from the bookings inbox.',
      'Your Solei event {{booking_ref}}',
      E'Dear {{customer_name}},\n\n{{message}}\n\nSolei',
      array['customer_name', 'booking_ref', 'message'], 85)
    on conflict (key) do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: updated_at + audit
-- ---------------------------------------------------------------------------
create trigger booking_event_types_updated_at before update on public.booking_event_types
  for each row execute function public.set_updated_at();
create trigger booking_service_types_updated_at before update on public.booking_service_types
  for each row execute function public.set_updated_at();
create trigger booking_packages_updated_at before update on public.booking_packages
  for each row execute function public.set_updated_at();
create trigger booth_designs_updated_at before update on public.booth_designs
  for each row execute function public.set_updated_at();
create trigger flower_options_updated_at before update on public.flower_options
  for each row execute function public.set_updated_at();
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

create trigger audit after insert or update or delete on public.booking_event_types
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.booking_service_types
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.booking_packages
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.booth_designs
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.flower_options
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.bookings
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.booking_quotes
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.booking_messages
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.booking_event_types enable row level security;
alter table public.booking_service_types enable row level security;
alter table public.booking_packages enable row level security;
alter table public.booth_designs enable row level security;
alter table public.flower_options enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_quotes enable row level security;
alter table public.booking_messages enable row level security;

create policy "anyone reads active event types" on public.booking_event_types
  for select using (active or public.has_permission('bookings.view'));
create policy "bookings.manage writes event types" on public.booking_event_types
  for all to authenticated
  using (public.has_permission('bookings.manage'))
  with check (public.has_permission('bookings.manage'));

create policy "anyone reads active service types" on public.booking_service_types
  for select using (active or public.has_permission('bookings.view'));
create policy "bookings.manage writes service types" on public.booking_service_types
  for all to authenticated
  using (public.has_permission('bookings.manage'))
  with check (public.has_permission('bookings.manage'));

create policy "anyone reads active packages" on public.booking_packages
  for select using (active or public.has_permission('bookings.view'));
create policy "bookings.manage writes packages" on public.booking_packages
  for all to authenticated
  using (public.has_permission('bookings.manage'))
  with check (public.has_permission('bookings.manage'));

create policy "anyone reads active booths" on public.booth_designs
  for select using (active or public.has_permission('bookings.view'));
create policy "bookings.manage writes booths" on public.booth_designs
  for all to authenticated
  using (public.has_permission('bookings.manage'))
  with check (public.has_permission('bookings.manage'));

create policy "anyone reads active flower options" on public.flower_options
  for select using (active or public.has_permission('bookings.view'));
create policy "bookings.manage writes flower options" on public.flower_options
  for all to authenticated
  using (public.has_permission('bookings.manage'))
  with check (public.has_permission('bookings.manage'));

-- Bookings are created by submit_booking and change status through the RPCs below; staff with
-- bookings.manage may still edit details directly (e.g. a corrected venue).
create policy "bookings.view reads bookings" on public.bookings
  for select to authenticated using (public.has_permission('bookings.view'));
create policy "bookings.manage updates bookings" on public.bookings
  for update to authenticated
  using (public.has_permission('bookings.manage'))
  with check (public.has_permission('bookings.manage'));

create policy "bookings.view reads quotes" on public.booking_quotes
  for select to authenticated using (public.has_permission('bookings.view'));

create policy "bookings.view reads messages" on public.booking_messages
  for select to authenticated using (public.has_permission('bookings.view'));
create policy "bookings.manage logs messages" on public.booking_messages
  for insert to authenticated
  with check (public.has_permission('bookings.manage') and direction in ('out', 'note'));

-- ---------------------------------------------------------------------------
-- Estimate (the only price source for requests — never trust client prices)
-- ---------------------------------------------------------------------------
/*
  p: { package_id?, flowers?, flower_option_id?, products_interest: [{ category, qty }] }
  → { lines: [{ kind, label, qty, unit_price_fils, total_fils }], total_fils }
  Products use the category's lowest active price ("from"); a category without a price (e.g.
  dukhoon before launch) is listed with null amounts and priced in the quotation.
*/
create or replace function public.booking_estimate(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_total int := 0;
  v_pkg record;
  v_flower record;
  v_base int;
  v_item jsonb;
  v_cat record;
  v_qty int;
begin
  if nullif(p ->> 'package_id', '') is not null then
    select name, base_price_fils into v_pkg
      from booking_packages where id = (p ->> 'package_id')::uuid and active;
    if not found then
      raise exception 'this package is no longer available' using errcode = 'P0001';
    end if;
    v_lines := v_lines || jsonb_build_object('kind', 'package', 'label', v_pkg.name, 'qty', 1,
      'unit_price_fils', v_pkg.base_price_fils, 'total_fils', v_pkg.base_price_fils);
    v_total := v_total + v_pkg.base_price_fils;
  end if;

  if coalesce((p ->> 'flowers')::boolean, false) then
    select name, price_fils into v_flower
      from flower_options where id = nullif(p ->> 'flower_option_id', '')::uuid and active;
    if not found then
      raise exception 'choose a flower colour' using errcode = 'P0001';
    end if;
    select booking_flower_base_fils into v_base from settings where id = 1;
    v_lines := v_lines || jsonb_build_object('kind', 'flowers', 'label', 'Flowers — ' || v_flower.name,
      'qty', 1, 'unit_price_fils', v_base + v_flower.price_fils, 'total_fils', v_base + v_flower.price_fils);
    v_total := v_total + v_base + v_flower.price_fils;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p -> 'products_interest', '[]'::jsonb)) loop
    v_qty := coalesce(nullif(v_item ->> 'qty', '')::int, 0);
    continue when v_qty <= 0;
    if v_qty > 10000 then
      raise exception 'quantities above 10,000 — please mention them in your special requests'
        using errcode = 'P0001';
    end if;
    select c.name,
           (select min(v.price_fils) from product_variants v join products pr on pr.id = v.product_id
             where pr.category_id = c.id and pr.active and v.active) as from_price
      into v_cat
      from categories c where c.slug = v_item ->> 'category' and c.active;
    if not found then
      raise exception 'unknown product category' using errcode = 'P0001';
    end if;
    v_lines := v_lines || jsonb_build_object('kind', 'products', 'category', v_item ->> 'category',
      'label', v_cat.name, 'qty', v_qty, 'unit_price_fils', v_cat.from_price,
      'total_fils', case when v_cat.from_price is null then null else v_cat.from_price * v_qty end);
    v_total := v_total + coalesce(v_cat.from_price * v_qty, 0);
  end loop;

  return jsonb_build_object('lines', v_lines, 'total_fils', v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- Public submit
-- ---------------------------------------------------------------------------
/*
  p: { client_uuid, event_type_id, event_date, start_time, end_time, location, emirate, guests,
       service_type_ids: [uuid], package_id?, booth_design_id?, flowers, flower_option_id?,
       products_interest: [{ category, qty }], special_requests?,
       contact: { name, phone (E.164), email }, consent: true, marketing_consent? }
*/
create or replace function public.submit_booking(p jsonb)
returns table (booking_id uuid, ref text, estimated_total_fils int, existing boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_existing public.bookings;
  v_booking public.bookings;
  v_services uuid[];
  v_estimate jsonb;
  v_customer uuid;
  v_name text := nullif(trim(p -> 'contact' ->> 'name'), '');
  v_phone text := nullif(trim(p -> 'contact' ->> 'phone'), '');
  v_email text := nullif(lower(trim(p -> 'contact' ->> 'email')), '');
  v_marketing boolean := coalesce((p ->> 'marketing_consent')::boolean, false);
  v_products jsonb;
begin
  if nullif(p ->> 'client_uuid', '') is null then
    raise exception 'missing request id' using errcode = '22023';
  end if;
  select * into v_existing from bookings b where b.client_uuid = (p ->> 'client_uuid')::uuid;
  if found then
    return query select v_existing.id, v_existing.ref, v_existing.estimated_total_fils, true;
    return;
  end if;

  if not coalesce((p ->> 'consent')::boolean, false) then
    raise exception 'please agree to be contacted about your request' using errcode = 'P0001';
  end if;
  if v_name is null or length(v_name) > 120 then
    raise exception 'enter your name' using errcode = 'P0001';
  end if;
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'enter a valid phone number' using errcode = 'P0001';
  end if;
  if v_email is null or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'enter a valid email' using errcode = 'P0001';
  end if;
  if not exists (select 1 from booking_event_types where id = (p ->> 'event_type_id')::uuid and active) then
    raise exception 'choose an event type' using errcode = 'P0001';
  end if;
  if (p ->> 'event_date')::date < public.business_today() then
    raise exception 'choose a date in the future' using errcode = 'P0001';
  end if;
  if length(coalesce(trim(p ->> 'location'), '')) not between 2 and 200 then
    raise exception 'enter the event location' using errcode = 'P0001';
  end if;
  if coalesce((p ->> 'guests')::int, 0) not between 1 and 10000 then
    raise exception 'enter the number of guests' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct s.id), '{}') into v_services
    from booking_service_types s
   where s.active and s.id in (
     select (jsonb_array_elements_text(coalesce(p -> 'service_type_ids', '[]'::jsonb)))::uuid);
  if cardinality(v_services) = 0
     or cardinality(v_services) <> jsonb_array_length(coalesce(p -> 'service_type_ids', '[]'::jsonb)) then
    raise exception 'choose at least one service' using errcode = 'P0001';
  end if;

  if nullif(p ->> 'booth_design_id', '') is not null
     and not exists (select 1 from booth_designs where id = (p ->> 'booth_design_id')::uuid and active) then
    raise exception 'this booth design is no longer available' using errcode = 'P0001';
  end if;

  -- Keep only positive quantities.
  select coalesce(jsonb_agg(jsonb_build_object('category', e ->> 'category', 'qty', (e ->> 'qty')::int)), '[]'::jsonb)
    into v_products
    from jsonb_array_elements(coalesce(p -> 'products_interest', '[]'::jsonb)) e
   where coalesce(nullif(e ->> 'qty', '')::int, 0) > 0;

  v_estimate := public.booking_estimate(jsonb_build_object(
    'package_id', p ->> 'package_id', 'flowers', coalesce((p ->> 'flowers')::boolean, false),
    'flower_option_id', p ->> 'flower_option_id', 'products_interest', v_products));

  v_customer := public.upsert_customer(v_phone, v_email, v_name, 'booking', (p ->> 'emirate')::public.emirate,
    null, v_marketing, case when v_marketing then 'email' end);

  insert into bookings (
    customer_id, contact_name, contact_phone, contact_email, event_type_id, event_date, start_time,
    end_time, location, emirate, guests, products_interest, service_type_ids, package_id,
    booth_design_id, flowers, flower_option_id, special_requests, estimate, estimated_total_fils,
    consent_at, client_uuid
  ) values (
    v_customer, v_name, v_phone, v_email, (p ->> 'event_type_id')::uuid, (p ->> 'event_date')::date,
    (p ->> 'start_time')::time, (p ->> 'end_time')::time, trim(p ->> 'location'),
    (p ->> 'emirate')::public.emirate, (p ->> 'guests')::int, v_products, v_services,
    nullif(p ->> 'package_id', '')::uuid, nullif(p ->> 'booth_design_id', '')::uuid,
    coalesce((p ->> 'flowers')::boolean, false),
    case when coalesce((p ->> 'flowers')::boolean, false) then nullif(p ->> 'flower_option_id', '')::uuid end,
    nullif(trim(p ->> 'special_requests'), ''), v_estimate, (v_estimate ->> 'total_fils')::int,
    now(), (p ->> 'client_uuid')::uuid
  ) returning * into v_booking;

  perform public.write_audit('booking.submitted', 'bookings', v_booking.id::text, null,
    jsonb_build_object('ref', v_booking.ref, 'event_date', v_booking.event_date,
      'estimated_total_fils', v_booking.estimated_total_fils));
  return query select v_booking.id, v_booking.ref, v_booking.estimated_total_fils, false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status changes (staff)
-- ---------------------------------------------------------------------------
create or replace function public.set_booking_status(
  p_booking_id uuid,
  p_status public.booking_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.bookings;
  v_reason text := nullif(trim(p_reason), '');
begin
  perform public.require_permission('bookings.manage');
  select * into v_b from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if v_b.status = p_status then
    return;
  end if;

  if p_status = 'in_review' and v_b.status <> 'requested' then
    raise exception 'only new requests can be marked in review' using errcode = 'P0001';
  elsif p_status in ('rejected', 'cancelled') then
    if v_b.status in ('completed', 'rejected', 'cancelled') then
      raise exception 'this booking is already closed' using errcode = 'P0001';
    end if;
    if p_status = 'rejected' and v_b.status = 'confirmed' then
      raise exception 'a confirmed booking can be cancelled, not rejected' using errcode = 'P0001';
    end if;
    if v_reason is null or length(v_reason) < 3 then
      raise exception 'give a reason' using errcode = 'P0001';
    end if;
    update booking_quotes set status = 'withdrawn' where booking_id = v_b.id and status = 'sent';
    if v_b.event_id is not null then
      update events set status = 'cancelled' where id = v_b.event_id and status <> 'completed';
    end if;
  elsif p_status = 'completed' and v_b.status <> 'confirmed' then
    raise exception 'only confirmed bookings can be completed' using errcode = 'P0001';
  elsif p_status not in ('in_review', 'rejected', 'cancelled', 'completed') then
    raise exception 'use the quote or confirm actions for this status' using errcode = 'P0001';
  end if;

  update bookings set status = p_status,
    reject_reason = case when p_status in ('rejected', 'cancelled') then v_reason else reject_reason end
  where id = v_b.id;
  perform public.write_audit('booking.' || p_status::text, 'bookings', v_b.id::text,
    jsonb_build_object('status', v_b.status), jsonb_build_object('status', p_status, 'reason', v_reason));
end;
$$;

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------
/*
  New quote version (every send is a version; older open versions are superseded).
  p: { booking_id, lines: [{ label, qty, unit_price_fils }], discount_fils, deposit_fils?,
       valid_until?, notes? } — totals are recomputed here.
*/
create or replace function public.send_booking_quote(p jsonb)
returns table (quote_id uuid, version int, token text, total_fils int, deposit_fils int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.bookings;
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal int := 0;
  v_discount int := coalesce(nullif(p ->> 'discount_fils', '')::int, 0);
  v_total int;
  v_deposit int;
  v_valid date;
  v_qty int;
  v_unit int;
  v_label text;
  v_version int;
  v_settings public.settings;
  v_quote public.booking_quotes;
begin
  perform public.require_permission('bookings.manage');
  select * into v_b from bookings where id = (p ->> 'booking_id')::uuid for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if v_b.status not in ('requested', 'in_review', 'quoted', 'accepted') then
    raise exception 'this booking can no longer be quoted' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'add at least one line' using errcode = 'P0001';
  end if;

  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    v_label := nullif(trim(v_line ->> 'label'), '');
    v_qty := (v_line ->> 'qty')::int;
    v_unit := (v_line ->> 'unit_price_fils')::int;
    if v_label is null or length(v_label) > 200 then
      raise exception 'every line needs a description' using errcode = 'P0001';
    end if;
    if v_qty is null or v_qty not between 1 and 100000 or v_unit is null or v_unit < 0 then
      raise exception 'check quantities and prices' using errcode = 'P0001';
    end if;
    v_lines := v_lines || jsonb_build_object('label', v_label, 'qty', v_qty,
      'unit_price_fils', v_unit, 'total_fils', v_qty * v_unit);
    v_subtotal := v_subtotal + v_qty * v_unit;
  end loop;

  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'the discount can''t exceed the subtotal' using errcode = 'P0001';
  end if;
  v_total := v_subtotal - v_discount;

  select * into v_settings from settings where id = 1;
  if nullif(p ->> 'deposit_fils', '') is null then
    v_deposit := ((v_total::bigint * v_settings.booking_deposit_bp * 2 + 10000) / 20000)::int;
  else
    v_deposit := (p ->> 'deposit_fils')::int;
  end if;
  if v_deposit < 0 or v_deposit > v_total then
    raise exception 'the deposit must be between 0 and the total' using errcode = 'P0001';
  end if;

  v_valid := coalesce(nullif(p ->> 'valid_until', '')::date,
                      public.business_today() + v_settings.booking_quote_validity_days);
  if v_valid < public.business_today() then
    raise exception 'the validity date is in the past' using errcode = 'P0001';
  end if;

  select coalesce(max(q.version), 0) + 1 into v_version from booking_quotes q where q.booking_id = v_b.id;
  update booking_quotes q set status = 'superseded'
   where q.booking_id = v_b.id and q.status in ('sent', 'accepted');

  insert into booking_quotes (booking_id, version, lines, subtotal_fils, discount_fils, total_fils,
                              deposit_fils, valid_until, notes)
  values (v_b.id, v_version, v_lines, v_subtotal, v_discount, v_total, v_deposit, v_valid,
          nullif(trim(p ->> 'notes'), ''))
  returning * into v_quote;

  update bookings set status = 'quoted' where id = v_b.id;
  perform public.write_audit('booking.quote_sent', 'bookings', v_b.id::text, null,
    jsonb_build_object('version', v_version, 'total_fils', v_total, 'deposit_fils', v_deposit));
  return query select v_quote.id, v_quote.version, v_quote.token, v_quote.total_fils, v_quote.deposit_fils;
end;
$$;

-- Money received on a booking's own payment orders (deposit / balance), net of refunds.
create or replace function public.booking_paid_fils(p_booking_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(s.paid_fils - s.refunded_fils), 0)::int
    from orders o join order_payment_summary s on s.order_id = o.id
   where o.booking_id = p_booking_id and o.channel = 'booking';
$$;

-- Public quote view by token (no ids or internal fields).
create or replace function public.get_booking_quote(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ref', b.ref,
    'booking_status', b.status,
    'customer_name', b.contact_name,
    'event_type', t.name,
    'event_date', b.event_date,
    'start_time', to_char(b.start_time, 'HH24:MI'),
    'end_time', to_char(b.end_time, 'HH24:MI'),
    'location', b.location,
    'emirate', b.emirate,
    'guests', b.guests,
    'version', q.version,
    'status', q.status,
    'is_latest', not exists (select 1 from booking_quotes n where n.booking_id = b.id and n.version > q.version),
    'expired', q.valid_until < public.business_today(),
    'lines', q.lines,
    'subtotal_fils', q.subtotal_fils,
    'discount_fils', q.discount_fils,
    'total_fils', q.total_fils,
    'deposit_fils', q.deposit_fils,
    'valid_until', q.valid_until,
    'notes', q.notes,
    'sent_at', q.sent_at,
    'accepted_at', q.accepted_at,
    'paid_fils', public.booking_paid_fils(b.id)
  )
  from booking_quotes q
  join bookings b on b.id = q.booking_id
  join booking_event_types t on t.id = b.event_type_id
  where q.token = p_token and length(p_token) >= 32;
$$;

-- ---------------------------------------------------------------------------
-- Confirmation → calendar event
-- ---------------------------------------------------------------------------
-- Internal: confirm and create the linked private_booking event once. Returns the event id.
create or replace function public._confirm_booking(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.bookings;
  v_type text;
  v_booth text;
  v_package text;
  v_event uuid;
begin
  select * into v_b from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if v_b.status = 'confirmed' and v_b.event_id is not null then
    return v_b.event_id;
  end if;
  if v_b.status in ('completed', 'rejected', 'cancelled') then
    raise exception 'this booking is closed and can''t be confirmed' using errcode = 'P0001';
  end if;

  select name into v_type from booking_event_types where id = v_b.event_type_id;
  select name into v_booth from booth_designs where id = v_b.booth_design_id;
  select name into v_package from booking_packages where id = v_b.package_id;

  v_event := v_b.event_id;
  if v_event is null then
    insert into events (type, status, name, organiser_name, organiser_phone, organiser_email,
                        location, emirate, start_date, end_date, daily_hours, booth_details, notes,
                        booking_id)
    values ('private_booking', 'confirmed', v_type || ' · ' || v_b.contact_name || ' (' || v_b.ref || ')',
            v_b.contact_name, v_b.contact_phone, v_b.contact_email, v_b.location, v_b.emirate,
            v_b.event_date, v_b.event_date,
            jsonb_build_object(v_b.event_date::text, jsonb_build_object(
              'open', to_char(v_b.start_time, 'HH24:MI'), 'close', to_char(v_b.end_time, 'HH24:MI'))),
            nullif(concat_ws(' · ', 'Package: ' || v_package, 'Booth: ' || v_booth,
                             v_b.guests || ' guests'), ''),
            v_b.special_requests, v_b.id)
    returning id into v_event;
  else
    update events set status = 'confirmed' where id = v_event and status = 'potential';
  end if;

  update bookings set status = 'confirmed', event_id = v_event, confirmed_at = now() where id = v_b.id;
  perform public.write_audit('booking.confirmed', 'bookings', v_b.id::text,
    jsonb_build_object('status', v_b.status), jsonb_build_object('status', 'confirmed', 'event_id', v_event));
  return v_event;
end;
$$;

-- Staff: confirm manually (e.g. deposit paid by bank transfer).
create or replace function public.confirm_booking(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_permission('bookings.manage');
  return public._confirm_booking(p_booking_id);
end;
$$;

-- Customer accepts a quote via its emailed link. No deposit due → confirmed straight away.
create or replace function public.accept_quote(p_token text)
returns table (ref text, status public.booking_status, deposit_fils int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.booking_quotes;
  v_b public.bookings;
begin
  select * into v_q from booking_quotes q where q.token = p_token and length(p_token) >= 32 for update;
  if not found then
    raise exception 'quotation not found' using errcode = 'P0002';
  end if;
  select * into v_b from bookings b where b.id = v_q.booking_id for update;

  if v_q.status = 'accepted' then
    return query select v_b.ref, v_b.status, v_q.deposit_fils;
    return;
  end if;
  if v_q.status <> 'sent' then
    raise exception 'this quotation has been replaced — please use the latest one we sent you'
      using errcode = 'P0001';
  end if;
  if v_q.valid_until < public.business_today() then
    raise exception 'this quotation has expired — please contact us for an updated one'
      using errcode = 'P0001';
  end if;
  if v_b.status <> 'quoted' then
    raise exception 'this booking can no longer be accepted' using errcode = 'P0001';
  end if;

  update booking_quotes set status = 'accepted', accepted_at = now() where id = v_q.id;
  update bookings set status = 'accepted' where id = v_b.id;
  perform public.write_audit('booking.quote_accepted', 'bookings', v_b.id::text, null,
    jsonb_build_object('version', v_q.version, 'total_fils', v_q.total_fils));

  if v_q.deposit_fils = 0 then
    perform public._confirm_booking(v_b.id);
  end if;
  select * into v_b from bookings b where b.id = v_q.booking_id;
  return query select v_b.ref, v_b.status, v_q.deposit_fils;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments: deposit / balance orders in the one sales ledger
-- ---------------------------------------------------------------------------
/*
  Internal: the pending 'booking' order for a deposit or the remaining balance of the current
  quote (reused while unpaid). Paid through startPayment → webhook → confirm_payment like any order.
  Quote amounts are VAT-inclusive; the VAT part is recorded on the order.
*/
create or replace function public._booking_payment_order(p_booking_id uuid, p_kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.bookings;
  v_q public.booking_quotes;
  v_paid int;
  v_amount int;
  v_order uuid;
  v_rate int;
begin
  if p_kind not in ('deposit', 'balance') then
    raise exception 'invalid payment kind' using errcode = '22023';
  end if;
  select * into v_b from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if v_b.status in ('rejected', 'cancelled', 'completed') then
    raise exception 'this booking is closed' using errcode = 'P0001';
  end if;
  select * into v_q from booking_quotes q
   where q.booking_id = v_b.id and q.status in ('sent', 'accepted')
   order by q.version desc limit 1;
  if not found then
    raise exception 'send a quotation first' using errcode = 'P0001';
  end if;

  v_paid := public.booking_paid_fils(v_b.id);
  if p_kind = 'deposit' then
    if v_paid > 0 then
      raise exception 'the deposit has already been paid' using errcode = 'P0001';
    end if;
    v_amount := v_q.deposit_fils;
    if v_amount <= 0 then
      raise exception 'no deposit is due on this quotation' using errcode = 'P0001';
    end if;
  else
    v_amount := v_q.total_fils - v_paid;
    if v_amount <= 0 then
      raise exception 'this booking is fully paid' using errcode = 'P0001';
    end if;
  end if;

  select o.id into v_order from orders o
   where o.booking_id = v_b.id and o.channel = 'booking' and o.status = 'pending_payment'
     and o.total_fils = v_amount
   order by o.created_at desc limit 1;

  -- Any other unpaid booking order is stale (different amount).
  update orders set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Replaced by a new payment request'
   where booking_id = v_b.id and channel = 'booking' and status = 'pending_payment'
     and id is distinct from v_order;

  if v_order is null then
    select vat_rate_bp into v_rate from settings where id = 1;
    insert into orders (customer_id, channel, booking_id, status, fulfilment, contact_name, contact_phone,
                        contact_email, subtotal_fils, vat_fils, total_fils, vat_rate_bp, prices_include_vat,
                        notes)
    values (v_b.customer_id, 'booking', v_b.id, 'pending_payment', 'handed_over', v_b.contact_name,
            v_b.contact_phone, v_b.contact_email, v_amount,
            ((v_amount::bigint * v_rate * 2 + (10000 + v_rate)) / ((10000 + v_rate) * 2))::int,
            v_amount, v_rate, true,
            'Event booking ' || v_b.ref || ' — ' || case when p_kind = 'deposit' then 'deposit' else 'balance' end
              || ' (quote v' || v_q.version || ')')
    returning id into v_order;
    perform public.write_audit('booking.payment_requested', 'bookings', v_b.id::text, null,
      jsonb_build_object('kind', p_kind, 'amount_fils', v_amount, 'order_id', v_order));
  end if;
  return v_order;
end;
$$;

-- Customer (quote page): pay the deposit after accepting, or the balance later.
create or replace function public.quote_payment_order(p_token text, p_kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.booking_quotes;
  v_status public.booking_status;
begin
  select * into v_q from booking_quotes q where q.token = p_token and length(p_token) >= 32;
  if not found then
    raise exception 'quotation not found' using errcode = 'P0002';
  end if;
  select b.status into v_status from bookings b where b.id = v_q.booking_id;
  if v_q.status <> 'accepted' or v_status not in ('accepted', 'confirmed') then
    raise exception 'accept the quotation first' using errcode = 'P0001';
  end if;
  return public._booking_payment_order(v_q.booking_id, p_kind);
end;
$$;

-- Staff: payment request for the deposit or the balance (shared as a link).
create or replace function public.booking_payment_order(p_booking_id uuid, p_kind text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_permission('bookings.manage');
  return public._booking_payment_order(p_booking_id, p_kind);
end;
$$;

-- A booking order became paid (verified webhook / recorded payment): log it, treat payment as
-- acceptance of the current quote, confirm the booking, and close the order (nothing to ship).
create or replace function public.booking_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.bookings;
begin
  if new.channel <> 'booking' or old.status <> 'pending_payment'
     or new.status in ('pending_payment', 'cancelled') then
    return null;
  end if;
  select * into v_b from bookings where id = new.booking_id for update;
  if not found then
    return null;
  end if;

  insert into booking_messages (booking_id, direction, channel, body, created_by)
  values (v_b.id, 'note', 'internal',
          'Payment received: ' || 'AED ' || to_char(new.total_fils / 100.0, 'FM999,999,990.00')
            || ' (order ' || new.number || ').', null);

  if v_b.status = 'quoted' then
    update booking_quotes set status = 'accepted', accepted_at = now()
     where id = (select q.id from booking_quotes q where q.booking_id = v_b.id and q.status = 'sent'
                  order by q.version desc limit 1);
    update bookings set status = 'accepted' where id = v_b.id;
  end if;
  if v_b.status in ('quoted', 'accepted') then
    perform public._confirm_booking(v_b.id);
  end if;

  update orders set status = 'completed' where id = new.id;
  return null;
end;
$$;

create trigger booking_order_paid after update of status on public.orders
  for each row when (new.booking_id is not null and old.status = 'pending_payment')
  execute function public.booking_order_paid();

-- ---------------------------------------------------------------------------
-- Booking settings (deposit %, flower base price, quote validity)
-- ---------------------------------------------------------------------------
create or replace function public.update_booking_settings(
  p_deposit_bp int,
  p_flower_base_fils int,
  p_quote_validity_days int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_permission('bookings.manage');
  update settings set
    booking_deposit_bp = p_deposit_bp,
    booking_flower_base_fils = p_flower_base_fils,
    booking_quote_validity_days = p_quote_validity_days,
    updated_by = auth.uid()
  where id = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.booking_estimate(jsonb) from public;
grant execute on function public.booking_estimate(jsonb) to anon, authenticated;
revoke execute on function public.submit_booking(jsonb) from public;
grant execute on function public.submit_booking(jsonb) to anon, authenticated;
revoke execute on function public.get_booking_quote(text) from public;
grant execute on function public.get_booking_quote(text) to anon, authenticated;
revoke execute on function public.accept_quote(text) from public;
grant execute on function public.accept_quote(text) to anon, authenticated;
revoke execute on function public.quote_payment_order(text, text) from public;
grant execute on function public.quote_payment_order(text, text) to anon, authenticated;

revoke execute on function public.set_booking_status(uuid, public.booking_status, text) from public, anon;
revoke execute on function public.send_booking_quote(jsonb) from public, anon;
revoke execute on function public.confirm_booking(uuid) from public, anon;
revoke execute on function public.booking_payment_order(uuid, text) from public, anon;
revoke execute on function public.update_booking_settings(int, int, int) from public, anon;
grant execute on function public.set_booking_status(uuid, public.booking_status, text) to authenticated;
grant execute on function public.send_booking_quote(jsonb) to authenticated;
grant execute on function public.confirm_booking(uuid) to authenticated;
grant execute on function public.booking_payment_order(uuid, text) to authenticated;
grant execute on function public.update_booking_settings(int, int, int) to authenticated;

revoke execute on function public.booking_paid_fils(uuid) from public, anon, authenticated;
revoke execute on function public._confirm_booking(uuid) from public, anon, authenticated;
revoke execute on function public._booking_payment_order(uuid, text) from public, anon, authenticated;
revoke execute on function public.booking_order_paid() from public, anon, authenticated;
revoke execute on function public.next_booking_ref() from public, anon;

-- ---------------------------------------------------------------------------
-- Launch configuration (placeholders — see docs/DECISIONS.md; all editable in admin)
-- ---------------------------------------------------------------------------
insert into public.booking_event_types (name, sort) values
  ('Wedding', 10), ('Engagement', 20), ('Birthday', 30), ('Graduation', 40), ('Ramadan', 50),
  ('Eid', 60), ('Family gathering', 70), ('Corporate', 80), ('Other', 90);

insert into public.booking_service_types (name, description, sort) values
  ('Perfume display booth', 'A styled scent bar where your guests discover every destination.', 10),
  ('Guest giveaways', 'Perfumes, all-over sprays and dukhoon your guests take home.', 20),
  ('Customised arrangements', 'Florals, trays and details made in your colours.', 30);

insert into public.booking_packages (name, description, inclusions, base_price_fils, images, sort) values
  ('Essence', 'An intimate scent corner for smaller gatherings.',
   array['Styled tabletop display', 'One Solei host for up to 3 hours', 'Testers of the full collection', 'Delivery & setup in Abu Dhabi'],
   350000, array['/images/events/booth-table.jpg'], 10),
  ('Signature', 'Our most-loved booth with passports and personalised scent cards.',
   array['Signature display booth', 'Two Solei hosts for up to 5 hours', 'Solei Passport for every guest', 'Personalised scent cards', 'Delivery & setup across the UAE'],
   650000, array['/images/events/booth-passport.jpg'], 20),
  ('Grand Destination', 'A full scent experience for weddings and large celebrations.',
   array['Grand floral booth', 'Three Solei hosts for the whole evening', 'Solei Passport for every guest', 'Custom giveaway packaging', 'Fresh florals in your colours', 'Delivery & setup across the UAE'],
   1200000, array['/images/events/booth-florals.jpg'], 30);

insert into public.booth_designs (name, description, photos, sort) values
  ('Floral arch', 'Blush and burgundy florals framing the collection.', array['/images/events/booth-florals.jpg'], 10),
  ('Passport bar', 'A travel-inspired bar where guests collect their stamps.', array['/images/events/booth-passport.jpg'], 20),
  ('Classic table', 'A refined linen table, quiet and elegant.', array['/images/events/booth-table.jpg'], 30);

insert into public.flower_options (name, hex, price_fils, sort) values
  ('Blush pink', '#F7CDD0', 0, 10),
  ('Ivory white', '#F6EEE8', 0, 20),
  ('Burgundy', '#460328', 15000, 30),
  ('Gold accents', '#B08D57', 25000, 40),
  ('Mixed garden', '#C97A86', 30000, 50);
