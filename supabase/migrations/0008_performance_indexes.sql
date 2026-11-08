-- Performance indexes for catalog listing, search and per-user lists.
-- All statements are idempotent.

-- Catalog listing: partial indexes on active rows cover each sort order (+ id tiebreaker).
create index if not exists products_active_created_idx
  on public.products (created_at desc, id) where is_active;
create index if not exists products_active_price_asc_idx
  on public.products (price, id) where is_active;
create index if not exists products_active_price_desc_idx
  on public.products (price desc, id) where is_active;
create index if not exists products_active_name_idx
  on public.products (name, id) where is_active;

-- Category pages and related products: filter by category, newest first.
create index if not exists products_active_category_created_idx
  on public.products (category_id, created_at desc, id) where is_active;

-- Free-text search (ilike '%word%') on name / short_description / description.
create extension if not exists pg_trgm with schema extensions;
create index if not exists products_name_trgm_idx
  on public.products using gin (name extensions.gin_trgm_ops);
create index if not exists products_short_description_trgm_idx
  on public.products using gin (short_description extensions.gin_trgm_ops);
create index if not exists products_description_trgm_idx
  on public.products using gin (description extensions.gin_trgm_ops);

-- Per-user lists, newest first.
create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created_at desc);
create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

-- Redundant: already covered by the primary key / unique constraint with user_id first.
drop index if exists public.favorites_user_id_idx;
drop index if exists public.cart_items_user_id_idx;
drop index if exists public.orders_user_id_idx;
