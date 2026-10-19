-- Product reviews (client 2026-10-19): only customers who bought the product can review it —
-- stars, text and up to 3 photos. Nothing is shown until the owner approves it; declined reviews
-- stay hidden. Mirrors src/modules/reviews.

insert into public.permissions (key, "group", description, sort) values
  ('reviews.manage', 'Catalog', 'Approve or decline customer reviews', 32);
insert into public.role_permissions (role_id, permission_key)
select r.id, 'reviews.manage' from public.roles r where r.key in ('owner', 'manager');

create type public.review_status as enum ('pending', 'approved', 'declined');

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- The customer's account and the order that qualified them (kept for the owner's reference).
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  -- Shown publicly, e.g. "Reem A." (never the email).
  author_name text not null check (char_length(author_name) between 1 and 60),
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 1 and 2000),
  -- Storage paths in the `reviews` bucket, under the author's folder.
  photos text[] not null default '{}' check (cardinality(photos) <= 3),
  status public.review_status not null default 'pending',
  moderated_at timestamptz,
  moderated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One review per product per account.
  constraint product_reviews_one_per_user unique (product_id, user_id)
);
create index product_reviews_product_idx on public.product_reviews (product_id, status, created_at desc);
create index product_reviews_status_idx on public.product_reviews (status, created_at desc);

create trigger product_reviews_updated_at before update on public.product_reviews
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.product_reviews
  for each row execute function public.audit_row_change();

alter table public.product_reviews enable row level security;
-- Customers write through a server action (service client) after the purchase check.
create policy product_reviews_public_read on public.product_reviews
  for select using (status = 'approved' or public.has_permission('reviews.manage'));
create policy product_reviews_staff_update on public.product_reviews
  for update using (public.has_permission('reviews.manage'))
  with check (public.has_permission('reviews.manage'));
create policy product_reviews_staff_delete on public.product_reviews
  for delete using (public.has_permission('reviews.manage'));

/*
  The order that lets an account review a product: one of its orders (placed while signed in, or
  with the account's email, or of the customer record linked to the account) that contains the
  product and has been delivered or completed. Null = not eligible.
*/
create or replace function public.review_purchase(
  p_user uuid, p_email text, p_order_ids uuid[], p_product uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.id
    from orders o
    join order_lines l on l.order_id = o.id
    join product_variants v on v.id = l.variant_id
   where v.product_id = p_product
     and o.status in ('delivered', 'completed')
     and (
       o.id = any (coalesce(p_order_ids, '{}'))
       or (p_email is not null and lower(o.contact_email) = lower(p_email))
       or o.customer_id in (select c.id from customers c where c.auth_user_id = p_user)
     )
   order by o.placed_at desc
   limit 1;
$$;
revoke all on function public.review_purchase(uuid, text, uuid[], uuid) from public, anon, authenticated;

-- Review photos: public to read (shown once approved), each customer uploads only into their own
-- folder (`<user id>/…`); staff with reviews.manage can delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reviews', 'reviews', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "public reads review photos" on storage.objects
  for select using (bucket_id = 'reviews');
create policy "customers upload own review photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reviews' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reviews.manage deletes review photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'reviews' and public.has_permission('reviews.manage'));
