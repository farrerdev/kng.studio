create table if not exists public.products (
  id text primary key,
  name text not null,
  price text not null,
  fit text not null default '',
  material text not null default '',
  size_chart_image_src text not null default '',
  size_chart_image_alt text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_patterns (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  name text not null,
  accent text not null default '#c8b69a',
  image_src text not null default '',
  image_alt text not null default '',
  available_sizes text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  src text not null,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_info (
  id text primary key default 'main',
  image_src text not null default '',
  image_alt text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.product_patterns enable row level security;
alter table public.product_images enable row level security;
alter table public.shop_info enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products for select
  using (active = true);

drop policy if exists "Public can read patterns" on public.product_patterns;
create policy "Public can read patterns"
  on public.product_patterns for select
  using (true);

drop policy if exists "Public can read product images" on public.product_images;
create policy "Public can read product images"
  on public.product_images for select
  using (true);

drop policy if exists "Public can read shop info" on public.shop_info;
create policy "Public can read shop info"
  on public.shop_info for select
  using (true);

drop policy if exists "Authenticated admin can manage products" on public.products;
create policy "Authenticated admin can manage products"
  on public.products for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated admin can manage patterns" on public.product_patterns;
create policy "Authenticated admin can manage patterns"
  on public.product_patterns for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated admin can manage product images" on public.product_images;
create policy "Authenticated admin can manage product images"
  on public.product_images for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated admin can manage shop info" on public.shop_info;
create policy "Authenticated admin can manage shop info"
  on public.shop_info for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read catalog images" on storage.objects;
create policy "Public can read catalog images"
  on storage.objects for select
  using (bucket_id = 'catalog-images');

drop policy if exists "Authenticated admin can upload catalog images" on storage.objects;
create policy "Authenticated admin can upload catalog images"
  on storage.objects for insert
  with check (bucket_id = 'catalog-images' and auth.role() = 'authenticated');

drop policy if exists "Authenticated admin can update catalog images" on storage.objects;
create policy "Authenticated admin can update catalog images"
  on storage.objects for update
  using (bucket_id = 'catalog-images' and auth.role() = 'authenticated')
  with check (bucket_id = 'catalog-images' and auth.role() = 'authenticated');

drop policy if exists "Authenticated admin can delete catalog images" on storage.objects;
create policy "Authenticated admin can delete catalog images"
  on storage.objects for delete
  using (bucket_id = 'catalog-images' and auth.role() = 'authenticated');
