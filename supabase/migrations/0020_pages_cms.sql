-- Structured content is additive; existing plain-text content remains intact.
alter table public.pages add column rich_content jsonb;
alter table public.pages add constraint pages_rich_content_object
  check (rich_content is null or jsonb_typeof(rich_content) = 'object');

create table public.page_drafts (
  id uuid primary key default gen_random_uuid(),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.page_drafts enable row level security;
revoke all on public.page_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.page_drafts to authenticated;
create policy "Admins manage page drafts" on public.page_drafts for all to authenticated
  using ((select public.is_active_admin())) with check ((select public.is_active_admin()));
create trigger media_reference_guard before insert or update on public.page_drafts
  for each row execute function public.media_reference_guard();

create or replace function public.media_is_referenced(p_path text)
returns boolean language sql volatile security definer set search_path = '' as $$
  select exists (select 1 from public.product_images r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.products r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.categories r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.pages r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.page_drafts r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.banners r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.homepage_sections r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.homepage_draft r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.site_settings r where public.media_row_mentions_path(row_to_json(r)::text, p_path));
$$;

-- Only server-validated documents may reach the public table.
revoke insert, update, delete on public.pages from authenticated;

create function public.admin_publish_page(p_id uuid, p_revision integer, p_document jsonb, p_actor uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin' and is_active) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  perform 1 from public.page_drafts where id = p_id and revision = p_revision and document = p_document for update;
  if not found then raise exception 'page_draft_conflict' using errcode = '40001'; end if;
  insert into public.pages (id, slug, title, excerpt, rich_content, featured_image_path, meta_title,
    meta_description, canonical_url, og_image_path, published_at, is_published)
  values (p_id, p_document->>'slug', p_document->>'title', nullif(p_document->>'excerpt',''),
    p_document->'content', nullif(p_document->>'featured_image_path',''), nullif(p_document->>'meta_title',''),
    nullif(p_document->>'meta_description',''), nullif(p_document->>'canonical_url',''), nullif(p_document->>'og_image_path',''),
    nullif(p_document->>'published_at','')::timestamptz, true)
  on conflict (id) do update set slug=excluded.slug, title=excluded.title, excerpt=excluded.excerpt,
    rich_content=excluded.rich_content, featured_image_path=excluded.featured_image_path, meta_title=excluded.meta_title,
    meta_description=excluded.meta_description, canonical_url=excluded.canonical_url, og_image_path=excluded.og_image_path,
    published_at=excluded.published_at, is_published=true;
  insert into public.admin_activity_logs(admin_user_id, action, entity_type, entity_id, metadata)
    values (p_actor, 'publish', 'page', p_id, jsonb_build_object('revision', p_revision));
  return true;
end;
$$;
revoke all on function public.admin_publish_page(uuid,integer,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.admin_publish_page(uuid,integer,jsonb,uuid) to service_role;

create function public.admin_page_operation(p_id uuid, p_operation text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_operation = 'unpublish' then
    update public.pages set is_published = false where id = p_id;
    if not found then raise exception 'page_not_found' using errcode = 'P0002'; end if;
  elsif p_operation = 'delete' then
    delete from public.page_drafts where id = p_id;
    delete from public.pages where id = p_id;
  else raise exception 'invalid_operation' using errcode = '22023';
  end if;
  insert into public.admin_activity_logs(admin_user_id, action, entity_type, entity_id)
    values ((select auth.uid()), p_operation, 'page', p_id);
  return true;
end;
$$;
revoke all on function public.admin_page_operation(uuid,text) from public, anon;
grant execute on function public.admin_page_operation(uuid,text) to authenticated;
