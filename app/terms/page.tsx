import type { Metadata } from "next";
import { LegalPage, legalTitle } from "@/components/shared/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await legalTitle("terms"), robots: { index: false } };
}

export default function TermsPage() {
  return <LegalPage page="terms" />;
}
