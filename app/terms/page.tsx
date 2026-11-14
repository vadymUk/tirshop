import type { Metadata } from "next";
import { LegalPage, legalTitle } from "@/components/shared/legal-page";
import { getPublicPage } from "@/lib/pages/data";
import { pageMetadata, PublicPage } from "@/lib/pages/public-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (await getPublicPage("terms")) return pageMetadata("terms");
  return { title: await legalTitle("terms"), robots: { index: false } };
}

export default async function TermsPage() {
  if (await getPublicPage("terms")) return <PublicPage slug="terms" />;
  return <LegalPage page="terms" />;
}
