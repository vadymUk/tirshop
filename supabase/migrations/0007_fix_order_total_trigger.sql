-- Fix: assert_order_total referenced NEW.order_id inside a CASE, which PL/pgSQL
-- rejects when the trigger fires on public.orders (that table has no order_id).
-- Branch with IF so each table only touches its own columns.
create or replace function public.assert_order_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_total    numeric(12, 2);
  v_sum      numeric(12, 2);
begin
  if tg_table_name = 'orders' then
    v_order_id := new.id;
  elsif tg_op = 'DELETE' then
    v_order_id := old.order_id;
  else
    v_order_id := new.order_id;
  end if;

  select total_amount into v_total from public.orders where id = v_order_id;
  if not found then
    return null; -- order was deleted (cascade)
  end if;

  select coalesce(sum(subtotal), 0) into v_sum
  from public.order_items where order_id = v_order_id;

  if v_sum <> v_total then
    raise exception 'Order % total (%) does not match items sum (%)',
      v_order_id, v_total, v_sum using errcode = '23514';
  end if;
  return null;
end;
$$;
