"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { SortKey } from "@/lib/catalog/config";
import { buildListingHref, type ListingFilters } from "@/lib/catalog/listing";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/layout/language-provider";

/** Page numbers to show: first, last, and a window around the current page. */
function getPageItems(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push("gap");
    items.push(p);
  });
  return items;
}

type PaginationProps = {
  basePath: string;
  sort: SortKey;
  page: number;
  totalPages: number;
  filters?: ListingFilters;
};

export function Pagination({ basePath, sort, page, totalPages, filters }: PaginationProps) {
  const { t } = useLanguage();
  if (totalPages <= 1) return null;

  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return (
    <nav aria-label={t("Сторінки")} className="flex flex-wrap items-center justify-center gap-1.5">
      {isFirst ? (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft aria-hidden="true" />
          {t("Назад")}
        </Button>
      ) : (
        <Link
          href={buildListingHref(basePath, sort, page - 1, filters)}
          rel="prev"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ChevronLeft aria-hidden="true" />
          {t("Назад")}
        </Link>
      )}

      <ul className="flex items-center gap-1.5">
        {getPageItems(page, totalPages).map((item, i) =>
          item === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={buildListingHref(basePath, sort, item, filters)}
                aria-label={`${t("Сторінка")} ${item}`}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  buttonVariants({
                    variant: item === page ? "default" : "outline",
                    size: "sm",
                  }),
                  "min-w-9",
                )}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ul>

      {isLast ? (
        <Button variant="outline" size="sm" disabled>
          {t("Далі")}
          <ChevronRight aria-hidden="true" />
        </Button>
      ) : (
        <Link
          href={buildListingHref(basePath, sort, page + 1, filters)}
          rel="next"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {t("Далі")}
          <ChevronRight aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
