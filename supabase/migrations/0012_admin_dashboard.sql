-- 0012: additive schema for the admin dashboard.
--
-- Existing commerce tables are extended in place; no existing rows are deleted.
-- Public reads remain limited to active/published website content. All management
-- writes are restricted by RLS to active administrators, except profile privilege
-- fields, which are writable only by trusted SQL or the service role.
--
-- Rollback: this migration is intentionally forward-only in production. Disable the
-- admin application and revoke its grants/policies if rollback is needed. Do not drop
-- these tables or columns without a reviewed backup/retention plan: they may contain
-- settings, content, and audit history. Restore a pre-migration backup only if a
-- destructive schema rollback is explicitly approved.

do $$
begin
  create type public.admin_role as enum ('customer', 'admin');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.homepage_section_type as enum (
    'hero',
    'promotional',
    'featured_categories',
    'featured_products',
    'benefits',
    'testimonials',
    'contact'
  );
exception
  when duplicate_object then null;
end;
$$;

-- Earlier versions of this migration returned void from these RPCs. PostgreSQL
-- cannot change a function's return type with CREATE OR REPLACE. Remove only
-- those known legacy signatures; dependent objects must be reviewed, not cascaded.
do $$
declare
  v_signature text;
  v_function regprocedure;
begin
  foreach v_signature in array array[
    'public.record_admin_activity(text,text,uuid,text,jsonb,inet)',
    'public.admin_set_product_stock(uuid,integer,text)',
    'public.admin_update_order_status(uuid,public.order_status,text)'
  ] loop
    v_function := to_regprocedure(v_signature);
    if v_function is not null and exists (
      select 1 from pg_catalog.pg_proc
      where oid = v_function and prorettype = 'pg_catalog.void'::regtype
    ) then
      execute format('drop function %s', v_function);
    end if;
  end loop;
end;
$$;

-- Profiles ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists role public.admin_role not null default 'customer',
  add column if not exists is_active boolean not null default true;

-- Do not expose administrative flags through customer profile reads. Admin access
-- checks go through is_active_admin(); ordinary profile reads use only these fields.
revoke select on public.profiles from authenticated;
grant select (id, full_name, phone, created_at, updated_at)
  on public.profiles to authenticated;

-- Keep privilege fields protected even if broader profile update grants are added
-- later. The service-role API and trusted migrations remain the only writers.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin')
  then
    raise exception 'profile privilege fields may only be changed by trusted administration'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update of role, is_active on public.profiles
  for each row execute function public.protect_profile_privileges();

revoke all on function public.protect_profile_privileges() from public, anon, authenticated;
revoke update (role, is_active) on public.profiles from anon, authenticated;

-- Fixed-search-path helper avoids recursive profile RLS checks in admin policies.
create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'::public.admin_role
      and p.is_active
  );
$$;

revoke all on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated, service_role;

create table if not exists public.admin_action_rate_limits (
  admin_user_id uuid not null references public.profiles (id) on delete cascade,
  action        text not null check (char_length(action) between 1 and 100),
  window_start  timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (admin_user_id, action)
);

alter table public.admin_action_rate_limits enable row level security;
revoke all on public.admin_action_rate_limits from public, anon, authenticated;

