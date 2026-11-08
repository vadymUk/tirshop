import type { Metadata } from "next";
import { MessageCircle, MessageSquare, Phone, Send, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { companyInfo, sellerContacts, siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = {
  title: "Про нас",
  description:
    "Практичні товари та аксесуари для далекобійників і професійних водіїв у довгих європейських рейсах. Контакти продавця.",
  alternates: { canonical: "/about" },
};

type Channel = {
  label: string;
  href: string;
  icon: LucideIcon;
  external: boolean;
  hint: string;
};

const channels: Channel[] = [
  { label: "Телефон", href: sellerContacts.links.phone, icon: Phone, external: false, hint: "Зателефонувати" },
  { label: "WhatsApp", href: sellerContacts.links.whatsapp, icon: MessageCircle, external: true, hint: "Написати у WhatsApp" },
  { label: "Viber", href: sellerContacts.links.viber, icon: MessageSquare, external: false, hint: "Написати у Viber" },
  { label: "Telegram", href: sellerContacts.links.telegram, icon: Send, external: true, hint: "Написати в Telegram" },
];

const legalRows: { label: string; value: string | null }[] = [
  { label: "Назва компанії", value: companyInfo.companyName },
  { label: "Адреса", value: companyInfo.address },
  { label: "NIP", value: companyInfo.nip },
  { label: "REGON", value: companyInfo.regon },
  { label: "Інформація про VAT", value: companyInfo.vat },
  { label: "Години роботи", value: companyInfo.businessHours },
];

export default async function AboutPage() {
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <section className="space-y-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Truck className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t("Про нас")} {siteConfig.name}</h1>
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
      </section>

      <section id="contacts" aria-labelledby="contacts-title" className="scroll-mt-24 space-y-4">
        <h2 id="contacts-title" className="text-2xl font-semibold">
          {t("Контакти продавця")}
        </h2>
        <p className="text-muted-foreground">
          {t("Оберіть зручний спосіб зв'язку:")} {sellerContacts.phoneDisplay}.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {channels.map(({ label, href, icon: Icon, external, hint }) => (
            <li key={label}>
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                aria-label={`${hint}: ${sellerContacts.phoneDisplay}`}
                className="flex items-center gap-4 rounded-lg border p-4 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-muted-foreground">
                    {sellerContacts.phoneDisplay}
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
