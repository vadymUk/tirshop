import { sellerContacts, siteConfig } from "@/config/site";

/** Canonical origin without a trailing slash. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}

/** Collapses whitespace and cuts at a word boundary for meta descriptions. */
export function truncate(text: string, max = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(items: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function organizationJsonLd(name: string = siteConfig.name, description: string = siteConfig.description, phone: string = sellerContacts.phone) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: SITE_URL,
    description,
    ...(phone ? { contactPoint: {
      "@type": "ContactPoint",
      telephone: phone,
      contactType: "customer service",
      availableLanguage: ["uk", "pl"],
    } } : {}),
  };
}

export function websiteJsonLd(name: string = siteConfig.name) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: SITE_URL,
    inLanguage: "uk",
  };
}
