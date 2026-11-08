-- 0001: tables, constraints, indexes.
-- Pre-release cleanup: removes the earlier prototype tables (no production data existed).
drop table if exists public.products cascade;
drop table if exists public.categories cascade;

create type public.order_status as enum (
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
);
create type public.payment_status as enum (
  'pending', 'paid', 'failed', 'refunded'
);

-- profiles ------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) <= 200),
  phone       text check (phone is null or char_length(phone) <= 30),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- categories ----------------------------------------------------------------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 120),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  text,
  image_url    text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- products ------------------------------------------------------------------
create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid not null references public.categories (id) on delete restrict,
  name               text not null check (char_length(name) between 1 and 200),
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description  text,
  description        text,
  price              numeric(12, 2) not null check (price > 0),
  currency           varchar(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  stock_quantity     integer not null default 0 check (stock_quantity >= 0),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- product_images ------------------------------------------------------------
create table public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  storage_path  text not null,
  alt_text      text,
  sort_order    integer not null default 0 check (sort_order >= 0),
  created_at    timestamptz not null default now()
);

-- favorites -----------------------------------------------------------------
create table public.favorites (
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- cart_items ----------------------------------------------------------------
create table public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  quantity    integer not null check (quantity > 0 and quantity <= 99),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, product_id)
);

-- orders --------------------------------------------------------------------
-- user_id is SET NULL on user deletion: order history must outlive the account.
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users (id) on delete set null,
  status          public.order_status not null default 'pending',
  payment_status  public.payment_status not null default 'pending',
  customer_name   text not null check (char_length(customer_name) between 2 and 200),
  customer_email  text not null check (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  customer_phone  text not null check (char_length(customer_phone) between 6 and 30),
  country         text not null check (char_length(country) between 2 and 100),
  city            text not null check (char_length(city) between 1 and 120),
  postal_code     text not null check (char_length(postal_code) between 2 and 20),
  address         text not null check (char_length(address) between 3 and 300),
  apartment       text,
  notes           text check (notes is null or char_length(notes) <= 1000),
  total_amount    numeric(12, 2) not null check (total_amount > 0),
  currency        varchar(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- order_items: snapshot of product data at purchase time -----------------------
create table public.order_items (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete cascade,
  product_id           uuid references public.products (id) on delete set null,
  product_name         text not null,
  product_description  text not null default '',
  unit_price           numeric(12, 2) not null check (unit_price > 0),
  quantity             integer not null check (quantity > 0),
  subtotal             numeric(12, 2) not null,
  created_at           timestamptz not null default now(),
  constraint order_items_subtotal_matches check (subtotal = unit_price * quantity)
);

-- indexes ---------------------------------------------------------------------
-- slug columns are already indexed by their UNIQUE constraints.
create index products_category_id_idx    on public.products (category_id);
create index products_is_active_idx      on public.products (is_active);
create index categories_is_active_idx    on public.categories (is_active);
create index product_images_product_idx  on public.product_images (product_id, sort_order);
create index favorites_user_id_idx       on public.favorites (user_id);
create index favorites_product_id_idx    on public.favorites (product_id);
create index cart_items_user_id_idx      on public.cart_items (user_id);
create index cart_items_product_id_idx   on public.cart_items (product_id);
create index orders_user_id_idx          on public.orders (user_id);
create index orders_created_at_idx       on public.orders (created_at desc);
create index order_items_order_id_idx    on public.order_items (order_id);
create index order_items_product_id_idx  on public.order_items (product_id);
