import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/components/layout/language-provider";
import { siteConfig } from "@/config/site";
import { getLanguage } from "@/lib/i18n";
import { SITE_URL } from "@/lib/seo";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { getThemePreference } from "@/lib/theme-server";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${siteConfig.name} — товари для далекобійників`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  twitter: { card: "summary_large_image", title: siteConfig.name, description: siteConfig.description },
  robots: { index: true, follow: true },
};

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
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
            {children}
          </main>
          <SiteFooter />
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
