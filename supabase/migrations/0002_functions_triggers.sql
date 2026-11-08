-- 0002: triggers and the place_order function.

-- updated_at ------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- profile auto-creation ---------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- order total integrity ---------------------------------------------------------
-- orders.total_amount must equal the sum of its items' subtotals. Checked at
-- commit (deferred) so the order and its items can be inserted in any order.
create function public.assert_order_total()
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
  v_order_id := case when tg_table_name = 'orders' then
                  coalesce(new.id, old.id)
                else
                  coalesce(new.order_id, old.order_id)
                end;

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

create constraint trigger orders_total_check
  after insert or update of total_amount on public.orders
  deferrable initially deferred
  for each row execute function public.assert_order_total();

create constraint trigger order_items_total_check
  after insert or update or delete on public.order_items
  deferrable initially deferred
  for each row execute function public.assert_order_total();

-- place_order -------------------------------------------------------------------
-- The only way for a user to create an order. Prices, names and totals are read
-- from the database, never from the client, stock is locked and decremented, and
-- the cart is cleared, all in one transaction.
create function public.place_order(
  p_customer_name  text,
  p_customer_phone text,
  p_country        text,
  p_city           text,
  p_postal_code    text,
  p_address        text,
  p_apartment      text default null,
  p_notes          text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_email     text;
  v_count     integer;
  v_currency  text;
  v_currencies integer;
  v_total     numeric(12, 2);
  v_order_id  uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = v_user;

  -- Lock the affected products to serialize concurrent stock updates.
  perform 1
  from public.products p
  join public.cart_items c on c.product_id = p.id
  where c.user_id = v_user
  order by p.id
  for update of p;

  select count(*), count(distinct p.currency), min(p.currency), sum(p.price * c.quantity)
    into v_count, v_currencies, v_currency, v_total
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.user_id = v_user;

  if v_count = 0 then
    raise exception 'Cart is empty' using errcode = 'P0001';
  end if;
  if v_currencies > 1 then
    raise exception 'Cart contains mixed currencies' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.cart_items c
    join public.products p on p.id = c.product_id
    where c.user_id = v_user
      and (not p.is_active or p.stock_quantity < c.quantity)
  ) then
    raise exception 'Some items are unavailable or out of stock' using errcode = 'P0001';
  end if;

  insert into public.orders (
    user_id, customer_name, customer_email, customer_phone, country, city,
    postal_code, address, apartment, notes, total_amount, currency
  ) values (
    v_user, p_customer_name, v_email, p_customer_phone, p_country, p_city,
    p_postal_code, p_address, nullif(p_apartment, ''), nullif(p_notes, ''),
    v_total, v_currency
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, product_description,
    unit_price, quantity, subtotal
  )
  select v_order_id, p.id, p.name,
         coalesce(p.short_description, p.description, ''),
         p.price, c.quantity, p.price * c.quantity
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.user_id = v_user;

  update public.products p
  set stock_quantity = p.stock_quantity - c.quantity
  from public.cart_items c
  where c.product_id = p.id and c.user_id = v_user;

  delete from public.cart_items where user_id = v_user;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.place_order(text, text, text, text, text, text, text, text) to authenticated;
