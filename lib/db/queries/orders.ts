import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import type { CheckoutInput } from "@/lib/validations/checkout";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem } from "@/types/database";

export type OrderWithItems = Order & { order_items: OrderItem[] };

export type PlaceOrderErrorCode =
  | "unauthenticated"
  | "cart_empty"
  | "items_unavailable"
  | "mixed_currencies"
  | "rate_limited"
  | "invalid_data"
  | "unknown";

export class PlaceOrderError extends Error {
  constructor(public readonly code: PlaceOrderErrorCode) {
    super(code);
    this.name = "PlaceOrderError";
  }
}

/**
 * Creates an order from the signed-in user's cart through the place_order RPC.
 * The function runs in one transaction: it re-reads prices and stock, checks that every
 * product is active and in stock, computes totals, snapshots the items, decrements stock
 * and clears the cart. Nothing price-related is accepted from the caller.
 */
export async function placeOrder(input: CheckoutInput): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new PlaceOrderError("unauthenticated");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_customer_name: input.fullName,
    p_customer_email: input.email,
    p_customer_phone: input.phone,
    p_country: input.country,
    p_city: input.city,
    p_postal_code: input.postalCode,
    p_address: input.address,
    p_apartment: input.apartment || undefined,
    p_notes: input.notes || undefined,
  });

  if (error) {
    if (error.message.includes("cart_empty")) throw new PlaceOrderError("cart_empty");
    if (error.message.includes("items_unavailable")) {
      throw new PlaceOrderError("items_unavailable");
    }
    if (error.message.includes("mixed_currencies")) {
      throw new PlaceOrderError("mixed_currencies");
    }
    if (error.message.includes("rate_limited")) throw new PlaceOrderError("rate_limited");
    if (error.message.includes("not_authenticated") || error.code === "42501") {
      throw new PlaceOrderError("unauthenticated");
    }
    if (error.code === "23514") throw new PlaceOrderError("invalid_data");
    console.error("place_order failed:", error);
    throw new PlaceOrderError("unknown");
  }

  return data;
}

export type OrderSummary = Pick<
  Order,
  "id" | "order_number" | "status" | "payment_status" | "total_amount" | "currency" | "created_at"
>;

/** The signed-in user's orders, newest first (RLS-scoped). Empty for guests. */
export const getUserOrders = cache(async (): Promise<OrderSummary[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, total_amount, currency, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return data;
});

/** An order of the signed-in user with its snapshot items (RLS-scoped); null if not theirs. */
export const getOrder = cache(async (orderId: string): Promise<OrderWithItems | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .order("created_at", { referencedTable: "order_items", ascending: true })
    .maybeSingle();
  if (error) throw new Error(`Failed to load order: ${error.message}`);

  return data;
});
