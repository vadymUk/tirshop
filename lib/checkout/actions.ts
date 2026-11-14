"use server";

import { after } from "next/server";
import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/rate-limit";
import { getCart } from "@/lib/db/queries/cart";
import { placeOrder, PlaceOrderError } from "@/lib/db/queries/orders";
import { sendOrderEmails } from "@/lib/email/send-order-emails";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/checkout";

export type PlaceOrderResult =
  | { success: true; orderId: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Partial<Record<keyof CheckoutInput, string[]>>;
      unauthenticated?: boolean;
      /** The cart changed or is invalid: send the user back to /cart. */
      cartInvalid?: boolean;
    };

const CART_INVALID_ERROR =
  "Some items in your cart are no longer available or out of stock. Please review your cart.";

export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  // 1. authenticate
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Please sign in to continue.", unauthenticated: true };
  }
  if (await isRateLimited("checkout", 20, 600)) {
    return { success: false, error: "Too many orders. Please try again later." };
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // 2-5. load the cart with live product data; block inactive / out-of-stock items early.
  // The prices read here are for the guard only; place_order recomputes everything in SQL.
  try {
    const cart = await getCart();
    if (cart.lines.length === 0) {
      return { success: false, error: "Your cart is empty.", cartInvalid: true };
    }
    if (!cart.canCheckout) {
      return { success: false, error: CART_INVALID_ERROR, cartInvalid: true };
    }
  } catch (error) {
    console.error("Checkout cart validation failed:", error);
    return { success: false, error: "Could not verify your cart. Please try again." };
  }

  // 6-7. prices, totals, stock decrement, item snapshot and cart clearing happen atomically
  // inside the place_order database function.
  let orderId: string;
  try {
    orderId = await placeOrder(parsed.data);
  } catch (error) {
    if (error instanceof PlaceOrderError) {
      switch (error.code) {
        case "unauthenticated":
          return { success: false, error: "Please sign in to continue.", unauthenticated: true };
        case "cart_empty":
          return { success: false, error: "Your cart is empty.", cartInvalid: true };
        case "items_unavailable":
          return { success: false, error: CART_INVALID_ERROR, cartInvalid: true };
        case "mixed_currencies":
          return {
            success: false,
            error: "Your cart contains products in different currencies.",
            cartInvalid: true,
          };
        case "invalid_data":
          return { success: false, error: "Some of the details you entered are invalid." };
        case "rate_limited":
          return { success: false, error: "Too many orders. Please try again later." };
      }
    }
    return { success: false, error: "We couldn't place your order. Please try again." };
  }

  // The order is committed. Emails run after the response; failures are logged inside
  // sendOrderEmails and never affect the order or what the customer sees.
  after(() => sendOrderEmails(orderId));
  // Stock changed: expire public product data before the next request.
  updateTag("products");

  return { success: true, orderId };
}