create or replace function public.consume_admin_rate_limit(
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_window_start timestamptz;
  v_request_count integer;
begin
  if not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_action is null or char_length(btrim(p_action)) not between 1 and 100
     or p_limit is null or p_limit < 1 or p_limit > 1000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400
  then
    raise exception 'invalid_rate_limit' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.admin_action_rate_limits (
    admin_user_id, action, window_start, request_count
  )
  values (v_admin_id, btrim(p_action), v_window_start, 1)
  on conflict (admin_user_id, action) do update
  set request_count = case
        when admin_action_rate_limits.window_start < excluded.window_start then 1
        else admin_action_rate_limits.request_count + 1
      end,
      window_start = greatest(
        admin_action_rate_limits.window_start,
        excluded.window_start
      )
  returning request_count into v_request_count;

  return v_request_count <= p_limit;
end;
$$;

revoke all on function public.consume_admin_rate_limit(text, integer, integer)
  from public, anon, authenticated;

-- Site settings ----------------------------------------------------------------
create table if not exists public.site_settings (
  id                    uuid primary key default gen_random_uuid(),
  singleton             boolean not null default true unique check (singleton),
  store_name            text not null default 'Truck Shop'
                          check (char_length(store_name) between 1 and 200),
  store_description     text,
  logo_path             text,
  favicon_path          text,
  contact_email         text,
  contact_phone         text,
  whatsapp_number       text,
  viber_number          text,
  telegram_username     text,
  business_address      text,
  currency              varchar(3) not null default 'EUR'
                          check (currency ~ '^[A-Z]{3}$'),
  default_language      text not null default 'uk'
                          check (default_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  timezone              text not null default 'Europe/Warsaw',
  facebook_url          text,
  instagram_url         text,
  tiktok_url            text,
  youtube_url           text,
  announcement_text     text,
  announcement_enabled  boolean not null default false,
  maintenance_mode      boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

insert into public.site_settings (store_name)
values ('Truck Shop')
on conflict (singleton) do nothing;

create or replace function public.get_admin_site_settings()
returns setof public.site_settings
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  return query select s.* from public.site_settings s where s.singleton;
end;
$$;

revoke all on function public.get_admin_site_settings() from public, anon;
grant execute on function public.get_admin_site_settings() to authenticated;

-- Pages ------------------------------------------------------------------------
create table if not exists public.pages (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(title) between 1 and 200),
  slug                text not null unique
                        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  content             text not null default '',
  excerpt             text,
  featured_image_path text,
  meta_title          text,
  meta_description    text,
  canonical_url       text,
  og_image_path       text,
  is_published        boolean not null default false,
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint pages_meta_title_length
    check (meta_title is null or char_length(meta_title) <= 200),
  constraint pages_meta_description_length
    check (meta_description is null or char_length(meta_description) <= 500),
  constraint pages_canonical_url_length
    check (canonical_url is null or char_length(canonical_url) <= 2048)
);

create index if not exists pages_published_idx
  on public.pages (published_at desc, slug)
  where is_published;

-- Homepage sections ------------------------------------------------------------
create table if not exists public.homepage_sections (
  id           uuid primary key default gen_random_uuid(),
  section_key  text not null unique
                 check (section_key ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'),
  title        text,
  subtitle     text,
  content      text,
  section_type public.homepage_section_type not null,
  settings     jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(settings) = 'object'),
  sort_order   integer not null default 0 check (sort_order >= 0),
  is_visible   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists homepage_sections_visible_order_idx
  on public.homepage_sections (sort_order, section_key)
  where is_visible;

-- Banners ----------------------------------------------------------------------
create table if not exists public.banners (
  id                uuid primary key default gen_random_uuid(),
  title             text not null check (char_length(title) between 1 and 200),
  subtitle          text,
  image_path        text not null,
  mobile_image_path text,
  button_text       text,
  button_url        text,
  position          text not null default 'hero'
                      check (char_length(position) between 1 and 50),
  sort_order        integer not null default 0 check (sort_order >= 0),
  is_active         boolean not null default false,
  starts_at         timestamptz,
  ends_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint banners_schedule_valid
    check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists banners_active_position_order_idx
  on public.banners (position, sort_order, starts_at, ends_at)
  where is_active;

-- Administrator activity -------------------------------------------------------
create table if not exists public.admin_activity_logs (
  id            uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.profiles (id) on delete set null,
  action        text not null check (char_length(action) between 1 and 100),
  entity_type   text not null check (char_length(entity_type) between 1 and 100),
  entity_id     uuid,
  description   text,
  metadata      jsonb not null default '{}'::jsonb
                  check (jsonb_typeof(metadata) = 'object'),
  ip_address    inet,
  created_at    timestamptz not null default now()
);

create index if not exists admin_activity_logs_created_idx
  on public.admin_activity_logs (created_at desc);
create index if not exists admin_activity_logs_admin_created_idx
  on public.admin_activity_logs (admin_user_id, created_at desc);
create index if not exists admin_activity_logs_entity_created_idx
  on public.admin_activity_logs (entity_type, entity_id, created_at desc);

create or replace function public.record_admin_activity(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_ip_address inet default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if not public.consume_admin_rate_limit('activity_log', 120, 60) then
    return false;
  end if;
  if p_action is null or char_length(btrim(p_action)) not between 1 and 100
     or p_entity_type is null or char_length(btrim(p_entity_type)) not between 1 and 100
     or (p_description is not null and char_length(p_description) > 1000)
     or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
  then
    raise exception 'invalid_activity_log' using errcode = '22023';
  end if;

  insert into public.admin_activity_logs (
    admin_user_id, action, entity_type, entity_id, description, metadata, ip_address
  )
  values (
    (select auth.uid()),
    btrim(p_action),
    btrim(p_entity_type),
    p_entity_id,
    p_description,
    coalesce(p_metadata, '{}'::jsonb),
    p_ip_address
  );
  return true;
end;
$$;

revoke all on function public.record_admin_activity(text, text, uuid, text, jsonb, inet)
  from public, anon;
grant execute on function public.record_admin_activity(text, text, uuid, text, jsonb, inet)
  to authenticated;

create or replace function public.audit_admin_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_id uuid;
begin
  if not public.is_active_admin() then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then
    v_entity_id := old.id;
  else
    v_entity_id := new.id;
  end if;

  insert into public.admin_activity_logs (
    admin_user_id, action, entity_type, entity_id, metadata
  )
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    jsonb_build_object('operation', lower(tg_op))
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.audit_admin_mutation() from public, anon, authenticated;

-- Inventory history ------------------------------------------------------------
create table if not exists public.inventory_logs (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid references public.products (id) on delete set null,
  admin_user_id     uuid references public.profiles (id) on delete set null,
  change_type       text not null
                      check (change_type in ('initial', 'increase', 'decrease')),
  previous_quantity integer check (previous_quantity is null or previous_quantity >= 0),
  new_quantity      integer not null check (new_quantity >= 0),
  quantity_change   integer not null check (quantity_change <> 0),
  reason            text,
  created_at        timestamptz not null default now(),
  constraint inventory_logs_change_matches
    check (quantity_change = new_quantity - coalesce(previous_quantity, 0)),
  constraint inventory_logs_change_type_matches
    check (
      (change_type = 'initial' and previous_quantity is null and new_quantity > 0)
      or (change_type = 'increase' and previous_quantity is not null and quantity_change > 0)
      or (change_type = 'decrease' and previous_quantity is not null and quantity_change < 0)
    )
);

create index if not exists inventory_logs_product_created_idx
  on public.inventory_logs (product_id, created_at desc);
create index if not exists inventory_logs_admin_created_idx
  on public.inventory_logs (admin_user_id, created_at desc);
create unique index if not exists inventory_logs_migration_baseline_key
  on public.inventory_logs (product_id)
  where change_type = 'initial'
    and reason = 'Initial inventory snapshot during admin dashboard migration';

-- Preserve the current stock as a baseline; later product changes are captured by
-- the trigger below. Zero-stock products have no non-zero inventory movement.
insert into public.inventory_logs (
  product_id,
  change_type,
  previous_quantity,
  new_quantity,
  quantity_change,
  reason
)
select
  p.id,
  'initial',
  null,
  p.stock_quantity,
  p.stock_quantity,
  'Initial inventory snapshot during admin dashboard migration'
from public.products p
where p.stock_quantity > 0
on conflict do nothing;

create or replace function public.log_product_inventory_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous integer;
  v_change integer;
  v_type text;
  v_reason text;
begin
  if tg_op = 'INSERT' then
    v_previous := null;
    v_change := new.stock_quantity;
    v_type := 'initial';
  else
    if new.stock_quantity is not distinct from old.stock_quantity then
      return new;
    end if;
    v_previous := old.stock_quantity;
    v_change := new.stock_quantity - old.stock_quantity;
    v_type := case when v_change > 0 then 'increase' else 'decrease' end;
  end if;

  v_reason := nullif(current_setting('app.inventory_reason', true), '');
  if v_change <> 0 then
    insert into public.inventory_logs (
      product_id,
      admin_user_id,
      change_type,
      previous_quantity,
      new_quantity,
      quantity_change,
      reason
    )
    values (
      new.id,
      case when public.is_active_admin() then (select auth.uid()) else null end,
      v_type,
      v_previous,
      new.stock_quantity,
      v_change,
      v_reason
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_product_inventory_change on public.products;
create trigger log_product_inventory_change
  after insert or update of stock_quantity on public.products
  for each row execute function public.log_product_inventory_change();

revoke all on function public.log_product_inventory_change() from public, anon, authenticated;

create or replace function public.admin_set_product_stock(
  p_product_id uuid,
  p_new_quantity integer,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  if not public.consume_admin_rate_limit('inventory_update', 30, 60) then
    return false;
  end if;

  perform set_config('app.inventory_reason', btrim(p_reason), true);

  update public.products
  set stock_quantity = p_new_quantity
  where id = p_product_id;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

revoke all on function public.admin_set_product_stock(uuid, integer, text)
  from public, anon;
grant execute on function public.admin_set_product_stock(uuid, integer, text)
  to authenticated;

-- Order status history ---------------------------------------------------------
create table if not exists public.order_status_history (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  previous_status public.order_status,
  new_status      public.order_status not null,
  changed_by      uuid references public.profiles (id) on delete set null,
  note            text check (note is null or char_length(note) <= 1000),
  created_at      timestamptz not null default now()
);

create index if not exists order_status_history_order_created_idx
  on public.order_status_history (order_id, created_at desc);
create index if not exists order_status_history_actor_created_idx
  on public.order_status_history (changed_by, created_at desc);
create unique index if not exists order_status_history_migration_baseline_key
  on public.order_status_history (order_id)
  where previous_status is null
    and note = 'Initial order status snapshot during admin dashboard migration';

-- Record each order's current status as the starting point for future transitions.
insert into public.order_status_history (
  order_id,
  previous_status,
  new_status,
  note
)
select
  o.id,
  null,
  o.status,
  'Initial order status snapshot during admin dashboard migration'
from public.orders o
where true
on conflict do nothing;

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  v_note := nullif(current_setting('app.order_status_note', true), '');
  insert into public.order_status_history (
    order_id,
    previous_status,
    new_status,
    changed_by,
    note
  )
  values (
    new.id,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    case when public.is_active_admin() then (select auth.uid()) else null end,
    v_note
  );
  return new;
end;
$$;

drop trigger if exists log_order_status_change on public.orders;
create trigger log_order_status_change
  after insert or update of status on public.orders
  for each row execute function public.log_order_status_change();

revoke all on function public.log_order_status_change() from public, anon, authenticated;

-- The supported authenticated admin write path records the actor and optional note.
create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;
  if not public.consume_admin_rate_limit('order_status_update', 60, 60) then
    return false;
  end if;

  perform set_config('app.order_status_note', coalesce(p_note, ''), true);

  update public.orders
  set status = p_status
  where id = p_order_id;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

revoke all on function public.admin_update_order_status(uuid, public.order_status, text)
  from public, anon;
grant execute on function public.admin_update_order_status(uuid, public.order_status, text)
  to authenticated;

-- Product and category enhancements -------------------------------------------
alter table public.products
  add column if not exists sku text,
  add column if not exists compare_at_price numeric(12, 2),
  add column if not exists cost_price numeric(12, 2),
  add column if not exists is_featured boolean not null default false,
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists og_image_path text,
  add column if not exists weight numeric(10, 3);

alter table public.products
  drop constraint if exists products_compare_at_price_nonnegative,
  add constraint products_compare_at_price_nonnegative
    check (compare_at_price is null or compare_at_price >= 0),
  drop constraint if exists products_cost_price_nonnegative,
  add constraint products_cost_price_nonnegative
    check (cost_price is null or cost_price >= 0),
  drop constraint if exists products_weight_nonnegative,
  add constraint products_weight_nonnegative
    check (weight is null or weight >= 0),
  drop constraint if exists products_meta_title_length,
  add constraint products_meta_title_length
    check (meta_title is null or char_length(meta_title) <= 200),
  drop constraint if exists products_meta_description_length,
  add constraint products_meta_description_length
    check (meta_description is null or char_length(meta_description) <= 500);

create unique index if not exists products_sku_key
  on public.products (sku)
  where sku is not null;
create index if not exists products_featured_active_idx
  on public.products (created_at desc, id)
  where is_featured and is_active;

alter table public.categories
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists image_path text,
  add column if not exists sort_order integer not null default 0;

alter table public.categories
  drop constraint if exists categories_sort_order_nonnegative,
  add constraint categories_sort_order_nonnegative check (sort_order >= 0),
  drop constraint if exists categories_meta_title_length,
  add constraint categories_meta_title_length
    check (meta_title is null or char_length(meta_title) <= 200),
  drop constraint if exists categories_meta_description_length,
  add constraint categories_meta_description_length
    check (meta_description is null or char_length(meta_description) <= 500);

create index if not exists categories_active_sort_order_idx
  on public.categories (sort_order, name)
  where is_active;

-- updated_at triggers ----------------------------------------------------------
drop trigger if exists set_updated_at on public.site_settings;
create trigger set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.pages;
create trigger set_updated_at before update on public.pages
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.homepage_sections;
create trigger set_updated_at before update on public.homepage_sections
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.banners;
create trigger set_updated_at before update on public.banners
  for each row execute function public.set_updated_at();

drop trigger if exists audit_admin_mutation on public.products;
create trigger audit_admin_mutation
  after insert or update or delete on public.products
  for each row execute function public.audit_admin_mutation();

drop trigger if exists audit_admin_mutation on public.categories;
create trigger audit_admin_mutation
  after insert or update or delete on public.categories
  for each row execute function public.audit_admin_mutation();

drop trigger if exists audit_admin_mutation on public.product_images;
create trigger audit_admin_mutation
  after insert or update or delete on public.product_images
  for each row execute function public.audit_admin_mutation();

drop trigger if exists audit_admin_mutation on public.site_settings;
create trigger audit_admin_mutation
  after insert or update or delete on public.site_settings
  for each row execute function public.audit_admin_mutation();

drop trigger if exists audit_admin_mutation on public.pages;
create trigger audit_admin_mutation
  after insert or update or delete on public.pages
  for each row execute function public.audit_admin_mutation();

drop trigger if exists audit_admin_mutation on public.homepage_sections;
create trigger audit_admin_mutation
  after insert or update or delete on public.homepage_sections
  for each row execute function public.audit_admin_mutation();

drop trigger if exists audit_admin_mutation on public.banners;
create trigger audit_admin_mutation
  after insert or update or delete on public.banners
  for each row execute function public.audit_admin_mutation();

drop trigger if exists audit_admin_order_status on public.orders;
create trigger audit_admin_order_status
  after update of status on public.orders
  for each row execute function public.audit_admin_mutation();

-- RLS and grants ---------------------------------------------------------------
alter table public.site_settings enable row level security;
alter table public.pages enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.banners enable row level security;
alter table public.admin_activity_logs enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.order_status_history enable row level security;

revoke all on public.site_settings, public.pages, public.homepage_sections,
  public.banners, public.admin_activity_logs, public.inventory_logs,
  public.order_status_history
  from public, anon, authenticated;

-- Public settings are limited to storefront-facing fields; maintenance_mode and
-- other management data are available only to active admins.
grant select (
  id, store_name, store_description, logo_path, favicon_path, contact_email,
  contact_phone, whatsapp_number, viber_number, telegram_username,
  business_address, currency, default_language, timezone, facebook_url,
  instagram_url, tiktok_url, youtube_url, announcement_text,
  announcement_enabled, created_at, updated_at
) on public.site_settings to anon, authenticated;

grant insert, update on public.site_settings to authenticated;

grant select on public.pages, public.homepage_sections, public.banners
  to anon, authenticated;
grant insert, update, delete on public.pages, public.homepage_sections, public.banners
  to authenticated;

grant select on public.admin_activity_logs to authenticated;
grant select on public.inventory_logs, public.order_status_history to authenticated;

-- Admins receive management access to existing catalog tables without changing
-- their public active-only read policies or customer-facing behavior.
grant insert, update, delete on public.categories, public.product_images
  to authenticated;
-- Remove broader grants from earlier versions before applying column privileges.
revoke insert, update on public.products from authenticated;
revoke insert (stock_quantity), update (stock_quantity) on public.products from authenticated;
grant insert (
  category_id, name, slug, short_description, description, price, currency,
  is_active, sku, compare_at_price, cost_price, is_featured, meta_title,
  meta_description, og_image_path, weight
) on public.products to authenticated;
grant update (
  category_id, name, slug, short_description, description, price, currency,
  is_active, sku, compare_at_price, cost_price, is_featured, meta_title,
  meta_description, og_image_path, weight
) on public.products to authenticated;
grant delete on public.products to authenticated;

grant select on public.orders, public.order_items, public.payments to authenticated;

-- Existing product/category/image policies continue to govern public catalog reads.
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products"
  on public.products for all to authenticated
  using ((select public.is_active_admin()))
  with check ((select public.is_active_admin()));

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories"
  on public.categories for all to authenticated
  using ((select public.is_active_admin()))
  with check ((select public.is_active_admin()));

drop policy if exists "Admins manage product images" on public.product_images;
create policy "Admins manage product images"
  on public.product_images for all to authenticated
  using ((select public.is_active_admin()))
  with check ((select public.is_active_admin()));

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
  on public.profiles for select to authenticated
  using ((select public.is_active_admin()));

drop policy if exists "Admins read all orders" on public.orders;
create policy "Admins read all orders"
  on public.orders for select to authenticated
  using ((select public.is_active_admin()));

drop policy if exists "Admins read all order items" on public.order_items;
create policy "Admins read all order items"
  on public.order_items for select to authenticated
  using ((select public.is_active_admin()));

drop policy if exists "Admins read all payments" on public.payments;
create policy "Admins read all payments"
  on public.payments for select to authenticated
  using ((select public.is_active_admin()));

drop policy if exists "Public reads singleton site settings" on public.site_settings;
create policy "Public reads singleton site settings"
  on public.site_settings for select to anon, authenticated
  using (singleton);

drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings"
  on public.site_settings for all to authenticated
  using ((select public.is_active_admin()))
  with check ((select public.is_active_admin()));

drop policy if exists "Public reads published pages" on public.pages;
create policy "Public reads published pages"
  on public.pages for select to anon, authenticated
  using (is_published and (published_at is null or published_at <= now()));

drop policy if exists "Admins manage pages" on public.pages;
create policy "Admins manage pages"
  on public.pages for all to authenticated
  using ((select public.is_active_admin()))
  with check ((select public.is_active_admin()));

drop policy if exists "Public reads visible homepage sections" on public.homepage_sections;
create policy "Public reads visible homepage sections"
  on public.homepage_sections for select to anon, authenticated
  using (is_visible);

drop policy if exists "Admins manage homepage sections" on public.homepage_sections;
create policy "Admins manage homepage sections"
  on public.homepage_sections for all to authenticated
  using ((select public.is_active_admin()))
  with check ((select public.is_active_admin()));

drop policy if exists "Public reads active banners" on public.banners;
create policy "Public reads active banners"
  on public.banners for select to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists "Admins manage banners" on public.banners;
create policy "Admins manage banners"
  on public.banners for all to authenticated
  using ((select public.is_active_admin()))
  with check ((select public.is_active_admin()));

drop policy if exists "Admins read activity logs" on public.admin_activity_logs;
create policy "Admins read activity logs"
  on public.admin_activity_logs for select to authenticated
  using ((select public.is_active_admin()));

drop policy if exists "Admins read inventory logs" on public.inventory_logs;
create policy "Admins read inventory logs"
  on public.inventory_logs for select to authenticated
  using ((select public.is_active_admin()));

drop policy if exists "Admins read order status history" on public.order_status_history;
create policy "Admins read order status history"
  on public.order_status_history for select to authenticated
  using ((select public.is_active_admin()));
