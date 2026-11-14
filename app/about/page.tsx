import type { Metadata } from "next";
import { MessageCircle, MessageSquare, Phone, Send, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { companyInfo } from "@/config/site";
import { cn } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";
import { PageContent } from "@/components/pages/page-content";
import { getPublicPage } from "@/lib/pages/data";
import { pageMetadata } from "@/lib/pages/public-page";
import { getPublicSettings, contactLinks } from "@/lib/settings/public";

export const dynamic = "force-dynamic";

const fallbackMetadata: Metadata = {
  title: "Про нас",
  description:
    "Практичні товари та аксесуари для далекобійників і професійних водіїв у довгих європейських рейсах. Контакти продавця.",
  alternates: { canonical: "/about" },
};

export async function generateMetadata(): Promise<Metadata> {
  return (await getPublicPage("about")) ? pageMetadata("about") : fallbackMetadata;
}

type Channel = {
  label: string;
  href: string;
  icon: LucideIcon;
  external: boolean;
  hint: string;
  value: string;
};

export default async function AboutPage() {
  const [page, language, settings] = await Promise.all([getPublicPage("about"), getLanguage(), getPublicSettings()]);
  const t = (source: string) => translate(language, source);
  const links = contactLinks(settings);
  const channels: Channel[] = [
    { label: "Телефон", href: links.phone, icon: Phone, external: false, hint: "Зателефонувати", value: settings.contact_phone },
    { label: "WhatsApp", href: links.whatsapp, icon: MessageCircle, external: true, hint: "Написати у WhatsApp", value: settings.whatsapp_number },
    { label: "Viber", href: links.viber, icon: MessageSquare, external: false, hint: "Написати у Viber", value: settings.viber_number },
    { label: "Telegram", href: links.telegram, icon: Send, external: true, hint: "Написати в Telegram", value: settings.telegram_username || settings.contact_phone },
  ].filter((channel) => channel.href);
  const legalRows = [
    { label: "Назва компанії", value: settings.company_name || companyInfo.companyName },
    { label: "Адреса", value: settings.business_address || companyInfo.address },
    { label: "NIP", value: settings.nip || companyInfo.nip },
    { label: "REGON", value: settings.regon || companyInfo.regon },
    { label: "Інформація про VAT", value: settings.vat_details || companyInfo.vat },
    { label: "Адреса повернення", value: settings.return_address || null },
    { label: "Години роботи", value: companyInfo.businessHours },
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      {page ? <PageContent document={page} /> : <section className="space-y-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Truck className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t("Про нас")} {settings.store_name}</h1>
        <p className="text-lg text-muted-foreground">
          {t("Наш магазин спеціалізується на товарах і корисних аксесуарах для далекобійників та професійних водіїв, які проводять багато часу на європейських дорогах.")}
        </p>
        <p>
          {t("Ми пропонуємо практичні товари, які роблять довгі рейси та повсякденне життя в кабіні вантажівки комфортнішим і зручнішим: від речей для відпочинку та приготування їжі до інструментів і електроніки в дорогу.")}
        </p>
        <a
          href="#contacts"
          className={cn(buttonVariants({ size: "lg" }), "mt-2")}
        >
          {t("Зв'язатися з продавцем")}
        </a>
      </section>}

      <section id="contacts" aria-labelledby="contacts-title" className="scroll-mt-24 space-y-4">
        <h2 id="contacts-title" className="text-2xl font-semibold">
          {t("Контакти продавця")}
        </h2>
        <p className="text-muted-foreground">
          {t("Оберіть зручний спосіб зв'язку:")}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {channels.map(({ label, href, icon: Icon, external, hint, value }) => (
            <li key={label}>
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                aria-label={`${hint}: ${value}`}
                className="flex items-center gap-4 rounded-lg border p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-muted-foreground">
                    {value}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section id="company" aria-labelledby="company-title" className="scroll-mt-24 space-y-4">
        <h2 id="company-title" className="text-2xl font-semibold">
          {t("Інформація про компанію")}
        </h2>
        <dl className="divide-y rounded-lg border">
          {legalRows.map(({ label, value }) => (
            <div key={label} className="grid gap-1 p-4 text-sm sm:grid-cols-[14rem_1fr]">
              <dt className="text-muted-foreground">{t(label)}</dt>
              <dd className={value ? "font-medium" : "italic text-muted-foreground"}>
                {value ?? t("Буде додано пізніше")}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
