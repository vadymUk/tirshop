export type CartLineStatus = "ok" | "unavailable" | "out_of_stock" | "exceeds_stock";

export type CartLine = {
  id: string;
  productId: string;
  quantity: number;
  name: string;
  slug: string | null;
  imagePath: string | null;
  imageAlt: string;
  unitPrice: number;
  currency: string | null;
  stock: number;
  /** Highest quantity the user may set: min(stock, per-line cap). */
  maxQuantity: number;
  lineTotal: number;
  status: CartLineStatus;
};

export type CartData = {
  lines: CartLine[];
  /** Sum of quantities across all lines (shown in the header). */
  itemCount: number;
  /** Total of all lines that still have a product; only final when canCheckout is true. */
  total: number;
  /** Null when the cart is empty or currencies are mixed. */
  currency: string | null;
  hasMixedCurrencies: boolean;
  hasIssues: boolean;
  canCheckout: boolean;
};
