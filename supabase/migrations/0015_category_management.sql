-- Deletion and reassignment must happen under the same category row locks.
-- Rollback: disable the category UI and revoke the two RPC grants. Keep the
-- deletion restriction until storage cleanup and product reassignment are reviewed.
revoke delete on public.categories from authenticated;

create or replace function public.admin_delete_category(p_id uuid, p_target uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_id is null or p_id = p_target then raise exception 'invalid_category' using errcode = '22023'; end if;
  if not public.consume_admin_rate_limit('category_delete', 20, 60) then return false; end if;
  perform id from public.categories where id = p_id or id = p_target order by id for update;
  select count(*) into v_count from public.categories where id = p_id or id = p_target;
  if v_count <> (case when p_target is null then 1 else 2 end) then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.categories where id = p_id and (image_path is not null or image_url is not null)) then
    raise exception 'category_has_image' using errcode = '23503';
  end if;
  if p_target is null and exists (select 1 from public.products where category_id = p_id) then
    raise exception 'category_has_products' using errcode = '23503';
  end if;
  if p_target is not null then
    update public.products set category_id = p_target where category_id = p_id;
  end if;
  delete from public.categories where id = p_id;
  return true;
end;
$$;
revoke all on function public.admin_delete_category(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_category(uuid, uuid) to authenticated;

create or replace function public.admin_move_category(p_id uuid, p_target uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[];
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_id is null or p_target is null or p_id = p_target then raise exception 'invalid_category' using errcode = '22023'; end if;
  if not public.consume_admin_rate_limit('category_reorder', 30, 60) then return false; end if;
  -- Serialize full-list reorder operations, including across filtered pages.
  perform pg_catalog.pg_advisory_xact_lock(752314801);
  lock table public.categories in share row exclusive mode;
  select array_agg(id order by sort_order, name, id) into v_ids from public.categories;
  if v_ids is null or not (p_id = any(v_ids)) or not (p_target = any(v_ids)) then raise exception 'category_not_found' using errcode = 'P0002'; end if;
  with ordered as (
    select id, ord from unnest(v_ids) with ordinality as x(id, ord) where id <> p_id
  ), moved as (
    select id, case when ord >= array_position(v_ids, p_target) then ord + 0.5 else ord::numeric end as position from ordered
    union all select p_id, array_position(v_ids, p_target)::numeric
  ), numbered as (
    select id, row_number() over (order by position, id) - 1 as position from moved
  )
  update public.categories c set sort_order = n.position::integer from numbered n
    where c.id = n.id and c.sort_order is distinct from n.position::integer;
  return true;
end;
$$;
revoke all on function public.admin_move_category(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_move_category(uuid, uuid) to authenticated;
