import type { Metadata } from "next";
import { LegalPage, legalTitle } from "@/components/shared/legal-page";
import { getPublicPage } from "@/lib/pages/data";
import { pageMetadata, PublicPage } from "@/lib/pages/public-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (await getPublicPage("returns")) return pageMetadata("returns");
  return { title: await legalTitle("returns"), robots: { index: false } };
}

export default async function ReturnsPage() {
  if (await getPublicPage("returns")) return <PublicPage slug="returns" />;
  return <LegalPage page="returns" />;
}
