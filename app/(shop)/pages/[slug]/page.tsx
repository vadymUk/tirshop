import { notFound } from "next/navigation";
import { pageMetadata, PublicPage } from "@/lib/pages/public-page";
import { fixedSlugs } from "@/lib/pages/schema";

export const dynamic = "force-dynamic";

function customSlug(slug: string) {
  if ((fixedSlugs as readonly string[]).includes(slug)) notFound();
  return slug;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return pageMetadata(customSlug((await params).slug));
}

export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  return <PublicPage slug={customSlug((await params).slug)} />;
}
