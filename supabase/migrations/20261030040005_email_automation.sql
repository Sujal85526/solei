-- Phase 2 email automation:
--   1. Feedback request — "How was your order?" N days after a delivered order, once per order,
--      with a stop link. Answers land in the complaints & suggestions log (customer_feedback).
--   2. Staff reminders — email each person N hours before an event they're assigned to and before
--      each planned shift; optional daily digest of upcoming events for the owner.
--   3. Event news — customers opt in to hear about upcoming events; the owner announces a calendar
--      event to them as a campaign (campaigns.audience = 'event_news').
-- Sending runs from /api/cron/* (CRON_SECRET) or the admin "send now" buttons. Everything is off
-- until the owner switches it on. Mirrors src/modules/automation and src/modules/campaigns.

alter table public.settings
  add column feedback_requests_enabled boolean not null default false,
  add column feedback_request_days int not null default 3 check (feedback_request_days between 1 and 60),
  add column staff_reminders_enabled boolean not null default false,
  add column staff_reminder_hours int not null default 24 check (staff_reminder_hours between 1 and 168),
  add column owner_event_digest_enabled boolean not null default false;

alter table public.customers
  -- Opted in to news about upcoming events (pop-ups, exhibitions). Its own consent, separate from
  -- marketing_consent; unsubscribing from marketing turns it off too.
  add column event_news boolean not null default false,
  add column event_news_at timestamptz,
  -- Clicked "don't ask me for feedback" in a feedback request.
  add column feedback_optout_at timestamptz;
create index customers_event_news_idx on public.customers (event_news) where event_news;

-- ── 1. Feedback requests ─────────────────────────────────────────────────────────────────────
create table public.feedback_requests (
  order_id uuid primary key references public.orders (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  email text not null,
  sent_at timestamptz not null default now(),
  answered_at timestamptz
);
alter table public.feedback_requests enable row level security;
-- Written by the sending service and the public feedback page (service role); staff read.
create policy feedback_requests_staff_read on public.feedback_requests for select
  using (public.has_permission('customers.view'));

/*
  Orders due a feedback request: delivered (or completed after delivery / pickup) at least
  `feedback_request_days` ago and not more than 30 days before that, never asked, with an email,
  and the customer hasn't opted out. Till (POS) sales handed over at an event are not asked.
*/
create or replace function public.feedback_requests_due()
returns table (order_id uuid, order_number text, customer_id uuid, email text, name text)
language sql
stable
security definer
set search_path = public
as $$
  with s as (select feedback_request_days as days from settings where id = 1),
  done as (
    select h.order_id, min(h.created_at) as at
      from order_status_history h
     where h.to_status in ('delivered', 'completed')
     group by h.order_id
  )
  select o.id, o.number, o.customer_id, coalesce(nullif(o.contact_email, ''), c.email),
         coalesce(nullif(o.contact_name, ''), c.name)
    from orders o
    join done d on d.order_id = o.id
    cross join s
    left join customers c on c.id = o.customer_id
   where o.status in ('delivered', 'completed')
     and o.fulfilment in ('delivery', 'pickup')
     and d.at <= now() - make_interval(days => s.days)
     and d.at > now() - make_interval(days => s.days + 30)
     and coalesce(nullif(o.contact_email, ''), c.email) is not null
     and (c.id is null or c.feedback_optout_at is null)
     and not exists (select 1 from feedback_requests f where f.order_id = o.id)
   order by d.at
   limit 200;
$$;

