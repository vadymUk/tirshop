import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImages } from "@/components/admin/product-images";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireActiveAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const [product, categories, images, query] = await Promise.all([
    db.from("products").select("id,name,slug,sku,category_id,short_description,description,price,compare_at_price,currency,stock_quantity,weight,is_active,is_featured,meta_title,meta_description,og_image_path").eq("id", id).maybeSingle(),
    db.from("categories").select("id,name").order("name"),
    db.from("product_images").select("id,storage_path,alt_text").eq("product_id", id).order("sort_order").order("id"),
    searchParams,
  ]);
  if (product.error || categories.error || images.error) throw new Error(`Failed to load product: ${product.error?.message ?? categories.error?.message ?? images.error?.message}`);
  if (!product.data) notFound();
  return <><AdminPageHeading title={product.data.name} description="Редагування товару." /><div className="space-y-5"><ProductImages product={id} images={images.data ?? []} /><ProductForm product={product.data} categories={categories.data ?? []} saved={query.saved === "1"} /></div></>;
}
