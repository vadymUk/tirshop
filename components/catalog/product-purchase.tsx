import { AddToCartForm } from "@/components/catalog/add-to-cart-form";
import { FavoriteButton } from "@/components/catalog/favorite-button";
import { getAuthUser } from "@/lib/auth/session";
import { getCartQuantity, getFavoriteProductIds } from "@/lib/db/queries/products";

/** Personalised controls: streamed separately so the cached product content is not blocked. */
export async function ProductPurchase({
  productId,
  productName,
  stockQuantity,
}: {
  productId: string;
  productName: string;
  stockQuantity: number;
}) {
  const [user, favoriteIds, cartQuantity] = await Promise.all([
    getAuthUser(),
    getFavoriteProductIds(),
    getCartQuantity(productId),
  ]);
  const isAuthenticated = Boolean(user);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <AddToCartForm
          productId={productId}
          productName={productName}
          stockQuantity={stockQuantity}
          initialCartQuantity={cartQuantity}
          isAuthenticated={isAuthenticated}
        />
      </div>
      <FavoriteButton
        productId={productId}
        productName={productName}
        initialIsFavorite={favoriteIds.includes(productId)}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}

/** Reserves the same space as the loaded controls to avoid layout shift. */
export function ProductPurchaseSkeleton() {
  return <div className="h-24 animate-pulse rounded-lg bg-muted" aria-hidden="true" />;
}
