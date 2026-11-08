import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  callsOf,
  createFakeSupabase,
  PRODUCT_ID,
  USER_A,
  USER_B,
} from "../helpers/query-builder";

const fake = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => (fake.current as ReturnType<typeof createFakeSupabase>).client,
}));

import { addToCartAction, setFavoriteAction } from "@/lib/catalog/actions";

let supabase: ReturnType<typeof createFakeSupabase>;

beforeEach(() => {
  supabase = createFakeSupabase();
  fake.current = supabase;
});

describe("favorites: add", () => {
  it("requires authentication", async () => {
    supabase.signedInAs(null);
    const result = await setFavoriteAction({ productId: PRODUCT_ID, isFavorite: true });
    expect(result).toMatchObject({ success: false, unauthenticated: true });
    expect(supabase.client.from).not.toHaveBeenCalled();
  });

  it("inserts a row owned by the authenticated user", async () => {
    supabase.signedInAs(USER_A);
    const table = supabase.queueTable("favorites", { error: null });
    const result = await setFavoriteAction({ productId: PRODUCT_ID, isFavorite: true });

    expect(result).toEqual({ success: true, isFavorite: true });
    expect(callsOf(table, "insert")).toEqual([[{ user_id: USER_A.id, product_id: PRODUCT_ID }]]);
  });

  it("is idempotent when the product is already a favorite", async () => {
    supabase.signedInAs(USER_A);
    supabase.queueTable("favorites", { error: { code: "23505", message: "duplicate" } });
    expect(await setFavoriteAction({ productId: PRODUCT_ID, isFavorite: true })).toEqual({
      success: true,
      isFavorite: true,
    });
  });

  it("reports products that were removed or hidden", async () => {
    supabase.signedInAs(USER_A);
    supabase.queueTable("favorites", { error: { code: "23503", message: "fk" } });
    expect(await setFavoriteAction({ productId: PRODUCT_ID, isFavorite: true })).toMatchObject({
      success: false,
      error: "This product is no longer available.",
    });
  });

  it("rejects malformed product ids before touching the database", async () => {
    supabase.signedInAs(USER_A);
    const result = await setFavoriteAction({ productId: "1; DROP TABLE favorites", isFavorite: true });
    expect(result.success).toBe(false);
    expect(supabase.client.from).not.toHaveBeenCalled();
  });
});

describe("favorites: remove and ownership", () => {
  it("deletes only the current user's row", async () => {
    supabase.signedInAs(USER_A);
    const table = supabase.queueTable("favorites", { error: null });
    const result = await setFavoriteAction({ productId: PRODUCT_ID, isFavorite: false });

    expect(result).toEqual({ success: true, isFavorite: false });
    const filters = callsOf(table, "eq");
    expect(filters).toContainEqual(["user_id", USER_A.id]);
    expect(filters).toContainEqual(["product_id", PRODUCT_ID]);
  });

  it("ignores a user id smuggled in the payload (cannot act on another user's list)", async () => {
    supabase.signedInAs(USER_A);
    const table = supabase.queueTable("favorites", { error: null });
    await setFavoriteAction({
      productId: PRODUCT_ID,
      isFavorite: true,
      userId: USER_B.id,
      user_id: USER_B.id,
    } as never);

    expect(callsOf(table, "insert")[0][0]).toMatchObject({ user_id: USER_A.id });
    expect(JSON.stringify(table.calls)).not.toContain(USER_B.id);
  });

  it("surfaces database failures as a friendly message", async () => {
    supabase.signedInAs(USER_A);
    supabase.queueTable("favorites", { error: { code: "XX000", message: "secret internals" } });
    const result = await setFavoriteAction({ productId: PRODUCT_ID, isFavorite: false });
    expect(result).toMatchObject({ success: false });
    expect(JSON.stringify(result)).not.toContain("secret internals");
  });
});

describe("addToCartAction", () => {
  const cartCountTable = (supabaseRef: typeof supabase, quantities: number[]) =>
    supabaseRef.queueTable("cart_items", {
      data: quantities.map((quantity) => ({ quantity })),
      error: null,
    });

  it("requires authentication", async () => {
    supabase.signedInAs(null);
    expect(await addToCartAction({ productId: PRODUCT_ID, quantity: 1 })).toMatchObject({
      success: false,
      unauthenticated: true,
    });
  });

  it("adds through the atomic RPC and returns the new quantity and cart count", async () => {
    supabase.signedInAs(USER_A);
    supabase.setRpc("add_to_cart", { data: 3, error: null });
    cartCountTable(supabase, [3, 2]);

    const result = await addToCartAction({ productId: PRODUCT_ID, quantity: 1 });

    expect(result).toEqual({ success: true, quantity: 3, cartCount: 5 });
    expect(supabase.client.rpc).toHaveBeenCalledWith("add_to_cart", {
      p_product_id: PRODUCT_ID,
      p_quantity: 1,
    });
  });

  it("maps stock failures from the database to a clear message", async () => {
    supabase.signedInAs(USER_A);
    supabase.setRpc("add_to_cart", { data: null, error: { message: "insufficient_stock" } });
    expect(await addToCartAction({ productId: PRODUCT_ID, quantity: 5 })).toEqual({
      success: false,
      error: "Not enough stock for that quantity. Check your cart.",
    });
  });

  it.each([0, -2, 100, 2.5])("rejects quantity %s without calling the database", async (quantity) => {
    supabase.signedInAs(USER_A);
    const result = await addToCartAction({ productId: PRODUCT_ID, quantity });
    expect(result).toMatchObject({ success: false });
    expect(supabase.client.rpc).not.toHaveBeenCalled();
  });
});
