import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { ProductPurchase, ProductPurchaseSkeleton } from "@/components/catalog/product-purchase";
import { RelatedProducts } from "@/components/catalog/related-products";
import { StockBadge } from "@/components/catalog/stock-badge";
import { getProductBySlug } from "@/lib/db/queries/products";
import { getProductImageOriginalUrl, sortProductImages } from "@/lib/storage/urls";
import { absoluteUrl, breadcrumbJsonLd, truncate } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { formatPrice } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";
import { seoImagePath, mediaUrl } from "@/lib/admin/media-shared";

type Props = { params: Promise<{ slug: string }> };

function productDescription(product: {
  name: string;
  short_description: string | null;
  description: string | null;
}) {
  const text = product.short_description || product.description;
  return truncate(text || `${product.name} — товар для далекобійників у магазині Truck Shop.`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Товар не знайдено", robots: { index: false } };

  const first = sortProductImages(product.product_images)[0];
  const title = product.meta_title || product.name;
  const description = product.meta_description || productDescription(product);
  const url = absoluteUrl(`/products/${product.slug}`);
  if (product.og_image_path && !seoImagePath.safeParse(product.og_image_path).success) {
    throw new Error("Invalid product Open Graph image path");
  }
  const images = product.og_image_path
    ? [{ url: mediaUrl("site-media", product.og_image_path), alt: product.name }]
    : first
      ? [{ url: getProductImageOriginalUrl(first.storage_path), alt: first.alt_text || product.name }]
    : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title, description, url, type: "website", images },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: images?.map((i) => i.url),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [language, product] = await Promise.all([getLanguage(), getProductBySlug(slug)]);
  const t = (source: string) => translate(language, source);
  if (!product) notFound();

  const category = product.categories;
  const images = sortProductImages(product.product_images);
  const inStock = product.stock_quantity > 0;

  const productUrl = absoluteUrl(`/products/${product.slug}`);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: productDescription(product),
    url: productUrl,
    image: images.map((i) => getProductImageOriginalUrl(i.storage_path)),
    offers: {
      "@type": "Offer",
      url: productUrl,
      price: product.price,
      priceCurrency: product.currency,
      itemCondition: "https://schema.org/NewCondition",
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
  const breadcrumbs = breadcrumbJsonLd([
    { name: t("Головна"), path: "/" },
    { name: t("Товари"), path: "/products" },
    ...(category ? [{ name: t(category.name), path: `/category/${category.slug}` }] : []),
    { name: t(product.name), path: `/products/${product.slug}` },
  ]);

  return (
    <div className="space-y-12">
      <JsonLd data={[productJsonLd, breadcrumbs]} />
      <nav aria-label={t("Навігаційний ланцюжок")} className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/products" className="hover:underline">
              {t("Товари")}
            </Link>
          </li>
          {category && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true">/</span>
              <Link href={`/category/${category.slug}`} className="hover:underline">
                {t(category.name)}
              </Link>
            </li>
          )}
          <li className="flex items-center gap-1.5" aria-current="page">
            <span aria-hidden="true">/</span>
            {t(product.name)}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery
          images={images.map(({ id, storage_path, alt_text }) => ({
            id,
            storage_path,
            alt_text,
          }))}
          productName={t(product.name)}
        />

        <div className="space-y-6">
          <div className="space-y-2">
            {category && (
              <Link
                href={`/category/${category.slug}`}
                className="text-sm font-medium text-muted-foreground hover:underline"
              >
                {t(category.name)}
              </Link>
            )}
            <h1 className="text-3xl font-bold tracking-tight">            {t(product.name)}</h1>
            {product.short_description && (
                          <p className="text-muted-foreground">{t(product.short_description)}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <p className="text-3xl font-semibold">
              {formatPrice(product.price, product.currency)}
            </p>
            <StockBadge stockQuantity={product.stock_quantity} />
          </div>

          <Suspense fallback={<ProductPurchaseSkeleton />}>
            <ProductPurchase
              productId={product.id}
              productName={t(product.name)}
              stockQuantity={product.stock_quantity}
            />
          </Suspense>

          {product.description && (
            <section aria-labelledby="description-heading" className="space-y-2">
              <h2 id="description-heading" className="text-lg font-semibold">
                {t("Опис")}
              </h2>
              <p className="whitespace-pre-line text-muted-foreground">
                {t(product.description)}
              </p>
            </section>
          )}
        </div>
      </div>

      {product.category_id && (
        <Suspense fallback={<div className="h-80" aria-hidden="true" />}>
          <RelatedProducts
            categoryId={product.category_id}
            productId={product.id}
            heading={t("Схожі товари")}
          />
        </Suspense>
      )}
    </div>
  );
}
