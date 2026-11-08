"use client";

import Link from "next/link";
import { useLanguage } from "@/components/layout/language-provider";
import { AddToCartButton } from "@/components/catalog/add-to-cart-button";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { StockBadge } from "@/components/catalog/stock-badge";
import { ProductImage } from "@/components/product/product-image";
import type { CatalogProduct } from "@/lib/db/queries/products";
import { getPrimaryImage } from "@/lib/storage/urls";
import { formatPrice } from "@/lib/utils";

type ProductCardProps = {
  product: CatalogProduct;
  isFavorite: boolean;
  isAuthenticated: boolean;
  priority?: boolean;
  onFavoriteChange?: (productId: string, isFavorite: boolean) => void;
};

export function ProductCard({
  product,
  isFavorite,
  isAuthenticated,
  priority,
  onFavoriteChange,
}: ProductCardProps) {
  const image = getPrimaryImage(product.product_images);
  const { t } = useLanguage();
  const name = t(product.name);
  const outOfStock = product.stock_quantity <= 0;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border bg-card transition-shadow focus-within:shadow-md hover:shadow-md">
      <ProductImage
        storagePath={image?.storage_path ?? null}
        alt={image?.alt_text || name}
        priority={priority}
        className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]"
      />

      <FavoriteButton
        productId={product.id}
        productName={name}
        initialIsFavorite={isFavorite}
        isAuthenticated={isAuthenticated}
        onFavoriteChange={onFavoriteChange}
        className="absolute right-2 top-2 z-10"
      />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-medium leading-snug">
          {/* Stretched link: the whole card opens the product page. */}
          <Link
            href={`/products/${product.slug}`}
            className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {name}
          </Link>
        </h3>
        {product.short_description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {t(product.short_description)}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <p className="text-lg font-semibold">
            {formatPrice(product.price, product.currency)}
          </p>
          <StockBadge stockQuantity={product.stock_quantity} />
        </div>
        <AddToCartButton
          productId={product.id}
          productName={name}
          isAuthenticated={isAuthenticated}
          disabled={outOfStock}
          className="relative z-10 w-full"
        />
      </div>
    </article>
  );
}
