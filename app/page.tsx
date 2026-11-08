import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = {
  title: { absolute: `${siteConfig.name} — товари для далекобійників` },
  description: siteConfig.description,
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default async function HomePage() {
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);
  return (
    <section className="flex flex-col items-start gap-6 py-12">
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
        {siteConfig.name}
      </h1>
      <p className="max-w-xl text-muted-foreground">
        {t("Практичні товари та аксесуари для далекобійників і професійних водіїв у довгих європейських рейсах.")}
      </p>
      <Link href="/products" className={buttonVariants({ size: "lg" })}>
        {t("Переглянути товари")}
      </Link>
    </section>
  );
}
