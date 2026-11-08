import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  cleanupTestData,
  createCategory,
  createProduct,
  createTestUser,
  dbTestsEnabled,
  placeOrder,
  shippingDetails,
  stockOf,
  type TestUser,
} from "../helpers/db";

describe.skipIf(!dbTestsEnabled)("checkout transaction (real database)", () => {
  let categoryId: string;

  beforeAll(async () => {
    categoryId = await createCategory();
  });
  afterAll(cleanupTestData);

  const addToCart = (user: TestUser, productId: string, quantity: number) =>
    user.client.rpc("add_to_cart", { p_product_id: productId, p_quantity: quantity });

  const ordersOf = async (user: TestUser) =>
    (await adminClient().from("orders").select("*, order_items(*)").eq("user_id", user.id)).data ?? [];

  const cartOf = async (user: TestUser) =>
    (await adminClient().from("cart_items").select("*").eq("user_id", user.id)).data ?? [];

  it("creates the order with server-side prices, decrements stock and clears the cart", async () => {
    const user = await createTestUser("buyer");
    const cheap = await createProduct(categoryId, { price: 9.99, stock: 10 });
    const pricey = await createProduct(categoryId, { price: 100.5, stock: 3 });
    await addToCart(user, cheap, 3);
    await addToCart(user, pricey, 1);

    const { data: orderId, error } = await placeOrder(user);
    expect(error).toBeNull();

    const [order] = await ordersOf(user);
    expect(order.id).toBe(orderId);
    expect(order.user_id).toBe(user.id);
    expect(Number(order.total_amount)).toBe(130.47);
    expect(order.status).toBe("pending");
    expect(order.payment_status).toBe("pending");
    expect(order.order_items).toHaveLength(2);
    expect(order.order_items.map((i: { quantity: number }) => i.quantity).sort()).toEqual([1, 3]);

    expect(await stockOf(cheap)).toBe(7);
    expect(await stockOf(pricey)).toBe(2);
    expect(await cartOf(user)).toEqual([]);
  });

  it("uses the current database price, not the price at the time the item was added", async () => {
    const user = await createTestUser("price");
    const product = await createProduct(categoryId, { price: 10, stock: 5 });
    await addToCart(user, product, 2);
    await adminClient().from("products").update({ price: 15 }).eq("id", product);

    await placeOrder(user);
    expect(Number((await ordersOf(user))[0].total_amount)).toBe(30);
  });

  it("does not accept price, total or user parameters from the client", async () => {
    const user = await createTestUser("tamper");
    const product = await createProduct(categoryId, { price: 10, stock: 5 });
    await addToCart(user, product, 1);

    for (const extra of [{ p_total_amount: 0.01 }, { p_unit_price: 0.01 }, { p_user_id: user.id }]) {
      const { error } = await user.client.rpc("place_order", { ...shippingDetails, ...extra });
      expect(error).not.toBeNull();
    }
    expect(await ordersOf(user)).toEqual([]);
    expect(await stockOf(product)).toBe(5);
  });

  it("rejects an empty cart and unauthenticated callers", async () => {
    const user = await createTestUser("empty");
    expect((await placeOrder(user)).error?.message).toContain("cart_empty");

    const { anonClient } = await import("../helpers/db");
    const anon = await anonClient().rpc("place_order", shippingDetails);
    expect(anon.error).not.toBeNull();
  });

  it("rejects products that became inactive and leaves everything untouched", async () => {
    const user = await createTestUser("inactive");
    const product = await createProduct(categoryId, { stock: 5 });
    await addToCart(user, product, 1);
    await adminClient().from("products").update({ is_active: false }).eq("id", product);

    const { error } = await placeOrder(user);
    expect(error?.message).toContain("items_unavailable");
    expect(await ordersOf(user)).toEqual([]);
    expect(await stockOf(product)).toBe(5);
    expect(await cartOf(user)).toHaveLength(1);
  });

  it("rolls back completely when one line lacks stock (no partial order, no partial decrement)", async () => {
    const user = await createTestUser("partial");
    const plenty = await createProduct(categoryId, { stock: 10 });
    const scarce = await createProduct(categoryId, { stock: 3 });
    await addToCart(user, plenty, 2);
    await addToCart(user, scarce, 3);
    // Stock disappears after the item was added to the cart.
    await adminClient().from("products").update({ stock_quantity: 1 }).eq("id", scarce);

    const { error } = await placeOrder(user);
    expect(error?.message).toContain("items_unavailable");

    expect(await ordersOf(user)).toEqual([]);
    expect(await stockOf(plenty)).toBe(10);
    expect(await stockOf(scarce)).toBe(1);
    expect(await cartOf(user)).toHaveLength(2);
  });

  it("refuses carts with mixed currencies", async () => {
    const user = await createTestUser("currency");
    const eur = await createProduct(categoryId, { currency: "EUR" });
    const pln = await createProduct(categoryId, { currency: "PLN" });
    await addToCart(user, eur, 1);
    await addToCart(user, pln, 1);

    expect((await placeOrder(user)).error?.message).toContain("mixed_currencies");
    expect(await ordersOf(user)).toEqual([]);
  });

  it("two customers buying the last item at the same time: exactly one wins, stock never goes negative", async () => {
    const [first, second] = await Promise.all([createTestUser("race1"), createTestUser("race2")]);
    const last = await createProduct(categoryId, { stock: 1 });
    await Promise.all([addToCart(first, last, 1), addToCart(second, last, 1)]);

    const results = await Promise.all([placeOrder(first), placeOrder(second)]);

    const succeeded = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].error!.message).toContain("items_unavailable");
    expect(await stockOf(last)).toBe(0);
    expect((await ordersOf(first)).length + (await ordersOf(second)).length).toBe(1);
  });

  it("many concurrent buyers never oversell (stock 3, 8 buyers)", async () => {
    const buyers = await Promise.all(Array.from({ length: 8 }, (_, i) => createTestUser(`mass${i}`)));
    const product = await createProduct(categoryId, { stock: 3 });
    await Promise.all(buyers.map((buyer) => addToCart(buyer, product, 1)));

    const results = await Promise.all(buyers.map((buyer) => placeOrder(buyer)));

    expect(results.filter((r) => !r.error)).toHaveLength(3);
    expect(await stockOf(product)).toBe(0);
  });

  it("limits how many orders one account can place per hour", async () => {
    const user = await createTestUser("flood");
    const product = await createProduct(categoryId, { stock: 50 });
    let limited = false;
    for (let i = 0; i < 12 && !limited; i++) {
      await addToCart(user, product, 1);
      const { error } = await placeOrder(user);
      limited = Boolean(error?.message.includes("rate_limited"));
    }
    expect(limited).toBe(true);
  });
});

