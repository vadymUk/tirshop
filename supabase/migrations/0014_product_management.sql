-- Product mutations are atomic: stock cannot be overwritten by a stale form,
-- and deletion cannot erase an order reference or orphan a storage object.
alter table public.site_settings
  add column if not exists low_stock_threshold integer not null default 5;

alter table public.site_settings
  drop constraint if exists site_settings_low_stock_threshold_valid,
  add constraint site_settings_low_stock_threshold_valid
  check (low_stock_threshold between 0 and 1000000);

revoke delete on public.products from authenticated;

create or replace function public.admin_save_product(
  p_id uuid,
  p_product jsonb,
  p_stock integer,
  p_expected_stock integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_stock integer;
  v_price numeric;
  v_compare numeric;
  v_weight numeric;
begin
  if not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_product) is distinct from 'object' or p_stock is null or p_stock < 0
     or p_stock > 1000000000 then
    raise exception 'invalid_product' using errcode = '22023';
  end if;
  v_price := (p_product->>'price')::numeric;
  v_compare := nullif(p_product->>'compare_at_price', '')::numeric;
  v_weight := nullif(p_product->>'weight', '')::numeric;
  if nullif(btrim(p_product->>'name'), '') is null or char_length(p_product->>'name') > 200
     or coalesce(p_product->>'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or char_length(p_product->>'slug') > 200
     or char_length(coalesce(p_product->>'sku', '')) > 100
     or char_length(coalesce(p_product->>'short_description', '')) > 1000
     or char_length(coalesce(p_product->>'description', '')) > 20000
     or char_length(coalesce(p_product->>'og_image_path', '')) > 1000
     or coalesce(p_product->>'currency', '') !~ '^[A-Z]{3}$'
     or v_price is null or v_price <= 0 or v_price > 9999999999.99 or v_price <> round(v_price, 2)
     or (v_compare is not null and (v_compare < 0 or v_compare > 9999999999.99 or v_compare <> round(v_compare, 2)))
     or (v_weight is not null and (v_weight < 0 or v_weight > 9999999.999 or v_weight <> round(v_weight, 3)))
  then raise exception 'invalid_product' using errcode = '22023'; end if;
  if not public.consume_admin_rate_limit('product_save', 30, 60) then
    return null;
  end if;
  if p_id is not null then
    select stock_quantity into v_stock from public.products where id = p_id for update;
    if not found then raise exception 'product_not_found' using errcode = 'P0002'; end if;
    if p_expected_stock is null or v_stock <> p_expected_stock then
      raise exception 'stock_conflict' using errcode = '40001';
    end if;
  end if;
  perform set_config('app.inventory_reason', 'Admin product edit', true);
  if p_id is null then
    insert into public.products (
      category_id, name, slug, sku, short_description, description, price,
      compare_at_price, currency, stock_quantity, weight, is_active, is_featured,
      meta_title, meta_description, og_image_path
    ) values (
      (p_product->>'category_id')::uuid, p_product->>'name', p_product->>'slug',
      nullif(p_product->>'sku', ''), nullif(p_product->>'short_description', ''),
      nullif(p_product->>'description', ''), v_price,
      v_compare, p_product->>'currency',
      p_stock, v_weight,
      (p_product->>'is_active')::boolean, (p_product->>'is_featured')::boolean,
      nullif(p_product->>'meta_title', ''), nullif(p_product->>'meta_description', ''),
      nullif(p_product->>'og_image_path', '')
    ) returning id into v_id;
  else
    update public.products set
      category_id = (p_product->>'category_id')::uuid,
      name = p_product->>'name', slug = p_product->>'slug',
      sku = nullif(p_product->>'sku', ''),
      short_description = nullif(p_product->>'short_description', ''),
      description = nullif(p_product->>'description', ''),
      price = v_price,
      compare_at_price = v_compare,
      currency = p_product->>'currency', stock_quantity = p_stock,
      weight = v_weight,
      is_active = (p_product->>'is_active')::boolean,
      is_featured = (p_product->>'is_featured')::boolean,
      meta_title = nullif(p_product->>'meta_title', ''),
      meta_description = nullif(p_product->>'meta_description', ''),
      og_image_path = nullif(p_product->>'og_image_path', '')
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.admin_save_product(uuid, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_save_product(uuid, jsonb, integer, integer) to authenticated;

create or replace function public.admin_bulk_products(p_ids uuid[], p_operation text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_operation not in ('activate', 'deactivate', 'delete') or p_operation is null
     or coalesce(cardinality(p_ids), 0) not between 1 and 100
     or (select count(distinct id) from unnest(p_ids) id) <> cardinality(p_ids)
  then raise exception 'invalid_bulk_request' using errcode = '22023'; end if;
  if not public.consume_admin_rate_limit('product_bulk', 20, 60) then return false; end if;
  perform id from public.products where id = any(p_ids) order by id for update;
  select count(*) into v_count from public.products where id = any(p_ids);
  if v_count <> cardinality(p_ids) then raise exception 'product_not_found' using errcode = 'P0002'; end if;
  if p_operation = 'delete' then
    if exists (select 1 from public.order_items where product_id = any(p_ids)) then
      raise exception 'product_has_orders' using errcode = '23503';
    end if;
    if exists (select 1 from public.product_images where product_id = any(p_ids)) then
      raise exception 'product_has_images' using errcode = '23503';
    end if;
    delete from public.products where id = any(p_ids);
  else
    update public.products set is_active = (p_operation = 'activate') where id = any(p_ids);
  end if;
  return true;
end;
$$;

revoke all on function public.admin_bulk_products(uuid[], text) from public, anon, authenticated;
grant execute on function public.admin_bulk_products(uuid[], text) to authenticated;
