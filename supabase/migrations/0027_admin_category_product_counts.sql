-- Column-level product grants (0026) make PostgREST's products(count) embed fail
-- with "permission denied". Provide an admin-checked aggregate instead.
create function public.admin_category_product_counts(p_ids uuid[])
returns table(category_id uuid, product_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) > 100 then
    raise exception 'invalid_category_ids' using errcode = '22023';
  end if;
  return query
    select p.category_id, count(*)
    from public.products p
    where p.category_id = any(p_ids)
    group by p.category_id;
end;
$$;
revoke all on function public.admin_category_product_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_category_product_counts(uuid[]) to authenticated;
