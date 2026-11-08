export type CartErrorCode =
  | "unauthenticated"
  | "insufficient_stock"
  | "product_unavailable"
  | "not_in_cart"
  | "invalid_quantity"
  | "unknown";

export class CartError extends Error {
  constructor(public readonly code: CartErrorCode) {
    super(code);
    this.name = "CartError";
  }
}

const MESSAGES: Record<CartErrorCode, string> = {
  unauthenticated: "Please sign in to continue.",
  insufficient_stock: "Not enough stock for that quantity.",
  product_unavailable: "This product is no longer available.",
  not_in_cart: "This item is no longer in your cart.",
  invalid_quantity: "Invalid quantity.",
  unknown: "Something went wrong. Please try again.",
};

export function cartErrorMessage(code: CartErrorCode): string {
  return MESSAGES[code];
}

/** Maps a PostgREST/Postgres error from a cart write to a stable code. */
export function toCartError(error: { message: string; code?: string }): CartError {
  if (error.message.includes("insufficient_stock")) return new CartError("insufficient_stock");
  if (error.message.includes("product_unavailable")) return new CartError("product_unavailable");
  if (error.message.includes("not_authenticated") || error.code === "42501") {
    return new CartError("unauthenticated");
  }
  // 23514: check_violation on cart_items.quantity; 23503: product row is gone.
  if (error.message.includes("invalid_quantity") || error.code === "23514") {
    return new CartError("invalid_quantity");
  }
  if (error.code === "23503") return new CartError("product_unavailable");
  return new CartError("unknown");
}
