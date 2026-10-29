-- Phase 2 giveaways, part 2: a giveaways section on the store with admin-editable occasions
-- (Wedding, Graduation, Ramadan, Eid …), giveaway products that offer real catalog variants
-- (perfume / all-over spray in each scent, so stock and reports count the real bottles), and
-- photos on options (packaging / designs). Additive only: `main` keeps working on top of it.
--
-- A giveaway is a product with `is_giveaway`; the bottles it offers are `giveaway_items` (a variant
-- of a real product, optionally at its own giveaway price). An order line of a giveaway is the real
-- variant plus `giveaway_product_id`; its packaging/personalisation choices are the giveaway
-- product's option groups (see 20261030020002).

alter table public.products add column is_giveaway boolean not null default false;

create table public.giveaway_occasions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  blurb text check (length(blurb) <= 300),
  image_url text,
  -- Path in the `products` bucket when the photo was uploaded (removed with it).
  storage_path text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_occasions (
  product_id uuid not null references public.products (id) on delete cascade,
  occasion_id uuid not null references public.giveaway_occasions (id) on delete cascade,
  primary key (product_id, occasion_id)
);
create index product_occasions_occasion_idx on public.product_occasions (occasion_id);

create table public.giveaway_items (
  id uuid primary key default gen_random_uuid(),
  -- The giveaway product offering this bottle.
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  -- Price of one piece in this giveaway; empty = the variant's own price.
  price_fils int check (price_fils between 0 and 10000000),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, variant_id)
);
create index giveaway_items_product_idx on public.giveaway_items (product_id, sort);

-- Photos on options (packaging, designs), shown as tiles to choose from.
alter table public.product_options
  add column image_url text,
  add column storage_path text;

-- Which giveaway an order line was bought through (the line's variant is the real bottle).
alter table public.order_lines
  add column giveaway_product_id uuid references public.products (id) on delete set null;

create trigger giveaway_occasions_updated_at before update on public.giveaway_occasions
  for each row execute function public.set_updated_at();
create trigger giveaway_items_updated_at before update on public.giveaway_items
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.giveaway_occasions
  for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.giveaway_items
  for each row execute function public.audit_row_change();

alter table public.giveaway_occasions enable row level security;
alter table public.product_occasions enable row level security;
alter table public.giveaway_items enable row level security;

create policy "read active occasions" on public.giveaway_occasions
  for select using (active or public.has_permission('catalog.view'));
create policy "catalog.manage writes occasions" on public.giveaway_occasions for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

create policy "read occasions of visible products" on public.product_occasions
  for select using (
    exists (select 1 from public.products p where p.id = product_id
            and (p.active or public.has_permission('catalog.view')))
  );
create policy "catalog.manage writes product occasions" on public.product_occasions for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

create policy "read items of visible giveaways" on public.giveaway_items
  for select using (
    exists (select 1 from public.products p where p.id = product_id
            and (p.active or public.has_permission('catalog.view')))
  );
create policy "catalog.manage writes giveaway items" on public.giveaway_items for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

/*
  Save a giveaway's settings in one go (catalog.manage): p = { product_id, is_giveaway,
  occasion_ids: [..], items: [{ variant_id, price_fils|null, active }] } — in the given order;
  bottles not in the list are removed (orders keep their own lines).
*/
create or replace function public.giveaway_save(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid := (p ->> 'product_id')::uuid;
  it jsonb;
  i int := 0;
begin
  perform public.require_permission('catalog.manage');
  update products set is_giveaway = coalesce((p ->> 'is_giveaway')::boolean, false) where id = v_product;
  if not found then raise exception 'product not found' using errcode = 'P0002'; end if;

  delete from product_occasions where product_id = v_product;
  insert into product_occasions (product_id, occasion_id)
  select v_product, x::uuid from jsonb_array_elements_text(coalesce(p -> 'occasion_ids', '[]'::jsonb)) x
  on conflict do nothing;

  delete from giveaway_items g
   where g.product_id = v_product
     and not exists (select 1 from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) x
                      where (x ->> 'variant_id')::uuid = g.variant_id);
  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) loop
    if exists (select 1 from product_variants v join products pr on pr.id = v.product_id
                where v.id = (it ->> 'variant_id')::uuid and pr.id = v_product) then
      raise exception 'a giveaway can''t offer its own variants' using errcode = '22023';
    end if;
    insert into giveaway_items (product_id, variant_id, price_fils, active, sort)
    values (v_product, (it ->> 'variant_id')::uuid, nullif(it ->> 'price_fils', '')::int,
            coalesce((it ->> 'active')::boolean, true), i)
    on conflict (product_id, variant_id) do update
      set price_fils = excluded.price_fils, active = excluded.active, sort = excluded.sort;
    i := i + 1;
  end loop;
