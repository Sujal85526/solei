-- Owner-editable business settings. `settings` is public-safe (storefront reads it);
-- `private_settings` holds owner-only values.

create table public.settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Solei',
  legal_name text,
  trn text,                                   -- UAE Tax Registration Number (printed on invoices)
  vat_rate_bp int not null default 500 check (vat_rate_bp between 0 and 10000),
  prices_include_vat boolean not null default true,
  currency text not null default 'AED' check (currency = 'AED'),
  contact_email text,
  contact_phone text,
  whatsapp_number text,                       -- E.164; used for wa.me links
  instagram_handle text default '@solei.ad',
  instagram_url text default 'https://www.instagram.com/solei.ad/',
  free_delivery_threshold_fils int check (free_delivery_threshold_fils is null or free_delivery_threshold_fils >= 0),
  booking_deposit_bp int not null default 5000 check (booking_deposit_bp between 0 and 10000),
  returns_policy text,
  delivery_policy text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table public.private_settings (
  id int primary key default 1 check (id = 1),
  owner_notification_email text,
  owner_notification_phone text,
  low_stock_default int not null default 5 check (low_stock_default >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table public.delivery_zones (
  emirate public.emirate primary key,
  name text not null,
  fee_fils int not null default 0 check (fee_fils >= 0),
  active boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
create trigger private_settings_updated_at before update on public.private_settings
  for each row execute function public.set_updated_at();
create trigger delivery_zones_updated_at before update on public.delivery_zones
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;
alter table public.private_settings enable row level security;
alter table public.delivery_zones enable row level security;

create policy "anyone reads settings" on public.settings for select using (true);
create policy "settings.manage updates settings" on public.settings
  for update to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

create policy "staff read private settings" on public.private_settings
  for select to authenticated using (public.has_permission('settings.manage'));
create policy "settings.manage updates private settings" on public.private_settings
  for update to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

create policy "anyone reads active zones" on public.delivery_zones
  for select using (active or public.is_staff());
create policy "settings.manage writes zones" on public.delivery_zones
  for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

create trigger audit after insert or update or delete on public.settings
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.private_settings
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.delivery_zones
  for each row execute function public.audit_row_change();

-- Singleton rows always exist.
insert into public.settings (id) values (1);
insert into public.private_settings (id) values (1);
