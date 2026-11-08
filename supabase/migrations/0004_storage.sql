-- 0004: product image storage hardening and atomic image ordering.
--
-- Bucket layout:  product-images/{product_id}/{filename}
-- Access model:
--   * SELECT  : public (policy in 0003 limited to this bucket)
--   * INSERT / UPDATE / DELETE : NO policy exists for anon/authenticated, so Row
--     Level Security on storage.objects denies them. Only the service role
--     (server-side, bypasses RLS) can write.

update storage.buckets
set public = true,
    file_size_limit = 5242880,  -- 5 MiB per object (server also optimizes to WebP)
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'product-images';

-- storage_path must live under the product's own folder, with no traversal.
alter table public.product_images
  add constraint product_images_path_in_product_folder
  check (
    storage_path like product_id::text || '/%'
    and storage_path !~ '(^|/)\.\.(/|$)'
  );

-- A product cannot have two images at the same path.
alter table public.product_images
  add constraint product_images_storage_path_key unique (storage_path);

-- Atomically re-numbers a product's images to match the given order.
-- The array must contain exactly the product's current image ids.
create function public.reorder_product_images(
  p_product_id uuid,
  p_image_ids  uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing integer;
  v_given    integer := coalesce(cardinality(p_image_ids), 0);
begin
  select count(*) into v_existing
  from public.product_images where product_id = p_product_id;

  if v_given <> v_existing
     or (select count(distinct x) from unnest(p_image_ids) as x) <> v_given
     or (select count(*) from public.product_images
         where product_id = p_product_id and id = any (p_image_ids)) <> v_given
  then
    raise exception 'Image list does not match the product''s images'
      using errcode = '22023';
  end if;

  update public.product_images pi
  set sort_order = o.ord - 1
  from unnest(p_image_ids) with ordinality as o(id, ord)
  where pi.id = o.id and pi.product_id = p_product_id;
end;
$$;

-- Server-only: never callable by browser roles.
revoke all on function public.reorder_product_images(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_product_images(uuid, uuid[]) to service_role;
