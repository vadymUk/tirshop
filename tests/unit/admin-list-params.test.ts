import { describe, expect, it } from "vitest";
import { parseAdminListParams } from "@/lib/admin/list-params";

describe("admin list parameters", () => {
  it("trims and bounds search and accepts a positive page", () => {
    expect(parseAdminListParams({ q: ` ${"a".repeat(120)} `, page: "3" })).toEqual({
      query: "a".repeat(100),
      page: 3,
    });
  });

  it.each(["0", "-1", "1.5", "NaN", "100000"])("defaults invalid page %s", (page) => {
    expect(parseAdminListParams({ page }).page).toBe(1);
  });

  it("ignores repeated search and page parameters", () => {
    expect(parseAdminListParams({ q: ["a", "b"], page: ["2", "3"] })).toEqual({ query: "", page: 1 });
  });
});
