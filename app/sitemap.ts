import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { absoluteUrl } from "@/lib/seo";
import { pageHref, pageSlug } from "@/lib/pages/schema";

export const dynamic = "force-dynamic";

type Row = { slug: string; updated_at: string };
const PAGE_SIZE = 1000;

async function fetchAll(
  load: (from: number, to: number) => PromiseLike<{
    data: Row[] | null;
    error: { message: string } | null;
  }>,
) {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await load(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load sitemap entries: ${error.message}`);
    if (!data) throw new Error("Sitemap query returned no data");
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/products"), changeFrequency: "daily", priority: 0.8 },
  ];

  const supabase = createPublicClient();
  const [categories, products, pages] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("categories")
        .select("slug, updated_at")
        .eq("is_active", true)
        .order("slug")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("products")
        .select("slug, updated_at")
        .eq("is_active", true)
        .order("slug")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("pages")
        .select("slug, updated_at")
        .eq("is_published", true)
        .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`)
        .order("slug")
        .range(from, to),
    ),
  ]);

  for (const c of categories) {
    entries.push({
      url: absoluteUrl(`/category/${c.slug}`),
      lastModified: c.updated_at,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }
  for (const p of products) {
    entries.push({
      url: absoluteUrl(`/products/${p.slug}`),
      lastModified: p.updated_at,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }
  for (const page of pages) {
    if (!pageSlug.safeParse(page.slug).success) throw new Error(`Invalid page slug in sitemap: ${page.slug}`);
    entries.push({
      url: absoluteUrl(pageHref(page.slug)),
      lastModified: page.updated_at,
      changeFrequency: "monthly",
      priority: 0.4,
    });
  }

  if (entries.length > 50000) throw new Error("Sitemap exceeds 50,000 URLs; split it into multiple sitemaps.");

  return entries;
}
