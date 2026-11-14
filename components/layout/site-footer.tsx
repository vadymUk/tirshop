import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Truck } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getPublicSettings, contactLinks } from "@/lib/settings/public";
import { mediaUrl } from "@/lib/admin/media-shared";
import { getCategoriesForNavigation } from "@/lib/db/queries/categories";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

const linkClass =
  "rounded-sm text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring";

const infoLinks = [
  { href: "/privacy", label: "Політика конфіденційності" },
  { href: "/terms", label: "Умови та положення" },
  { href: "/shipping", label: "Інформація про доставку" },
  { href: "/returns", label: "Інформація про повернення" },
];

function FooterSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <nav aria-labelledby={id}>
      <h2 id={id} className="mb-3 text-sm font-semibold">
        {title}
      </h2>
      {children}
    </nav>
  );
}

async function FooterCategories() {
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);
  const categories = await getCategoriesForNavigation();
  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("Категорії з'являться незабаром.")}</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {categories.map((category) => (
        <li key={category.id}>
          <Link href={`/category/${category.slug}`} className={linkClass}>
            {t(category.name)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function SiteFooter() {
  const [language, settings] = await Promise.all([getLanguage(), getPublicSettings()]);
  const t = (source: string) => translate(language, source);
  const phoneDisplay = settings.contact_phone;
  const links = contactLinks(settings);
  const navLinks = [
    { href: "/", label: t("Головна") },
    { href: "/products", label: t("Товари") },
    { href: "/about", label: t("Про нас") },
    { href: "/about#contacts", label: t("Контакти") },
  ];
  const messengers = [
    { label: "WhatsApp", href: links.whatsapp, external: true },
    { label: "Viber", href: links.viber, external: false },
    { label: "Telegram", href: links.telegram, external: true },
  ].filter((item) => item.href);
  const social = [
    { label: "Facebook", href: settings.facebook_url }, { label: "Instagram", href: settings.instagram_url },
    { label: "TikTok", href: settings.tiktok_url }, { label: "YouTube", href: settings.youtube_url },
  ].filter((item) => item.href);

  return (
    <footer className="mt-12 border-t bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr]">
        <section aria-labelledby="footer-about" className="space-y-3 sm:col-span-2 lg:col-span-1">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {settings.logo_path ? <Image src={mediaUrl("site-media", settings.logo_path)} width={36} height={36} alt="" className="size-9 object-contain" /> : <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Truck className="size-5" aria-hidden="true" />
            </span>}
            <span id="footer-about" className="text-lg">
              {settings.store_name}
            </span>
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">
            {settings.store_description === null ? t(siteConfig.description) : settings.store_description}
          </p>
        </section>

        <FooterSection id="footer-nav" title={t("Навігація")}>
          <ul className="space-y-2 text-sm">
            {navLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </FooterSection>

        <FooterSection id="footer-categories" title={t("Категорії товарів")}>
          <Suspense fallback={<p className="text-sm text-muted-foreground">{t("Завантаження…")}</p>}>
            <FooterCategories />
          </Suspense>
        </FooterSection>

        <FooterSection id="footer-info" title={t("Інформація")}>
          <ul className="space-y-2 text-sm">
            {infoLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {t(item.label)}
                </Link>
              </li>
            ))}
          </ul>
        </FooterSection>

        <section aria-labelledby="footer-contact">
          <h2 id="footer-contact" className="mb-3 text-sm font-semibold">
            {t("Контакти")}
          </h2>
          <address className="space-y-2 text-sm not-italic">
            {phoneDisplay && <p>
              <span className="text-muted-foreground">{t("Телефон: ")}</span>
              <a
                href={links.phone}
                aria-label={`${t("Зателефонувати:")} ${phoneDisplay}`}
                className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {phoneDisplay}
              </a>
            </p>}
            {settings.contact_email && <p><a href={`mailto:${settings.contact_email}`} className={linkClass}>{settings.contact_email}</a></p>}
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {messengers.map(({ label, href, external }) => (
                <li key={label}>
                  <a
                    href={href}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    aria-label={label}
                    className={linkClass}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {social.map(({ label, href }) => <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>{label}</a></li>)}
            </ul>
          </address>
        </section>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {settings.store_name}. {t("Усі права захищено.")}
          </p>
          <p>
            <Link href="/about#company" className={linkClass + " underline"}>
              {settings.company_name || settings.nip || settings.regon || settings.vat_details
                ? t("Інформація про компанію")
                : `${t("Реквізити компанії (NIP, REGON, VAT) —")} ${t("буде додано пізніше")}`}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
