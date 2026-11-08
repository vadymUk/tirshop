import { describe, expect, it } from "vitest";
import { buildCart, EMPTY_CART, type CartRow } from "@/lib/cart/build";

const product = (overrides: Partial<NonNullable<CartRow["products"]>> = {}) => ({
  name: "Dash cam",
  slug: "dash-cam",
  price: 19.99,
  currency: "EUR",
  stock_quantity: 10,
  is_active: true,
  product_images: [],
  ...overrides,
});

const row = (id: string, quantity: number, products: CartRow["products"]): CartRow => ({
  id,
  product_id: `product-${id}`,
  quantity,
  products,
});

describe("buildCart", () => {
  it("returns an empty, non-checkoutable cart", () => {
    expect(EMPTY_CART.lines).toHaveLength(0);
    expect(EMPTY_CART.total).toBe(0);
    expect(EMPTY_CART.canCheckout).toBe(false);
  });

  it("computes totals in integer cents (no floating point drift)", () => {
    const cart = buildCart([row("1", 3, product({ price: 0.1 })), row("2", 1, product({ price: 0.2 }))]);
    expect(cart.lines[0].lineTotal).toBe(0.3);
    expect(cart.total).toBe(0.5);
    expect(cart.itemCount).toBe(4);
    expect(cart.currency).toBe("EUR");
    expect(cart.canCheckout).toBe(true);
  });

  it("flags quantity above stock and blocks checkout", () => {
    const cart = buildCart([row("1", 5, product({ stock_quantity: 3 }))]);
    expect(cart.lines[0].status).toBe("exceeds_stock");
    expect(cart.lines[0].maxQuantity).toBe(3);
    expect(cart.hasIssues).toBe(true);
    expect(cart.canCheckout).toBe(false);
  });

  it("flags out-of-stock items", () => {
    const cart = buildCart([row("1", 1, product({ stock_quantity: 0 }))]);
    expect(cart.lines[0].status).toBe("out_of_stock");
    expect(cart.canCheckout).toBe(false);
  });

  it("treats inactive and hidden products as unavailable and excludes them from the total", () => {
    const cart = buildCart([
      row("1", 1, product({ is_active: false })),
      row("2", 1, null),
      row("3", 2, product({ price: 5 })),
    ]);
    expect(cart.lines.map((line) => line.status)).toEqual(["unavailable", "unavailable", "ok"]);
    expect(cart.total).toBe(10);
    expect(cart.canCheckout).toBe(false);
  });

  it("caps the selectable quantity at 99", () => {
    const cart = buildCart([row("1", 1, product({ stock_quantity: 500 }))]);
    expect(cart.lines[0].maxQuantity).toBe(99);
  });

  it("refuses to check out a cart with mixed currencies", () => {
    const cart = buildCart([
      row("1", 1, product({ currency: "EUR" })),
      row("2", 1, product({ currency: "PLN" })),
    ]);
    expect(cart.hasMixedCurrencies).toBe(true);
    expect(cart.currency).toBeNull();
    expect(cart.canCheckout).toBe(false);
  });
});
