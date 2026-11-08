import { Suspense } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { siteConfig, sellerContacts } from "@/config/site";
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
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);
  const { phoneDisplay, links } = sellerContacts;
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
  ];

  return (
    <footer className="mt-12 border-t bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr]">
        <section aria-labelledby="footer-about" className="space-y-3 sm:col-span-2 lg:col-span-1">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Truck className="size-5" aria-hidden="true" />
            </span>
            <span id="footer-about" className="text-lg">
              {siteConfig.name}
            </span>
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">
            {t("Практичні товари та аксесуари для далекобійників і професійних водіїв у довгих європейських рейсах.")}
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
            <p>
              <span className="text-muted-foreground">{t("Телефон: ")}</span>
              <a
                href={links.phone}
                aria-label={`${t("Зателефонувати:")} ${phoneDisplay}`}
                className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {phoneDisplay}
              </a>
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {messengers.map(({ label, href, external }) => (
                <li key={label}>
                  <a
                    href={href}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    aria-label={`${label}: ${phoneDisplay}`}
                    className={linkClass}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </address>
        </section>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. {t("Усі права захищено.")}
          </p>
          <p>
            {t("Реквізити компанії (NIP, REGON, VAT) —")}{" "}
            <Link href="/about#company" className={linkClass + " underline"}>
              {t("буде додано пізніше")}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
