import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeContent } from "@/components/homepage/home-content";
import { emptySettings, homepageSchema, safeLink, type HomepageDocument } from "@/lib/homepage/schema";

const section = { id: "11111111-1111-4111-8111-111111111111", section_key: "hero", section_type: "hero" as const,
  title: "Test", subtitle: "", content: "<script>alert(1)</script>", settings: { ...emptySettings },
  sort_order: 0, is_visible: true };
const banner = { id: "22222222-2222-4222-8222-222222222222", title: "Banner", subtitle: "", image_path: "library/a.webp",
  mobile_image_path: "", button_text: "", button_url: "", position: "top" as const, sort_order: 0,
  starts_at: "2025-01-01T00:00:00Z", ends_at: "2025-02-01T00:00:00Z", is_active: true };
const document: HomepageDocument = { sections: [section], banners: [banner] };

describe("homepage structured content", () => {
  it("accepts only safe button destinations", () => {
    for (const value of ["", "/products?x=1", "https://example.test/a"]) expect(safeLink.safeParse(value).success).toBe(true);
    for (const value of ["javascript:alert(1)", "//evil.test", "/\\evil.test", "http://example.test", "https://user:pass@example.test"]) expect(safeLink.safeParse(value).success).toBe(false);
  });
  it("rejects unsafe images, unknown settings, invalid dates and duplicate ids", () => {
    expect(homepageSchema.safeParse({ ...document, sections: [{ ...section, settings: { ...emptySettings, desktop_image: "../secret" } }] }).success).toBe(false);
    expect(homepageSchema.safeParse({ ...document, sections: [{ ...section, settings: { ...emptySettings, html: "<b>" } }] }).success).toBe(false);
    expect(homepageSchema.safeParse({ ...document, banners: [{ ...banner, starts_at: "2025-02-30T00:00:00Z" }] }).success).toBe(false);
    expect(homepageSchema.safeParse({ ...document, sections: [section, section] }).success).toBe(false);
  });
  it("renders escaped text and only scheduled visible content", () => {
    const render = (now: string) => renderToStaticMarkup(<HomeContent document={document} catalog={{ products: [], categories: [], featuredProducts: [] }} now={Date.parse(now)} />);
    expect(render("2025-01-15T00:00:00Z")).toContain("Banner");
    expect(render("2025-02-01T00:00:00Z")).not.toContain("Banner");
    expect(render("2024-12-31T23:59:59Z")).not.toContain("Banner");
    expect(render("2025-01-15T00:00:00Z")).toContain("&lt;script&gt;");
    expect(render("2025-01-15T00:00:00Z")).not.toContain("<script>");
    expect(renderToStaticMarkup(<HomeContent document={{ ...document, sections: [{ ...section, is_visible: false }] }} catalog={{ products: [], categories: [], featuredProducts: [] }} now={0} />)).not.toContain("Test");
  });
  it("adds flagged products after manually selected products without duplicates", () => {
    const first = { id: section.id, name: "Selected", slug: "selected", price: 1, currency: "EUR", product_images: [] };
    const second = { ...first, id: banner.id, name: "Featured", slug: "featured" };
    const featuredSection = { ...section, section_type: "featured_products" as const, settings: { ...emptySettings, product_ids: [first.id] } };
    const html = renderToStaticMarkup(<HomeContent document={{ sections: [featuredSection], banners: [] }} catalog={{ products: [first], featuredProducts: [first, second], categories: [] }} now={0} />);
    expect(html.match(/Selected/g)).toHaveLength(1);
    expect(html.match(/Featured/g)).toHaveLength(1);
    expect(html.indexOf("Selected")).toBeLessThan(html.indexOf("Featured"));
    const hidden = renderToStaticMarkup(<HomeContent document={{ sections: [{ ...featuredSection, is_visible: false }], banners: [] }} catalog={{ products: [first], featuredProducts: [second], categories: [] }} now={0} />);
    expect(hidden).not.toContain("Featured");
  });
});
