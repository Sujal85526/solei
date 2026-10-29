-- Phase 2 staff: planned shifts (rota) and a per-person performance report — sales made (orders
-- store staff_id), hours clocked (staff_attendance), shifts planned, events worked (event_staff).
-- Mirrors src/modules/rota and src/modules/staff-report. No new permission keys (P2-13): the rota
-- is planned with staff.manage, everyone sees their own shifts; the report needs reports.view and
-- shows hours only with staff.manage (same rule as attendance).

create table public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_profiles (user_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- The event the shift is for (pop-up, exhibition, wedding), when there is one.
  event_id uuid references public.events (id) on delete set null,
  note text check (length(note) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_shifts_order check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours')
);
create index staff_shifts_starts_idx on public.staff_shifts (starts_at);
create index staff_shifts_user_idx on public.staff_shifts (user_id, starts_at);

create trigger staff_shifts_updated_at before update on public.staff_shifts
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.staff_shifts
  for each row execute function public.audit_row_change();

alter table public.staff_shifts enable row level security;
create policy staff_shifts_read on public.staff_shifts for select
  using (user_id = auth.uid() or public.has_permission('staff.manage'));
create policy staff_shifts_write on public.staff_shifts for all
  using (public.has_permission('staff.manage')) with check (public.has_permission('staff.manage'));

/*
  One row per staff member for business days p_from..p_to (Asia/Dubai):
    orders, units, sales_fils    orders they made (POS / manual), not cancelled or awaiting payment;
                                 sales = order totals minus refunds
    worked_minutes, shifts_worked, planned_minutes, planned_shifts   null without staff.manage
    events_worked                events they were assigned to that overlap the range (not cancelled)
  Active staff always; former staff only when they have something in the range.
*/
create or replace function public.staff_performance(p_from date, p_to date)
returns table (
  user_id uuid, full_name text, job_title text, active boolean,
  orders int, units int, sales_fils int,
  worked_minutes int, shifts_worked int, planned_minutes int, planned_shifts int,
  events_worked int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hours boolean;
begin
  perform public.require_permission('reports.view');
  v_hours := public.has_permission('staff.manage');
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'choose a range of up to a year' using errcode = 'P0001';
  end if;
  return query
  with sales as (
    select o.staff_id as uid, count(*)::int as n,
           sum(o.total_fils - ps.refunded_fils)::int as fils,
           sum((select coalesce(sum(l.qty), 0) from order_lines l where l.order_id = o.id))::int as qty
      from orders o join order_payment_summary ps on ps.order_id = o.id
     where o.staff_id is not null
       and o.status not in ('pending_payment', 'cancelled')
       and (o.placed_at at time zone 'Asia/Dubai')::date between p_from and p_to
     group by o.staff_id
  ), worked as (
    select a.user_id as uid, count(*)::int as n,
           sum(extract(epoch from a.clock_out - a.clock_in) / 60)::int as mins
      from staff_attendance a
     where a.clock_out is not null
       and (a.clock_in at time zone 'Asia/Dubai')::date between p_from and p_to
     group by a.user_id
  ), planned as (
    select s.user_id as uid, count(*)::int as n,
           sum(extract(epoch from s.ends_at - s.starts_at) / 60)::int as mins
      from staff_shifts s
     where (s.starts_at at time zone 'Asia/Dubai')::date between p_from and p_to
     group by s.user_id
  ), evts as (
    select es.user_id as uid, count(distinct e.id)::int as n
      from event_staff es join events e on e.id = es.event_id
     where e.status <> 'cancelled' and e.start_date <= p_to and e.end_date >= p_from
     group by es.user_id
  )
  select p.user_id, p.full_name, p."position", p.active,
         coalesce(sa.n, 0), coalesce(sa.qty, 0), coalesce(sa.fils, 0),
         case when v_hours then coalesce(w.mins, 0) end,
         case when v_hours then coalesce(w.n, 0) end,
         case when v_hours then coalesce(pl.mins, 0) end,
         case when v_hours then coalesce(pl.n, 0) end,
         coalesce(ev.n, 0)
    from staff_profiles p
    left join sales sa on sa.uid = p.user_id
    left join worked w on w.uid = p.user_id
    left join planned pl on pl.uid = p.user_id
    left join evts ev on ev.uid = p.user_id
   where p.active or sa.uid is not null or w.uid is not null or pl.uid is not null or ev.uid is not null
   order by coalesce(sa.fils, 0) desc, p.full_name;
end;
$$;

revoke all on function public.staff_performance(date, date) from public, anon;
grant execute on function public.staff_performance(date, date) to authenticated;
