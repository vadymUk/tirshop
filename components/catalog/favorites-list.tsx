"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { ProductCard } from "@/components/catalog/product-card";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import type { CatalogProduct } from "@/lib/db/queries/products";
import { useLanguage } from "@/components/layout/language-provider";

export function FavoritesList({ products }: { products: CatalogProduct[] }) {
  const { t } = useLanguage();
  // Ids hidden optimistically after un-favoriting; restored if the request fails.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const visible = products.filter((p) => !removed.has(p.id));

  function handleChange(productId: string, isFavorite: boolean) {
    setRemoved((prev) => {
      const next = new Set(prev);
      if (isFavorite) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title={t("No favorites yet")}
        description={t("Tap the heart on any product to save it here for later.")}
        action={
          <Link href="/products" className={buttonVariants()}>
            {t("Browse products")}
          </Link>
        }
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {visible.map((product) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            isFavorite
            isAuthenticated
            onFavoriteChange={handleChange}
          />
        </li>
      ))}
    </ul>
  );
}
