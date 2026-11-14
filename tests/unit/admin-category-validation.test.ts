import { describe, expect, it } from "vitest";
import { categorySchema } from "@/lib/admin/category-validation";

const category = {
  id: "", name: "Category", slug: "category", description: "",
  is_active: true, sort_order: "0", meta_title: "", meta_description: "",
};

describe("category validation", () => {
  it("accepts valid input", () => {
    expect(categorySchema.parse(category).sort_order).toBe(0);
  });
  it.each([
    { id: "invalid" }, { name: "  " }, { slug: "Invalid slug" },
    { sort_order: "-1" }, { sort_order: "1.5" }, { sort_order: "1000001" },
    { meta_title: "x".repeat(201) }, { is_active: "true" },
  ])("rejects invalid input %j", (change) => {
    expect(categorySchema.safeParse({ ...category, ...change }).success).toBe(false);
  });
});
