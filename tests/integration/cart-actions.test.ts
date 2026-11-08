import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsOf, createFakeSupabase, PRODUCT_ID, USER_A } from "../helpers/query-builder";

const fake = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => (fake.current as ReturnType<typeof createFakeSupabase>).client,
}));

import {
  clearCartAction,
  removeFromCartAction,
  updateCartQuantityAction,
} from "@/lib/cart/actions";

let supabase: ReturnType<typeof createFakeSupabase>;

const cartRow = (quantity: number, stock = 10, price = 10) => ({
  id: "row-1",
  product_id: PRODUCT_ID,
  quantity,
  products: {
    name: "Dash cam",
    slug: "dash-cam",
    price,
    currency: "EUR",
    stock_quantity: stock,
    is_active: true,
    product_images: [],
  },
});

beforeEach(() => {
  supabase = createFakeSupabase();
  fake.current = supabase;
  supabase.signedInAs(USER_A);
});

describe("updateCartQuantityAction", () => {
  it("updates only the current user's line and returns a server-computed cart", async () => {
    const update = supabase.queueTable("cart_items", { data: [{ quantity: 4 }], error: null });
    supabase.queueTable("cart_items", { data: [cartRow(4, 10, 2.5)], error: null });

    const result = await updateCartQuantityAction({ productId: PRODUCT_ID, quantity: 4 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.cart.total).toBe(10);
      expect(result.cart.itemCount).toBe(4);
    }
    expect(callsOf(update, "update")).toEqual([[{ quantity: 4 }]]);
    expect(callsOf(update, "eq")).toEqual(
      expect.arrayContaining([
        ["user_id", USER_A.id],
        ["product_id", PRODUCT_ID],
      ]),
    );
  });

  it("surfaces the database stock limit (trigger) as an error", async () => {
    supabase.queueTable("cart_items", { data: null, error: { message: "insufficient_stock" } });
    expect(await updateCartQuantityAction({ productId: PRODUCT_ID, quantity: 50 })).toEqual({
      success: false,
      error: "Not enough stock for that quantity.",
    });
  });

  it("reports a line that is no longer in the cart", async () => {
    supabase.queueTable("cart_items", { data: [], error: null });
    expect(await updateCartQuantityAction({ productId: PRODUCT_ID, quantity: 1 })).toMatchObject({
      success: false,
      error: "This item is no longer in your cart.",
    });
  });

  it.each([0, 100, -1, 1.2])("rejects quantity %s up front", async (quantity) => {
    const result = await updateCartQuantityAction({ productId: PRODUCT_ID, quantity });
    expect(result).toMatchObject({ success: false, error: "Invalid quantity." });
    expect(supabase.client.from).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    supabase.signedInAs(null);
    expect(await updateCartQuantityAction({ productId: PRODUCT_ID, quantity: 1 })).toMatchObject({
      success: false,
      unauthenticated: true,
    });
  });
});

describe("removeFromCartAction / clearCartAction", () => {
  it("removes a line scoped to the current user", async () => {
    const del = supabase.queueTable("cart_items", { error: null });
    supabase.queueTable("cart_items", { data: [], error: null });

    const result = await removeFromCartAction({ productId: PRODUCT_ID });

    expect(result).toMatchObject({ success: true });
    expect(callsOf(del, "delete")).toHaveLength(1);
    expect(callsOf(del, "eq")).toEqual(
      expect.arrayContaining([
        ["user_id", USER_A.id],
        ["product_id", PRODUCT_ID],
      ]),
    );
  });

  it("rejects malformed ids", async () => {
    expect(await removeFromCartAction({ productId: "nope" })).toMatchObject({ success: false });
    expect(supabase.client.from).not.toHaveBeenCalled();
  });

  it("clears the whole cart of the current user only", async () => {
    const del = supabase.queueTable("cart_items", { error: null });
    supabase.queueTable("cart_items", { data: [], error: null });

    const result = await clearCartAction();

    expect(result).toMatchObject({ success: true });
    expect(callsOf(del, "eq")).toEqual([["user_id", USER_A.id]]);
  });

  it("guests cannot mutate the cart", async () => {
    supabase.signedInAs(null);
    expect(await clearCartAction()).toMatchObject({ success: false, unauthenticated: true });
    expect(await removeFromCartAction({ productId: PRODUCT_ID })).toMatchObject({
      success: false,
      unauthenticated: true,
    });
  });
});
