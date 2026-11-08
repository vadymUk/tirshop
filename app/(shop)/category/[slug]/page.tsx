import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryNav } from "@/components/catalog/category-nav";
import { FilterPanel } from "@/components/catalog/filter-panel";
import { buildListingHref, hasActiveFilters } from "@/lib/catalog/listing";
import { ProductListing } from "@/components/catalog/product-listing";
import { parseListingParams } from "@/lib/catalog/config";
import { getAuthUser } from "@/lib/auth/session";
import { getCategories, getCategoryBySlug } from "@/lib/db/queries/categories";
import { getFavoriteProductIds, getProductsPage } from "@/lib/db/queries/products";
import { getProductImageOriginalUrl } from "@/lib/storage/urls";
import { absoluteUrl, breadcrumbJsonLd, truncate } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    sort?: string;
    page?: string;
    q?: string;
    minPrice?: string;
    maxPrice?: string;
    availability?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Категорію не знайдено", robots: { index: false } };

  const { sort, page, q, minPrice, maxPrice, availability } = parseListingParams(
    await searchParams,
  );
  const filtered = hasActiveFilters({ q, minPrice, maxPrice, availability });
  const { totalPages } = await getProductsPage({
    categoryId: category.id,
    sort,
    page,
    search: q,
    minPrice,
    maxPrice,
    inStockOnly: availability === "in_stock",
  });

  const basePath = `/category/${category.slug}`;
  const title = page > 1 ? `${category.name} — сторінка ${page}` : category.name;
  const baseDescription = truncate(
    category.description ??
      `${category.name}: практичні товари для далекобійників у довгих рейсах Європою.`,
    140,
  );
  const description = page > 1 ? `${baseDescription} Сторінка ${page}.` : baseDescription;
  // Sorted variants duplicate the default listing; canonical points at the plain paginated URL.
  const canonical = buildListingHref(basePath, "newest", page);

  return {
    title,
    description,
    // Filtered views duplicate the plain category listing.
    robots: filtered ? { index: false, follow: true } : undefined,
    alternates: { canonical },
    pagination: {
      previous: page > 1 ? buildListingHref(basePath, "newest", page - 1) : null,
      next: page < totalPages ? buildListingHref(basePath, "newest", page + 1) : null,
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(canonical),
      type: "website",
      images: category.image_url
        ? [category.image_url.startsWith("http") ? category.image_url : getProductImageOriginalUrl(category.image_url)]
        : undefined,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const { sort, page, q, minPrice, maxPrice, availability } = parseListingParams(
    await searchParams,
  );
  const filters = { q, minPrice, maxPrice, availability };
  const [listing, categories, favoriteIds, user] = await Promise.all([
    getProductsPage({
      categoryId: category.id,
      sort,
      page,
      search: q,
      minPrice,
      maxPrice,
      inStockOnly: availability === "in_stock",
    }),
    getCategories(),
    getFavoriteProductIds(),
    getAuthUser(),
  ]);

  // A page past the end is a 404, not an empty listing.
  if (page > 1 && listing.products.length === 0) notFound();

  return (
    <div className="space-y-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("Головна"), path: "/" },
          { name: t("Товари"), path: "/products" },
          { name: t(category.name), path: `/category/${category.slug}` },
        ])}
      />
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{t(category.name)}</h1>
        {category.description && (
          <p className="max-w-2xl text-muted-foreground">{t(category.description)}</p>
        )}
      </header>
      <CategoryNav categories={categories} activeSlug={category.slug} filters={filters} />
      <FilterPanel basePath={`/category/${category.slug}`} sort={sort} filters={filters} />
      <ProductListing
        basePath={`/category/${category.slug}`}
        {...listing}
        sort={sort}
        filters={filters}
        favoriteIds={favoriteIds}
        isAuthenticated={Boolean(user)}
      />
    </div>
  );
}
