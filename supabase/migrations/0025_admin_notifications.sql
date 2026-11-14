-- Poll existing durable records; no trigger is added to checkout or stock writes.
create table public.admin_notification_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('new_order', 'low_stock', 'out_of_stock', 'order_cancelled', 'email_failure', 'security')),
  source_id uuid not null,
  entity_id uuid,
  created_at timestamptz not null default now(),
  unique (kind, source_id)
);
create index admin_notification_events_created_idx on public.admin_notification_events (created_at desc, id desc);
create index inventory_logs_notification_created_idx on public.inventory_logs (created_at, id);
create index order_status_notification_created_idx on public.order_status_history (created_at, id);

create table public.admin_notification_reads (
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid not null references public.admin_notification_events(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (admin_user_id, notification_id)
);

create table public.admin_notification_preferences (
  admin_user_id uuid primary key references public.profiles(id) on delete cascade,
  new_order boolean not null default true,
  low_stock boolean not null default true,
  out_of_stock boolean not null default true,
  order_cancelled boolean not null default true,
  email_failure boolean not null default true,
  security boolean not null default true
);
alter table public.admin_notification_events enable row level security;
alter table public.admin_notification_reads enable row level security;
alter table public.admin_notification_preferences enable row level security;
revoke all on public.admin_notification_events, public.admin_notification_reads, public.admin_notification_preferences
  from public, anon, authenticated;

create function public.admin_sync_notifications()
returns void language plpgsql security definer set search_path = '' as $$
declare v_threshold integer;
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  select s.low_stock_threshold into strict v_threshold from public.site_settings s where s.singleton;

  insert into public.admin_notification_events(kind, source_id, entity_id, created_at)
  select 'new_order', o.id, o.id, o.created_at from public.orders o
  where not exists (select 1 from public.admin_notification_events n where n.kind = 'new_order' and n.source_id = o.id)
  order by o.created_at, o.id limit 250 on conflict (kind, source_id) do nothing;

  insert into public.admin_notification_events(kind, source_id, entity_id, created_at)
  select 'order_cancelled', h.id, h.order_id, h.created_at from public.order_status_history h
  where h.new_status = 'cancelled' and h.previous_status is not null
    and not exists (select 1 from public.admin_notification_events n where n.kind = 'order_cancelled' and n.source_id = h.id)
  order by h.created_at, h.id limit 250 on conflict (kind, source_id) do nothing;

  insert into public.admin_notification_events(kind, source_id, entity_id, created_at)
  select 'low_stock', l.id, l.product_id, l.created_at from public.inventory_logs l
  join public.products p on p.id = l.product_id
  where p.is_active and l.new_quantity > 0 and l.new_quantity <= v_threshold
    and (l.previous_quantity is null or l.previous_quantity = 0 or l.previous_quantity > v_threshold)
    and not exists (select 1 from public.admin_notification_events n where n.kind = 'low_stock' and n.source_id = l.id)
  order by l.created_at, l.id limit 250 on conflict (kind, source_id) do nothing;

  insert into public.admin_notification_events(kind, source_id, entity_id, created_at)
  select 'out_of_stock', l.id, l.product_id, l.created_at from public.inventory_logs l
  join public.products p on p.id = l.product_id
  where p.is_active and l.new_quantity = 0 and l.previous_quantity > 0
    and not exists (select 1 from public.admin_notification_events n where n.kind = 'out_of_stock' and n.source_id = l.id)
  order by l.created_at, l.id limit 250 on conflict (kind, source_id) do nothing;

  insert into public.admin_notification_events(kind, source_id, entity_id, created_at)
  select 'out_of_stock', p.id, p.id, p.created_at from public.products p
  where p.is_active and p.stock_quantity = 0
    and not exists (select 1 from public.inventory_logs l where l.product_id = p.id and l.new_quantity = 0)
    and not exists (select 1 from public.admin_notification_events n where n.kind = 'out_of_stock' and n.source_id = p.id)
  order by p.created_at, p.id limit 250 on conflict (kind, source_id) do nothing;

  insert into public.admin_notification_events(kind, source_id, entity_id, created_at)
  select 'security', a.id, a.admin_user_id, a.created_at from public.admin_activity_logs a
  where a.action = 'login' and a.entity_type = 'admin_session'
    and not exists (select 1 from public.admin_notification_events n where n.kind = 'security' and n.source_id = a.id)
  order by a.created_at, a.id limit 250 on conflict (kind, source_id) do nothing;
end;
$$;
revoke all on function public.admin_sync_notifications() from public, anon, authenticated;
grant execute on function public.admin_sync_notifications() to authenticated;

create function public.admin_notification_feed(p_offset integer default 0, p_limit integer default 11)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_p public.admin_notification_preferences%rowtype;
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_offset is null or p_offset < 0 or p_limit is null or p_limit not between 1 and 101 then
    raise exception 'invalid_notification_pagination' using errcode = '22023';
  end if;
  select * into v_p from public.admin_notification_preferences p where p.admin_user_id = (select auth.uid());
  if not found then
    v_p.new_order := true; v_p.low_stock := true; v_p.out_of_stock := true;
    v_p.order_cancelled := true; v_p.email_failure := true; v_p.security := true;
  end if;
  return (
    with visible as materialized (
      select n.id, n.kind, n.entity_id, n.created_at, (r.notification_id is not null) as is_read
      from public.admin_notification_events n
      left join public.admin_notification_reads r on r.notification_id = n.id and r.admin_user_id = (select auth.uid())
      where case n.kind when 'new_order' then v_p.new_order when 'low_stock' then v_p.low_stock
        when 'out_of_stock' then v_p.out_of_stock when 'order_cancelled' then v_p.order_cancelled
        when 'email_failure' then v_p.email_failure when 'security' then v_p.security else false end
    ),
    page as (select * from visible order by created_at desc, id desc offset p_offset limit p_limit)
    select jsonb_build_object(
      'unread', (select count(*) from visible where not is_read),
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by page.created_at desc, page.id desc) from page), '[]'::jsonb),
      'preferences', jsonb_build_object('new_order', v_p.new_order, 'low_stock', v_p.low_stock,
        'out_of_stock', v_p.out_of_stock, 'order_cancelled', v_p.order_cancelled,
        'email_failure', v_p.email_failure, 'security', v_p.security)
    )
  );
