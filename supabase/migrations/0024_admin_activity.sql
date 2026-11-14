-- Authenticated administrators can read but cannot forge or edit audit entries.
revoke execute on function public.record_admin_activity(text, text, uuid, text, jsonb, inet)
  from public, anon, authenticated;

create function public.record_trusted_admin_activity(
  p_actor uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin' and is_active) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('upload', 'delete', 'attach', 'reorder', 'delete_all')
     or p_entity_type is null or p_entity_type not in ('media', 'product_image')
     or jsonb_typeof(p_metadata) is distinct from 'object'
     or exists (select 1 from jsonb_object_keys(p_metadata) as k(key)
       where k.key not in ('bucket', 'uploaded_count', 'image_count', 'deleted_count'))
     or (p_metadata ? 'bucket' and (jsonb_typeof(p_metadata->'bucket') <> 'string'
       or p_metadata->>'bucket' not in ('site-media', 'product-images')))
     or exists (select 1 from jsonb_each(p_metadata) as e(key, value)
       where e.key in ('uploaded_count', 'image_count', 'deleted_count')
         and (jsonb_typeof(e.value) <> 'number' or e.value::text !~ '^[0-9]{1,6}$'))
  then raise exception 'invalid_activity_log' using errcode = '22023'; end if;
  insert into public.admin_activity_logs(admin_user_id, action, entity_type, entity_id, description, metadata)
    values (p_actor, p_action, p_entity_type, p_entity_id, 'Media operation', p_metadata);
  return true;
end;
$$;
revoke all on function public.record_trusted_admin_activity(uuid, text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_trusted_admin_activity(uuid, text, text, uuid, jsonb) to service_role;

create function public.record_admin_login(p_actor uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin' and is_active) then
    return false;
  end if;
  insert into public.admin_activity_logs(admin_user_id, action, entity_type, entity_id, description)
    values (p_actor, 'login', 'admin_session', p_actor, 'Administrator password sign-in');
  return true;
end;
$$;
revoke all on function public.record_admin_login(uuid) from public, anon, authenticated;
grant execute on function public.record_admin_login(uuid) to service_role;

create or replace function public.audit_admin_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_metadata jsonb := jsonb_build_object('operation', lower(tg_op));
begin
  if not public.is_active_admin() then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then v_id := old.id; else v_id := new.id; end if;
  if tg_table_name = 'products' and tg_op = 'UPDATE' then
    if old.price is distinct from new.price then
      v_metadata := v_metadata || jsonb_build_object('price_before', old.price, 'price_after', new.price,
        'currency_before', old.currency, 'currency_after', new.currency);
    end if;
    if old.stock_quantity is distinct from new.stock_quantity then
      v_metadata := v_metadata || jsonb_build_object('stock_before', old.stock_quantity, 'stock_after', new.stock_quantity);
    end if;
  elsif tg_table_name = 'orders' and tg_op = 'UPDATE' then
    if old.status is not distinct from new.status then return new; end if;
    v_metadata := v_metadata || jsonb_build_object('status_before', old.status, 'status_after', new.status);
  end if;
  insert into public.admin_activity_logs(admin_user_id, action, entity_type, entity_id, description, metadata)
    values ((select auth.uid()), lower(tg_op), tg_table_name, v_id,
      'Administrative database ' || lower(tg_op), v_metadata);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.audit_admin_mutation() from public, anon, authenticated;

create function public.admin_activity_list(
  p_admin uuid default null, p_action text default '', p_entity text default '',
  p_from date default null, p_to date default null, p_query text default '',
  p_offset integer default 0, p_limit integer default 21
)
returns table (
  id uuid, admin_user_id uuid, action text, entity_type text, entity_id uuid,
  description text, metadata jsonb, created_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_action is null or char_length(p_action) > 100 or p_entity is null or char_length(p_entity) > 100
     or p_query is null or char_length(p_query) > 100 or p_offset is null or p_offset < 0
     or p_limit is null or p_limit not between 1 and 101
     or (p_from is not null and (not isfinite(p_from) or p_from < date '0001-01-01' or p_from > date '9998-12-31'))
     or (p_to is not null and (not isfinite(p_to) or p_to < date '0001-01-01' or p_to > date '9998-12-31'))
     or (p_from is not null and p_to is not null and p_from > p_to)
  then raise exception 'invalid_activity_filter' using errcode = '22023'; end if;
  return query
    select l.id, l.admin_user_id, l.action, l.entity_type, l.entity_id, l.description,
      coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(l.metadata) e
        where (e.key in ('price_before', 'price_after', 'stock_before', 'stock_after',
          'revision', 'uploaded_count', 'image_count', 'deleted_count') and jsonb_typeof(e.value) = 'number')
          or (e.key in ('currency_before', 'currency_after') and jsonb_typeof(e.value) = 'string'
            and (e.value #>> '{}') ~ '^[A-Z]{3}$')
          or (e.key in ('status_before', 'status_after') and jsonb_typeof(e.value) = 'string'
            and (e.value #>> '{}') in ('pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'))
          or (e.key = 'operation' and jsonb_typeof(e.value) = 'string'
            and (e.value #>> '{}') in ('insert', 'update', 'delete'))
          or (e.key = 'bucket' and jsonb_typeof(e.value) = 'string'
            and (e.value #>> '{}') in ('site-media', 'product-images'))
      ), '{}'::jsonb), l.created_at
    from public.admin_activity_logs l
    where (p_admin is null or l.admin_user_id = p_admin)
      and (p_action = '' or l.action = p_action)
      and (p_entity = '' or l.entity_type = p_entity)
      and (p_from is null or l.created_at >= (p_from::timestamp at time zone 'UTC'))
      and (p_to is null or l.created_at < ((p_to + 1)::timestamp at time zone 'UTC'))
      and (p_query = '' or position(lower(p_query) in lower(l.action)) > 0
        or position(lower(p_query) in lower(l.entity_type)) > 0
        or position(lower(p_query) in lower(coalesce(l.description, ''))) > 0
        or position(lower(p_query) in lower(coalesce(l.entity_id::text, ''))) > 0)
    order by l.created_at desc, l.id desc offset p_offset limit p_limit;
end;
$$;
revoke all on function public.admin_activity_list(uuid, text, text, date, date, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_activity_list(uuid, text, text, date, date, text, integer, integer)
  to authenticated;
