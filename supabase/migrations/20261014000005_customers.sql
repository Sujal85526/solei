-- Customers: deduplicated by normalised E.164 phone; email-only contacts allowed (e.g. newsletter).

create type public.customer_source as enum ('website', 'pos', 'whatsapp', 'direct', 'booking', 'newsletter', 'import', 'manual');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text unique check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (email = lower(email) and email like '%_@_%')),
  emirate public.emirate,
  address jsonb,                                   -- { line1, line2, area, city, emirate, notes }
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_channels text[] not null default '{}', -- 'email' | 'whatsapp'
  unsubscribed_at timestamptz,
  source public.customer_source not null default 'manual',
  notes text,
  auth_user_id uuid unique references auth.users (id) on delete set null, -- passport magic-link login
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_contact_required check (phone is not null or email is not null)
);

create index customers_email_idx on public.customers (email);
create index customers_name_trgm_idx on public.customers using gin (name extensions.gin_trgm_ops);
create index customers_phone_trgm_idx on public.customers using gin (phone extensions.gin_trgm_ops);

create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

create policy "customers.view reads customers" on public.customers
  for select to authenticated using (public.has_permission('customers.view') or auth_user_id = auth.uid());
create policy "customers.manage writes customers" on public.customers
  for all to authenticated
  using (public.has_permission('customers.manage'))
  with check (public.has_permission('customers.manage'));

create trigger audit after insert or update or delete on public.customers
  for each row execute function public.audit_row_change();

/*
  Find-or-create a customer by phone (preferred) or email, filling blanks without
  overwriting existing data. Consent is only ever granted here, never revoked
  (revoking is an explicit unsubscribe). Internal: called by other security-definer
  functions and trusted server code.
*/
create or replace function public.upsert_customer(
  p_phone text,
  p_email text,
  p_name text default null,
  p_source public.customer_source default 'manual',
  p_emirate public.emirate default null,
  p_address jsonb default null,
  p_marketing_consent boolean default false,
  p_marketing_channel text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := nullif(lower(trim(p_email)), '');
  v_phone text := nullif(trim(p_phone), '');
begin
  if v_phone is null and v_email is null then
    raise exception 'phone or email is required' using errcode = '22023';
  end if;

  if v_phone is not null then
    select id into v_id from customers where phone = v_phone;
  end if;
  if v_id is null and v_email is not null then
    -- Only merge by email into a record without a different phone.
    select id into v_id from customers
    where email = v_email and (phone is null or phone = v_phone)
    order by created_at limit 1;
  end if;

  if v_id is null then
    insert into customers (name, phone, email, emirate, address, source,
                           marketing_consent, marketing_consent_at, marketing_channels)
    values (nullif(trim(p_name), ''), v_phone, v_email, p_emirate, p_address, p_source,
            p_marketing_consent, case when p_marketing_consent then now() end,
            case when p_marketing_consent and p_marketing_channel is not null then array[p_marketing_channel] else '{}' end)
    returning id into v_id;
  else
    update customers set
      name = coalesce(name, nullif(trim(p_name), '')),
      phone = coalesce(phone, v_phone),
      email = coalesce(email, v_email),
      emirate = coalesce(p_emirate, emirate),
      address = coalesce(p_address, address),
      marketing_consent = marketing_consent or p_marketing_consent,
      marketing_consent_at = case when p_marketing_consent then now() else marketing_consent_at end,
      unsubscribed_at = case when p_marketing_consent then null else unsubscribed_at end,
      marketing_channels = case
        when p_marketing_consent and p_marketing_channel is not null
             and not (p_marketing_channel = any (marketing_channels))
        then marketing_channels || p_marketing_channel
        else marketing_channels end
    where id = v_id;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.upsert_customer(text, text, text, public.customer_source, public.emirate, jsonb, boolean, text) from public, anon, authenticated;

-- Public newsletter / WhatsApp opt-in (homepage). Consent is mandatory.
create or replace function public.marketing_opt_in(p_channel text, p_email text default null, p_phone text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_channel not in ('email', 'whatsapp') then
    raise exception 'invalid channel' using errcode = '22023';
  end if;
  perform public.upsert_customer(
    case when p_channel = 'whatsapp' then p_phone end,
    case when p_channel = 'email' then p_email end,
    null, 'newsletter', null, null, true, p_channel
  );
end;
$$;

revoke execute on function public.marketing_opt_in(text, text, text) from public;
grant execute on function public.marketing_opt_in(text, text, text) to anon, authenticated;
