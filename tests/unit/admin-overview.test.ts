import { describe, expect, it } from "vitest";
import { parseOverviewFilter } from "@/lib/admin/overview";

describe("dashboard date filters", () => {
  it("defaults to the last 30 days", () => {
    expect(parseOverviewFilter({})).toEqual({ filter: { period: "last_30_days" } });
  });
  it.each(["today", "yesterday", "last_7_days", "last_30_days", "this_month", "this_year"])("accepts %s", (period) => {
    expect(parseOverviewFilter({ period }).filter?.period).toBe(period);
  });
  it("accepts inclusive leap-day ranges", () => {
    expect(parseOverviewFilter({ period: "custom", from: "2024-02-29", to: "2024-03-01" }).filter).toEqual({ period: "custom", from: "2024-02-29", to: "2024-03-01" });
  });
  it.each([
    { period: "custom", from: "2025-02-29", to: "2025-03-01" },
    { period: "custom", from: "2025-02-01", to: "2025-01-31" },
    { period: "custom", from: "2020-01-01", to: "2023-01-01" },
    { period: "custom", from: "9999-12-31", to: "9999-12-31" },
    { period: "unknown" },
    { period: ["today", "yesterday"] },
  ])("rejects invalid input %j", (params) => {
    expect(parseOverviewFilter(params).error).toBeTruthy();
  });
});