end;
$$;
revoke all on function public.giveaway_save(jsonb) from public, anon;
grant execute on function public.giveaway_save(jsonb) to authenticated;

/*
  product_option_group_save from 20261024000010, now with an optional photo per option
  (options: [{ id?, label, price_delta_fils, active, image_url?, storage_path? }]).
*/
create or replace function public.product_option_group_save(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_kind public.option_group_kind := (p ->> 'kind')::public.option_group_kind;
  v_keep uuid[];
  o jsonb;
  i int := 0;
begin
  perform public.require_permission('catalog.manage');
  if v_kind <> 'text' and jsonb_array_length(coalesce(p -> 'options', '[]'::jsonb)) = 0 then
    raise exception 'add at least one option' using errcode = '22023';
  end if;
  if v_id is null then
    insert into product_option_groups (product_id, name, kind, required, max_length, sort)
    values ((p ->> 'product_id')::uuid, trim(p ->> 'name'), v_kind, (p ->> 'required')::boolean,
            coalesce((p ->> 'max_length')::int, 40),
            coalesce((select max(sort) + 1 from product_option_groups where product_id = (p ->> 'product_id')::uuid), 0))
    returning id into v_id;
  else
    update product_option_groups set name = trim(p ->> 'name'), kind = v_kind,
           required = (p ->> 'required')::boolean, max_length = coalesce((p ->> 'max_length')::int, 40)
     where id = v_id;
    if not found then raise exception 'option group not found' using errcode = 'P0002'; end if;
  end if;

  if v_kind = 'text' then
    delete from product_options where group_id = v_id;
    return v_id;
  end if;
  select coalesce(array_agg((x ->> 'id')::uuid) filter (where nullif(x ->> 'id', '') is not null), '{}')
    into v_keep from jsonb_array_elements(p -> 'options') x;
  delete from product_options where group_id = v_id and not (id = any (v_keep));
  for o in select * from jsonb_array_elements(p -> 'options') loop
    if nullif(o ->> 'id', '') is null then
      insert into product_options (group_id, label, price_delta_fils, active, sort, image_url, storage_path)
      values (v_id, trim(o ->> 'label'), (o ->> 'price_delta_fils')::int, coalesce((o ->> 'active')::boolean, true), i,
              nullif(o ->> 'image_url', ''), nullif(o ->> 'storage_path', ''));
    else
      update product_options set label = trim(o ->> 'label'), price_delta_fils = (o ->> 'price_delta_fils')::int,
             active = coalesce((o ->> 'active')::boolean, true), sort = i,
             image_url = nullif(o ->> 'image_url', ''), storage_path = nullif(o ->> 'storage_path', '')
       where id = (o ->> 'id')::uuid and group_id = v_id;
    end if;
    i := i + 1;
  end loop;
  return v_id;
end;
$$;

insert into public.giveaway_occasions (name, slug, blurb, image_url, sort) values
  ('Wedding', 'wedding', 'Bottled memories for every guest — in your colours, with your names.',
   '/images/products/perfumes-florals.jpg', 10),
  ('Graduation', 'graduation', 'A scent to remember the day by, for classmates and family.',
   '/images/products/perfumes-trio.jpg', 20),
  ('Ramadan', 'ramadan', 'Thoughtful gifts for iftar tables and the people you share them with.',
   '/images/products/sprays-stone.jpg', 30),
  ('Eid', 'eid', 'Eid gifts for family, friends and the whole majlis.',
   '/images/products/sprays-trio.jpg', 40),
  ('Other occasions', 'other', 'Birthdays, baby showers, corporate gifts — tell us what you are celebrating.',
   '/images/events/booth-florals.jpg', 50)
on conflict (slug) do nothing;
