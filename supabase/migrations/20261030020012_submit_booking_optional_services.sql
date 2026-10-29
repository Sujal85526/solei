-- Plan your event, owner's six steps (event type → details incl. contact → package → booth →
-- flowers → summary): the customer wizard no longer has the "Services" and "Products of interest"
-- steps, so submit_booking accepts an empty service list (it sends [] and [] — the columns stay, staff
-- can still use them). Same signature; `main` (which still sends at least one service) is unaffected.
-- Redefines submit_booking from 20261014200001.

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
  -- Services are optional (the customer wizard no longer asks; staff can add them); unknown or
  -- inactive ones are still refused.
  if cardinality(v_services) <> jsonb_array_length(coalesce(p -> 'service_type_ids', '[]'::jsonb)) then
    raise exception 'a service you chose is no longer available' using errcode = 'P0001';
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
