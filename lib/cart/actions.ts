"use server";

import { z } from "zod";
import { CartError, cartErrorMessage } from "@/lib/cart/errors";
import type { CartData } from "@/lib/cart/types";
import { MAX_CART_LINE_QUANTITY } from "@/lib/catalog/config";
import {
  clearCart,
  getCart,
  removeFromCart,
  updateCartQuantity,
} from "@/lib/db/queries/cart";

export type CartActionResult =
  | { success: true; cart: CartData }
  | { success: false; error: string; unauthenticated?: boolean };

const updateSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_CART_LINE_QUANTITY),
});
const removeSchema = z.object({ productId: z.string().uuid() });

/** Runs a cart mutation and returns the freshly computed cart (totals come from the server). */
async function mutate(operation: () => Promise<unknown>): Promise<CartActionResult> {
  try {
    await operation();
    return { success: true, cart: await getCart() };
  } catch (error) {
    if (error instanceof CartError) {
      return {
        success: false,
        error: cartErrorMessage(error.code),
        unauthenticated: error.code === "unauthenticated" || undefined,
      };
    }
    console.error("Cart action failed:", error);
    return { success: false, error: cartErrorMessage("unknown") };
  }
}

export async function updateCartQuantityAction(
  input: z.input<typeof updateSchema>,
): Promise<CartActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: cartErrorMessage("invalid_quantity") };
  return mutate(() => updateCartQuantity(parsed.data.productId, parsed.data.quantity));
}

export async function removeFromCartAction(
  input: z.input<typeof removeSchema>,
): Promise<CartActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };
  return mutate(() => removeFromCart(parsed.data.productId));
}

export async function clearCartAction(): Promise<CartActionResult> {
  return mutate(() => clearCart());
}
