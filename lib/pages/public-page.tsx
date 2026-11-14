import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContent } from "@/components/pages/page-content";
import { mediaUrl } from "@/lib/admin/media-shared";
import { getPublicPage } from "@/lib/pages/data";
import { pageHref } from "@/lib/pages/schema";

export async function pageMetadata(slug: string): Promise<Metadata> {
  const page = await getPublicPage(slug);
  if (!page) return { robots: { index: false, follow: false } };
  const title = page.meta_title || page.title;
  const description = page.meta_description || page.excerpt;
  const url = page.canonical_url || pageHref(page.slug);
  const image = page.og_image_path ? mediaUrl("site-media", page.og_image_path) : undefined;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, ...(image ? { images: [image] } : {}) } };
}

export async function PublicPage({ slug }: { slug: string }) {
  const page = await getPublicPage(slug);
  if (!page) notFound();
  return <PageContent document={page} />;
}
