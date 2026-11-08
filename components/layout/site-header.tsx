import { Suspense } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { CartLink } from "@/components/cart/cart-link";
import { AccountMenu } from "@/components/layout/account-menu";
import { CategoriesMenu } from "@/components/layout/categories-menu";
import { FavoritesLink } from "@/components/layout/favorites-link";
import { LanguageSelector } from "@/components/layout/language-selector";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NavLink } from "@/components/layout/nav-link";
import { SearchBox } from "@/components/layout/search-box";
import { ThemeSelector } from "@/components/layout/theme-selector";
import { siteConfig } from "@/config/site";
import { getAuthUser } from "@/lib/auth/session";
import { getCartCount } from "@/lib/db/queries/cart";
import { getCategoriesForNavigation } from "@/lib/db/queries/categories";
import { getFavoritesCount } from "@/lib/db/queries/products";

function PrimaryNav({
  children,
  language,
}: {
  children?: React.ReactNode;
  language: import("@/lib/translations").Language;
}) {
  const t = (source: string) => translate(language, source);
  return (
    <nav
      aria-label={t("Головна навігація")}
      className="hidden flex-1 items-center justify-center gap-1 xl:flex"
    >
      <NavLink href="/">{t("Головна")}</NavLink>
      <NavLink href="/products" matchPrefix>{t("Товари")}</NavLink>
      {children}
      <NavLink href="/about">{t("Про нас")}</NavLink>
    </nav>
  );
}

/** Reads the session, counts and categories; this is the only dynamic part of the header. */
async function HeaderDynamic() {
  const [user, language] = await Promise.all([getAuthUser(), getLanguage()]);
  // A failing query must never take the whole header (and site) down.
  const [categories, cartCount, favoritesCount] = await Promise.all([
    getCategoriesForNavigation(),
    user ? getCartCount().catch(() => 0) : 0,
    user ? getFavoritesCount().catch(() => 0) : 0,
  ]);
  const email = user?.email ?? null;

  return (
    <>
      <PrimaryNav language={language}>
        {categories.length > 0 && <CategoriesMenu categories={categories} />}
      </PrimaryNav>
      <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
        <LanguageSelector />
        <ThemeSelector />
        <FavoritesLink initialCount={favoritesCount} />
        <CartLink initialCount={cartCount} />
        <div className="hidden xl:block">
          <AccountMenu email={email} />
        </div>
        <MobileMenu categories={categories} email={email} siteName={siteConfig.name} />
      </div>
    </>
  );
}

export async function SiteHeader() {
  const language = await getLanguage();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <Link
          href="/"
          aria-label={siteConfig.name}
          className="flex shrink-0 items-center gap-2 rounded-md font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="gradient-shift flex size-9 items-center justify-center rounded-lg text-primary-foreground">
            <Truck className="size-5" aria-hidden="true" />
          </span>
          <span className="hidden text-lg min-[420px]:inline">{siteConfig.name}</span>
        </Link>
        <Suspense fallback={<div className="hidden h-10 w-56 lg:block" />}>
          <SearchBox className="hidden w-56 shrink-0 lg:block" />
        </Suspense>
        <Suspense fallback={<PrimaryNav language={language} />}>
          <HeaderDynamic />
        </Suspense>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-3 lg:hidden">
        <Suspense fallback={<div className="h-10" />}>
          <SearchBox />
        </Suspense>
      </div>
    </header>
  );
}
