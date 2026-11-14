import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { HomeContent } from "@/components/homepage/home-content";
import { siteConfig } from "@/config/site";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";
import { getHomepageCatalog, getPublicHomepage, homepageRenderTime } from "@/lib/homepage/data";
import { getPublicSettings } from "@/lib/settings/public";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  return {
    title: { absolute: `${settings.store_name} — товари для далекобійників` },
    description: settings.store_description ?? siteConfig.description,
    alternates: { canonical: "/" },
    openGraph: { url: "/" },
  };
}

export default async function HomePage() {
  const [language, document, settings] = await Promise.all([getLanguage(), getPublicHomepage(), getPublicSettings()]);
  const [catalog, now] = await Promise.all([getHomepageCatalog(document), homepageRenderTime()]);
  const t = (source: string) => translate(language, source);
  return (
    <>
      <JsonLd data={[organizationJsonLd(settings.store_name, settings.store_description ?? siteConfig.description, settings.contact_phone), websiteJsonLd(settings.store_name)]} />
      <HomeContent document={document} catalog={catalog} translate={t} now={now} />
    </>
  );
}
