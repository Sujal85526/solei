-- Allocate several products to an event in one transaction (all or nothing).
--   p_lines: [{ "variant_id": uuid, "qty": int }]
-- Each line is a transfer from p_from_location (main stock by default) to the event location.
create or replace function public.allocate_event_stock(
  p_event_id uuid,
  p_lines jsonb,
  p_from_location uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_loc uuid;
  v_from uuid := p_from_location;
  v_line record;
  v_total int := 0;
begin
  perform public.require_permission('events.manage');
  perform public.require_permission('inventory.transfer');

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if v_event.closed_at is not null then
    raise exception 'this event is closed — reopen it to allocate more stock' using errcode = 'P0001';
  end if;
  if v_event.status = 'cancelled' then
    raise exception 'this event is cancelled' using errcode = 'P0001';
  end if;

  select id into v_loc from public.stock_locations where event_id = p_event_id;
  if v_from is null then
    select id into v_from from public.stock_locations where is_default;
  end if;
  if v_from is null or v_from = v_loc then
    raise exception 'choose where the stock comes from' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'choose at least one product' using errcode = '22023';
  end if;

  for v_line in
    select (l ->> 'variant_id')::uuid as variant_id, sum((l ->> 'qty')::int)::int as qty
    from jsonb_array_elements(p_lines) l
    group by 1
    order by 1
  loop
    if v_line.qty is null or v_line.qty <= 0 then
      raise exception 'quantities must be above 0' using errcode = '22023';
    end if;
    perform pg_advisory_xact_lock(hashtext(v_line.variant_id::text || v_from::text));
    if public.on_hand(v_line.variant_id, v_from) < v_line.qty then
      raise exception 'not enough % in stock (% available)',
        (select p.name || coalesce(' · ' || nullif(v.label, ''), '')
         from public.product_variants v join public.products p on p.id = v.product_id
         where v.id = v_line.variant_id),
        public.on_hand(v_line.variant_id, v_from)
        using errcode = 'P0001';
    end if;
    perform public.transfer_stock(v_line.variant_id, v_from, v_loc, v_line.qty,
      'Allocated to ' || v_event.name);
    v_total := v_total + v_line.qty;
  end loop;

  return v_total;
end;
$$;

revoke execute on function public.allocate_event_stock(uuid, jsonb, uuid) from public, anon;
grant execute on function public.allocate_event_stock(uuid, jsonb, uuid) to authenticated;
