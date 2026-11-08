"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { buildListingHref, hasActiveFilters, type ListingFilters } from "@/lib/catalog/listing";
import { Button } from "@/components/ui/button";
import type { SortKey } from "@/lib/catalog/config";
import { useLanguage } from "@/components/layout/language-provider";

const fieldClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Plain GET form: no JavaScript needed, URLs stay shareable, and the page param is
 * deliberately not submitted, so every filter change returns to page 1.
 */
export function FilterPanel({
  basePath,
  sort,
  filters,
}: {
  basePath: string;
  sort: SortKey;
  filters: ListingFilters;
}) {
  const { t } = useLanguage();
  const active = hasActiveFilters({ ...filters, q: undefined });
  const resetHref = buildListingHref(basePath, sort, 1, {
    q: filters.q,
    category: filters.category,
  });

  return (
    <details className="rounded-lg border" open={active}>
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {t("Фільтри")}{active ? ` (${t("застосовано")})` : ""}
      </summary>
      <form
        action={basePath}
        method="get"
        aria-label={t("Фільтри товарів")}
        className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
      >
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {filters.category && <input type="hidden" name="category" value={filters.category} />}
        {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}

        <div className="space-y-1.5">
          <label htmlFor="filter-min-price" className="text-sm font-medium">
            {t("Ціна від")}
          </label>
          <input
            id="filter-min-price"
            name="minPrice"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            defaultValue={filters.minPrice}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="filter-max-price" className="text-sm font-medium">
            {t("Ціна до")}
          </label>
          <input
            id="filter-max-price"
            name="maxPrice"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            defaultValue={filters.maxPrice}
            className={fieldClass}
          />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="availability"
            value="in_stock"
            defaultChecked={filters.availability === "in_stock"}
            className="size-4"
          />
          {t("Лише в наявності")}
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            {t("Застосувати")}
          </Button>
          {active && (
            <Link
              href={resetHref}
              className="inline-flex h-8 items-center rounded-md px-3 text-sm underline-offset-4 hover:underline"
            >
              {t("Скинути")}
            </Link>
          )}
        </div>
      </form>
    </details>
  );
}
