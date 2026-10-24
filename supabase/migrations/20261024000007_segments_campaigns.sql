-- Phase 2 CRM: customer segments (saved filters) and email campaigns. A campaign goes only to
-- customers in its segment who agreed to email marketing and haven't unsubscribed; every email
-- carries an unsubscribe link (added by the app, not removable). Mirrors src/modules/campaigns.

insert into public.permissions (key, "group", description, sort) values
  ('marketing.manage', 'Customers', 'Build customer segments and send email campaigns', 52);
insert into public.role_permissions (role_id, permission_key)
select r.id, 'marketing.manage' from public.roles r where r.key in ('owner', 'manager');

/*
  Rules (all optional; an empty object = every customer):
    min_spent_fils, max_spent_fils   lifetime paid spend (after refunds)
    min_orders                       paid orders
    purchased_within_days            last purchase in the last N days
    not_purchased_days               no purchase in the last N days (includes never)
    destination_ids                  bought a scent from any of these destinations
    passport                         'has' | 'none' | 'reward' (an unused reward waiting)
    emirates                         delivery/profile emirate is one of these
    consent                          'opted_in' = agreed to email marketing (campaigns always apply it)
*/
create table public.customer_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (length(description) <= 300),
  rules jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customer_segments_name_key on public.customer_segments (lower(name));

create type public.campaign_status as enum ('draft', 'sending', 'sent');
create type public.campaign_recipient_status as enum ('pending', 'sent', 'failed', 'skipped');

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  subject text not null default '' check (length(subject) <= 200),
  -- Markdown, same as the notification templates; {{first_name}} and {{unsubscribe_link}} available.
  body text not null default '',
  segment_id uuid references public.customer_segments (id) on delete set null,
  -- Snapshot so history survives a deleted or edited segment.
  segment_name text,
  status public.campaign_status not null default 'draft',
  sent_at timestamptz,
  sent_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_recipients (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  email text not null,
  status public.campaign_recipient_status not null default 'pending',
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);
create index campaign_recipients_campaign_idx on public.campaign_recipients (campaign_id, status);

create trigger customer_segments_updated_at before update on public.customer_segments
  for each row execute function public.set_updated_at();
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.customer_segments
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.campaigns
  for each row execute function public.audit_row_change();

alter table public.customer_segments enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
create policy segments_staff on public.customer_segments for all
  using (public.has_permission('marketing.manage')) with check (public.has_permission('marketing.manage'));
create policy campaigns_staff on public.campaigns for all
  using (public.has_permission('marketing.manage')) with check (public.has_permission('marketing.manage'));
-- Recipients are written by the sending service (service role); staff read them.
create policy campaign_recipients_staff_read on public.campaign_recipients for select
  using (public.has_permission('marketing.manage'));

/*
  Customers matching the rules, with what staff need to see. `emailable` = can get a campaign:
  has an email, agreed to marketing on email, not unsubscribed.
*/
create or replace function public.segment_members(p_rules jsonb)
returns table (
  customer_id uuid, name text, email text, emirate public.emirate, total_spent_fils int, order_count int,
  last_purchase_at timestamptz, has_passport boolean, emailable boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r jsonb := coalesce(p_rules, '{}'::jsonb);
begin
  -- Staff with marketing.manage, or the sending service (service role).
  if not (public.has_permission('marketing.manage') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  with stats as (
    select o.customer_id as cid,
           count(*) filter (where o.status not in ('pending_payment', 'cancelled'))::int as orders,
           coalesce(sum(ps.paid_fils - ps.refunded_fils), 0)::int as spent,
           max(o.placed_at) filter (where o.status not in ('pending_payment', 'cancelled')) as last_at
      from orders o join order_payment_summary ps on ps.order_id = o.id
     where o.customer_id is not null
     group by o.customer_id
  )
  select c.id, c.name, c.email, c.emirate, coalesce(s.spent, 0), coalesce(s.orders, 0), s.last_at,
         exists (select 1 from passports p where p.customer_id = c.id),
         (c.email is not null and c.marketing_consent and 'email' = any (c.marketing_channels)
          and c.unsubscribed_at is null)
    from customers c
    left join stats s on s.cid = c.id
   where (r ->> 'min_spent_fils' is null or coalesce(s.spent, 0) >= (r ->> 'min_spent_fils')::int)
     and (r ->> 'max_spent_fils' is null or coalesce(s.spent, 0) <= (r ->> 'max_spent_fils')::int)
     and (r ->> 'min_orders' is null or coalesce(s.orders, 0) >= (r ->> 'min_orders')::int)
     and (r ->> 'purchased_within_days' is null
          or s.last_at >= now() - make_interval(days => (r ->> 'purchased_within_days')::int))
     and (r ->> 'not_purchased_days' is null or s.last_at is null
          or s.last_at < now() - make_interval(days => (r ->> 'not_purchased_days')::int))
     and (jsonb_array_length(coalesce(r -> 'destination_ids', '[]'::jsonb)) = 0
          or exists (
            select 1 from orders o join order_lines l on l.order_id = o.id
             where o.customer_id = c.id and o.status not in ('pending_payment', 'cancelled')
               and l.destination_id in (select (jsonb_array_elements_text(r -> 'destination_ids'))::uuid)))
     and (r ->> 'passport' is null
          or (r ->> 'passport' = 'has' and exists (select 1 from passports p where p.customer_id = c.id))
          or (r ->> 'passport' = 'none' and not exists (select 1 from passports p where p.customer_id = c.id))
          or (r ->> 'passport' = 'reward' and exists (
                select 1 from loyalty_rewards lr where lr.customer_id = c.id and lr.status = 'available')))
     and (jsonb_array_length(coalesce(r -> 'emirates', '[]'::jsonb)) = 0
          or c.emirate::text in (select jsonb_array_elements_text(r -> 'emirates')))
     and (coalesce(r ->> 'consent', 'any') <> 'opted_in'
          or (c.marketing_consent and c.unsubscribed_at is null))
   order by coalesce(s.spent, 0) desc, c.created_at;
end;
$$;

-- Turn email marketing off for a customer (unsubscribe link). Service role only.
create or replace function public.customer_unsubscribe(p_customer uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update customers set marketing_consent = false, marketing_channels = '{}', unsubscribed_at = now()
   where id = p_customer and unsubscribed_at is null;
$$;

revoke all on function public.segment_members(jsonb) from public, anon;
grant execute on function public.segment_members(jsonb) to authenticated;
revoke all on function public.customer_unsubscribe(uuid) from public, anon, authenticated;

-- Campaign emails are logged in the outbox under this key; the content comes from each campaign.
insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort, enabled, is_marketing)
values ('campaign', 'customer', 'Campaign', 'Wrapper for email campaigns — write campaigns in Admin → Campaigns.',
        '{{subject}}', '{{body}}', array['first_name','unsubscribe_link'], 900, true, true)
on conflict (key) do nothing;
