-- Aggregate dashboard data in PostgreSQL without exposing it to customers.
-- Periods use UTC calendar days and include both selected dates.
create index if not exists profiles_customer_created_idx
  on public.profiles (created_at desc, id) where role = 'customer';
create index if not exists products_updated_admin_idx
  on public.products (updated_at desc, id);
create index if not exists products_low_stock_admin_idx
  on public.products (stock_quantity, name, id) where is_active;

create or replace function public.admin_dashboard_overview(
  p_period text default 'last_30_days',
  p_from date default null,
  p_to date default null
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
  v_result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  case p_period
    when 'today' then v_from := v_today; v_to := v_today;
    when 'yesterday' then v_from := v_today - 1; v_to := v_today - 1;
    when 'last_7_days' then v_from := v_today - 6; v_to := v_today;
    when 'last_30_days' then v_from := v_today - 29; v_to := v_today;
    when 'this_month' then v_from := date_trunc('month', v_today::timestamp)::date; v_to := v_today;
    when 'this_year' then v_from := date_trunc('year', v_today::timestamp)::date; v_to := v_today;
    when 'custom' then v_from := p_from; v_to := p_to;
    else raise exception 'invalid_period' using errcode = '22023';
  end case;
  if v_from is null or v_to is null or not isfinite(v_from) or not isfinite(v_to)
     or v_from < date '0001-01-01' or v_to > date '9998-12-31'
     or v_from > v_to or v_to - v_from > 730 then
    raise exception 'invalid_date_range' using errcode = '22023';
  end if;

  with selected_orders as materialized (
    select id, status, payment_status, total_amount, currency, created_at
    from public.orders
    where created_at >= (v_from::timestamp at time zone 'UTC')
      and created_at < ((v_to + 1)::timestamp at time zone 'UTC')
  ),
  paid_items as materialized (
    select oi.product_id, oi.product_name, oi.quantity, oi.subtotal,
           o.currency, p.category_id, c.name as category_name
    from selected_orders o
    join public.order_items oi on oi.order_id = o.id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
    where o.status <> 'cancelled' and o.payment_status = 'paid'
  ),
  money as (
    select currency,
      sum(total_amount) as order_value,
      sum(total_amount) filter (where status <> 'cancelled' and payment_status = 'paid') as paid_revenue,
      sum(total_amount) filter (where status <> 'cancelled' and payment_status = 'pending') as pending_value,
      sum(total_amount) filter (where status = 'cancelled') as cancelled_value
    from selected_orders group by currency
  ),
  daily_orders as (
    select (created_at at time zone 'UTC')::date as day, count(*) as count
    from selected_orders group by 1
  ),
  daily_revenue as (
    select (created_at at time zone 'UTC')::date as day, currency, sum(total_amount) as amount
    from selected_orders
    where status <> 'cancelled' and payment_status = 'paid'
    group by 1, currency
  ),
  status_counts as (
    select status, count(*) as count from selected_orders group by status
  ),
  top_products as (
    select product_id, min(product_name) as product_name, sum(quantity) as quantity, currency, sum(subtotal) as revenue
    from paid_items
    group by product_id, case when product_id is null then product_name end, currency
    order by sum(quantity) desc, min(product_name), currency
    limit 10
  ),
  top_categories as (
    select category_id, coalesce(category_name, 'Категорія невідома') as name,
      currency, sum(quantity) as quantity, sum(subtotal) as revenue
    from paid_items
    group by category_id, category_name, currency
    order by sum(quantity) desc, coalesce(category_name, 'Категорія невідома'), currency
    limit 10
  )
  select jsonb_build_object(
    'from', v_from, 'to', v_to,
    'products', (select count(*) from public.products),
    'active_products', (select count(*) from public.products where is_active),
    'out_of_stock', (select count(*) from public.products where stock_quantity = 0),
    'categories', (select count(*) from public.categories),
    'customers', (select count(*) from public.profiles where role = 'customer'),
    'orders', (select count(*) from selected_orders),
    'pending_orders', (select count(*) from selected_orders where status = 'pending'),
    'completed_orders', (select count(*) from selected_orders where status = 'completed'),
    'cancelled_orders', (select count(*) from selected_orders where status = 'cancelled'),
    'money', coalesce((select jsonb_agg(jsonb_build_object(
      'currency', currency, 'order_value', order_value, 'paid_revenue', coalesce(paid_revenue, 0),
      'pending_value', coalesce(pending_value, 0), 'cancelled_value', coalesce(cancelled_value, 0)
    ) order by currency) from money), '[]'::jsonb),
    'daily_orders', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'count', count) order by day) from daily_orders), '[]'::jsonb),
    'daily_revenue', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'currency', currency, 'amount', amount) order by day, currency) from daily_revenue), '[]'::jsonb),
    'statuses', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'count', count) order by status) from status_counts), '[]'::jsonb),
    'top_products', coalesce((select jsonb_agg(to_jsonb(t) order by t.quantity desc, t.product_name, t.currency) from top_products t), '[]'::jsonb),
    'top_categories', coalesce((select jsonb_agg(to_jsonb(t) order by t.quantity desc, t.name, t.currency) from top_categories t), '[]'::jsonb),
    'recent_orders', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc, t.id) from (
      select id, order_number, customer_name, status, payment_status, total_amount, currency, created_at
      from public.orders order by created_at desc, id limit 5
    ) t), '[]'::jsonb),
    'recent_customers', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc, t.id) from (
      select id, full_name, phone, created_at from public.profiles
      where role = 'customer' order by created_at desc, id limit 5
    ) t), '[]'::jsonb),
    'low_stock', coalesce((select jsonb_agg(to_jsonb(t) order by t.stock_quantity, t.name, t.id) from (
      select id, name, stock_quantity from public.products
      where is_active and stock_quantity <= 5 order by stock_quantity, name, id limit 5
    ) t), '[]'::jsonb),
    'recent_products', coalesce((select jsonb_agg(to_jsonb(t) order by t.updated_at desc, t.id) from (
      select id, name, updated_at from public.products order by updated_at desc, id limit 5
    ) t), '[]'::jsonb),
    'recent_activity', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc, t.id) from (
      select id, action, entity_type, admin_user_id, created_at
      from public.admin_activity_logs order by created_at desc, id limit 5
    ) t), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.admin_dashboard_overview(text, date, date) from public, anon, authenticated;
grant execute on function public.admin_dashboard_overview(text, date, date) to authenticated;

-- Access rollback: REVOKE EXECUTE ON FUNCTION public.admin_dashboard_overview(text,date,date)
-- FROM authenticated; keep the indexes unless their removal has been reviewed.
