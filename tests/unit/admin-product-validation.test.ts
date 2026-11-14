import { describe, expect, it } from "vitest";
import { productSchema } from "@/lib/admin/product-validation";
import { parseProductListParams } from "@/lib/admin/product-list";

const product = {
  id: "", category_id: "33333333-3333-4333-8333-333333333333",
  name: "Product", slug: "product", sku: "", short_description: "", description: "",
  price: "10.25", compare_at_price: "", currency: "EUR", stock_quantity: "5",
  expected_stock: "", weight: "", is_active: true, is_featured: false,
  meta_title: "", meta_description: "", og_image_path: "",
};

describe("product validation", () => {
  it("accepts a valid product", () => expect(productSchema.safeParse(product).success).toBe(true));
  it.each([
    { price: "-1" }, { price: "0" }, { stock_quantity: "-1" },
    { category_id: "bad" }, { slug: "bad slug" }, { currency: "eur" },
    { id: "33333333-3333-4333-8333-333333333333", expected_stock: "" },
  ])("rejects invalid input %j", (change) => expect(productSchema.safeParse({ ...product, ...change }).success).toBe(false));
  it("accepts only site-media paths for a custom Open Graph image", () => {
    expect(productSchema.safeParse({ ...product, og_image_path: "library/image.webp" }).success).toBe(true);
    for (const path of ["https://example.test/image.webp", "../image.webp", "//example.test/image.webp"]) {
      expect(productSchema.safeParse({ ...product, og_image_path: path }).success).toBe(false);
    }
  });
});

describe("product list query parsing", () => {
  it("sanitizes PostgREST search and validates filters", () => {
    const result = parseProductListParams({ q: 'a),is_active.eq.false', category: "bad", page: "-1", stock: "low" });
    expect(result.q).not.toContain(",");
    expect(result.category).toBe("");
    expect(result.page).toBe(1);
    expect(result.stock).toBe("low");
  });
});
