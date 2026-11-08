import "server-only";
import { cache } from "react";
import { getAuthUser, getCurrentUser } from "@/lib/auth/session";
import { buildCart, EMPTY_CART } from "@/lib/cart/build";
import { CartError, toCartError } from "@/lib/cart/errors";
import type { CartData } from "@/lib/cart/types";
import { createClient } from "@/lib/supabase/server";

// All queries run as the signed-in user: RLS scopes every row to auth.uid(), and the
// stock trigger (migration 0005) enforces limits even if this code is bypassed.

async function requireCartUser() {
  const user = await getCurrentUser();
  if (!user) throw new CartError("unauthenticated");
  return user;
}

/**
 * Reads the cart with live product prices and stock. Never cached across requests, so
 * checkout always sees current data. Guests get an empty cart.
 */
export async function getCart(): Promise<CartData> {
  const user = await getCurrentUser();
  if (!user) return EMPTY_CART;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select(
      "id, product_id, quantity, products(name, slug, price, currency, stock_quantity, is_active, product_images(storage_path, alt_text, sort_order))",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load cart: ${error.message}`);

  return buildCart(data ?? []);
}

/** Total number of items in the cart (sum of quantities); 0 for guests. */
export const getCartCount = cache(async (): Promise<number> => {
  const user = await getAuthUser();
  if (!user) return 0;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("user_id", user.id);
  if (error) throw new Error(`Failed to load cart count: ${error.message}`);

  return data.reduce((sum, row) => sum + row.quantity, 0);
});

/** Adds to the cart through the atomic add_to_cart RPC; returns the new line quantity. */
export async function addToCart(productId: string, quantity: number): Promise<number> {
  await requireCartUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_to_cart", {
    p_product_id: productId,
    p_quantity: quantity,
  });
  if (error) throw toCartError(error);
  return data;
}

/** Sets an existing cart line to an exact quantity (1..stock). */
export async function updateCartQuantity(
  productId: string,
  quantity: number,
): Promise<number> {
  const user = await requireCartUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .select("quantity");
  if (error) throw toCartError(error);
  if (!data?.length) throw new CartError("not_in_cart");
  return data[0].quantity;
}

export async function removeFromCart(productId: string): Promise<void> {
  const user = await requireCartUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", productId);
  if (error) throw toCartError(error);
}

export async function clearCart(): Promise<void> {
  const user = await requireCartUser();
  const supabase = await createClient();
  const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id);
  if (error) throw toCartError(error);
}
