import { ProductCard } from "@/components/catalog/product-card";
import { getAuthUser } from "@/lib/auth/session";
import { getFavoriteProductIds, getRelatedProducts } from "@/lib/db/queries/products";

export async function RelatedProducts({
  categoryId,
  productId,
  heading,
}: {
  categoryId: string;
  productId: string;
  heading: string;
}) {
  const [related, user, favoriteIds] = await Promise.all([
    getRelatedProducts(categoryId, productId),
    getAuthUser(),
    getFavoriteProductIds(),
  ]);
  if (related.length === 0) return null;
  const isAuthenticated = Boolean(user);

  return (
    <section aria-labelledby="related-heading" className="space-y-4">
      <h2 id="related-heading" className="text-xl font-semibold">
        {heading}
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {related.map((item) => (
          <li key={item.id}>
            <ProductCard
              product={item}
              isFavorite={favoriteIds.includes(item.id)}
              isAuthenticated={isAuthenticated}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
