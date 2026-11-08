"use client";

import Link from "next/link";
import { PackageSearch, SearchX } from "lucide-react";
import { ProductCard } from "@/components/catalog/product-card";
import { Pagination } from "@/components/catalog/pagination";
import {
  buildListingHref as buildHref,
  hasActiveFilters,
  type ListingFilters,
} from "@/lib/catalog/listing";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { PAGE_SIZE, SORT_OPTIONS, type SortKey } from "@/lib/catalog/config";
import type { CatalogProduct } from "@/lib/db/queries/products";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/layout/language-provider";

type ListingProps = {
  basePath: string;
  products: CatalogProduct[];
  total: number;
  page: number;
  totalPages: number;
  sort: SortKey;
  favoriteIds: string[];
  isAuthenticated: boolean;
  filters?: ListingFilters;
};

export function ProductListing({
  basePath,
  products,
  total,
  page,
  totalPages,
  sort,
  favoriteIds,
  isAuthenticated,
  filters,
}: ListingProps) {
  const { t } = useLanguage();
  const favorites = new Set(favoriteIds);

  if (products.length === 0 && hasActiveFilters(filters) && page === 1) {
    return (
      <EmptyState
        icon={SearchX}
        title={t("Нічого не знайдено")}
        description={t("За вибраними умовами товарів не знайдено. Спробуйте змінити або скинути фільтри.")}
        action={
          <Link
            href={buildHref(basePath, "newest", 1, { category: filters?.category })}
            className={buttonVariants({ variant: "outline" })}
          >
            {t("Скинути фільтри")}
          </Link>
        }
      />
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title={t(page > 1 ? "На цій сторінці немає товарів" : "Товарів не знайдено")}
        description={
          page > 1
            ? t("Такої сторінки не існує.")
            : t("Тут поки що немає товарів. Завітайте пізніше.")
        }
        action={
          <Link href={buildHref(basePath, sort, 1, { category: filters?.category })} className={buttonVariants({ variant: "outline" })}>
            {t("На першу сторінку")}
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {hasActiveFilters(filters) && (
            <>
              {t("Знайдено")} {total}
              {filters?.q && <> {t("за запитом")} «{filters.q}»</>}.{" "}
            </>
          )}
          {t("Показано")} {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + products.length} {t("з")} {total}
        </p>
        <nav aria-label={t("Сортування товарів")} className="flex flex-wrap gap-1.5">
          {(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => (
            <Link
              key={key}
              href={buildHref(basePath, key, 1, filters)}
              aria-current={key === sort ? "true" : undefined}
              className={cn(
                buttonVariants({
                  variant: key === sort ? "secondary" : "ghost",
                  size: "sm",
                }),
              )}
            >
              {t(SORT_OPTIONS[key].label)}
            </Link>
          ))}
        </nav>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {products.map((product, i) => (
          <li key={product.id}>
            <ProductCard
              product={product}
              isFavorite={favorites.has(product.id)}
              isAuthenticated={isAuthenticated}
              priority={i < 2}
            />
          </li>
        ))}
      </ul>

      <Pagination
        basePath={basePath}
        sort={sort}
        page={page}
        totalPages={totalPages}
        filters={filters}
      />
    </div>
  );
}
