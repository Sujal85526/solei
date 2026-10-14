-- Catalog: categories → products (per destination) → variants (the stock unit).

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_-]+$'),
  name text not null,
  description text,
  image_url text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  country text,
  region text,
  mood text,
  story text,
  hero_image_url text,
  postcard_image_url text,
  accent_colour text check (accent_colour is null or accent_colour ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  destination_id uuid references public.destinations (id),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text,
  notes_top text[] not null default '{}',
  notes_heart text[] not null default '{}',
  notes_base text[] not null default '{}',
  active boolean not null default true,
  featured boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index products_destination_idx on public.products (destination_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,                -- public URL (Storage bucket `products` or /images/…)
  storage_path text,                -- set when stored in Supabase Storage
  alt text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null default '',   -- e.g. "50 ml"
  size_ml int check (size_ml is null or size_ml > 0),
  sku text not null unique,
  barcode text unique,
  price_fils int not null check (price_fils >= 0),
  low_stock_threshold int check (low_stock_threshold is null or low_stock_threshold >= 0),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_idx on public.product_variants (product_id);

-- Unit cost lives apart from the variant so only reports.financial.view can read it.
create table public.variant_costs (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  cost_fils int not null default 0 check (cost_fils >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger destinations_updated_at before update on public.destinations
  for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();
create trigger variant_costs_updated_at before update on public.variant_costs
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.destinations enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.variant_costs enable row level security;

-- Public sees active catalog; staff with catalog.view see everything.
create policy "read active categories" on public.categories
  for select using (active or public.has_permission('catalog.view'));
create policy "read active destinations" on public.destinations
  for select using (active or public.has_permission('catalog.view'));
create policy "read active products" on public.products
  for select using (active or public.has_permission('catalog.view'));
create policy "read images of visible products" on public.product_images
  for select using (
    exists (select 1 from public.products p where p.id = product_id
            and (p.active or public.has_permission('catalog.view')))
  );
create policy "read active variants" on public.product_variants
  for select using (
    (active and exists (select 1 from public.products p where p.id = product_id and p.active))
    or public.has_permission('catalog.view')
  );
create policy "financial reads costs" on public.variant_costs
  for select to authenticated using (public.has_permission('reports.financial.view'));

-- Writes: catalog.manage (costs additionally need reports.financial.view).
create policy "catalog.manage writes categories" on public.categories for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy "catalog.manage writes destinations" on public.destinations for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy "catalog.manage writes products" on public.products for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy "catalog.manage writes images" on public.product_images for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy "catalog.manage writes variants" on public.product_variants for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));
create policy "catalog.manage + financial writes costs" on public.variant_costs for all to authenticated
  using (public.has_permission('catalog.manage') and public.has_permission('reports.financial.view'))
  with check (public.has_permission('catalog.manage') and public.has_permission('reports.financial.view'));

create trigger audit after insert or update or delete on public.categories
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.destinations
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.products
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.product_images
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.product_variants
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.variant_costs
  for each row execute function public.audit_row_change();

-- Storage: public product images, writable by catalog managers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "public reads product images" on storage.objects
  for select using (bucket_id = 'products');
create policy "catalog.manage uploads product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'products' and public.has_permission('catalog.manage'));
create policy "catalog.manage updates product images" on storage.objects
  for update to authenticated using (bucket_id = 'products' and public.has_permission('catalog.manage'));
create policy "catalog.manage deletes product images" on storage.objects
  for delete to authenticated using (bucket_id = 'products' and public.has_permission('catalog.manage'));
