-- Staff, roles and permissions. Checked server-side with public.has_permission(key)
-- in RLS policies and RPCs; the app mirrors the same keys in src/lib/permissions.ts.

create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  "group" text not null,
  description text not null,
  sort int not null default 0
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z_]+$'),
  name text not null,
  description text,
  -- Owner/manager must sign in with TOTP (aal2) for their permissions to apply.
  requires_mfa boolean not null default false,
  -- System roles can't be deleted (owner always keeps every permission).
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create type public.employment_status as enum ('full_time', 'part_time', 'freelance', 'event_only', 'former');

create table public.staff_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  email text not null,
  position text,
  phone text,
  employment_status public.employment_status not null default 'full_time',
  role_id uuid not null references public.roles (id),
  active boolean not null default true,
  deactivated_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_profiles_role_idx on public.staff_profiles (role_id);

create trigger staff_profiles_updated_at before update on public.staff_profiles
  for each row execute function public.set_updated_at();
create trigger roles_updated_at before update on public.roles
  for each row execute function public.set_updated_at();

-- Current user's active staff row + role, honouring the MFA requirement.
create or replace function public.current_staff_role()
returns public.roles
language sql
stable
security definer
set search_path = public
as $$
  select r.*
  from public.staff_profiles sp
  join public.roles r on r.id = sp.role_id
  where sp.user_id = auth.uid()
    and sp.active
    and (not r.requires_mfa or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (public.current_staff_role()).id is not null;
$$;

create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    join public.roles r on r.id = sp.role_id
    where sp.user_id = auth.uid()
      and sp.active
      and (not r.requires_mfa or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
      and (
        r.key = 'owner'
        or exists (
          select 1 from public.role_permissions rp
          where rp.role_id = r.id and rp.permission_key = p_key
        )
      )
  );
$$;

-- Raise unless the caller holds the permission. Use at the top of RPCs.
create or replace function public.require_permission(p_key text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission(p_key) then
    raise exception 'permission denied: %', p_key using errcode = '42501';
  end if;
end;
$$;

-- Permission keys granted to the current user (for building the UI).
create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select p.key
  from public.permissions p
  where public.has_permission(p.key);
$$;

alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_profiles enable row level security;

create policy "staff read permissions" on public.permissions
  for select to authenticated using (public.is_staff());

create policy "staff read roles" on public.roles
  for select to authenticated using (public.is_staff());
create policy "staff.manage writes roles" on public.roles
  for all to authenticated
  using (public.has_permission('staff.manage'))
  with check (public.has_permission('staff.manage'));

create policy "staff read role permissions" on public.role_permissions
  for select to authenticated using (public.is_staff());
create policy "staff.manage writes role permissions" on public.role_permissions
  for all to authenticated
  using (public.has_permission('staff.manage'))
  with check (public.has_permission('staff.manage'));

-- A user can always read their own profile (even before MFA, so the app can prompt for it).
create policy "read own staff profile" on public.staff_profiles
  for select to authenticated using (user_id = auth.uid());
create policy "staff.manage reads staff" on public.staff_profiles
  for select to authenticated using (public.has_permission('staff.manage'));
create policy "staff.manage writes staff" on public.staff_profiles
  for all to authenticated
  using (public.has_permission('staff.manage'))
  with check (public.has_permission('staff.manage'));

-- Audit log is readable with audit.view; nobody can update or delete it.
create policy "audit.view reads audit log" on public.audit_log
  for select to authenticated using (public.has_permission('audit.view'));

create trigger audit after insert or update or delete on public.roles
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.role_permissions
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.staff_profiles
  for each row execute function public.audit_row_change();
