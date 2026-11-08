import type { Metadata } from "next";
import { LegalPage, legalTitle } from "@/components/shared/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await legalTitle("privacy"), robots: { index: false } };
}

export default function PrivacyPage() {
  return <LegalPage page="privacy" />;
}
