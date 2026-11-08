-- Cart stock enforcement + atomic add_to_cart RPC.
-- Direct INSERT/UPDATE on cart_items is allowed for the owner by RLS, so the stock limit
-- must live in the database: a trigger rejects any quantity above available stock.

create or replace function public.enforce_cart_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_active boolean;
begin
  select stock_quantity, is_active into v_stock, v_active
  from public.products
  where id = new.product_id;

  if not found or not v_active then
    raise exception 'product_unavailable' using errcode = 'P0001';
  end if;

  if new.quantity > v_stock then
    raise exception 'insufficient_stock' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_cart_stock() from public, anon, authenticated;

drop trigger if exists cart_items_enforce_stock on public.cart_items;
create trigger cart_items_enforce_stock
  before insert or update of quantity, product_id on public.cart_items
  for each row execute function public.enforce_cart_stock();

-- Adds p_quantity to the caller's cart line (creating it if needed).
-- SECURITY INVOKER: RLS still applies, so a user can only touch their own cart.
create or replace function public.add_to_cart(p_product_id uuid, p_quantity integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quantity integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'invalid_quantity' using errcode = 'P0001';
  end if;

  insert into public.cart_items (user_id, product_id, quantity)
  values (auth.uid(), p_product_id, p_quantity)
  on conflict (user_id, product_id)
  do update set quantity = public.cart_items.quantity + excluded.quantity
  returning quantity into v_quantity;

  return v_quantity;
end;
$$;

revoke all on function public.add_to_cart(uuid, integer) from public, anon;
grant execute on function public.add_to_cart(uuid, integer) to authenticated;
