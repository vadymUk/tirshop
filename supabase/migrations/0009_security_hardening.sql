-- 0009: security hardening.
--  * place_order locks the caller's cart rows (closes the cart-delete vs checkout race)
--  * place_order always uses the verified account email (the order email was client-controlled,
--    which let any signed-in user make the shop send mail to arbitrary addresses)
--  * place_order rejects bursts of orders from one account (abuse / stock-lock protection)
--  * enforce_cart_stock no longer relies on the caller's search_path

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
  v_order_id   uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Orders are confirmed to the verified account email; the submitted address is only a fallback.
  select email into v_email from auth.users where id = v_user;
  v_email := coalesce(nullif(v_email, ''), p_customer_email);

  if (select count(*) from public.orders
      where user_id = v_user and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- Serialize with every cart write: lock the caller's cart rows first, then the products
  -- (always in this order), so a concurrent cart change cannot slip between the checks,
  -- the snapshot and the stock decrement.
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

revoke all on function public.place_order(text, text, text, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.place_order(text, text, text, text, text, text, text, text, text)
  to authenticated;

alter function public.enforce_cart_stock() set search_path = '';
