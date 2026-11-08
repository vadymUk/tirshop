import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsOf, createFakeSupabase, createQueryBuilder, USER_A, USER_B } from "../helpers/query-builder";

const fakePublic = vi.hoisted(() => ({ current: null as unknown }));
const fakeServer = vi.hoisted(() => ({ current: null as unknown }));

// Caching is a production concern; tests need every call to reach the (fake) database.
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => fakePublic.current,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => (fakeServer.current as ReturnType<typeof createFakeSupabase>).client,
}));

import { PAGE_SIZE } from "@/lib/catalog/config";
import {
  getFavoriteProductIds,
  getProductBySlug,
  getProductsPage,
  getRelatedProducts,
} from "@/lib/db/queries/products";
import { getCategories, getCategoryBySlug } from "@/lib/db/queries/categories";

function publicClientReturning(result: unknown) {
  const builder = createQueryBuilder(result);
  fakePublic.current = { from: vi.fn(() => builder) };
  return builder;
}

beforeEach(() => {
  fakeServer.current = createFakeSupabase();
});

// Each test uses distinct arguments because react `cache` memoises identical calls.
describe("product listing and pagination", () => {
  it("only lists active products and paginates in the database with range()", async () => {
    const query = publicClientReturning({ data: [{ id: "p1" }], error: null, count: 25 });

    const result = await getProductsPage({ page: 2, sort: "price_asc", inStockOnly: false });

    expect(callsOf(query, "eq")).toContainEqual(["is_active", true]);
    expect(callsOf(query, "range")).toEqual([[PAGE_SIZE, PAGE_SIZE * 2 - 1]]);
    expect(callsOf(query, "order")[0]).toEqual(["price", { ascending: true }]);
    expect(callsOf(query, "select")[0][1]).toEqual({ count: "exact" });
    expect(result).toMatchObject({ total: 25, page: 2, totalPages: Math.ceil(25 / PAGE_SIZE) });
  });

  it("selects explicit columns instead of *", async () => {
    const query = publicClientReturning({ data: [], error: null, count: 0 });
    await getProductsPage({ page: 3 });
    const columns = String(callsOf(query, "select")[0][0]);
    expect(columns).not.toBe("*");
    expect(columns).not.toContain("*");
    expect(columns).not.toMatch(/\bdescription\b(?!,)/);
  });

  it("treats a page beyond the end as an empty result instead of failing", async () => {
    publicClientReturning({ data: null, error: { code: "PGRST103", message: "range" }, count: null });
    expect(await getProductsPage({ page: 77 })).toEqual({
      products: [],
      total: 0,
      page: 77,
      totalPages: 1,
    });
  });

  it("throws on unexpected database errors", async () => {
    publicClientReturning({ data: null, error: { code: "XX000", message: "boom" }, count: null });
    await expect(getProductsPage({ page: 78 })).rejects.toThrow(/Failed to load products/);
  });

  it("applies category, price and stock filters in SQL", async () => {
    const query = publicClientReturning({ data: [], error: null, count: 0 });
    await getProductsPage({
      categoryId: "cat-1",
      minPrice: 5,
      maxPrice: 50,
      inStockOnly: true,
      page: 4,
    });
    expect(callsOf(query, "eq")).toContainEqual(["category_id", "cat-1"]);
    expect(callsOf(query, "gte")).toEqual([["price", 5]]);
    expect(callsOf(query, "lte")).toEqual([["price", 50]]);
    expect(callsOf(query, "gt")).toEqual([["stock_quantity", 0]]);
  });
});

