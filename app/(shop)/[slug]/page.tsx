import { notFound } from "next/navigation";
import { fixedSlugs } from "@/lib/pages/schema";
import { pageMetadata, PublicPage } from "@/lib/pages/public-page";

export const dynamic = "force-dynamic";

function allowed(slug: string) {
  if (!(fixedSlugs as readonly string[]).includes(slug)) notFound();
  return slug;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return pageMetadata(allowed((await params).slug));
}

export default async function FixedPage({ params }: { params: Promise<{ slug: string }> }) {
  return <PublicPage slug={allowed((await params).slug)} />;
}
