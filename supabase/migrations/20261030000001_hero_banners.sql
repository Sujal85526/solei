-- Homepage banners: the owner uploads a desktop and a phone image per banner (Admin → Settings →
-- Homepage banners), orders them and sets how long each stays up. No banners = the built-in hero.

create table public.hero_banners (
  id uuid primary key default gen_random_uuid(),
  sort int not null default 0,
  desktop_path text not null,              -- object path inside the `banners` bucket
  mobile_path text not null,
  alt text not null default '' check (char_length(alt) <= 200),
  link_href text check (link_href is null or char_length(link_href) <= 300),
  seconds int not null default 5 check (seconds between 2 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hero_banners_sort_idx on public.hero_banners (sort);

create trigger hero_banners_updated_at before update on public.hero_banners
  for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.hero_banners
  for each row execute function public.audit_row_change();

alter table public.hero_banners enable row level security;

create policy "anyone reads hero banners" on public.hero_banners
  for select to anon, authenticated using (true);
create policy "settings.manage writes hero banners" on public.hero_banners
  for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- Storage: public banner images, writable by whoever manages settings.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banners', 'banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "public reads banner images" on storage.objects
  for select using (bucket_id = 'banners');
create policy "settings.manage uploads banner images" on storage.objects
  for insert to authenticated with check (bucket_id = 'banners' and public.has_permission('settings.manage'));
create policy "settings.manage updates banner images" on storage.objects
  for update to authenticated using (bucket_id = 'banners' and public.has_permission('settings.manage'));
create policy "settings.manage deletes banner images" on storage.objects
  for delete to authenticated using (bucket_id = 'banners' and public.has_permission('settings.manage'));
