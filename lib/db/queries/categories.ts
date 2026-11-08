import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

const CATEGORY_COLUMNS = "id, name, slug, description, image_url";
const CATALOG_REVALIDATE_SECONDS = 120;

/** Public data: cached across requests, refreshed by the "catalog" tag or after 2 minutes. */
const loadCategories = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select(CATEGORY_COLUMNS)
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(`Failed to load categories: ${error.message}`);
    return data;
  },
  ["categories"],
  { tags: ["catalog", "categories"], revalidate: CATALOG_REVALIDATE_SECONDS },
);

const loadCategoryBySlug = unstable_cache(
  async (slug: string) => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select(CATEGORY_COLUMNS)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(`Failed to load category: ${error.message}`);
    return data;
  },
  ["category-by-slug"],
  { tags: ["catalog", "categories"], revalidate: CATALOG_REVALIDATE_SECONDS },
);

export const getCategories = cache(() => loadCategories());
export const getCategoryBySlug = cache((slug: string) => loadCategoryBySlug(slug));

/** Keeps optional navigation data from breaking a page while preserving diagnostics. */
export async function getCategoriesForNavigation() {
  try {
    return await getCategories();
  } catch (error) {
    console.error("Failed to load categories for navigation:", error);
    return [];
  }
}
