-- Phase 2 CRM: complaints, suggestions and compliments log. Staff log what a customer told them
-- (in the shop, on the phone, on WhatsApp); the "How was your order?" email (feedback request,
-- 20261030040004) adds entries too. Each entry can be tied to an order, assigned to a staff member
-- and followed through open → in progress → resolved. Mirrors src/modules/feedback.
-- Reuses customers.view (read) and customers.manage (write): no new permission keys (P2-13).

create type public.feedback_kind as enum ('complaint', 'suggestion', 'compliment', 'other');
create type public.feedback_status as enum ('open', 'in_progress', 'resolved');
-- staff = logged by staff; email = the customer's answer to the feedback request.
create type public.feedback_source as enum ('staff', 'email');

create table public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  kind public.feedback_kind not null default 'complaint',
  source public.feedback_source not null default 'staff',
  -- 1–5 stars when the customer rated the order (feedback request); empty for staff entries.
  rating smallint check (rating between 1 and 5),
  message text not null check (length(trim(message)) between 1 and 2000),
  status public.feedback_status not null default 'open',
  assigned_to uuid references auth.users (id) on delete set null,
  resolution text check (length(resolution) <= 2000),
  resolved_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_feedback_about check (customer_id is not null or order_id is not null)
);
create index customer_feedback_customer_idx on public.customer_feedback (customer_id, created_at desc);
create index customer_feedback_status_idx on public.customer_feedback (status, created_at desc);
create index customer_feedback_order_idx on public.customer_feedback (order_id);

-- resolved_at follows the status.
create or replace function public.customer_feedback_resolved_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'resolved' and (tg_op = 'INSERT' or old.status <> 'resolved') then
    new.resolved_at := now();
  elsif new.status <> 'resolved' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

create trigger customer_feedback_resolved before insert or update on public.customer_feedback
  for each row execute function public.customer_feedback_resolved_at();
create trigger customer_feedback_updated_at before update on public.customer_feedback
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.customer_feedback
  for each row execute function public.audit_row_change();

alter table public.customer_feedback enable row level security;
create policy customer_feedback_read on public.customer_feedback for select
  using (public.has_permission('customers.view'));
create policy customer_feedback_write on public.customer_feedback for all
  using (public.has_permission('customers.manage')) with check (public.has_permission('customers.manage'));
