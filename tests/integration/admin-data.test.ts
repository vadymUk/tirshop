import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsOf, createFakeSupabase } from "../helpers/query-builder";

const fake = vi.hoisted(() => ({ current: null as unknown }));
const requireActiveAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => (fake.current as ReturnType<typeof createFakeSupabase>).client,
}));

import { getAdminList, getDashboardStats } from "@/lib/admin/data";

beforeEach(() => {
  fake.current = createFakeSupabase();
  requireActiveAdmin.mockResolvedValue({ id: "admin" });
});

describe("admin dashboard queries", () => {
  it("checks admin and paginates and searches products in the database", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    const records = Array.from({ length: 21 }, (_, index) => ({
      id: String(index), name: "Product", sku: null, price: 10,
      currency: "EUR", stock_quantity: 3, is_active: true,
    }));
    const builder = db.queueTable("products", { data: records, error: null });
    const result = await getAdminList("products", 2, "50%_");
    expect(requireActiveAdmin).toHaveBeenCalled();
    expect(callsOf(builder, "range")).toEqual([[20, 40]]);
    expect(callsOf(builder, "ilike")).toEqual([["name", "%50\\%\\_%"]]);
    expect(result?.rows).toHaveLength(20);
    expect(result?.hasNext).toBe(true);
    expect(result?.rows[0].href).toBe("/admin/products/0/edit");
  });

  it("returns an empty page for a range beyond the result set", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.queueTable("products", { data: null, error: { code: "PGRST103", message: "range" } });
    expect((await getAdminList("products", 99, ""))?.rows).toEqual([]);
  });

  it("surfaces database errors instead of showing an empty list", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.queueTable("products", { data: null, error: { code: "XX000", message: "unavailable" } });
    await expect(getAdminList("products", 1, "")).rejects.toThrow("unavailable");
  });

  it("does not turn failed dashboard counts into zero", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.queueTable("products", { count: null, error: { message: "unavailable" } });
    db.queueTable("orders", { count: 0, error: null });
    db.queueTable("profiles", { count: 0, error: null });
    db.queueTable("products", { count: 0, error: null });
    await expect(getDashboardStats()).rejects.toThrow("unavailable");
  });
});
