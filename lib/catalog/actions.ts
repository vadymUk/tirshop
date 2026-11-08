"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { MAX_CART_LINE_QUANTITY } from "@/lib/catalog/config";
import { CartError, cartErrorMessage } from "@/lib/cart/errors";
import { addToCart, getCartCount } from "@/lib/db/queries/cart";
import { createClient } from "@/lib/supabase/server";

export type FavoriteResult =
  | { success: true; isFavorite: boolean }
  | { success: false; error: string; unauthenticated?: boolean };

export type CartResult =
  | { success: true; quantity: number; cartCount: number }
  | { success: false; error: string; unauthenticated?: boolean };

const favoriteSchema = z.object({
  productId: z.string().uuid(),
  isFavorite: z.boolean(),
});

const cartSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_CART_LINE_QUANTITY),
});

const UNAUTHENTICATED = {
  success: false,
  error: "Please sign in to continue.",
  unauthenticated: true,
} as const;

/** Sets the favorite state of a product for the current user (idempotent). */
export async function setFavoriteAction(
  input: z.input<typeof favoriteSchema>,
): Promise<FavoriteResult> {
  const parsed = favoriteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const user = await getCurrentUser();
  if (!user) return UNAUTHENTICATED;

  const { productId, isFavorite } = parsed.data;
  const supabase = await createClient();

  if (isFavorite) {
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, product_id: productId });
    // 23505: already a favorite, which is the desired end state.
    if (error && error.code !== "23505") {
      return error.code === "23503"
        ? { success: false, error: "This product is no longer available." }
        : { success: false, error: "Could not update favorites. Please try again." };
    }
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);
    if (error) {
      return { success: false, error: "Could not update favorites. Please try again." };
    }
  }

  return { success: true, isFavorite };
}

/** Adds to the cart; stock is enforced in the database (trigger + RPC). */
export async function addToCartAction(
  input: z.input<typeof cartSchema>,
): Promise<CartResult> {
  const parsed = cartSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid quantity." };

  const user = await getCurrentUser();
  if (!user) return UNAUTHENTICATED;

  try {
    const quantity = await addToCart(parsed.data.productId, parsed.data.quantity);
    return { success: true, quantity, cartCount: await getCartCount() };
  } catch (error) {
    if (error instanceof CartError) {
      return {
        success: false,
        error:
          error.code === "insufficient_stock"
            ? "Not enough stock for that quantity. Check your cart."
            : cartErrorMessage(error.code),
        unauthenticated: error.code === "unauthenticated" || undefined,
      };
    }
    console.error("addToCart failed:", error);
    return { success: false, error: "Could not add to cart. Please try again." };
  }
}
