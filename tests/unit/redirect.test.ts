import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath (open redirect protection)", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/checkout")).toBe("/checkout");
    expect(safeNextPath("/products?q=abc&page=2", "/account")).toBe("/products?q=abc&page=2");
  });

  it.each([
    "//evil.example",
    "https://evil.example",
    "http://evil.example/path",
    "javascript:alert(1)",
    "/\\evil.example",
    "/ok\nHeader: injected",
    "/with space",
    "/tab\there",
    "evil.example",
    "",
  ])("falls back for %j", (next) => {
    expect(safeNextPath(next, "/account")).toBe("/account");
  });

  it("falls back for null and undefined", () => {
    expect(safeNextPath(null, "/account")).toBe("/account");
    expect(safeNextPath(undefined)).toBe("/");
  });
});
