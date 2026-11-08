import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FilterPanel } from "@/components/catalog/filter-panel";
import { buildListingHref, hasActiveFilters } from "@/lib/catalog/listing";
import { CategoryNav } from "@/components/catalog/category-nav";
import { ProductListing } from "@/components/catalog/product-listing";
import { ResultsSkeleton } from "@/components/catalog/skeletons";
import { parseListingParams } from "@/lib/catalog/config";
import { getAuthUser } from "@/lib/auth/session";
import { getCategoriesForNavigation, getCategoryBySlug } from "@/lib/db/queries/categories";
import { getFavoriteProductIds, getProductsPage } from "@/lib/db/queries/products";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

type RawParams = {
  sort?: string;
  page?: string;
  q?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  availability?: string;
};
type Props = { searchParams: Promise<RawParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { page, q, category, ...rest } = parseListingParams(await searchParams);

  // Search and filter results are thin, duplicate views: keep them out of the index.
  if (category || hasActiveFilters({ q, ...rest })) {
    return {
      title: q ? `Пошук: ${q}` : "Товари",
      alternates: { canonical: "/products" },
      robots: { index: false, follow: true },
    };
  }

  const title = page > 1 ? `Товари — сторінка ${page}` : "Товари";
  const description =
    "Товари та аксесуари для далекобійників у довгих рейсах Європою." +
    (page > 1 ? ` Сторінка ${page}.` : "");
  // Sorted variants duplicate the default listing, so canonical drops the sort.
  const canonical = buildListingHref("/products", "newest", page);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
  };
}

async function Results({ params }: { params: RawParams }) {
  const {
    sort,
    page,
    q,
    category: categorySlug,
    minPrice,
    maxPrice,
    availability,
  } = parseListingParams(params);

  const [category, favoriteIds, user] = await Promise.all([
    categorySlug ? getCategoryBySlug(categorySlug) : null,
    getFavoriteProductIds(),
    getAuthUser(),
  ]);
  const listing = await getProductsPage({
    categoryId: category?.id,
    sort,
    page,
    search: q,
    minPrice,
    maxPrice,
    inStockOnly: availability === "in_stock",
  });
  if (page > 1 && listing.products.length === 0) notFound();

  return (
    <ProductListing
      basePath="/products"
      {...listing}
      sort={sort}
      filters={{ q, category: category?.slug, minPrice, maxPrice, availability }}
      favoriteIds={favoriteIds}
      isAuthenticated={Boolean(user)}
    />
  );
}

export default async function ProductsPage({ searchParams }: Props) {
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);
  const params = await searchParams;
  const {
    sort,
    page,
    q,
    category: categorySlug,
    minPrice,
    maxPrice,
    availability,
  } = parseListingParams(params);
  const filters = { q, category: categorySlug, minPrice, maxPrice, availability };
  const categories = await getCategoriesForNavigation();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{q ? `${t("Пошук:")} ${q}` : t("Товари")}</h1>
      <CategoryNav
        categories={categories}
        filters={filters}
        activeSlug={categorySlug}
      />
      <FilterPanel basePath="/products" sort={sort} filters={filters} />
      {/* Keyed so each new query shows the skeleton while the server filters in PostgreSQL. */}
      <Suspense
        key={JSON.stringify([q, categorySlug, minPrice, maxPrice, availability, sort, page])}
        fallback={<ResultsSkeleton label={t("Завантаження товарів")} />}
      >
        <Results params={params} />
      </Suspense>
    </div>
  );
}