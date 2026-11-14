import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsOf, createFakeSupabase } from "../helpers/query-builder";

const state = vi.hoisted(() => ({ db: null as unknown, product: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => (state.db as ReturnType<typeof createFakeSupabase>).client,
}));
vi.mock("@/lib/db/queries/products", () => ({ getProductBySlug: state.product }));

import sitemap from "@/app/sitemap";
import { generateMetadata } from "@/app/(shop)/products/[slug]/page";

beforeEach(() => {
  vi.clearAllMocks();
  state.db = createFakeSupabase();
});

describe("public SEO", () => {
  it("includes published pages, active products and categories in the sitemap", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    const categories = db.queueTable("categories", { data: [{ slug: "tools", updated_at: "2025-01-01" }], error: null });
    const products = db.queueTable("products", { data: [{ slug: "item", updated_at: "2025-01-01" }], error: null });
    const pages = db.queueTable("pages", { data: [{ slug: "privacy", updated_at: "2025-01-01" }, { slug: "news", updated_at: "2025-01-01" }], error: null });
    const urls = (await sitemap()).map((entry) => new URL(entry.url).pathname);
    expect(urls).toEqual(["/", "/products", "/category/tools", "/products/item", "/privacy", "/pages/news"]);
    expect(callsOf(categories, "eq")).toContainEqual(["is_active", true]);
    expect(callsOf(products, "eq")).toContainEqual(["is_active", true]);
    expect(callsOf(pages, "eq")).toContainEqual(["is_published", true]);
    expect(callsOf(pages, "or")[0][0]).toMatch(/^published_at\.is\.null,published_at\.lte\./);
    expect(urls).not.toContain("/admin");
  });

  it("surfaces database errors instead of publishing an incomplete sitemap", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.queueTable("categories", { data: [], error: null });
    db.queueTable("products", { data: null, error: { message: "unavailable" } });
    db.queueTable("pages", { data: [], error: null });
    await expect(sitemap()).rejects.toThrow("unavailable");
  });

  it("uses product overrides and falls back to product details", async () => {
    const product = { name: "Product", slug: "product", short_description: "Description", description: null,
      meta_title: "Custom title", meta_description: "Custom description", og_image_path: "library/og.webp",
      product_images: [{ storage_path: "item.webp", alt_text: "Item", sort_order: 0 }] };
    state.product.mockResolvedValue(product);
    const props = { params: Promise.resolve({ slug: "product" }) };
    const metadata = await generateMetadata(props);
    expect(metadata.title).toBe("Custom title");
    expect(metadata.description).toBe("Custom description");
    expect(metadata.openGraph).toMatchObject({ title: "Custom title", images: [{ url: expect.stringContaining("/site-media/library/og.webp") }] });
    state.product.mockResolvedValue({ ...product, meta_title: null, meta_description: null, og_image_path: null });
    const fallback = await generateMetadata(props);
    expect(fallback.title).toBe("Product");
    expect(fallback.description).toBe("Description");
    expect(fallback.openGraph).toMatchObject({ images: [{ alt: "Item" }] });
    state.product.mockResolvedValue({ ...product, og_image_path: "https://evil.test/image" });
    await expect(generateMetadata(props)).rejects.toThrow("Invalid product Open Graph image path");
  });
});
