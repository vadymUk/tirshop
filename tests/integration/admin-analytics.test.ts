import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/query-builder";

const fake = vi.hoisted(() => ({ current: null as unknown }));
const requireActiveAdmin = vi.hoisted(() => vi.fn());
const getAdminUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin, getAdminUser }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => (fake.current as ReturnType<typeof createFakeSupabase>).client,
}));

import { getEcommerceAnalytics } from "@/lib/admin/analytics-data";
import { GET } from "@/app/admin/analytics/export/route";

const result = {
  from: "2024-01-01", to: "2024-01-01", currency: "EUR", bucket: "day", threshold: 5,
  orders: 0, completed: 0, cancelled: 0, gross: 0, paid: 0, unpaid: 0, average: 0,
  customers: 0, new_customers: 0, repeat_customers: 0, timeline: [], statuses: [],
  best_products: [], revenue_products: [], least_products: [], categories: [], top_customers: [], low_stock: [], out_of_stock: [],
};

beforeEach(() => {
  fake.current = createFakeSupabase();
  requireActiveAdmin.mockResolvedValue({ id: "admin" });
  getAdminUser.mockResolvedValue({ id: "admin" });
});

describe("analytics data and export", () => {
  it("checks admin and sends a bounded, typed request", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_ecommerce_analytics", { data: result, error: null });
    await getEcommerceAnalytics({ period: "custom", from: "2024-01-01", to: "2024-01-01", bucket: "month", currency: "EUR" }, 20);
    expect(requireActiveAdmin).toHaveBeenCalled();
    expect(db.client.rpc).toHaveBeenCalledWith("admin_ecommerce_analytics", {
      p_period: "custom", p_from: "2024-01-01", p_to: "2024-01-01", p_currency: "EUR", p_bucket: "month", p_offset: 20,
    });
  });

  it("rejects unauthorized and invalid exports before querying", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    getAdminUser.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/admin/analytics/export"))).status).toBe(403);
    expect((await GET(new Request("http://localhost/admin/analytics/export?currency=bad"))).status).toBe(400);
    expect(db.client.rpc).not.toHaveBeenCalled();
  });

  it("returns uncached CSV for an administrator and surfaces RPC errors", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_ecommerce_analytics", { data: result, error: null });
    const response = await GET(new Request("http://localhost/admin/analytics/export?period=today"));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toContain('"summary"');
    db.setRpc("admin_ecommerce_analytics", { data: null, error: { message: "unavailable" } });
    await expect(getEcommerceAnalytics({ period: "today", bucket: "day" })).rejects.toThrow("unavailable");
  });

  it("streams all report pages using the resolved dates and currency", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    const items = Array.from({ length: 21 }, (_, i) => ({ id: `${i}`, name: `item-${i}`, stock_quantity: 1 }));
    db.client.rpc
      .mockImplementationOnce(async () => ({ data: { ...result, low_stock: items }, error: null }))
      .mockImplementationOnce(async () => ({ data: { ...result, low_stock: items.slice(20) }, error: null }));
    const response = await GET(new Request("http://localhost/admin/analytics/export?period=today"));
    const csv = await response.text();
    expect(csv).toContain('"item-19"');
    expect(csv.match(/"item-20"/g)).toHaveLength(1);
    expect(csv.match(/"entity_id"/g)).toHaveLength(1);
    expect(db.client.rpc).toHaveBeenLastCalledWith("admin_ecommerce_analytics", {
      p_period: "custom", p_from: "2024-01-01", p_to: "2024-01-01", p_currency: "EUR", p_bucket: "day", p_offset: 20,
    });
  });
});