/*
  The customer's answer from the feedback page: a rating (1–5), what kind of feedback and a message.
  Lands in the complaints & suggestions log (open, so staff follow it up). One answer per request.
*/
create or replace function public.feedback_submit(p_order uuid, p_rating int, p_kind public.feedback_kind, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req feedback_requests;
  v_id uuid;
begin
  select * into v_req from feedback_requests where order_id = p_order for update;
  if not found then raise exception 'this link isn''t valid any more' using errcode = 'P0002'; end if;
  if v_req.answered_at is not null then
    raise exception 'thank you — we already have your feedback for this order' using errcode = 'P0001';
  end if;
  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception 'rating must be 1 to 5' using errcode = '22023';
  end if;
  if p_rating is null and nullif(trim(p_message), '') is null then
    raise exception 'please rate the order or write a few words' using errcode = 'P0001';
  end if;
  insert into customer_feedback (customer_id, order_id, kind, source, rating, message)
  values (v_req.customer_id, p_order, p_kind, 'email', p_rating,
          coalesce(nullif(trim(p_message), ''), format('Rated %s out of 5', p_rating)))
  returning id into v_id;
  update feedback_requests set answered_at = now() where order_id = p_order;
  return v_id;
end;
$$;

-- ── 2. Staff reminders ───────────────────────────────────────────────────────────────────────
-- When an event day opens (its own hours, else the default hours, else 10:00), Asia/Dubai.
create or replace function public.event_day_opens_at(p_event public.events, p_day date)
returns timestamptz
language sql
stable
as $$
  select (p_day + coalesce(
            nullif(p_event.daily_hours -> p_day::text ->> 'open', ''),
            nullif(p_event.daily_hours -> 'default' ->> 'open', ''),
            '10:00')::time) at time zone 'Asia/Dubai';
$$;

/*
  Reminders due in the next p_hours: confirmed events starting then (one per assigned person) and
  planned shifts starting then. Deduplicated by the sender (outbox), so running hourly is safe.
*/
create or replace function public.staff_reminders_due(p_hours int)
returns table (
  kind text, ref_id uuid, user_id uuid, email text, full_name text, starts_at timestamptz,
  ends_at timestamptz, event_id uuid, event_name text, location text, emirate public.emirate,
  start_date date, end_date date, role text, note text
)
language sql
stable
security definer
set search_path = public
as $$
  select 'event', e.id, p.user_id, p.email, p.full_name, public.event_day_opens_at(e, e.start_date), null::timestamptz,
         e.id, e.name, e.location, e.emirate, e.start_date, e.end_date, es.role, es.note
    from events e
    join event_staff es on es.event_id = e.id
    join staff_profiles p on p.user_id = es.user_id and p.active
   where e.status = 'confirmed'
     and public.event_day_opens_at(e, e.start_date) between now() and now() + make_interval(hours => p_hours)
  union all
  select 'shift', s.id, p.user_id, p.email, p.full_name, s.starts_at, s.ends_at,
         e.id, e.name, e.location, e.emirate, e.start_date, e.end_date, null, s.note
    from staff_shifts s
    join staff_profiles p on p.user_id = s.user_id and p.active
    left join events e on e.id = s.event_id
   where s.starts_at between now() and now() + make_interval(hours => p_hours);
$$;

-- ── 3. Event news ────────────────────────────────────────────────────────────────────────────
alter table public.campaigns
  -- segment = the campaign's segment (marketing consent); event_news = customers who opted in to
  -- event news. event_id = the calendar event an announcement is about.
  add column audience text not null default 'segment' check (audience in ('segment', 'event_news')),
  add column event_id uuid references public.events (id) on delete set null;

-- Public sign-up (events page / account). Creates the customer when new. Service role only.
create or replace function public.event_news_opt_in(p_email text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.upsert_customer(null, p_email, p_name, 'newsletter');
begin
  update customers set event_news = true, event_news_at = now()
   where id = v_id and not event_news;
  return v_id;
end;
$$;

-- Unsubscribe link (campaigns, event announcements): marketing and event news both off.
create or replace function public.customer_unsubscribe(p_customer uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update customers set marketing_consent = false, marketing_channels = '{}', unsubscribed_at = now(),
         event_news = false
   where id = p_customer and (unsubscribed_at is null or event_news);
$$;

revoke all on function public.feedback_requests_due() from public, anon, authenticated;
revoke all on function public.feedback_submit(uuid, int, public.feedback_kind, text) from public, anon, authenticated;
revoke all on function public.staff_reminders_due(int) from public, anon, authenticated;
revoke all on function public.event_news_opt_in(text, text) from public, anon, authenticated;
revoke all on function public.customer_unsubscribe(uuid) from public, anon, authenticated;

-- ── Templates ────────────────────────────────────────────────────────────────────────────────
insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort) values
('feedback_request', 'customer', 'Feedback request',
 'Sent a few days after an order is delivered (timing in Admin → Customers → Automation). Once per order.',
 'How was your Solei order, {{customer_name}}?',
 E'Dear {{customer_name}},\n\nYour order {{order_number}} arrived a few days ago — we''d love to know how it went.\n\n[Tell us in one minute]({{feedback_link}})\n\nLoved your scent? You can also [write a review]({{review_link}}) for other travellers.\n\nWith love,\nSolei\n\nDon''t want to be asked? [Stop feedback emails]({{unsubscribe_link}}).',
 array['customer_name','order_number','feedback_link','review_link','unsubscribe_link'], 75),
('staff_event_reminder', 'staff', 'Event reminder (staff)',
 'Sent to each person assigned to an event, before it starts (timing in Admin → Customers → Automation).',
 'Reminder: {{event_name}} on {{event_dates}}',
 E'Hi {{staff_name}},\n\nA reminder that you''re working at **{{event_name}}**{{event_role}}.\n\n- When: {{event_dates}}, opens {{start_time}}\n- Where: {{event_location}}\n\n{{note}}\n\n[Open the event]({{event_link}})\n\nThank you,\nSolei',
 array['staff_name','event_name','event_role','event_dates','start_time','event_location','note','event_link'], 300),
('staff_shift_reminder', 'staff', 'Shift reminder (staff)',
 'Sent to a staff member before each planned shift on the rota.',
 'Your shift on {{shift_date}}',
 E'Hi {{staff_name}},\n\nA reminder of your shift: **{{shift_date}}, {{shift_time}}**{{event_name}}.\n\n{{note}}\n\n[See the rota]({{rota_link}})\n\nThank you,\nSolei',
 array['staff_name','shift_date','shift_time','event_name','note','rota_link'], 301),
('owner_event_digest', 'owner', 'Upcoming events (digest)',
 'Daily summary of the next 7 days of events and who is working, if the digest is on.',
 'Solei — events in the next 7 days',
 E'Upcoming events and staff:\n\n{{events}}\n\n[Open the calendar]({{calendar_link}})',
 array['events','calendar_link'], 210)
on conflict (key) do nothing;

-- Starting text for an event announcement; each announcement is a campaign the owner can edit.
insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort, enabled, is_marketing)
values ('event_announcement', 'customer', 'Event announcement',
        'Starting text when you announce a calendar event to customers who asked for event news (Calendar → event → Announce).',
        'Come and see us at {{event_name}}',
        E'Dear {{first_name}},\n\nWe''ll be at **{{event_name}}** — {{event_dates}}, {{event_location}}.\n\nCome and discover our scents in person; we''d love to see you there.\n\nWith love,\nSolei',
        array['first_name','event_name','event_dates','event_location','unsubscribe_link'], 901, true, true)
on conflict (key) do nothing;
