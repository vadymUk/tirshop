-- Table-wide SELECT overrides column restrictions, so replace it with an
-- explicit public column list and provide a separately authorized cost lookup.
revoke select on public.products from public, anon, authenticated;
revoke select (cost_price) on public.products from public, anon, authenticated;

grant select (
  id, category_id, name, slug, short_description, description, price, currency,
  stock_quantity, is_active, sku, compare_at_price, is_featured, meta_title,
  meta_description, og_image_path, weight, created_at, updated_at
) on public.products to anon, authenticated;

create function public.admin_product_cost(p_product_id uuid)
returns table(product_id uuid, cost_price numeric)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_product_id is null then
    raise exception 'product_id_required' using errcode = '22023';
  end if;
  return query select p.id, p.cost_price from public.products p where p.id = p_product_id;
end;
$$;
revoke all on function public.admin_product_cost(uuid) from public, anon, authenticated;
grant execute on function public.admin_product_cost(uuid) to authenticated;
