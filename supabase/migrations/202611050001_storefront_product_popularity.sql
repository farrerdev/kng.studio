-- Public, aggregate-only product popularity for storefront recommendations.
-- storefront_events stays admin-read-only; this function exposes just one score per product.
-- Weights: add to cart = 5, pattern view = 2, product view = 1, over the last `days` days.
create or replace function public.storefront_product_popularity(days integer default 30)
returns table (product_id text, score numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    events.product_id,
    sum(
      case events.event_type
        when 'add_to_cart' then 5
        when 'pattern_view' then 2
        when 'product_view' then 1
        else 0
      end
    )::numeric as score
  from public.storefront_events as events
  where events.product_id is not null
    and events.product_id <> '__site_visit'
    and events.event_type in ('product_view', 'pattern_view', 'add_to_cart')
    and events.created_at >= now() - make_interval(days => greatest(1, least(coalesce(days, 30), 365)))
  group by events.product_id
$$;

revoke all on function public.storefront_product_popularity(integer) from public;
grant execute on function public.storefront_product_popularity(integer) to anon, authenticated;
