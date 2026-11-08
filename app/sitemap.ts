import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

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
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/products"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.4 },
  ];

  try {
    const supabase = createPublicClient();
    const [categories, products] = await Promise.all([
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
  } catch (error) {
    // Supabase unavailable: serve the static entries rather than failing the sitemap.
    console.error("Failed to populate product and category sitemap entries:", error);
  }

  return entries;
}
