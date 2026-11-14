-- Stock mutations are logged by the existing product trigger in the same transaction.
-- Checkout and cancellation keep their existing locking and stock restoration logic.
create or replace function public.log_product_inventory_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_previous integer;
  v_change integer;
  v_type text;
  v_reason text;
begin
  if tg_op = 'INSERT' then
    v_previous := null;
    v_change := new.stock_quantity;
    v_type := 'initial';
  else
    if new.stock_quantity is not distinct from old.stock_quantity then return new; end if;
    v_previous := old.stock_quantity;
    v_change := new.stock_quantity - old.stock_quantity;
    v_type := case when v_change > 0 then 'increase' else 'decrease' end;
  end if;
  v_reason := coalesce(nullif(current_setting('app.inventory_reason', true), ''),
    case when tg_op = 'INSERT' then 'Initial stock' else 'Checkout or trusted stock operation' end);
  if v_change <> 0 then
    insert into public.inventory_logs
      (product_id, admin_user_id, change_type, previous_quantity, new_quantity, quantity_change, reason)
    values
      (new.id, case when public.is_active_admin() then (select auth.uid()) else null end,
       v_type, v_previous, new.stock_quantity, v_change, v_reason);
  end if;
  return new;
end;
$$;
revoke all on function public.log_product_inventory_change() from public, anon, authenticated;

create or replace function public.admin_adjust_inventory(
  p_ids uuid[], p_expected integer[], p_operation text, p_quantity integer, p_reason text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_row record;
  v_new bigint;
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if coalesce(cardinality(p_ids), 0) not between 1 and 100
     or cardinality(p_expected) is distinct from cardinality(p_ids)
     or (select count(distinct id) from unnest(p_ids) id) <> cardinality(p_ids)
     or array_position(p_expected, null) is not null
     or p_operation is null or p_operation not in ('set', 'increase', 'decrease')
     or p_quantity is null or p_quantity < 0 or p_quantity > 1000000000
     or (p_operation <> 'set' and p_quantity = 0)
     or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000
  then raise exception 'invalid_inventory_request' using errcode = '22023'; end if;
  if not public.consume_admin_rate_limit('inventory_adjust', 30, 60) then return false; end if;

  perform p.id from public.products p where p.id = any(p_ids) order by p.id for update;
  select count(*) into v_count from public.products p where p.id = any(p_ids);
  if v_count <> cardinality(p_ids) then raise exception 'product_not_found' using errcode = 'P0002'; end if;
  for v_row in
    select p.id, p.stock_quantity, expected.quantity as expected_quantity
    from public.products p
    join unnest(p_ids, p_expected) as expected(id, quantity) on expected.id = p.id
    order by p.id
  loop
    if v_row.stock_quantity <> v_row.expected_quantity then
      raise exception 'stock_conflict' using errcode = 'P0001';
    end if;
    v_new := case p_operation when 'set' then p_quantity::bigint
      when 'increase' then v_row.stock_quantity::bigint + p_quantity
      else v_row.stock_quantity::bigint - p_quantity end;
    if v_new < 0 or v_new > 2147483647 then raise exception 'invalid_resulting_stock' using errcode = '22023'; end if;
    if v_new = v_row.stock_quantity then raise exception 'unchanged_stock' using errcode = '22023'; end if;
  end loop;
  perform pg_catalog.set_config('app.inventory_reason', btrim(p_reason), true);
  update public.products p set stock_quantity = case p_operation
    when 'set' then p_quantity
    when 'increase' then p.stock_quantity + p_quantity
    else p.stock_quantity - p_quantity end
  where p.id = any(p_ids);
  return true;
end;
$$;
revoke all on function public.admin_adjust_inventory(uuid[], integer[], text, integer, text) from public, anon, authenticated;
grant execute on function public.admin_adjust_inventory(uuid[], integer[], text, integer, text) to authenticated;

create or replace function public.admin_inventory_list(
  p_query text default '', p_status text default 'all', p_offset integer default 0, p_limit integer default 21
)
returns table (
  id uuid, name text, sku text, stock_quantity integer, is_active boolean,
  threshold integer, image_path text, last_stock_update timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_query is null or char_length(p_query) > 100 or p_status is null or p_status not in ('all', 'in', 'low', 'out')
     or p_offset is null or p_offset < 0 or p_limit is null or p_limit not between 1 and 101 then
    raise exception 'invalid_inventory_filter' using errcode = '22023';
  end if;
  return query
    select p.id, p.name, p.sku, p.stock_quantity, p.is_active, s.low_stock_threshold,
      image.storage_path, movement.created_at
    from public.products p
    cross join public.site_settings s
    left join lateral (
      select i.storage_path from public.product_images i where i.product_id = p.id
      order by i.sort_order, i.id limit 1
    ) image on true
    left join lateral (
      select l.created_at from public.inventory_logs l where l.product_id = p.id
      order by l.created_at desc, l.id desc limit 1
    ) movement on true
    where s.singleton
      and (p_query = '' or position(lower(p_query) in lower(p.name)) > 0
        or position(lower(p_query) in lower(coalesce(p.sku, ''))) > 0)
      and (p_status = 'all' or (p_status = 'out' and p.stock_quantity = 0)
        or (p_status = 'low' and p.stock_quantity > 0 and p.stock_quantity <= s.low_stock_threshold)
        or (p_status = 'in' and p.stock_quantity > 0))
    order by p.name, p.id offset p_offset limit p_limit;
end;
$$;
revoke all on function public.admin_inventory_list(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_inventory_list(text, text, integer, integer) to authenticated;
