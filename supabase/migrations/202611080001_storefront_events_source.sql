-- Where each storefront event happened: the web store or the 3D walk-in shop (3d.kngstudio.shop).
-- Existing rows predate the 3D shop's tagging and are counted as web.
alter table public.storefront_events
  add column if not exists source text not null default 'web';

alter table public.storefront_events
  drop constraint if exists storefront_events_source_check;

alter table public.storefront_events
  add constraint storefront_events_source_check check (source in ('web', '3d'));

-- Let PostgREST see the new column right away.
notify pgrst, 'reload schema';
