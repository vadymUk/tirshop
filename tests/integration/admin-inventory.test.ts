import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/query-builder";

const fake = vi.hoisted(() => ({ current: null as unknown }));
const authorizeAdminOperation = vi.hoisted(() => vi.fn());
const getAdminUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/security", () => ({ authorizeAdminOperation }));
vi.mock("@/lib/admin/auth", () => ({ getAdminUser, requireActiveAdmin: authorizeAdminOperation }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (fake.current as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));

import { adjustInventory } from "@/lib/admin/inventory-actions";
import { GET } from "@/app/admin/inventory/export/route";

const id = "33333333-3333-4333-8333-333333333333";
function form() {
  const value = new FormData();
  value.append("items", `${id}:4`);
  value.set("operation", "decrease");
  value.set("quantity", "2");
  value.set("reason", "  count  ");
  return value;
}

beforeEach(() => {
  fake.current = createFakeSupabase();
  authorizeAdminOperation.mockResolvedValue({ id: "admin" });
  getAdminUser.mockResolvedValue({ id: "admin" });
});

describe("inventory actions and CSV", () => {
  it("authorizes and submits expected stock, operation and reason", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_adjust_inventory", { data: true, error: null });
    expect((await adjustInventory({}, form())).success).toBeDefined();
    expect(authorizeAdminOperation).toHaveBeenCalledWith("inventory-adjust");
    expect(db.client.rpc).toHaveBeenCalledWith("admin_adjust_inventory", { p_ids: [id], p_expected: [4], p_operation: "decrease", p_quantity: 2, p_reason: "count" });
  });
  it("surfaces stale and invalid stock without success", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_adjust_inventory", { data: null, error: { message: "stock_conflict" } });
    expect((await adjustInventory({}, form())).error).toContain("змінився");
    const invalid = form(); invalid.set("reason", "");
    expect((await adjustInventory({}, invalid)).error).toBeDefined();
    expect(db.client.rpc).toHaveBeenCalledTimes(1);
  });
  it("protects export and streams pages using validated filters", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    getAdminUser.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/admin/inventory/export"))).status).toBe(403);
    expect((await GET(new Request("http://localhost/admin/inventory/export?status=wrong"))).status).toBe(400);
    const items = Array.from({ length: 101 }, (_, i) => ({ id: `${i}`, name: `item-${i}`, sku: null, stock_quantity: 1, is_active: true, threshold: 5, image_path: null, last_stock_update: null }));
    db.client.rpc.mockImplementationOnce(async () => ({ data: items, error: null })).mockImplementationOnce(async () => ({ data: items.slice(100), error: null }));
    const response = await GET(new Request("http://localhost/admin/inventory/export?status=low&q=brake"));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const csv = await response.text();
    expect(csv).toContain("item-99");
    expect(csv.match(/"item-100"/g)).toHaveLength(1);
    expect(db.client.rpc).toHaveBeenLastCalledWith("admin_inventory_list", { p_query: "brake", p_status: "low", p_offset: 100, p_limit: 101 });
  });
});
