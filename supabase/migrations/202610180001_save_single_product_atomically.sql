create or replace function public.save_catalog_product(
  p_product jsonb,
  p_patterns jsonb default '[]'::jsonb,
  p_images jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_product_id text := nullif(p_product ->> 'id', '');
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;

  if v_product_id is null then
    raise exception 'Product id is required';
  end if;

  if not exists (
    select 1
    from public.product_types
    where id = p_product ->> 'product_type_id'
  ) then
    raise exception 'Product type does not exist';
  end if;

  insert into public.products (
    id,
    product_type_id,
    name,
    price,
    fit,
    material,
    shopee_url,
    size_chart_image_src,
    size_chart_image_alt,
    sort_order,
    active
  )
  values (
    v_product_id,
    p_product ->> 'product_type_id',
    coalesce(p_product ->> 'name', ''),
    coalesce(p_product ->> 'price', ''),
    coalesce(p_product ->> 'fit', ''),
    coalesce(p_product ->> 'material', ''),
    coalesce(p_product ->> 'shopee_url', ''),
    coalesce(p_product ->> 'size_chart_image_src', ''),
    coalesce(p_product ->> 'size_chart_image_alt', ''),
    coalesce((p_product ->> 'sort_order')::integer, 0),
    coalesce((p_product ->> 'active')::boolean, true)
  )
  on conflict (id) do update set
    product_type_id = excluded.product_type_id,
    name = excluded.name,
    price = excluded.price,
    fit = excluded.fit,
    material = excluded.material,
    shopee_url = excluded.shopee_url,
    size_chart_image_src = excluded.size_chart_image_src,
    size_chart_image_alt = excluded.size_chart_image_alt,
    sort_order = excluded.sort_order,
    active = excluded.active,
    updated_at = now();

  if exists (
    select 1
    from public.product_patterns existing_pattern
    join jsonb_array_elements(coalesce(p_patterns, '[]'::jsonb)) incoming_pattern
      on incoming_pattern ->> 'id' = existing_pattern.id
    where existing_pattern.product_id <> v_product_id
  ) then
    raise exception 'Pattern id belongs to another product';
  end if;

  insert into public.product_patterns (
    id,
    product_id,
    name,
    accent,
    image_src,
    image_alt,
    available_sizes,
    sort_order
  )
  select
    pattern_row.id,
    v_product_id,
    pattern_row.name,
    pattern_row.accent,
    pattern_row.image_src,
    pattern_row.image_alt,
    pattern_row.available_sizes,
    pattern_row.sort_order
  from jsonb_to_recordset(coalesce(p_patterns, '[]'::jsonb)) as pattern_row(
    id text,
    name text,
    accent text,
    image_src text,
    image_alt text,
    available_sizes text[],
    sort_order integer
  )
  on conflict (id) do update set
    name = excluded.name,
    accent = excluded.accent,
    image_src = excluded.image_src,
    image_alt = excluded.image_alt,
    available_sizes = excluded.available_sizes,
    sort_order = excluded.sort_order,
    updated_at = now();

  delete from public.product_patterns existing_pattern
  where existing_pattern.product_id = v_product_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_patterns, '[]'::jsonb)) incoming_pattern
      where incoming_pattern ->> 'id' = existing_pattern.id
    );

  if exists (
    select 1
    from public.product_images existing_image
    join jsonb_array_elements(coalesce(p_images, '[]'::jsonb)) incoming_image
      on incoming_image ->> 'id' = existing_image.id
    where existing_image.product_id <> v_product_id
  ) then
    raise exception 'Image id belongs to another product';
  end if;

  insert into public.product_images (id, product_id, src, alt, sort_order)
  select
    image_row.id,
    v_product_id,
    image_row.src,
    image_row.alt,
    image_row.sort_order
  from jsonb_to_recordset(coalesce(p_images, '[]'::jsonb)) as image_row(
    id text,
    src text,
    alt text,
    sort_order integer
  )
  on conflict (id) do update set
    src = excluded.src,
    alt = excluded.alt,
    sort_order = excluded.sort_order,
    updated_at = now();

  delete from public.product_images existing_image
  where existing_image.product_id = v_product_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_images, '[]'::jsonb)) incoming_image
      where incoming_image ->> 'id' = existing_image.id
    );
end;
$$;

revoke all on function public.save_catalog_product(jsonb, jsonb, jsonb) from public;
grant execute on function public.save_catalog_product(jsonb, jsonb, jsonb) to authenticated;
