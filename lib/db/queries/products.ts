import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
// Read-only, RLS-scoped personalisation uses the verified-claims identity (no Auth round trip).
import { getAuthUser as getCurrentUser } from "@/lib/auth/session";
import { PAGE_SIZE, SORT_OPTIONS, type SortKey } from "@/lib/catalog/config";
import { findCatalogSources } from "@/lib/catalog-translations";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

const CATALOG_REVALIDATE_SECONDS = 60;

/** Cards need one image and no long description; the detail page loads everything. */
const CARD_SELECT =
  "id, category_id, name, slug, short_description, price, currency, stock_quantity, product_images(id, storage_path, alt_text, sort_order), categories(id, name, slug)";
const DETAIL_SELECT =
  "id, category_id, name, slug, short_description, description, price, currency, stock_quantity, meta_title, meta_description, og_image_path, product_images(id, storage_path, alt_text, sort_order), categories(id, name, slug)";

type ListOptions = {
  categoryId?: string;
  sort?: SortKey;
  page?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
};

/** Splits user input into words, dropping characters that are special in PostgREST filters. */
function toSearchWords(search: string) {
  return search
    .replace(/[\\,()"*%]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
}

const quote = (value: string) => `"${value.replace(/[\\"]/g, "\\$&")}"`;

/** One OR group per word: ilike on the stored (English) text, plus exact matches of translated sources. */
function searchFilter(word: string) {
  const pattern = `*${word.replace(/_/g, "\\_")}*`;
  const clauses = [
    `name.ilike.${pattern}`,
    `short_description.ilike.${pattern}`,
    `description.ilike.${pattern}`,
  ];
  for (const source of findCatalogSources(word).slice(0, 30)) {
    const q = quote(source);
    clauses.push(`name.eq.${q}`, `short_description.eq.${q}`, `description.eq.${q}`);
  }
  return clauses.join(",");
}

/** Paginated list of active products via range(); count is computed by the database. */
async function queryProductsPage(
  categoryId: string | null,
  sort: SortKey,
  page: number,
  search: string,
  minPrice: number | null,
  maxPrice: number | null,
  inStockOnly: boolean,
) {
  const supabase = createPublicClient();
  const { column, ascending } = SORT_OPTIONS[sort];
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("products")
    .select(CARD_SELECT, { count: "exact" })
    .eq("is_active", true)
    .order(column, { ascending })
    .order("id")
    .order("sort_order", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .range(from, from + PAGE_SIZE - 1);

  if (categoryId) query = query.eq("category_id", categoryId);
  if (minPrice !== null) query = query.gte("price", minPrice);
  if (maxPrice !== null) query = query.lte("price", maxPrice);
  if (inStockOnly) query = query.gt("stock_quantity", 0);
  // Every word must match name, short description or description (AND of ORs, evaluated in PostgreSQL).
  for (const word of toSearchWords(search)) {
    query = query.or(searchFilter(word));
  }

  const { data, error, count } = await query;
  // PGRST103: page is beyond the last row; treat as an empty page.
  if (error?.code === "PGRST103") {
    return { products: [], total: 0, page, totalPages: 1 };
  }
  if (error) throw new Error(`Failed to load products: ${error.message}`);

  const total = count ?? 0;
  return {
    products: data,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

const queryProductsPageCached = unstable_cache(queryProductsPage, ["products-page"], {
  tags: ["catalog", "products"],
  revalidate: CATALOG_REVALIDATE_SECONDS,
});

/** Free-text searches are unbounded, so only browse/filter pages are cached across requests. */
const loadProductsPage = cache(
  (
    categoryId: string | null,
    sort: SortKey,
    page: number,
    search: string,
    minPrice: number | null,
    maxPrice: number | null,
    inStockOnly: boolean,
  ) =>
    (search ? queryProductsPage : queryProductsPageCached)(
      categoryId,
      sort,
      page,
      search,
      minPrice,
      maxPrice,
      inStockOnly,
    ),
);


/** Primitive cache keys let generateMetadata and the page share one query per request. */
export function getProductsPage({
  categoryId,
  sort = "newest",
  page = 1,
  search = "",
  minPrice,
  maxPrice,
  inStockOnly = false,
}: ListOptions = {}) {
  return loadProductsPage(
    categoryId ?? null,
    sort,
    page,
    search,
    minPrice ?? null,
    maxPrice ?? null,
    inStockOnly,
  );
}

const loadProductBySlug = unstable_cache(
  async (slug: string) => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("products")
      .select(DETAIL_SELECT)
      .eq("slug", slug)
      .eq("is_active", true)
      .order("sort_order", { referencedTable: "product_images" })
      .maybeSingle();
    if (error) throw new Error(`Failed to load product: ${error.message}`);
    return data;
  },
  ["product-by-slug"],
  { tags: ["catalog", "products"], revalidate: CATALOG_REVALIDATE_SECONDS },
);

export const getProductBySlug = cache((slug: string) => loadProductBySlug(slug));

const loadRelatedProducts = unstable_cache(
  async (categoryId: string, excludeProductId: string, limit: number) => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("products")
      .select(CARD_SELECT)
      .eq("is_active", true)
      .eq("category_id", categoryId)
      .neq("id", excludeProductId)
      .order("created_at", { ascending: false })
      .order("sort_order", { referencedTable: "product_images" })
      .limit(1, { referencedTable: "product_images" })
      .limit(limit);
    if (error) throw new Error(`Failed to load related products: ${error.message}`);
    return data;
  },
  ["related-products"],
  { tags: ["catalog", "products"], revalidate: CATALOG_REVALIDATE_SECONDS },
);

export const getRelatedProducts = cache(
  (categoryId: string, excludeProductId: string, limit = 4) =>
    loadRelatedProducts(categoryId, excludeProductId, limit),
);

export type CatalogProduct = Awaited<
  ReturnType<typeof getProductsPage>
>["products"][number];

/** Product ids favorited by the signed-in user (RLS-scoped). Empty for guests. */
export const getFavoriteProductIds = cache(async (): Promise<string[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("product_id")
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to load favorites: ${error.message}`);
  return data.map((row) => row.product_id);
});

/** Number of favorites shown on /favorites (active products only); 0 for guests. RLS-scoped. */
export const getFavoritesCount = cache(async (): Promise<number> => {
  const user = await getCurrentUser();
  if (!user) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("favorites")
    .select("product_id, products!inner(is_active)", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("products.is_active", true);
  if (error) throw new Error(`Failed to load favorites count: ${error.message}`);
  return count ?? 0;
});

/** Quantity of one product already in the signed-in user's cart (0 for guests). */
export const getCartQuantity = cache(async (productId: string): Promise<number> => {
  const user = await getCurrentUser();
  if (!user) return 0;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load cart: ${error.message}`);
  return data?.quantity ?? 0;
});

/** Active products the signed-in user has favorited, newest favorite first. RLS-scoped. */
export const getFavoriteProducts = cache(async (): Promise<CatalogProduct[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  // The inner join drops favorites whose product is inactive or no longer visible.
  const { data, error } = await supabase
    .from("favorites")
    .select(`created_at, products!inner(${CARD_SELECT})`)
    .eq("user_id", user.id)
    .eq("products.is_active", true)
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "products.product_images" })
    .limit(1, { referencedTable: "products.product_images" })
    .limit(100);
  if (error) throw new Error(`Failed to load favorites: ${error.message}`);

  return data.flatMap((row) => (row.products ? [row.products] : []));
});
