import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/query-builder";

const state = vi.hoisted(() => ({ db: null as unknown, authorize: vi.fn(), updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/security", () => ({ authorizeAdminOperation: state.authorize }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (state.db as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("next/cache", () => ({ updateTag: state.updateTag, revalidatePath: state.revalidatePath }));
import { bulkProducts } from "@/lib/admin/product-actions";
import { moveCategory } from "@/lib/admin/category-actions";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  state.db = createFakeSupabase();
  state.authorize.mockResolvedValue({ id: first });
});

describe("catalog invalidation", () => {
  it("expires product data, but not category data, after a product mutation", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_bulk_products", { data: true, error: null });
    const form = new FormData();
    form.append("ids", first);
    form.set("operation", "deactivate");
    expect((await bulkProducts({}, form)).success).toBeTruthy();
    expect(state.updateTag).toHaveBeenCalledWith("products");
    expect(state.updateTag).not.toHaveBeenCalledWith("categories");
    expect(state.updateTag).not.toHaveBeenCalledWith("catalog");
  });

  it("expires categories and embedded product category data after category changes", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_move_category", { data: true, error: null });
    expect((await moveCategory(first, second)).success).toBeTruthy();
    expect(state.updateTag).toHaveBeenCalledWith("categories");
    expect(state.updateTag).toHaveBeenCalledWith("products");
    vi.clearAllMocks();
    db.setRpc("admin_move_category", { data: null, error: { message: "unavailable" } });
    expect((await moveCategory(first, second)).error).toBeTruthy();
    expect(state.updateTag).not.toHaveBeenCalled();
  });
});
