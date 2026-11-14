import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsOf, createFakeSupabase } from "../helpers/query-builder";
import { emptySettings, type HomepageDocument } from "@/lib/homepage/schema";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => (state.db as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("next/cache", () => ({ unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
import { getHomepageCatalog } from "@/lib/homepage/data";

const id = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const section = { id, section_key: "featured", section_type: "featured_products" as const, title: "Featured", subtitle: "", content: "", sort_order: 0, is_visible: true, settings: { ...emptySettings, product_ids: [id] } };
const product = { id, name: "One", slug: "one", price: 2, currency: "EUR", product_images: [] };
const document: HomepageDocument = { sections: [section], banners: [] };

beforeEach(() => { state.db = createFakeSupabase(); });

describe("homepage catalog", () => {
  it("loads selected products and paginates active featured products", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    const selected = db.queueTable("products", { data: [product], error: null });
    const first = db.queueTable("products", { data: [product], count: 2, error: null });
    const second = db.queueTable("products", { data: [{ ...product, id: secondId, slug: "two" }], count: 2, error: null });
    const result = await getHomepageCatalog(document);
    expect(result.products).toHaveLength(1);
    expect(result.featuredProducts.map((item) => item.id)).toEqual([id, secondId]);
    expect(callsOf(selected, "eq")).toContainEqual(["is_active", true]);
    expect(callsOf(first, "eq")).toEqual(expect.arrayContaining([["is_active", true], ["is_featured", true]]));
    expect(callsOf(first, "range")).toEqual([[0, 99]]);
    expect(callsOf(second, "range")).toEqual([[1, 100]]);
  });

  it("does not fetch featured products for hidden sections and surfaces query failures", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    const hidden = { ...document, sections: [{ ...section, is_visible: false, settings: { ...emptySettings } }] };
    expect((await getHomepageCatalog(hidden)).featuredProducts).toEqual([]);
    expect(db.client.from).not.toHaveBeenCalled();
    db.queueTable("products", { data: [product], error: null });
    db.queueTable("products", { data: null, count: null, error: { message: "unavailable" } });
    await expect(getHomepageCatalog(document)).rejects.toThrow("unavailable");
  });
});
