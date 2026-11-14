import type { Metadata } from "next";
import { LegalPage, legalTitle } from "@/components/shared/legal-page";
import { getPublicPage } from "@/lib/pages/data";
import { pageMetadata, PublicPage } from "@/lib/pages/public-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (await getPublicPage("shipping")) return pageMetadata("shipping");
  return { title: await legalTitle("shipping"), robots: { index: false } };
}

export default async function ShippingPage() {
  if (await getPublicPage("shipping")) return <PublicPage slug="shipping" />;
  return <LegalPage page="shipping" />;
}
