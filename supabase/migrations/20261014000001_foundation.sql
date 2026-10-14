-- Foundation: shared enums, helper functions and the audit log.
create extension if not exists pg_trgm with schema extensions;
-- Conventions: money = integer fils, rates = basis points (500 = 5%), business dates = Asia/Dubai.

create type public.emirate as enum (
  'abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah'
);

-- Keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Today's business date in Asia/Dubai.
create or replace function public.business_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Dubai')::date;
$$;

-- Business date of an instant.
create or replace function public.business_day(ts timestamptz)
returns date
language sql
immutable
as $$
  select (ts at time zone 'Asia/Dubai')::date;
$$;

-- Client IP from PostgREST request headers (null outside an API request).
create or replace function public.request_ip()
returns inet
language plpgsql
stable
as $$
declare
  headers json;
  raw text;
begin
  headers := nullif(current_setting('request.headers', true), '')::json;
  raw := split_part(coalesce(headers ->> 'x-forwarded-for', headers ->> 'x-real-ip', ''), ',', 1);
  return nullif(trim(raw), '')::inet;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log — append-only. Rows are written by the audit trigger (every mutation
-- on business tables) and by RPCs for semantic actions (e.g. 'order.cancel').
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_action_idx on public.audit_log (action);

alter table public.audit_log enable row level security;

-- Explicit semantic audit entry, callable from RPCs.
create or replace function public.write_audit(
  p_action text,
  p_entity text,
  p_entity_id text,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after, ip)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_before, p_after, public.request_ip());
$$;

revoke execute on function public.write_audit(text, text, text, jsonb, jsonb) from public, anon;

-- Generic row-change audit trigger. Attach with:
--   create trigger audit after insert or update or delete on <table>
--   for each row execute function public.audit_row_change();
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  -- Tables keyed by something other than `id` fall back to their natural key.
  row_id text := coalesce(
    new_row ->> 'id', old_row ->> 'id',
    new_row ->> 'user_id', old_row ->> 'user_id',
    new_row ->> 'variant_id', old_row ->> 'variant_id',
    new_row ->> 'emirate', old_row ->> 'emirate',
    case when new_row ? 'role_id' then concat_ws(':', new_row ->> 'role_id', new_row ->> 'permission_key') end,
    case when old_row ? 'role_id' then concat_ws(':', old_row ->> 'role_id', old_row ->> 'permission_key') end
  );
begin
  -- Skip no-op updates (only updated_at changed).
  if tg_op = 'UPDATE' and (old_row - 'updated_at') = (new_row - 'updated_at') then
    return null;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after, ip)
  values (auth.uid(), tg_table_name || '.' || lower(tg_op), tg_table_name, row_id, old_row, new_row, public.request_ip());
  return null;
end;
$$;
