import { describe, expect, it } from "vitest";
import { analyticsCsv, analyticsSchema, hasMoreAnalytics, parseAnalyticsFilter } from "@/lib/admin/analytics";

const empty = () => analyticsSchema.parse({
  from: "2024-01-01", to: "2024-01-31", currency: "EUR", bucket: "day", threshold: 5,
  orders: 0, completed: 0, cancelled: 0, gross: 0, paid: 0, unpaid: 0, average: 0,
  customers: 0, new_customers: 0, repeat_customers: 0, timeline: [], statuses: [],
  best_products: [], revenue_products: [], least_products: [], categories: [], top_customers: [], low_stock: [], out_of_stock: [],
});

describe("analytics filters", () => {
  it("supports 90 days and custom UTC dates, rejecting invalid or oversized ranges", () => {
    expect(parseAnalyticsFilter({ period: "last_90_days", bucket: "week", currency: "PLN" }).filter).toEqual({ period: "last_90_days", bucket: "week", currency: "PLN" });
    expect(parseAnalyticsFilter({ period: "custom", from: "2024-02-29", to: "2024-03-01" }).filter?.from).toBe("2024-02-29");
    expect(parseAnalyticsFilter({ period: "custom", from: "2023-02-29", to: "2024-03-01" }).error).toBeDefined();
    expect(parseAnalyticsFilter({ period: "custom", from: "2021-01-01", to: "2024-01-01" }).error).toBeDefined();
    expect(parseAnalyticsFilter({ currency: "eur" }).error).toBeDefined();
    expect(parseAnalyticsFilter({ bucket: ["day", "month"] }).error).toBeDefined();
  });
});

describe("analytics CSV", () => {
  it("quotes data, neutralizes spreadsheet formulas, and retains numeric values", () => {
    const data = empty();
    data.best_products.push({ product_id: "id", name: ' \t=HYPERLINK("https://example.test")', quantity: 2, revenue: 10 });
    const csv = analyticsCsv(data);
    expect(csv).toContain(`"best_products","id","' \t=HYPERLINK(""https://example.test"")","2","","10","EUR"`);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(analyticsCsv(data, false)).not.toContain("entity_id");
  });

  it("exports at most one report page and signals another", () => {
    const data = empty();
    data.low_stock = Array.from({ length: 21 }, (_, i) => ({ id: `${i}`, name: `item-${i}`, stock_quantity: 1 }));
    expect(hasMoreAnalytics(data)).toBe(true);
    const csv = analyticsCsv(data);
    expect(csv).toContain("item-19");
    expect(csv).not.toContain("item-20");
  });
});
