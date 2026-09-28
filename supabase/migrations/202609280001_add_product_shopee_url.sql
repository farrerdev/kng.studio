alter table public.products
  add column if not exists shopee_url text not null default '';