describe("product search", () => {
  it("adds one OR group per word, searching name, short and full description", async () => {
    const query = publicClientReturning({ data: [], error: null, count: 0 });
    await getProductsPage({ search: "night vision", page: 5 });

    const groups = callsOf(query, "or").map(([filter]) => String(filter));
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group).toContain("name.ilike.");
      expect(group).toContain("short_description.ilike.");
      expect(group).toContain("description.ilike.");
    }
    expect(groups[0]).toContain("*night*");
    expect(groups[1]).toContain("*vision*");
  });

  it("matches translated words through their English source text", async () => {
    const query = publicClientReturning({ data: [], error: null, count: 0 });
    await getProductsPage({ search: "відеореєстратор", page: 6 });
    expect(String(callsOf(query, "or")[0][0])).toMatch(/name\.eq\./);
  });

  it("neutralises characters that could inject extra PostgREST filters", async () => {
    const query = publicClientReturning({ data: [], error: null, count: 0 });
    await getProductsPage({ search: 'cam),is_active.eq.false,name.ilike.("x', page: 7 });

    const filters = callsOf(query, "or").map(([filter]) => String(filter));
    // Strip the quoted `eq` values (which legitimately contain commas); what remains are the
    // ilike clauses built from user input, and they must not contain filter syntax characters.
    for (const filter of filters) {
      const withoutQuoted = filter.replace(/"(?:[^"\\]|\\.)*"/g, "Q");
      const clauses = withoutQuoted.split(",");
      expect(clauses.every((clause) => /^(name|short_description|description)\.(ilike|eq)\.[^(),"]*$/.test(clause))).toBe(
        true,
      );
    }
    expect(filters.join("|")).not.toContain("is_active.eq.false");
  });

  it("limits the number of words", async () => {
    const query = publicClientReturning({ data: [], error: null, count: 0 });
    await getProductsPage({ search: "a1 b2 c3 d4 e5 f6 g7 h8", page: 8 });
    expect(callsOf(query, "or")).toHaveLength(5);
  });

  it("escapes LIKE wildcards typed by the user", async () => {
    const query = publicClientReturning({ data: [], error: null, count: 0 });
    await getProductsPage({ search: "50%_off", page: 9 });
    const filters = callsOf(query, "or").map(([filter]) => String(filter));
    // "%" is stripped from input, and a literal underscore is escaped so it is not a LIKE wildcard.
    expect(filters.join("|")).not.toContain("%");
    expect(filters[1]).toContain("*\\_off*");
  });
});

describe("product details, related products and categories", () => {
  it("loads a product by slug for active products only", async () => {
    const query = publicClientReturning({ data: { id: "p1", slug: "dash-cam" }, error: null });
    expect(await getProductBySlug("dash-cam")).toMatchObject({ slug: "dash-cam" });
    expect(callsOf(query, "eq")).toEqual(
      expect.arrayContaining([
        ["slug", "dash-cam"],
        ["is_active", true],
      ]),
    );
  });

  it("returns null for an unknown slug (drives notFound())", async () => {
    publicClientReturning({ data: null, error: null });
    expect(await getProductBySlug("missing-product")).toBeNull();
  });

  it("loads related products from the same category, excluding the current one, in one query", async () => {
    const query = publicClientReturning({ data: [], error: null });
    await getRelatedProducts("cat-9", "prod-9", 3);
    expect(callsOf(query, "eq")).toEqual(
      expect.arrayContaining([
        ["category_id", "cat-9"],
        ["is_active", true],
      ]),
    );
    expect(callsOf(query, "neq")).toEqual([["id", "prod-9"]]);
  });

  it("lists categories and finds one by slug", async () => {
    const list = publicClientReturning({
      data: [{ id: "c1", name: "Electronics", slug: "electronics" }],
      error: null,
    });
    expect(await getCategories()).toHaveLength(1);
    expect(callsOf(list, "select")[0][0]).not.toBe("*");

    publicClientReturning({ data: { id: "c1", slug: "electronics" }, error: null });
    expect(await getCategoryBySlug("electronics")).toMatchObject({ slug: "electronics" });

    publicClientReturning({ data: null, error: null });
    expect(await getCategoryBySlug("nope")).toBeNull();
  });
});

describe("favorites listing is scoped to the user", () => {
  it("reads only the signed-in user's favorites", async () => {
    const supabase = createFakeSupabase();
    fakeServer.current = supabase;
    supabase.signedInAs(USER_B);
    const table = supabase.queueTable("favorites", { data: [{ product_id: "p1" }], error: null });

    expect(await getFavoriteProductIds()).toEqual(["p1"]);
    expect(callsOf(table, "eq")).toEqual([["user_id", USER_B.id]]);
    expect(JSON.stringify(table.calls)).not.toContain(USER_A.id);
  });
});