describe.skipIf(!dbTestsEnabled)("payment state changes (real database)", () => {
  let categoryId: string;
  beforeAll(async () => {
    categoryId = await createCategory();
  });
  afterAll(cleanupTestData);

  async function orderWithPayment() {
    const user = await createTestUser("pay");
    const product = await createProduct(categoryId, { price: 20, stock: 5 });
    await user.client.rpc("add_to_cart", { p_product_id: product, p_quantity: 2 });
    const { data: orderId } = await placeOrder(user);
    const providerPaymentId = `pay_${orderId}`;
    await adminClient().from("payments").insert({
      order_id: orderId,
      provider: "test-provider",
      provider_payment_id: providerPaymentId,
      amount: 40,
      currency: "EUR",
    });
    return { orderId: orderId as string, providerPaymentId };
  }

  const apply = (providerPaymentId: string, eventId: string, status: string, amount: number, currency = "EUR") =>
    adminClient().rpc("apply_payment_event", {
      p_provider: "test-provider",
      p_event_id: eventId,
      p_provider_payment_id: providerPaymentId,
      p_status: status,
      p_amount: amount,
      p_currency: currency,
      p_payload: {},
    });

  const paymentStatus = async (orderId: string) =>
    (await adminClient().from("orders").select("payment_status").eq("id", orderId).single()).data!.payment_status;

  it("marks an order paid only for a verified event with the exact amount and currency", async () => {
    const { orderId, providerPaymentId } = await orderWithPayment();

    expect((await apply(providerPaymentId, "evt_1", "paid", 1)).error?.message).toContain("amount_mismatch");
    expect((await apply(providerPaymentId, "evt_2", "paid", 40, "PLN")).error?.message).toContain("amount_mismatch");
    expect(await paymentStatus(orderId)).toBe("pending");

    expect((await apply(providerPaymentId, "evt_3", "paid", 40)).data).toBe("applied");
    expect(await paymentStatus(orderId)).toBe("paid");
  });

  it("is idempotent for duplicate webhook deliveries", async () => {
    const { providerPaymentId } = await orderWithPayment();
    expect((await apply(providerPaymentId, "evt_dup", "paid", 40)).data).toBe("applied");
    expect((await apply(providerPaymentId, "evt_dup", "paid", 40)).data).toBe("duplicate");
  });

  it("ignores impossible transitions (a paid order cannot fail again)", async () => {
    const { orderId, providerPaymentId } = await orderWithPayment();
    await apply(providerPaymentId, "evt_paid", "paid", 40);
    const result = await apply(providerPaymentId, "evt_late_fail", "failed", 40);
    expect(result.data).toBe("ignored");
    expect(await paymentStatus(orderId)).toBe("paid");
  });
});
