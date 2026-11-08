import { describe, expect, it } from "vitest";
import { getStockStatus, parseListingParams, PAGE_SIZE } from "@/lib/catalog/config";
import { buildListingHref, hasActiveFilters } from "@/lib/catalog/listing";
import { findCatalogSources } from "@/lib/catalog-translations";

describe("parseListingParams (pagination, sort and search input)", () => {
  it("applies defaults", () => {
    expect(parseListingParams({})).toMatchObject({ sort: "newest", page: 1 });
  });

  it("parses and clamps pagination", () => {
    expect(parseListingParams({ page: "3" }).page).toBe(3);
    expect(parseListingParams({ page: "0" }).page).toBe(1);
    expect(parseListingParams({ page: "-5" }).page).toBe(1);
    expect(parseListingParams({ page: "abc" }).page).toBe(1);
    expect(parseListingParams({ page: "99999" }).page).toBe(1);
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });

  it("falls back to newest for unknown sort values and accepts legacy hyphens", () => {
    expect(parseListingParams({ sort: "DROP TABLE" }).sort).toBe("newest");
    expect(parseListingParams({ sort: "price-asc" }).sort).toBe("price_asc");
  });

  it("normalises and bounds the search query", () => {
    expect(parseListingParams({ q: "  dash   cam  " }).q).toBe("dash cam");
    expect(parseListingParams({ q: "   " }).q).toBeUndefined();
    expect(parseListingParams({ q: "x".repeat(500) }).q).toHaveLength(100);
  });

  it("uses only the first value of repeated params", () => {
    expect(parseListingParams({ page: ["2", "9"] }).page).toBe(2);
  });

  it("parses price filters, ignores junk and swaps a reversed range", () => {
    expect(parseListingParams({ minPrice: "10,5" }).minPrice).toBe(10.5);
    expect(parseListingParams({ minPrice: "-1" }).minPrice).toBeUndefined();
    expect(parseListingParams({ maxPrice: "abc" }).maxPrice).toBeUndefined();
    const swapped = parseListingParams({ minPrice: "50", maxPrice: "10" });
    expect([swapped.minPrice, swapped.maxPrice]).toEqual([10, 50]);
  });

  it("validates the category slug shape", () => {
    expect(parseListingParams({ category: "cab-comfort" }).category).toBe("cab-comfort");
    expect(parseListingParams({ category: "Bad Slug!" }).category).toBeUndefined();
  });
});

describe("listing URLs", () => {
  it("omits defaults and keeps filters when paginating", () => {
    expect(buildListingHref("/products", "newest", 1)).toBe("/products");
    expect(buildListingHref("/products", "price_asc", 2, { q: "cam", availability: "in_stock" })).toBe(
      "/products?q=cam&availability=in_stock&sort=price_asc&page=2",
    );
  });

  it("detects active filters", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ category: "x" })).toBe(false);
    expect(hasActiveFilters({ q: "x" })).toBe(true);
    expect(hasActiveFilters({ minPrice: 0 })).toBe(true);
  });
});

describe("stock status", () => {
  it("classifies stock levels", () => {
    expect(getStockStatus(0).state).toBe("out");
    expect(getStockStatus(-3).state).toBe("out");
    expect(getStockStatus(1).state).toBe("low");
    expect(getStockStatus(5).state).toBe("low");
    expect(getStockStatus(6).state).toBe("in");
  });
});

describe("translated catalog search", () => {
  it("maps a translated word back to English source texts", () => {
    expect(findCatalogSources("відеореєстратор").length).toBeGreaterThan(0);
    expect(findCatalogSources("wideorejestrator").length).toBeGreaterThan(0);
  });

  it("returns nothing for unknown words", () => {
    expect(findCatalogSources("xyzzy")).toEqual([]);
  });
});
