-- 0003: privileges, Row Level Security and storage policies.
-- Defense in depth: table GRANTs (what a role may do at all, down to columns)
-- plus RLS policies (which rows). Product/category writes are never granted to
-- anon/authenticated; they are done with the service role on the server or in
-- the Supabase dashboard.

alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.favorites      enable row level security;
alter table public.cart_items     enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

revoke all on public.profiles, public.categories, public.products,
  public.product_images, public.favorites, public.cart_items,
  public.orders, public.order_items from anon, authenticated;

-- catalog: read-only for everyone
grant select on public.categories, public.products, public.product_images
  to anon, authenticated;

-- authenticated user data
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

grant select, delete on public.favorites to authenticated;
grant insert (user_id, product_id) on public.favorites to authenticated;

grant select, delete on public.cart_items to authenticated;
grant insert (user_id, product_id, quantity) on public.cart_items to authenticated;
grant update (quantity) on public.cart_items to authenticated;

-- orders are created only through public.place_order()
grant select on public.orders, public.order_items to authenticated;

-- catalog policies -------------------------------------------------------------
create policy "Active categories are public"
  on public.categories for select to anon, authenticated
  using (is_active);

create policy "Active products are public"
  on public.products for select to anon, authenticated
  using (is_active);

create policy "Images of active products are public"
  on public.product_images for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.is_active
  ));

-- profiles ---------------------------------------------------------------------
create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- favorites --------------------------------------------------------------------
create policy "Users read own favorites"
  on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add own favorites"
  on public.favorites for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

create policy "Users delete own favorites"
  on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

-- cart -------------------------------------------------------------------------
create policy "Users read own cart"
  on public.cart_items for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add to own cart"
  on public.cart_items for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

create policy "Users update own cart"
  on public.cart_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete own cart items"
  on public.cart_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- orders -----------------------------------------------------------------------
create policy "Users read own orders"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users read items of own orders"
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = (select auth.uid())
  ));

-- storage: public bucket for product images, read-only for clients --------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Product images are publicly readable"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
