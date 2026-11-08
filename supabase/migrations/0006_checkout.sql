-- 0006: checkout / order system.
--  * order_status: 'delivered' becomes 'completed'
--  * orders.order_number: short, human-readable, sequential number
--  * payments: provider-agnostic payment attempts (Stripe/PayPal/... later, no orders rewrite)
--  * place_order(): now takes the customer email entered at checkout and uses stable error tokens

-- order status ------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'order_status' and e.enumlabel = 'delivered'
  ) then
    alter type public.order_status rename value 'delivered' to 'completed';
  end if;
end;
$$;

-- order number ------------------------------------------------------------------
alter table public.orders
  add column if not exists order_number bigint generated always as identity (start with 1000);

create unique index if not exists orders_order_number_key on public.orders (order_number);

alter table public.orders
  drop constraint if exists orders_apartment_length;
alter table public.orders
  add constraint orders_apartment_length
  check (apartment is null or char_length(apartment) <= 50);

-- payments ----------------------------------------------------------------------
-- orders.payment_status stays the single "is it paid?" flag the shop reads. A payment
-- provider integration records its attempts here and (server-side, with the service
-- role, e.g. from a webhook) moves orders.payment_status accordingly.
create table if not exists public.payments (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders (id) on delete cascade,
  provider              text not null check (char_length(provider) between 2 and 50),
  provider_payment_id   text,
  amount                numeric(12, 2) not null check (amount > 0),
  currency              varchar(3) not null check (currency ~ '^[A-Z]{3}$'),
  status                public.payment_status not null default 'pending',
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists payments_order_id_idx on public.payments (order_id);
create unique index if not exists payments_provider_payment_key
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

drop trigger if exists set_updated_at on public.payments;
create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

drop policy if exists "Users read payments of own orders" on public.payments;
create policy "Users read payments of own orders"
  on public.payments for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id and o.user_id = (select auth.uid())
    )
  );

-- place_order ---------------------------------------------------------------------
-- The only way for a user to create an order. Prices, names and totals are read from
-- the database (never from the client), stock is locked and decremented, and the cart
-- is cleared, all in a single transaction. Errors use stable tokens the app maps.
drop function if exists public.place_order(text, text, text, text, text, text, text, text);

create function public.place_order(
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
  v_count      integer;
  v_currency   text;
  v_currencies integer;
  v_total      numeric(12, 2);
  v_order_id   uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

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
    v_user, p_customer_name, p_customer_email, p_customer_phone, p_country, p_city,
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
