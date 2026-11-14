-- UTC calendar periods; amounts and rankings are scoped to one currency.
create or replace function public.admin_ecommerce_analytics(
  p_period text default 'last_30_days',
  p_from date default null,
  p_to date default null,
  p_currency text default null,
  p_bucket text default 'day',
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_from date;
  v_to date;
  v_currency text;
  v_threshold integer;
  v_result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  case p_period
    when 'today' then v_from := v_today; v_to := v_today;
    when 'last_7_days' then v_from := v_today - 6; v_to := v_today;
    when 'last_30_days' then v_from := v_today - 29; v_to := v_today;
    when 'last_90_days' then v_from := v_today - 89; v_to := v_today;
    when 'this_year' then v_from := date_trunc('year', v_today::timestamp)::date; v_to := v_today;
    when 'custom' then v_from := p_from; v_to := p_to;
    else raise exception 'invalid_period' using errcode = '22023';
  end case;
  if v_from is null or v_to is null or not isfinite(v_from) or not isfinite(v_to)
     or v_from < date '0001-01-01' or v_to > date '9998-12-31'
     or v_from > v_to or v_to - v_from > 730 then
    raise exception 'invalid_date_range' using errcode = '22023';
  end if;
  if p_bucket is null or p_bucket not in ('day', 'week', 'month') then
    raise exception 'invalid_bucket' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception 'invalid_offset' using errcode = '22023';
  end if;

  select coalesce(p_currency, s.currency), s.low_stock_threshold
    into v_currency, v_threshold from public.site_settings s where s.singleton;
  if v_currency is null or v_currency !~ '^[A-Z]{3}$' or v_threshold is null then
    raise exception 'invalid_currency_or_settings' using errcode = '22023';
  end if;

  with selected_orders as materialized (
    select o.id, o.user_id, o.status, o.payment_status, o.total_amount, o.created_at
    from public.orders o
    where o.currency = v_currency
      and o.created_at >= (v_from::timestamp at time zone 'UTC')
      and o.created_at < ((v_to + 1)::timestamp at time zone 'UTC')
  ),
  paid_items as materialized (
    select oi.order_id, oi.product_id, oi.product_name, oi.quantity, oi.subtotal,
      p.category_id, c.name as category_name
    from selected_orders o
    join public.order_items oi on oi.order_id = o.id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
    where o.status <> 'cancelled' and o.payment_status = 'paid'
  ),
  product_sales as (
    select product_id, case when product_id is null then product_name end as deleted_name,
      min(product_name) as name, sum(quantity) as quantity, sum(subtotal) as revenue
    from paid_items group by product_id, case when product_id is null then product_name end
  ),
  category_sales as (
    select category_id, coalesce(category_name, 'Категорія невідома') as name,
      sum(quantity) as quantity, sum(subtotal) as revenue, count(distinct order_id) as orders
    from paid_items group by category_id, category_name
  ),
  timeline as (
    select date_trunc(p_bucket, created_at at time zone 'UTC')::date as bucket,
      count(*) as orders,
      coalesce(sum(total_amount) filter (where status <> 'cancelled' and payment_status = 'paid'), 0) as revenue
    from selected_orders group by 1
  ),
  timeline_full as (
    select buckets.bucket::date as bucket, coalesce(t.orders, 0) as orders,
      coalesce(t.revenue, 0) as revenue
    from pg_catalog.generate_series(
      date_trunc(p_bucket, v_from::timestamp), date_trunc(p_bucket, v_to::timestamp),
      case p_bucket when 'day' then interval '1 day' when 'week' then interval '1 week' else interval '1 month' end
    ) as buckets(bucket)
    left join timeline t on t.bucket = buckets.bucket::date
  ),
  customer_sales as (
    select p.id, coalesce(nullif(p.full_name, ''), 'Без імені') as name,
      count(*) as orders, sum(o.total_amount) as revenue
    from selected_orders o join public.profiles p on p.id = o.user_id
    where p.role = 'customer' and o.status <> 'cancelled'
    group by p.id, p.full_name
  ),
  least_products as (
    select p.id, p.name, coalesce(s.quantity, 0) as quantity, coalesce(s.revenue, 0) as revenue
    from public.products p left join product_sales s on s.product_id = p.id
    where p.is_active and p.currency = v_currency
  )
  select jsonb_build_object(
    'from', v_from, 'to', v_to, 'currency', v_currency, 'bucket', p_bucket,
    'threshold', v_threshold,
    'orders', (select count(*) from selected_orders),
    'completed', (select count(*) from selected_orders where status = 'completed'),
    'cancelled', (select count(*) from selected_orders where status = 'cancelled'),
    'gross', (select coalesce(sum(total_amount), 0) from selected_orders where status <> 'cancelled'),
    'paid', (select coalesce(sum(total_amount), 0) from selected_orders where status <> 'cancelled' and payment_status = 'paid'),
    'unpaid', (select coalesce(sum(total_amount), 0) from selected_orders where status <> 'cancelled' and payment_status in ('pending', 'failed')),
    'average', (select coalesce(avg(total_amount), 0) from selected_orders where status <> 'cancelled'),
    'customers', (select count(*) from public.profiles where role = 'customer'),
    'new_customers', (select count(*) from public.profiles where role = 'customer'
      and created_at >= (v_from::timestamp at time zone 'UTC') and created_at < ((v_to + 1)::timestamp at time zone 'UTC')),
    'repeat_customers', (select count(*) from (
      select o.user_id from selected_orders o join public.profiles p on p.id = o.user_id
      where p.role = 'customer' and o.status <> 'cancelled'
      group by o.user_id having count(*) >= 2
    ) r),
    'timeline', coalesce((select jsonb_agg(to_jsonb(t) order by t.bucket) from timeline_full t), '[]'::jsonb),
    'statuses', coalesce((select jsonb_agg(to_jsonb(t) order by t.status) from (
      select status, count(*) as count from selected_orders group by status
    ) t), '[]'::jsonb),
    'best_products', coalesce((select jsonb_agg(to_jsonb(t) order by t.quantity desc, t.name, t.product_id) from (
      select product_id, name, quantity, revenue from product_sales order by quantity desc, name, product_id limit 21 offset p_offset
    ) t), '[]'::jsonb),
    'revenue_products', coalesce((select jsonb_agg(to_jsonb(t) order by t.revenue desc, t.name, t.product_id) from (
      select product_id, name, quantity, revenue from product_sales order by revenue desc, name, product_id limit 21 offset p_offset
    ) t), '[]'::jsonb),
    'least_products', coalesce((select jsonb_agg(to_jsonb(t) order by t.quantity, t.name, t.id) from (
      select * from least_products order by quantity, name, id limit 21 offset p_offset
    ) t), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(t) order by t.quantity desc, t.name, t.category_id) from (
      select * from category_sales order by quantity desc, name, category_id limit 21 offset p_offset
    ) t), '[]'::jsonb),
    'top_customers', coalesce((select jsonb_agg(to_jsonb(t) order by t.revenue desc, t.name, t.id) from (
      select * from customer_sales order by revenue desc, name, id limit 21 offset p_offset
    ) t), '[]'::jsonb),
    'low_stock', coalesce((select jsonb_agg(to_jsonb(t) order by t.stock_quantity, t.name, t.id) from (
      select id, name, stock_quantity from public.products
      where is_active and currency = v_currency and stock_quantity > 0 and stock_quantity <= v_threshold
      order by stock_quantity, name, id limit 21 offset p_offset
    ) t), '[]'::jsonb),
    'out_of_stock', coalesce((select jsonb_agg(to_jsonb(t) order by t.name, t.id) from (
      select id, name, stock_quantity from public.products
      where is_active and currency = v_currency and stock_quantity = 0 order by name, id limit 21 offset p_offset
    ) t), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.admin_ecommerce_analytics(text, date, date, text, text, integer) from public, anon, authenticated;
grant execute on function public.admin_ecommerce_analytics(text, date, date, text, text, integer) to authenticated;
