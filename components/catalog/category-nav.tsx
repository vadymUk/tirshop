"use client";

import Link from "next/link";
import { buildListingHref, hasActiveFilters, type ListingFilters } from "@/lib/catalog/listing";
import { buttonVariants } from "@/components/ui/button";
import type { Category } from "@/types/database";
import { useLanguage } from "@/components/layout/language-provider";

type NavCategory = Pick<Category, "id" | "name" | "slug">;

export function CategoryNav({
  categories,
  activeSlug,
  filters,
}: {
  categories: NavCategory[];
  activeSlug?: string;
  /** When filters are active, links stay on /products so they are kept. */
  filters?: ListingFilters;
}) {
  const { t } = useLanguage();
  if (categories.length === 0) return null;
  const filtered = hasActiveFilters(filters);
  const item = (active: boolean) =>
    buttonVariants({ variant: active ? "default" : "outline", size: "sm" });

  return (
    <nav aria-label={t("Категорії")} className="flex flex-wrap gap-2">
      <Link
        href={filtered ? buildListingHref("/products", "newest", 1, { ...filters, category: undefined }) : "/products"}
        aria-current={activeSlug ? undefined : "page"}
        className={item(!activeSlug)}
      >
        {t("Усі")}
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={
            filtered
              ? buildListingHref("/products", "newest", 1, { ...filters, category: category.slug })
              : `/category/${category.slug}`
          }
          aria-current={category.slug === activeSlug ? "page" : undefined}
          className={item(category.slug === activeSlug)}
        >
          {t(category.name)}
        </Link>
      ))}
    </nav>
  );
}
