import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/query-builder";

const fake = vi.hoisted(() => ({ current: null as unknown }));
const requireActiveAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => (fake.current as ReturnType<typeof createFakeSupabase>).client,
}));

import { getDashboardOverview } from "@/lib/admin/overview-data";

beforeEach(() => {
  fake.current = createFakeSupabase();
  requireActiveAdmin.mockResolvedValue({ id: "admin" });
});

describe("dashboard overview data", () => {
  it("sends a bounded filter to the authorized aggregate RPC", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_dashboard_overview", { data: {
      from: "2024-01-01", to: "2024-01-02", products: 0, active_products: 0,
      out_of_stock: 0, categories: 0, customers: 0, orders: 0, pending_orders: 0,
      completed_orders: 0, cancelled_orders: 0, money: [], daily_orders: [],
      daily_revenue: [], statuses: [], top_products: [], top_categories: [],
      recent_orders: [], recent_customers: [], low_stock: [], recent_products: [], recent_activity: [],
    }, error: null });
    const result = await getDashboardOverview({ period: "custom", from: "2024-01-01", to: "2024-01-02" });
    expect(requireActiveAdmin).toHaveBeenCalled();
    expect(db.client.rpc).toHaveBeenCalledWith("admin_dashboard_overview", {
      p_period: "custom", p_from: "2024-01-01", p_to: "2024-01-02",
    });
    expect(result.orders).toBe(0);
  });

  it("surfaces database errors instead of fabricating metrics", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_dashboard_overview", { data: null, error: { message: "unavailable" } });
    await expect(getDashboardOverview({ period: "today" })).rejects.toThrow("unavailable");
  });

  it("rejects incomplete responses", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_dashboard_overview", { data: {}, error: null });
    await expect(getDashboardOverview({ period: "today" })).rejects.toThrow();
  });
});
