import { beforeEach, describe, expect, it, vi } from "vitest";
import { SHIPPING_COUNTRIES } from "@/lib/checkout/countries";
import { USER_A } from "../helpers/query-builder";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isRateLimited: vi.fn(),
  getCart: vi.fn(),
  placeOrder: vi.fn(),
  sendOrderEmails: vi.fn(),
  revalidateTag: vi.fn(),
  after: vi.fn((callback: () => unknown) => callback()),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/rate-limit", () => ({ isRateLimited: mocks.isRateLimited }));
vi.mock("@/lib/db/queries/cart", () => ({ getCart: mocks.getCart }));
vi.mock("@/lib/db/queries/orders", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/db/queries/orders")>()),
  placeOrder: mocks.placeOrder,
}));
vi.mock("@/lib/email/send-order-emails", () => ({ sendOrderEmails: mocks.sendOrderEmails }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag, revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));

import { placeOrderAction } from "@/lib/checkout/actions";
import { PlaceOrderError } from "@/lib/db/queries/orders";

const ORDER_ID = "44444444-4444-4444-8444-444444444444";

const input = {
  fullName: "Jan Kowalski",
  email: "jan@example.com",
  phone: "+48 600 100 200",
  country: SHIPPING_COUNTRIES[0],
  city: "Warszawa",
  postalCode: "00-001",
  address: "Marszałkowska 1",
  apartment: "",
  notes: "",
  acceptTerms: true,
};

beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue(USER_A);
  mocks.isRateLimited.mockResolvedValue(false);
  mocks.getCart.mockResolvedValue({ lines: [{ id: "1" }], canCheckout: true });
  mocks.placeOrder.mockResolvedValue(ORDER_ID);
  mocks.sendOrderEmails.mockResolvedValue({ seller: true, customer: true });
});

describe("placeOrderAction: access control", () => {
  it("rejects unauthenticated users and never reads the cart or creates an order", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const result = await placeOrderAction(input);
    expect(result).toMatchObject({ success: false, unauthenticated: true });
    expect(mocks.getCart).not.toHaveBeenCalled();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    mocks.isRateLimited.mockResolvedValue(true);
    const result = await placeOrderAction(input);
    expect(result).toMatchObject({ success: false, error: "Too many orders. Please try again later." });
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });
});

describe("placeOrderAction: validation", () => {
  it("returns field errors for invalid details", async () => {
    const result = await placeOrderAction({ ...input, email: "bad", phone: "x" });
    expect(result).toMatchObject({ success: false });
    if (!result.success) {
      expect(result.fieldErrors?.email).toBeDefined();
      expect(result.fieldErrors?.phone).toBeDefined();
    }
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it("requires the consent checkbox on the server as well", async () => {
    const result = await placeOrderAction({ ...input, acceptTerms: false });
    expect(result).toMatchObject({ success: false });
    if (!result.success) expect(result.fieldErrors?.acceptTerms).toBeDefined();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it("rejects non-object payloads", async () => {
    expect(await placeOrderAction(null)).toMatchObject({ success: false });
    expect(await placeOrderAction("<script>")).toMatchObject({ success: false });
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });
});

describe("placeOrderAction: cart and stock validation", () => {
  it("rejects an empty cart", async () => {
    mocks.getCart.mockResolvedValue({ lines: [], canCheckout: false });
    expect(await placeOrderAction(input)).toMatchObject({
      success: false,
      error: "Your cart is empty.",
      cartInvalid: true,
    });
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it("rejects carts with unavailable or out-of-stock lines before creating an order", async () => {
    mocks.getCart.mockResolvedValue({ lines: [{ id: "1" }], canCheckout: false });
    expect(await placeOrderAction(input)).toMatchObject({ success: false, cartInvalid: true });
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["cart_empty", "Your cart is empty."],
    ["items_unavailable", "Some items in your cart are no longer available or out of stock. Please review your cart."],
    ["mixed_currencies", "Your cart contains products in different currencies."],
    ["invalid_data", "Some of the details you entered are invalid."],
    ["rate_limited", "Too many orders. Please try again later."],
  ] as const)("maps the database error %s to a safe message", async (code, message) => {
    mocks.placeOrder.mockRejectedValue(new PlaceOrderError(code));
    const result = await placeOrderAction(input);
    expect(result).toMatchObject({ success: false, error: message });
    expect(mocks.sendOrderEmails).not.toHaveBeenCalled();
  });

  it("hides unexpected failures behind a generic message (rollback: no email, no cache refresh)", async () => {
    mocks.placeOrder.mockRejectedValue(new Error("relation orders does not exist"));
    const result = await placeOrderAction(input);
    expect(result).toEqual({
      success: false,
      error: "We couldn't place your order. Please try again.",
    });
    expect(mocks.sendOrderEmails).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("returns a friendly error if the cart cannot be verified", async () => {
    mocks.getCart.mockRejectedValue(new Error("db down"));
    expect(await placeOrderAction(input)).toMatchObject({ success: false });
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });
});

describe("placeOrderAction: order creation", () => {
  it("creates the order, sends emails after commit and refreshes cached stock", async () => {
    const result = await placeOrderAction(input);

    expect(result).toEqual({ success: true, orderId: ORDER_ID });
    expect(mocks.sendOrderEmails).toHaveBeenCalledWith(ORDER_ID);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("products", "max");
  });

  it("passes only customer details to the database: never prices, totals, status or user id", async () => {
    await placeOrderAction({
      ...input,
      price: 0.01,
      total_amount: 0,
      payment_status: "paid",
      status: "completed",
      user_id: "another-user",
      items: [{ productId: "x", unitPrice: 0 }],
    });

    const payload = mocks.placeOrder.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual(
      [
        "acceptTerms",
        "address",
        "apartment",
        "city",
        "country",
        "email",
        "fullName",
        "notes",
        "phone",
        "postalCode",
      ].sort(),
    );
  });

  it("does not fail the order when sending emails fails", async () => {
    mocks.sendOrderEmails.mockRejectedValue(new Error("resend down"));
    // after() runs the callback synchronously in this test; a rejected promise must not leak.
    mocks.after.mockImplementationOnce((callback: () => unknown) => {
      Promise.resolve(callback()).catch(() => undefined);
    });
    expect(await placeOrderAction(input)).toEqual({ success: true, orderId: ORDER_ID });
  });
});
