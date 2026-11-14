import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { mediaUrl } from "@/lib/admin/media-shared";
import type { getHomepageCatalog } from "@/lib/homepage/data";
import type { HomeBanner, HomeSection, HomepageDocument } from "@/lib/homepage/schema";
import { getPrimaryImage, getProductImageUrl } from "@/lib/storage/urls";
import { formatPrice } from "@/lib/utils";

type Catalog = Awaited<ReturnType<typeof getHomepageCatalog>>;
const textClass = "max-w-3xl whitespace-pre-line text-muted-foreground";

function Picture({ desktop, mobile, alt }: { desktop: string; mobile: string; alt: string }) {
  if (!desktop && !mobile) return null;
  return <picture>{mobile && <source media="(max-width: 639px)" srcSet={mediaUrl("site-media", mobile)} />}
    <img src={mediaUrl("site-media", desktop || mobile)} alt={alt} loading="lazy" className="max-h-96 w-full rounded-lg object-cover" />
  </picture>;
}

function Banner({ banner }: { banner: HomeBanner }) {
  return <article className="space-y-3 rounded-lg border p-4"><Picture desktop={banner.image_path} mobile={banner.mobile_image_path} alt={banner.title} />
    <h3 className="text-xl font-semibold">{banner.title}</h3>{banner.subtitle && <p className={textClass}>{banner.subtitle}</p>}
    {banner.button_text && banner.button_url && <Link className={buttonVariants({ variant: "outline" })} href={banner.button_url}>{banner.button_text}</Link>}
  </article>;
}

function Section({ section, catalog, translate }: { section: HomeSection; catalog: Catalog; translate: (text: string) => string }) {
  const { settings } = section;
  const selected = settings.product_ids.map((id) => catalog.products.find((item) => item.id === id)).filter((item) => item !== undefined);
  const selectedIds = new Set(selected.map((item) => item.id));
  const products = [...selected, ...catalog.featuredProducts.filter((item) => !selectedIds.has(item.id))];
  const categories = settings.category_ids.map((id) => catalog.categories.find((item) => item.id === id)).filter((item) => item !== undefined);
  const hero = section.section_type === "hero";
  return <section className={hero ? "flex flex-col items-start gap-6 py-12" : "space-y-4 py-8"}>
    {hero ? <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{translate(section.title)}</h1> : <h2 className="text-2xl font-bold">{translate(section.title)}</h2>}
    {section.subtitle && <p className="text-lg">{translate(section.subtitle)}</p>}
    {section.content && <p className={textClass}>{translate(section.content)}</p>}
    <Picture desktop={settings.desktop_image} mobile={settings.mobile_image} alt={section.title} />
    {section.section_type === "featured_categories" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{categories.map((category) => <Link key={category.id} href={`/category/${category.slug}`} className="rounded-lg border p-4 hover:border-primary"><h3 className="font-semibold">{category.name}</h3>{category.description && <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>}</Link>)}</div>}
    {section.section_type === "featured_products" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => {
      const image = getPrimaryImage(product.product_images);
      return <Link key={product.id} href={`/products/${product.slug}`} className="rounded-lg border p-4 hover:border-primary">{image && <Image src={getProductImageUrl(image.storage_path)} width={240} height={240} alt="" className="mb-3 aspect-square w-full object-contain" />}<h3 className="font-semibold">{product.name}</h3><p className="mt-1">{formatPrice(product.price, product.currency)}</p></Link>;
    })}</div>}
    {(settings.primary_text && settings.primary_url || settings.secondary_text && settings.secondary_url) && <div className="flex flex-wrap gap-3">
      {settings.primary_text && settings.primary_url && <Link href={settings.primary_url} className={buttonVariants({ size: "lg" })}>{translate(settings.primary_text)}</Link>}
      {settings.secondary_text && settings.secondary_url && <Link href={settings.secondary_url} className={buttonVariants({ size: "lg", variant: "outline" })}>{translate(settings.secondary_text)}</Link>}
    </div>}
  </section>;
}

export function HomeContent({ document, catalog, now, translate = (s) => s }: { document: HomepageDocument; catalog: Catalog; now: number; translate?: (s: string) => string }) {
  const banners = document.banners.filter((b) => b.is_active && (!b.starts_at || Date.parse(b.starts_at) <= now) && (!b.ends_at || Date.parse(b.ends_at) > now)).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const sections = document.sections.filter((section) => section.is_visible).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const group = (position: HomeBanner["position"]) => {
    const items = banners.filter((b) => b.position === position);
    return items.length ? <div className="grid gap-4 py-4 sm:grid-cols-2">{items.map((banner) => <Banner key={banner.id} banner={banner} />)}</div> : null;
  };
  const firstHero = sections.findIndex((s) => s.section_type === "hero");
  return <>{group("top")}{firstHero < 0 && group("hero")}
    {sections.map((s, i) => <div key={s.id}><Section section={s} catalog={catalog} translate={translate} />{i === firstHero && group("hero")}{i === Math.floor((sections.length - 1) / 2) && group("middle")}</div>)}
    {!sections.length && group("middle")}{group("bottom")}</>;
}
