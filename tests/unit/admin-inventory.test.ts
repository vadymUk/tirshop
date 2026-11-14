import { describe, expect, it } from "vitest";
import { inventoryCsv, parseInventoryAdjustment, parseInventoryFilter, stockStatus, type InventoryItem } from "@/lib/admin/inventory";

const id = "33333333-3333-4333-8333-333333333333";
function adjustment(operation = "decrease", quantity = "2", reason = "Inventory count") {
  const form = new FormData();
  form.append("items", `${id}:4`);
  form.set("operation", operation);
  form.set("quantity", quantity);
  form.set("reason", reason);
  return form;
}

describe("inventory validation", () => {
  it("accepts valid stock operations and rejects invalid quantities, duplicate products and missing reasons", () => {
    expect(parseInventoryAdjustment(adjustment()).success).toBe(true);
    expect(parseInventoryAdjustment(adjustment("set", "0")).success).toBe(true);
    expect(parseInventoryAdjustment(adjustment("increase", "0")).success).toBe(false);
    expect(parseInventoryAdjustment(adjustment("decrease", "-1")).success).toBe(false);
    expect(parseInventoryAdjustment(adjustment("set", "1.5")).success).toBe(false);
    expect(parseInventoryAdjustment(adjustment("set", "1", "  ")).success).toBe(false);
    const form = adjustment();
    form.append("items", `${id}:4`);
    expect(parseInventoryAdjustment(form).success).toBe(false);
  });
  it("validates filters and stock boundaries", () => {
    expect(parseInventoryFilter({ q: " brake ", status: "low", page: "2" }).filter).toEqual({ query: "brake", status: "low", page: 2 });
    expect(parseInventoryFilter({ status: "unknown" }).error).toBeDefined();
    expect(parseInventoryFilter({ q: ["x", "y"] }).error).toBeDefined();
    expect(stockStatus({ stock_quantity: 0, threshold: 5 })).toBe("Немає в наявності");
    expect(stockStatus({ stock_quantity: 5, threshold: 5 })).toBe("Малий залишок");
    expect(stockStatus({ stock_quantity: 6, threshold: 5 })).toBe("Достатній");
  });
});

it("escapes CSV fields and spreadsheet formulas", () => {
  const item: InventoryItem = { id, name: ' =CMD("x")', sku: "@formula", stock_quantity: 1, threshold: 5, is_active: true, image_path: null, last_stock_update: null };
  const csv = inventoryCsv([item], true);
  expect(csv).toContain(`"' =CMD(""x"")","'@formula","1","5"`);
  expect(csv.startsWith("\uFEFF")).toBe(true);
});