end;
$$;
revoke all on function public.admin_notification_feed(integer, integer) from public, anon, authenticated;
grant execute on function public.admin_notification_feed(integer, integer) to authenticated;

create function public.admin_notification_mark(p_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_id is not null and not exists (select 1 from public.admin_notification_events where id = p_id) then
    raise exception 'notification_not_found' using errcode = 'P0002';
  end if;
  insert into public.admin_notification_reads(admin_user_id, notification_id)
    select (select auth.uid()), n.id from public.admin_notification_events n
    left join public.admin_notification_preferences p on p.admin_user_id = (select auth.uid())
    where (p_id is null or n.id = p_id) and case n.kind
      when 'new_order' then coalesce(p.new_order, true) when 'low_stock' then coalesce(p.low_stock, true)
      when 'out_of_stock' then coalesce(p.out_of_stock, true) when 'order_cancelled' then coalesce(p.order_cancelled, true)
      when 'email_failure' then coalesce(p.email_failure, true) when 'security' then coalesce(p.security, true) else false end
    on conflict (admin_user_id, notification_id) do nothing;
end;
$$;
revoke all on function public.admin_notification_mark(uuid) from public, anon, authenticated;
grant execute on function public.admin_notification_mark(uuid) to authenticated;

create function public.admin_notification_set_preferences(p_preferences jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if jsonb_typeof(p_preferences) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_preferences)) <> 6
     or exists (select 1 from jsonb_each(p_preferences) e
       where e.key not in ('new_order', 'low_stock', 'out_of_stock', 'order_cancelled', 'email_failure', 'security')
       or jsonb_typeof(e.value) <> 'boolean')
  then raise exception 'invalid_notification_preferences' using errcode = '22023'; end if;
  insert into public.admin_notification_preferences(admin_user_id, new_order, low_stock, out_of_stock, order_cancelled, email_failure, security)
  values ((select auth.uid()), (p_preferences->>'new_order')::boolean, (p_preferences->>'low_stock')::boolean,
    (p_preferences->>'out_of_stock')::boolean, (p_preferences->>'order_cancelled')::boolean,
    (p_preferences->>'email_failure')::boolean, (p_preferences->>'security')::boolean)
  on conflict (admin_user_id) do update set new_order = excluded.new_order, low_stock = excluded.low_stock,
    out_of_stock = excluded.out_of_stock, order_cancelled = excluded.order_cancelled,
    email_failure = excluded.email_failure, security = excluded.security;
end;
$$;
revoke all on function public.admin_notification_set_preferences(jsonb) from public, anon, authenticated;
grant execute on function public.admin_notification_set_preferences(jsonb) to authenticated;

create function public.record_order_email_failure(p_order uuid, p_source uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_order is null or p_source is null or not exists (select 1 from public.orders where id = p_order) then
    raise exception 'invalid_email_failure' using errcode = '22023';
  end if;
  if p_source <> p_order and not exists (select 1 from public.order_status_history where id = p_source and order_id = p_order) then
    raise exception 'invalid_email_failure' using errcode = '22023';
  end if;
  insert into public.admin_notification_events(kind, source_id, entity_id)
    values ('email_failure', p_source, p_order) on conflict (kind, source_id) do nothing;
end;
$$;
revoke all on function public.record_order_email_failure(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_order_email_failure(uuid, uuid) to service_role;
