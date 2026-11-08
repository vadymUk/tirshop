import type { SortKey } from "@/lib/catalog/config";

export type ListingFilters = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: "in_stock";
};

/** True when any narrowing filter (not just category) is applied. */
export function hasActiveFilters(filters: ListingFilters = {}) {
  return Boolean(
    filters.q ||
      filters.minPrice !== undefined ||
      filters.maxPrice !== undefined ||
      filters.availability,
  );
}

/** Builds a listing URL while preserving the category and active filters. */
export function buildListingHref(
  basePath: string,
  sort: SortKey,
  page: number,
  filters: ListingFilters = {},
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
  if (filters.availability) params.set("availability", filters.availability);
  if (sort !== "newest") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
