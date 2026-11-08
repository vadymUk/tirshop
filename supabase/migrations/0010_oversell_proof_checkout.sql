-- 0010: oversell-proof checkout.
-- place_order is one transaction (a PL/pgSQL function body is atomic: any exception rolls
-- back the order, its items, the stock change and the cart deletion together).
--
-- Concurrency strategy
--   1. Lock the caller's cart rows (FOR UPDATE, ordered by id): serializes checkout with the
--      same user's cart writes and with a double-submitted checkout.
--   2. Lock the affected products (FOR UPDATE, ordered by id): two buyers of the same product
--      queue here. Consistent ordering (cart rows, then products by id) prevents deadlocks.
--      The second buyer waits, then re-reads the committed stock, so it sees 0 and fails.
--   3. Validate stock/active/currency and compute totals from the locked rows only.
--   4. Decrement with a guarded UPDATE (stock_quantity >= quantity) and verify every cart line
--      was updated; otherwise raise items_unavailable. The CHECK (stock_quantity >= 0)
--      constraint remains as a last line of defence.

create or replace function public.place_order(
  p_customer_name  text,
  p_customer_email text,
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
  v_user       uuid := auth.uid();
  v_email      text;
  v_count      integer;
  v_currency   text;
  v_currencies integer;
  v_total      numeric(12, 2);
  v_updated    integer;
  v_order_id   uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = v_user;
  v_email := coalesce(nullif(v_email, ''), p_customer_email);

  if (select count(*) from public.orders
      where user_id = v_user and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- 1. cart rows, 2. products: fixed lock order.
  perform 1
  from public.cart_items c
  where c.user_id = v_user
  order by c.id
  for update;

  perform 1
  from public.products p
  join public.cart_items c on c.product_id = p.id
  where c.user_id = v_user
  order by p.id
  for update of p;

  -- 3. everything below reads the locked, current rows.
  select count(*), count(distinct p.currency), min(p.currency), sum(p.price * c.quantity)
    into v_count, v_currencies, v_currency, v_total
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.user_id = v_user;

  if v_count = 0 then
    raise exception 'cart_empty' using errcode = 'P0001';
  end if;
  if v_currencies > 1 then
    raise exception 'mixed_currencies' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.cart_items c
    join public.products p on p.id = c.product_id
    where c.user_id = v_user
      and (not p.is_active or p.stock_quantity < c.quantity)
  ) then
    raise exception 'items_unavailable' using errcode = 'P0001';
  end if;

  -- 4. guarded decrement first: if it cannot cover every line, nothing is created.
  update public.products p
  set stock_quantity = p.stock_quantity - c.quantity
  from public.cart_items c
  where c.product_id = p.id
    and c.user_id = v_user
    and p.is_active
    and p.stock_quantity >= c.quantity;

  get diagnostics v_updated = row_count;
  if v_updated <> v_count then
    raise exception 'items_unavailable' using errcode = 'P0001';
  end if;

  insert into public.orders (
    user_id, customer_name, customer_email, customer_phone, country, city,
    postal_code, address, apartment, notes, total_amount, currency
  ) values (
    v_user, p_customer_name, v_email, p_customer_phone, p_country, p_city,
    p_postal_code, p_address, nullif(p_apartment, ''), nullif(p_notes, ''),
    v_total, v_currency
  ) returning id into v_order_id;

  -- Prices are the same locked rows used for v_total (price cannot change mid-transaction
  -- for a row we hold FOR UPDATE), so the deferred total check always holds.
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

  delete from public.cart_items where user_id = v_user;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(text, text, text, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.place_order(text, text, text, text, text, text, text, text, text)
  to authenticated;
