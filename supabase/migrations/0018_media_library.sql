-- Public assets are readable by URL. All writes go through the validated server
-- operations; there are deliberately no client Storage write policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create policy "Site media are publicly readable" on storage.objects
  for select to anon, authenticated using (bucket_id = 'site-media');

create table public.media_metadata (
  bucket text not null check (bucket in ('product-images', 'site-media')),
  path text not null,
  original_name text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  primary key (bucket, path)
);
alter table public.media_metadata enable row level security;
revoke all on public.media_metadata from public, anon, authenticated;

-- A durable tombstone prevents references from being added during or after
-- an asynchronous Storage deletion, including when a deletion needs retrying.
create table public.media_delete_claims (
  bucket text not null,
  path text not null,
  created_at timestamptz not null default now(),
  primary key (bucket, path)
);
alter table public.media_delete_claims enable row level security;
revoke all on public.media_delete_claims from public, anon, authenticated;

create function public.media_row_mentions_path(p_row text, p_path text)
returns boolean language sql immutable set search_path = '' as $$
  select case when p_path !~ '^[a-zA-Z0-9_./-]+$' then true else lower(p_row) ~ (select string_agg(
    '(' || case when c = '.' then '\.' else c end || '|%' || lpad(to_hex(ascii(c)), 2, '0') ||
    '|%25' || lpad(to_hex(ascii(c)), 2, '0') || '|&#' || ascii(c)::text ||
    ';|&#x' || to_hex(ascii(c)) || ';' || case when c = '/' then '|&sol;' else '' end || ')', '' order by n)
    from regexp_split_to_table(lower(p_path), '') with ordinality as chars(c, n)) end;
$$;
revoke all on function public.media_row_mentions_path(text,text) from public, anon, authenticated;

create function public.media_is_referenced(p_path text)
returns boolean language sql volatile security definer set search_path = '' as $$
  select exists (select 1 from public.product_images r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.products r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.categories r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.pages r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.banners r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.homepage_sections r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.site_settings r where public.media_row_mentions_path(row_to_json(r)::text, p_path));
$$;
revoke all on function public.media_is_referenced(text) from public, anon, authenticated;

create function public.media_reference_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(818181, 1);
  if exists (select 1 from public.media_delete_claims c
             where public.media_row_mentions_path(row_to_json(new)::text, c.path)) then
    raise exception 'media_deleted_or_pending_deletion' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.media_reference_guard() from public, anon, authenticated;
create trigger media_reference_guard before insert or update on public.product_images for each row execute function public.media_reference_guard();
create trigger media_reference_guard before insert or update on public.products for each row execute function public.media_reference_guard();
create trigger media_reference_guard before insert or update on public.categories for each row execute function public.media_reference_guard();
create trigger media_reference_guard before insert or update on public.pages for each row execute function public.media_reference_guard();
create trigger media_reference_guard before insert or update on public.banners for each row execute function public.media_reference_guard();
create trigger media_reference_guard before insert or update on public.homepage_sections for each row execute function public.media_reference_guard();
create trigger media_reference_guard before insert or update on public.site_settings for each row execute function public.media_reference_guard();

create function public.admin_media_list(
  p_bucket text, p_query text default '', p_type text default '',
  p_ascending boolean default false, p_orphan boolean default false, p_offset integer default 0
)
returns table (bucket text, path text, original_name text, created_at timestamptz,
  mime_type text, size bigint, width integer, height integer, referenced boolean, deleting boolean, managed boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_bucket not in ('product-images', 'site-media') or length(p_query) > 100
    or p_type not in ('', 'image/jpeg', 'image/png', 'image/webp') or p_offset < 0 or p_offset > 1999980 then
    raise exception 'invalid_media_filter' using errcode = '22023';
  end if;
  return query
  select o.bucket_id, o.name, coalesce(m.original_name, pg_catalog.split_part(o.name, '/', pg_catalog.array_length(pg_catalog.string_to_array(o.name, '/'), 1))),
    o.created_at, o.metadata->>'mimetype',
    case when o.metadata->>'size' ~ '^[0-9]{1,15}$' then (o.metadata->>'size')::bigint else null end,
    m.width, m.height, public.media_is_referenced(o.name), c.path is not null, m.path is not null
  from storage.objects o
  left join public.media_metadata m on m.bucket = o.bucket_id and m.path = o.name
  left join public.media_delete_claims c on c.bucket = o.bucket_id and c.path = o.name
  where o.bucket_id = p_bucket
    and (p_query = '' or strpos(lower(coalesce(m.original_name, o.name)), lower(p_query)) > 0)
    and (p_type = '' or o.metadata->>'mimetype' = p_type)
    and (not p_orphan or not public.media_is_referenced(o.name))
  order by case when p_ascending then o.created_at end asc,
    case when not p_ascending then o.created_at end desc, o.name
  limit 21 offset p_offset;
end;
$$;
revoke all on function public.admin_media_list(text,text,text,boolean,boolean,integer) from public, anon;
grant execute on function public.admin_media_list(text,text,text,boolean,boolean,integer) to authenticated;

-- Only library-managed, URL-safe paths can be deleted. Legacy objects remain
-- visible but require manual reference verification and external-link review.
create function public.admin_claim_media_deletion(p_bucket text, p_path text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_bucket not in ('product-images', 'site-media') or p_path !~ '^[a-zA-Z0-9_./-]+$'
    or p_path ~ '(^|/)\.\.(/|$)' then raise exception 'invalid_media_path' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(818181, 1);
  if not exists (select 1 from public.media_metadata m where m.bucket = p_bucket and m.path = p_path) then
    raise exception 'legacy_media_requires_manual_review' using errcode = '23514';
  end if;
  if public.media_is_referenced(p_path) then raise exception 'media_is_referenced' using errcode = '23514'; end if;
  insert into public.media_delete_claims (bucket, path) values (p_bucket, p_path) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.admin_claim_media_deletion(text,text) from public, anon;
grant execute on function public.admin_claim_media_deletion(text,text) to authenticated;

create function public.admin_attach_product_image(p_product uuid, p_path text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  perform 1 from public.products where id = p_product for update;
  if not found then raise exception 'product_not_found' using errcode = 'P0002'; end if;
  if p_path not like p_product::text || '/%' or
    not exists (select 1 from storage.objects where bucket_id = 'product-images' and name = p_path) then
    raise exception 'image_not_found' using errcode = '22023';
  end if;
  if (select count(*) from public.product_images where product_id = p_product) >= 10 then
    raise exception 'too_many_images' using errcode = '23514';
  end if;
  insert into public.product_images(product_id, storage_path, sort_order)
    select p_product, p_path, coalesce(max(sort_order), -1) + 1
    from public.product_images where product_id = p_product
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_attach_product_image(uuid,text) from public, anon;
grant execute on function public.admin_attach_product_image(uuid,text) to authenticated;
