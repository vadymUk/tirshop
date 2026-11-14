import type { Metadata } from "next";
import { LegalPage, legalTitle } from "@/components/shared/legal-page";
import { getPublicPage } from "@/lib/pages/data";
import { pageMetadata, PublicPage } from "@/lib/pages/public-page";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (await getPublicPage("privacy")) return pageMetadata("privacy");
  return { title: await legalTitle("privacy"), robots: { index: false } };
}

export default async function PrivacyPage() {
  if (await getPublicPage("privacy")) return <PublicPage slug="privacy" />;
  return <LegalPage page="privacy" />;
}
