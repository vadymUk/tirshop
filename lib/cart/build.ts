import { MAX_CART_LINE_QUANTITY } from "@/lib/catalog/config";
import type { CartData, CartLine, CartLineStatus } from "@/lib/cart/types";
import { getPrimaryImage } from "@/lib/storage/urls";

export type CartRow = {
  id: string;
  product_id: string;
  quantity: number;
  /** Null when the product is inactive (hidden by RLS) or otherwise unreadable. */
  products: {
    name: string;
    slug: string;
    price: number;
    currency: string;
    stock_quantity: number;
    is_active: boolean;
    product_images: { storage_path: string; alt_text: string | null; sort_order: number }[];
  } | null;
};

const toCents = (amount: number) => Math.round(amount * 100);

/** Builds the cart view model from database rows. All money math is done in integer cents. */
export function buildCart(rows: readonly CartRow[]): CartData {
  let totalCents = 0;
  const currencies = new Set<string>();

  const lines = rows.map((row): CartLine => {
    const product = row.products;

    if (!product || !product.is_active) {
      return {
        id: row.id,
        productId: row.product_id,
        quantity: row.quantity,
        name: "Unavailable product",
        slug: null,
        imagePath: null,
        imageAlt: "",
        unitPrice: 0,
        currency: null,
        stock: 0,
        maxQuantity: 0,
        lineTotal: 0,
        status: "unavailable",
      };
    }

    let status: CartLineStatus = "ok";
    if (product.stock_quantity <= 0) status = "out_of_stock";
    else if (row.quantity > product.stock_quantity) status = "exceeds_stock";

    const lineCents = toCents(product.price) * row.quantity;
    totalCents += lineCents;
    currencies.add(product.currency);

    const image = getPrimaryImage(product.product_images);
    return {
      id: row.id,
      productId: row.product_id,
      quantity: row.quantity,
      name: product.name,
      slug: product.slug,
      imagePath: image?.storage_path ?? null,
      imageAlt: image?.alt_text || product.name,
      unitPrice: product.price,
      currency: product.currency,
      stock: product.stock_quantity,
      maxQuantity: Math.min(product.stock_quantity, MAX_CART_LINE_QUANTITY),
      lineTotal: lineCents / 100,
      status,
    };
  });

  const hasMixedCurrencies = currencies.size > 1;
  const hasIssues = lines.some((line) => line.status !== "ok");

  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: totalCents / 100,
    currency: currencies.size === 1 ? [...currencies][0] : null,
    hasMixedCurrencies,
    hasIssues,
    canCheckout: lines.length > 0 && !hasIssues && !hasMixedCurrencies,
  };
}

export const EMPTY_CART: CartData = buildCart([]);
