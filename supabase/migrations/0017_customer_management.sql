-- Disable the customer UI and revoke this RPC to roll back access; retain orders.
create index if not exists profiles_customer_created_idx
  on public.profiles (created_at desc, id) where role = 'customer';
create index if not exists orders_customer_created_idx
  on public.orders (user_id, created_at desc, id) where user_id is not null;

create function public.admin_customers(
  p_query text default '',
  p_from date default null,
  p_to date default null,
  p_min_orders integer default null,
  p_max_orders integer default null,
  p_ascending boolean default false,
  p_offset integer default 0,
  p_id uuid default null
)
returns table (
  id uuid, full_name text, phone text, created_at timestamptz,
  is_active boolean, order_count bigint, latest_order timestamptz, totals jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if length(coalesce(p_query, '')) > 100 or p_offset < 0 or p_offset > 1999980
     or p_min_orders < 0 or p_max_orders < 0
     or p_min_orders > p_max_orders or p_from > p_to then
    raise exception 'Invalid customer filters' using errcode = '22023';
  end if;

  return query
  with selected as (
    select p.id, p.full_name, p.phone, p.created_at, p.is_active,
           stats.order_count, stats.latest_order
    from public.profiles p
    cross join lateral (
      select count(*) as order_count, max(o.created_at) as latest_order
      from public.orders o where o.user_id = p.id
    ) stats
    where p.role = 'customer'
      and (p_id is null or p.id = p_id)
      and (coalesce(p_query, '') = ''
        or strpos(lower(coalesce(p.full_name, '')), lower(p_query)) > 0
        or strpos(lower(coalesce(p.phone, '')), lower(p_query)) > 0)
      and (p_from is null or p.created_at >= (p_from::timestamp at time zone 'UTC'))
      and (p_to is null or p.created_at < ((p_to + 1)::timestamp at time zone 'UTC'))
      and (p_min_orders is null or stats.order_count >= p_min_orders)
      and (p_max_orders is null or stats.order_count <= p_max_orders)
    order by case when p_ascending then p.created_at end asc,
             case when not p_ascending then p.created_at end desc, p.id
    limit 21 offset p_offset
  )
  select s.id, s.full_name, s.phone, s.created_at, s.is_active,
         s.order_count, s.latest_order,
         coalesce((select jsonb_agg(jsonb_build_object('currency', t.currency, 'amount', t.amount) order by t.currency)
                   from (select o.currency, sum(o.total_amount) as amount
                         from public.orders o where o.user_id = s.id group by o.currency) t), '[]'::jsonb)
  from selected s
  order by case when p_ascending then s.created_at end asc,
           case when not p_ascending then s.created_at end desc, s.id;
end;
$$;

revoke all on function public.admin_customers(text,date,date,integer,integer,boolean,integer,uuid) from public, anon;
grant execute on function public.admin_customers(text,date,date,integer,integer,boolean,integer,uuid) to authenticated;
