import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/components/layout/language-provider";
import { StoreChrome } from "@/components/layout/store-chrome";
import { siteConfig } from "@/config/site";
import { getLanguage } from "@/lib/i18n";
import { SITE_URL } from "@/lib/seo";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { getThemePreference } from "@/lib/theme-server";
import { getPublicSettings } from "@/lib/settings/public";
import "./globals.css";

const themeInitScript = `
  const savedTheme = (() => {
    try {
      return localStorage.getItem("${THEME_STORAGE_KEY}");
    } catch {
      return null;
    }
  })();
  document.documentElement.classList.toggle(
    "dark",
    savedTheme === "dark" ||
      (savedTheme !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
`;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  const description = settings.store_description ?? siteConfig.description;
  const locales: Record<string, string> = { uk: "uk_UA", ru: "ru_RU", pl: "pl_PL" };
  const locale = locales[settings.default_language.split("-")[0]] ?? siteConfig.locale;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: settings.store_name, template: `%s | ${settings.store_name}` },
    description,
    keywords: [...siteConfig.keywords],
    applicationName: settings.store_name,
    openGraph: { type: "website", siteName: settings.store_name, locale, title: settings.store_name, description },
    twitter: { card: "summary_large_image", title: settings.store_name, description },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [language, themePreference] = await Promise.all([
    getLanguage(),
    getThemePreference(),
  ]);
  const initialDark = themePreference === "dark";

  return (
    <html
      lang={language === "ua" ? "uk" : language}
      className={`${geistSans.variable} h-full antialiased${initialDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <LanguageProvider initialLanguage={language}>
          <StoreChrome header={<SiteHeader />} footer={<SiteFooter />}>
            {children}
          </StoreChrome>
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
