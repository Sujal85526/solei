-- Phase 2 reports: general (non-event) business expenses — rent, salaries, marketing… — so the
-- business-wide P&L can take them off. Admin → Reports → Expenses.
--
-- Categories are an owner-editable list (rename, add, hide), seeded with the usual ones.
-- Reading needs reports.financial.view; writing additionally needs the new expenses.manage.
-- Additive only: nothing on `main` reads or writes these tables.

insert into public.permissions (key, "group", description, sort) values
  ('expenses.manage', 'Reports', 'Add, edit and delete business expenses (rent, salaries…)', 27)
on conflict (key) do nothing;
-- The owner holds every permission implicitly. The manager grant waits for the merge
-- (docs/PHASE2_MERGE.md §1): main's role editor rejects keys it doesn't know.

create table if not exists public.business_expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_expense_categories_name_key
  on public.business_expense_categories (lower(name));

insert into public.business_expense_categories (name, sort) values
  ('Rent', 10), ('Salaries', 20), ('Marketing', 30), ('Packaging', 40), ('Utilities', 50), ('Other', 90)
on conflict do nothing;

create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.business_expense_categories (id) on delete restrict,
  amount_fils int not null check (amount_fils > 0),
  spent_on date not null default public.business_today(),
  note text check (note is null or length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_expenses_spent_on_idx on public.business_expenses (spent_on);
create index if not exists business_expenses_category_idx on public.business_expenses (category_id);

create or replace trigger business_expense_categories_updated_at before update on public.business_expense_categories
  for each row execute function public.set_updated_at();
create or replace trigger business_expenses_updated_at before update on public.business_expenses
  for each row execute function public.set_updated_at();
create or replace trigger audit after insert or update or delete on public.business_expense_categories
  for each row execute function public.audit_row_change();
create or replace trigger audit after insert or update or delete on public.business_expenses
  for each row execute function public.audit_row_change();

alter table public.business_expense_categories enable row level security;
alter table public.business_expenses enable row level security;

create policy "financial reads expense categories" on public.business_expense_categories
  for select to authenticated using (public.has_permission('reports.financial.view'));
create policy "expense managers write expense categories" on public.business_expense_categories
  for all to authenticated
  using (public.has_permission('expenses.manage') and public.has_permission('reports.financial.view'))
  with check (public.has_permission('expenses.manage') and public.has_permission('reports.financial.view'));

create policy "financial reads business expenses" on public.business_expenses
  for select to authenticated using (public.has_permission('reports.financial.view'));
create policy "expense managers write business expenses" on public.business_expenses
  for all to authenticated
  using (public.has_permission('expenses.manage') and public.has_permission('reports.financial.view'))
  with check (public.has_permission('expenses.manage') and public.has_permission('reports.financial.view'));
