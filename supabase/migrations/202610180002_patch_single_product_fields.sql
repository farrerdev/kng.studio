create or replace function public.patch_catalog_product(
  p_product_id text,
  p_product_patch jsonb default '{}'::jsonb,
  p_pattern_changes jsonb default '[]'::jsonb,
  p_pattern_ids_to_delete text[] default '{}'::text[],
  p_image_changes jsonb default '[]'::jsonb,
  p_image_ids_to_delete text[] default '{}'::text[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_change jsonb;
  v_fields jsonb;
  v_id text;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;

  if nullif(p_product_id, '') is null then
    raise exception 'Product id is required';
  end if;

  if p_product_patch ? 'product_type_id' and not exists (
    select 1 from public.product_types where id = p_product_patch ->> 'product_type_id'
  ) then
    raise exception 'Product type does not exist';
  end if;

  if exists (select 1 from public.products where id = p_product_id) then
    update public.products
    set
      product_type_id = case when p_product_patch ? 'product_type_id' then p_product_patch ->> 'product_type_id' else product_type_id end,
      name = case when p_product_patch ? 'name' then coalesce(p_product_patch ->> 'name', '') else name end,
      price = case when p_product_patch ? 'price' then coalesce(p_product_patch ->> 'price', '') else price end,
      fit = case when p_product_patch ? 'fit' then coalesce(p_product_patch ->> 'fit', '') else fit end,
      material = case when p_product_patch ? 'material' then coalesce(p_product_patch ->> 'material', '') else material end,
      shopee_url = case when p_product_patch ? 'shopee_url' then coalesce(p_product_patch ->> 'shopee_url', '') else shopee_url end,
      size_chart_image_src = case when p_product_patch ? 'size_chart_image_src' then coalesce(p_product_patch ->> 'size_chart_image_src', '') else size_chart_image_src end,
      size_chart_image_alt = case when p_product_patch ? 'size_chart_image_alt' then coalesce(p_product_patch ->> 'size_chart_image_alt', '') else size_chart_image_alt end,
      sort_order = case when p_product_patch ? 'sort_order' then (p_product_patch ->> 'sort_order')::integer else sort_order end,
      active = case when p_product_patch ? 'active' then (p_product_patch ->> 'active')::boolean else active end,
      updated_at = now()
    where id = p_product_id and p_product_patch <> '{}'::jsonb;
  else
    if not (
      p_product_patch ?& array[
        'product_type_id', 'name', 'price', 'fit', 'material', 'shopee_url',
        'size_chart_image_src', 'size_chart_image_alt', 'sort_order', 'active'
      ]
    ) then
      raise exception 'New product data is incomplete';
    end if;

    insert into public.products (
      id, product_type_id, name, price, fit, material, shopee_url,
      size_chart_image_src, size_chart_image_alt, sort_order, active
    ) values (
      p_product_id,
      p_product_patch ->> 'product_type_id',
      p_product_patch ->> 'name',
      p_product_patch ->> 'price',
      p_product_patch ->> 'fit',
      p_product_patch ->> 'material',
      p_product_patch ->> 'shopee_url',
      p_product_patch ->> 'size_chart_image_src',
      p_product_patch ->> 'size_chart_image_alt',
      (p_product_patch ->> 'sort_order')::integer,
      (p_product_patch ->> 'active')::boolean
    );
  end if;

  for v_change in select value from jsonb_array_elements(coalesce(p_pattern_changes, '[]'::jsonb))
  loop
    v_id := nullif(v_change ->> 'id', '');
    v_fields := coalesce(v_change -> 'changes', '{}'::jsonb);
    if v_id is null then raise exception 'Pattern id is required'; end if;

    if exists (select 1 from public.product_patterns where id = v_id and product_id <> p_product_id) then
      raise exception 'Pattern id belongs to another product';
    end if;

    if exists (select 1 from public.product_patterns where id = v_id) then
      update public.product_patterns
      set
        name = case when v_fields ? 'name' then coalesce(v_fields ->> 'name', '') else name end,
        accent = case when v_fields ? 'accent' then coalesce(v_fields ->> 'accent', '#c8b69a') else accent end,
        image_src = case when v_fields ? 'image_src' then coalesce(v_fields ->> 'image_src', '') else image_src end,
        image_alt = case when v_fields ? 'image_alt' then coalesce(v_fields ->> 'image_alt', '') else image_alt end,
        available_sizes = case when v_fields ? 'available_sizes' then array(select jsonb_array_elements_text(v_fields -> 'available_sizes')) else available_sizes end,
        sort_order = case when v_fields ? 'sort_order' then (v_fields ->> 'sort_order')::integer else sort_order end,
        updated_at = now()
      where id = v_id and product_id = p_product_id and v_fields <> '{}'::jsonb;
    else
      if not (v_fields ?& array['name', 'accent', 'image_src', 'image_alt', 'available_sizes', 'sort_order']) then
        raise exception 'New pattern data is incomplete';
      end if;
      insert into public.product_patterns (
        id, product_id, name, accent, image_src, image_alt, available_sizes, sort_order
      ) values (
        v_id, p_product_id, v_fields ->> 'name', v_fields ->> 'accent',
        v_fields ->> 'image_src', v_fields ->> 'image_alt',
        array(select jsonb_array_elements_text(v_fields -> 'available_sizes')),
        (v_fields ->> 'sort_order')::integer
      );
    end if;
  end loop;

  delete from public.product_patterns
  where product_id = p_product_id and id = any(coalesce(p_pattern_ids_to_delete, '{}'::text[]));

  for v_change in select value from jsonb_array_elements(coalesce(p_image_changes, '[]'::jsonb))
  loop
    v_id := nullif(v_change ->> 'id', '');
    v_fields := coalesce(v_change -> 'changes', '{}'::jsonb);
    if v_id is null then raise exception 'Image id is required'; end if;

    if exists (select 1 from public.product_images where id = v_id and product_id <> p_product_id) then
      raise exception 'Image id belongs to another product';
    end if;

    if exists (select 1 from public.product_images where id = v_id) then
      update public.product_images
      set
        src = case when v_fields ? 'src' then coalesce(v_fields ->> 'src', '') else src end,
        alt = case when v_fields ? 'alt' then coalesce(v_fields ->> 'alt', '') else alt end,
        sort_order = case when v_fields ? 'sort_order' then (v_fields ->> 'sort_order')::integer else sort_order end,
        updated_at = now()
      where id = v_id and product_id = p_product_id and v_fields <> '{}'::jsonb;
    else
      if not (v_fields ?& array['src', 'alt', 'sort_order']) then
        raise exception 'New image data is incomplete';
      end if;
      insert into public.product_images (id, product_id, src, alt, sort_order)
      values (v_id, p_product_id, v_fields ->> 'src', v_fields ->> 'alt', (v_fields ->> 'sort_order')::integer);
    end if;
  end loop;

  delete from public.product_images
  where product_id = p_product_id and id = any(coalesce(p_image_ids_to_delete, '{}'::text[]));
end;
$$;

revoke all on function public.patch_catalog_product(text, jsonb, jsonb, text[], jsonb, text[]) from public;
grant execute on function public.patch_catalog_product(text, jsonb, jsonb, text[], jsonb, text[]) to authenticated;

revoke execute on function public.save_catalog_product(jsonb, jsonb, jsonb) from authenticated;
