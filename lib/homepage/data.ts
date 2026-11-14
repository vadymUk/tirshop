import "server-only";
import { randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { emptySettings, homepagePublicSchema, homepageSchema, sectionSchema, type HomepageDocument } from "@/lib/homepage/schema";
import type { Database } from "@/types/database";

type SectionRow = Database["public"]["Tables"]["homepage_sections"]["Row"];
type BannerRow = Database["public"]["Tables"]["banners"]["Row"];

function sectionFromRow(row: SectionRow) {
  return sectionSchema.parse({
    id: row.id, section_key: row.section_key, section_type: row.section_type,
    title: row.title ?? "", subtitle: row.subtitle ?? "", content: row.content ?? "",
    settings: { ...emptySettings, ...(row.settings && typeof row.settings === "object" && !Array.isArray(row.settings) ? row.settings : {}) },
    sort_order: row.sort_order, is_visible: row.is_visible,
  });
}
function bannerFromRow(row: BannerRow) {
  return { id: row.id, title: row.title, subtitle: row.subtitle ?? "", image_path: row.image_path,
    mobile_image_path: row.mobile_image_path ?? "", button_text: row.button_text ?? "", button_url: row.button_url ?? "",
    position: row.position, sort_order: row.sort_order, starts_at: row.starts_at ? new Date(row.starts_at).toISOString() : "",
    ends_at: row.ends_at ? new Date(row.ends_at).toISOString() : "", is_active: row.is_active };
}
const defaults = [
  ["hero", "hero", "Truck Shop", true],
  ["featured_categories", "featured_categories", "Популярні категорії", false],
  ["featured_products", "featured_products", "Рекомендовані товари", false],
  ["promotional", "promotional", "Акції", false],
  ["information", "promotional", "Інформація", false],
  ["benefits", "benefits", "Наші переваги", false],
  ["testimonials", "testimonials", "Відгуки", false],
  ["contact", "contact", "Зв’яжіться з нами", false],
] as const;

export async function getHomepageEditor() {
  await requireActiveAdmin();
  const db = await createClient();
  const [draft, sections, banners, products, categories] = await Promise.all([
    db.from("homepage_draft").select("document,revision").eq("singleton", true).maybeSingle(),
    db.from("homepage_sections").select("*").order("sort_order").order("id").limit(51),
    db.from("banners").select("*").order("sort_order").order("id").limit(101),
    db.from("products").select("id,name,is_active").order("name").order("id").limit(1001),
    db.from("categories").select("id,name,is_active").order("name").order("id").limit(1001),
  ]);
  const error = draft.error ?? sections.error ?? banners.error ?? products.error ?? categories.error;
  if (error) throw new Error(`Failed to load homepage editor: ${error.message}`);
  if (!sections.data || !banners.data || !products.data || !categories.data) throw new Error("Missing homepage editor data");
  if (sections.data.length > 50 || banners.data.length > 100 || products.data.length > 1000 || categories.data.length > 1000)
    throw new Error("Homepage editor limits exceeded (50 sections, 100 banners, 1000 products/categories).");
  if (draft.data) return { document: homepageSchema.parse(draft.data.document), revision: draft.data.revision, products: products.data, categories: categories.data };
  const existing = sections.data.map(sectionFromRow);
  for (const [key, type, title, visible] of defaults) {
    if (!existing.some((s) => s.section_key === key || (type !== "promotional" && s.section_type === type))) {
      existing.push({ id: randomUUID(), section_key: key, section_type: type, title, subtitle: "",
        content: key === "hero" ? "Практичні товари та аксесуари для далекобійників і професійних водіїв у довгих європейських рейсах." : "",
        settings: { ...emptySettings, primary_text: key === "hero" ? "Переглянути товари" : "", primary_url: key === "hero" ? "/products" : "" },
        sort_order: existing.length * 10, is_visible: visible });
    }
  }
  return { document: homepageSchema.parse({ sections: existing, banners: banners.data.map(bannerFromRow) }), revision: 0, products: products.data, categories: categories.data };
}

const publishedSections = unstable_cache(async () => {
  const result = await createPublicClient().from("homepage_sections").select("*").eq("is_visible", true).order("sort_order").order("id");
  if (result.error) throw new Error(`Failed to load homepage sections: ${result.error.message}`);
  return result.data.map(sectionFromRow);
}, ["homepage-sections"], { tags: ["homepage"], revalidate: 60 });

export async function getPublicHomepage(): Promise<HomepageDocument> {
  const [sections, banners] = await Promise.all([
    publishedSections(),
    createPublicClient().from("banners").select("*").eq("is_active", true).order("sort_order").order("id"),
  ]);
  if (banners.error) throw new Error(`Failed to load homepage banners: ${banners.error.message}`);
  return homepagePublicSchema.parse({ sections, banners: banners.data.map(bannerFromRow) });
}

export async function getHomepageCatalog(document: HomepageDocument) {
  const productIds = [...new Set(document.sections.flatMap((s) => s.settings.product_ids))];
  const categoryIds = [...new Set(document.sections.flatMap((s) => s.settings.category_ids))];
  const db = createPublicClient();
  const productColumns = "id,name,slug,price,currency,product_images(storage_path,sort_order)" as const;
  const queryFeatured = (offset: number) => db.from("products").select(productColumns, { count: "exact" })
    .eq("is_active", true).eq("is_featured", true).order("created_at", { ascending: false }).order("id")
    .order("sort_order", { referencedTable: "product_images" }).limit(1, { referencedTable: "product_images" })
    .range(offset, offset + 99);
  async function getFeaturedProducts() {
    type Product = NonNullable<Awaited<ReturnType<typeof queryFeatured>>["data"]>[number];
    const items = new Map<string, Product>();
    let offset = 0;
    for (;;) {
      const result = await queryFeatured(offset);
      if (result.error || !result.data || result.count === null) {
        throw new Error(`Failed to load featured products: ${result.error?.message ?? "missing data or count"}`);
      }
      for (const product of result.data) items.set(product.id, product);
      offset += result.data.length;
      if (offset >= result.count) return [...items.values()];
      if (!result.data.length) throw new Error("Failed to load all featured products");
    }
  }
  const [products, categories, featuredProducts] = await Promise.all([
    productIds.length ? db.from("products").select(productColumns).eq("is_active", true).in("id", productIds).order("sort_order", { referencedTable: "product_images" }).limit(1, { referencedTable: "product_images" }) : Promise.resolve({ data: [], error: null }),
    categoryIds.length ? db.from("categories").select("id,name,slug,description").eq("is_active", true).in("id", categoryIds) : Promise.resolve({ data: [], error: null }),
    document.sections.some((section) => section.is_visible && section.section_type === "featured_products") ? getFeaturedProducts() : Promise.resolve([]),
  ]);
  if (products.error || categories.error) throw new Error(`Failed to load homepage catalog: ${products.error?.message ?? categories.error?.message}`);
  return { products: products.data ?? [], categories: categories.data ?? [], featuredProducts };
}

export async function homepageRenderTime() {
  return Date.now();
}
