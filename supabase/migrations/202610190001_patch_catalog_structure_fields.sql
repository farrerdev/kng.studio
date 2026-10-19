create or replace function public.patch_catalog_product_type(
  p_product_type_id text,
  p_patch jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;

  if nullif(p_product_type_id, '') is null then
    raise exception 'Product type id is required';
  end if;

  if exists (select 1 from public.product_types where id = p_product_type_id) then
    update public.product_types
    set
      name = case when p_patch ? 'name' then coalesce(p_patch ->> 'name', '') else name end,
      price = case when p_patch ? 'price' then coalesce(p_patch ->> 'price', '') else price end,
      cover_image_src = case when p_patch ? 'cover_image_src' then coalesce(p_patch ->> 'cover_image_src', '') else cover_image_src end,
      cover_image_alt = case when p_patch ? 'cover_image_alt' then coalesce(p_patch ->> 'cover_image_alt', '') else cover_image_alt end,
      size_chart_image_src = case when p_patch ? 'size_chart_image_src' then coalesce(p_patch ->> 'size_chart_image_src', '') else size_chart_image_src end,
      size_chart_image_alt = case when p_patch ? 'size_chart_image_alt' then coalesce(p_patch ->> 'size_chart_image_alt', '') else size_chart_image_alt end,
      sort_order = case when p_patch ? 'sort_order' then (p_patch ->> 'sort_order')::integer else sort_order end,
      updated_at = now()
    where id = p_product_type_id and p_patch <> '{}'::jsonb;
  else
    if not (
      p_patch ?& array[
        'name', 'price', 'cover_image_src', 'cover_image_alt',
        'size_chart_image_src', 'size_chart_image_alt', 'sort_order'
      ]
    ) then
      raise exception 'New product type data is incomplete';
    end if;

    insert into public.product_types (
      id, name, price, cover_image_src, cover_image_alt,
      size_chart_image_src, size_chart_image_alt, sort_order
    ) values (
      p_product_type_id,
      p_patch ->> 'name',
      p_patch ->> 'price',
      p_patch ->> 'cover_image_src',
      p_patch ->> 'cover_image_alt',
      p_patch ->> 'size_chart_image_src',
      p_patch ->> 'size_chart_image_alt',
      (p_patch ->> 'sort_order')::integer
    );
  end if;
end;
$$;

create or replace function public.patch_catalog_sort_order(
  p_product_type_orders jsonb default '[]'::jsonb,
  p_product_orders jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_id text;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_product_type_orders, '[]'::jsonb))
  loop
    v_id := nullif(v_item ->> 'id', '');
    if v_id is null or not (v_item ? 'sort_order') then
      raise exception 'Invalid product type order';
    end if;
    if not exists (select 1 from public.product_types where id = v_id) then
      raise exception 'Product type does not exist: %', v_id;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_product_orders, '[]'::jsonb))
  loop
    v_id := nullif(v_item ->> 'id', '');
    if v_id is null or not (v_item ? 'sort_order') then
      raise exception 'Invalid product order';
    end if;
    if not exists (select 1 from public.products where id = v_id) then
      raise exception 'Product does not exist: %', v_id;
    end if;
  end loop;

  update public.product_types product_type
  set sort_order = incoming.sort_order, updated_at = now()
  from jsonb_to_recordset(coalesce(p_product_type_orders, '[]'::jsonb)) as incoming(id text, sort_order integer)
  where product_type.id = incoming.id;

  update public.products product
  set sort_order = incoming.sort_order, updated_at = now()
  from jsonb_to_recordset(coalesce(p_product_orders, '[]'::jsonb)) as incoming(id text, sort_order integer)
  where product.id = incoming.id;
end;
$$;

create or replace function public.delete_catalog_product(p_product_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;
  if nullif(p_product_id, '') is null then
    raise exception 'Product id is required';
  end if;

  delete from public.products where id = p_product_id;
  if not found then
    raise exception 'Product does not exist';
  end if;
end;
$$;

create or replace function public.delete_catalog_product_type(
  p_product_type_id text,
  p_replacement_product_type_id text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_replacement_price text;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication required';
  end if;
  if nullif(p_product_type_id, '') is null or nullif(p_replacement_product_type_id, '') is null then
    raise exception 'Product type ids are required';
  end if;
  if p_product_type_id = p_replacement_product_type_id then
    raise exception 'Replacement product type must be different';
  end if;
  if not exists (select 1 from public.product_types where id = p_product_type_id) then
    raise exception 'Product type does not exist';
  end if;

  select price into v_replacement_price
  from public.product_types
  where id = p_replacement_product_type_id;
  if not found then
    raise exception 'Replacement product type does not exist';
  end if;

  update public.products
  set product_type_id = p_replacement_product_type_id,
      price = v_replacement_price,
      updated_at = now()
  where product_type_id = p_product_type_id;

  delete from public.product_types where id = p_product_type_id;
end;
$$;

revoke all on function public.patch_catalog_product_type(text, jsonb) from public;
grant execute on function public.patch_catalog_product_type(text, jsonb) to authenticated;

revoke all on function public.patch_catalog_sort_order(jsonb, jsonb) from public;
grant execute on function public.patch_catalog_sort_order(jsonb, jsonb) to authenticated;

revoke all on function public.delete_catalog_product(text) from public;
grant execute on function public.delete_catalog_product(text) to authenticated;

revoke all on function public.delete_catalog_product_type(text, text) from public;
grant execute on function public.delete_catalog_product_type(text, text) to authenticated;
