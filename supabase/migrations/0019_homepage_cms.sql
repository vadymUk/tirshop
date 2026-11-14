-- Drafts are private; publishing changes both public tables atomically.
insert into public.homepage_sections (section_key, section_type, title, content, settings, sort_order, is_visible)
select 'hero', 'hero', 'Truck Shop',
  'Практичні товари та аксесуари для далекобійників і професійних водіїв у довгих європейських рейсах.',
  '{"primary_text":"Переглянути товари","primary_url":"/products"}'::jsonb, 0, true
where not exists (select 1 from public.homepage_sections where section_type = 'hero')
on conflict (section_key) do nothing;

create table public.homepage_draft (
  singleton boolean primary key default true check (singleton),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.homepage_draft enable row level security;
revoke all on public.homepage_draft from public, anon, authenticated;
grant select, insert, update on public.homepage_draft to authenticated;
create policy "Admins manage homepage drafts" on public.homepage_draft
  for all to authenticated using ((select public.is_active_admin()))
  with check ((select public.is_active_admin()));

revoke insert, update, delete on public.homepage_sections, public.banners from authenticated;

create trigger media_reference_guard before insert or update on public.homepage_draft
  for each row execute function public.media_reference_guard();

create or replace function public.media_is_referenced(p_path text)
returns boolean language sql volatile security definer set search_path = '' as $$
  select exists (select 1 from public.product_images r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.products r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.categories r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.pages r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.banners r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.homepage_sections r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.homepage_draft r where public.media_row_mentions_path(row_to_json(r)::text, p_path))
      or exists (select 1 from public.site_settings r where public.media_row_mentions_path(row_to_json(r)::text, p_path));
$$;

-- Only the validated server action may publish: authenticated callers cannot
-- bypass its structured document validation via PostgREST.
create function public.publish_homepage(p_revision integer, p_document jsonb, p_actor uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_document jsonb; s jsonb; b jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin' and is_active) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  select document into v_document from public.homepage_draft
    where singleton and revision = p_revision and document = p_document for update;
  if not found then raise exception 'homepage_draft_conflict' using errcode = '40001'; end if;
  for s in select value from jsonb_array_elements(v_document->'sections') loop
    insert into public.homepage_sections (id, section_key, section_type, title, subtitle, content, settings, sort_order, is_visible)
    values ((s->>'id')::uuid, s->>'section_key', (s->>'section_type')::public.homepage_section_type,
      nullif(s->>'title',''), nullif(s->>'subtitle',''), nullif(s->>'content',''),
      s->'settings', (s->>'sort_order')::integer, (s->>'is_visible')::boolean)
    on conflict (id) do update set section_key = excluded.section_key, section_type = excluded.section_type,
      title = excluded.title, subtitle = excluded.subtitle, content = excluded.content,
      settings = excluded.settings, sort_order = excluded.sort_order, is_visible = excluded.is_visible;
  end loop;
  for b in select value from jsonb_array_elements(v_document->'banners') loop
    insert into public.banners (id, title, subtitle, image_path, mobile_image_path, button_text, button_url, position, sort_order, starts_at, ends_at, is_active)
    values ((b->>'id')::uuid, b->>'title', nullif(b->>'subtitle',''), b->>'image_path',
      nullif(b->>'mobile_image_path',''), nullif(b->>'button_text',''), nullif(b->>'button_url',''),
      b->>'position', (b->>'sort_order')::integer, nullif(b->>'starts_at','')::timestamptz,
      nullif(b->>'ends_at','')::timestamptz, (b->>'is_active')::boolean)
    on conflict (id) do update set title=excluded.title, subtitle=excluded.subtitle, image_path=excluded.image_path,
      mobile_image_path=excluded.mobile_image_path, button_text=excluded.button_text, button_url=excluded.button_url,
      position=excluded.position, sort_order=excluded.sort_order, starts_at=excluded.starts_at,
      ends_at=excluded.ends_at, is_active=excluded.is_active;
  end loop;
  delete from public.banners where not (id::text in (select value->>'id' from jsonb_array_elements(v_document->'banners')));
  insert into public.admin_activity_logs(admin_user_id, action, entity_type, metadata)
    values (p_actor, 'publish', 'homepage', jsonb_build_object('revision', p_revision));
  return true;
end;
$$;
revoke all on function public.publish_homepage(integer,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.publish_homepage(integer,jsonb,uuid) to service_role;
