import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsOf, createFakeSupabase } from "../helpers/query-builder";

const state = vi.hoisted(() => ({ db: null as unknown, requireAdmin: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin: state.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (state.db as ReturnType<typeof createFakeSupabase>).client }));
import EditProductPage from "@/app/admin/products/[id]/edit/page";

const id = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  state.db = createFakeSupabase();
  state.requireAdmin.mockResolvedValue({ id });
});

describe("product editor", () => {
  it("loads the editable fields without requesting the private product cost", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    const product = db.queueTable("products", { data: { id, name: "Product" }, error: null });
    db.queueTable("categories", { data: [], error: null });
    db.queueTable("product_images", { data: [], error: null });
    await EditProductPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
    const columns = String(callsOf(product, "select")[0][0]);
    expect(columns).not.toContain("*");
    expect(columns).not.toContain("cost_price");
    expect(columns).toContain("stock_quantity");
  });
});
