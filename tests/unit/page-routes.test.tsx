import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { emptyPage } from "@/lib/pages/schema";

const state = vi.hoisted(() => ({
  getPublicPage: vi.fn(),
  pageMetadata: vi.fn(),
}));
vi.mock("@/lib/pages/data", () => ({ getPublicPage: state.getPublicPage }));
vi.mock("@/lib/pages/public-page", () => ({
  pageMetadata: state.pageMetadata,
  PublicPage: () => <div>CMS page</div>,
}));
vi.mock("@/lib/i18n", () => ({ getLanguage: async () => "ua" }));
vi.mock("@/lib/settings/public", () => ({
  getPublicSettings: async () => ({ store_name: "Truck Shop", business_address: "", contact_phone: "", whatsapp_number: "", viber_number: "", telegram_username: "" }),
  contactLinks: () => ({ phone: "", whatsapp: "", viber: "", telegram: "" }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); } }));

import AboutPage, { generateMetadata as aboutMetadata } from "@/app/about/page";
import FixedPage, { generateMetadata as fixedMetadata } from "@/app/(shop)/[slug]/page";
import PrivacyPage, { generateMetadata as privacyMetadata } from "@/app/privacy/page";
import ShippingPage, { generateMetadata as shippingMetadata } from "@/app/shipping/page";
import ReturnsPage, { generateMetadata as returnsMetadata } from "@/app/returns/page";
import TermsPage, { generateMetadata as termsMetadata } from "@/app/terms/page";

const document = { ...emptyPage, slug: "about", title: "CMS title" };
const legalRoutes = [
  ["privacy", PrivacyPage, privacyMetadata],
  ["shipping", ShippingPage, shippingMetadata],
  ["returns", ReturnsPage, returnsMetadata],
  ["terms", TermsPage, termsMetadata],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  state.pageMetadata.mockResolvedValue({ title: "CMS SEO" });
});

describe("CMS fixed routes", () => {
  it.each(legalRoutes)("uses the published %s page and its metadata", async (slug, route, metadata) => {
    state.getPublicPage.mockResolvedValue(document);
    const element = await route();
    expect(element.props.slug).toBe(slug);
    expect(await metadata()).toEqual({ title: "CMS SEO" });
    expect(state.pageMetadata).toHaveBeenCalledWith(slug);
  });

  it.each(legalRoutes)("retains the unindexed %s placeholder when unpublished", async (slug, route, metadata) => {
    state.getPublicPage.mockResolvedValue(null);
    const element = await route();
    expect(element.props.page).toBe(slug);
    expect((await metadata()).robots).toEqual({ index: false });
  });

  it("uses the published about content while preserving contact and company anchors", async () => {
    state.getPublicPage.mockResolvedValue(document);
    const html = renderToStaticMarkup((await AboutPage()) as ReactElement);
    expect(html).toContain("CMS title");
    expect(html).toContain('id="contacts"');
    expect(html).toContain('id="company"');
    expect(await aboutMetadata()).toEqual({ title: "CMS SEO" });
  });

  it("serves contact at its root route and rejects other root slugs", async () => {
    const contact = { params: Promise.resolve({ slug: "contact" }) };
    expect((await FixedPage(contact)).props.slug).toBe("contact");
    expect(await fixedMetadata(contact)).toEqual({ title: "CMS SEO" });
    await expect(FixedPage({ params: Promise.resolve({ slug: "news" }) })).rejects.toThrow("not found");
  });
});
