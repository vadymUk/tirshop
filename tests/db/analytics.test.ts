import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyticsSchema } from "@/lib/admin/analytics";
import { adminClient, anonClient, cleanupTestData, createCategory, createProduct, createTestUser, dbTestsEnabled, placeOrder, type TestUser } from "../helpers/db";

describe.skipIf(!dbTestsEnabled)("analytics RPC (dedicated database)", () => {
  let admin: TestUser;
  let customer: TestUser;
  let productId: string;
  let categoryId: string;
  let outOfStockId: string;
  const date = "2317-01-02";
  const args = { p_period: "custom", p_from: date, p_to: date, p_currency: "XTS", p_bucket: "day", p_offset: 0 };

  beforeAll(async () => {
    [admin, customer] = await Promise.all([createTestUser("analytics-admin"), createTestUser("analytics-customer")]);
    const promoted = await adminClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    if (promoted.error) throw new Error(promoted.error.message);
    categoryId = await createCategory();
    productId = await createProduct(categoryId, { price: 10, stock: 50, currency: "XTS" });
    outOfStockId = await createProduct(categoryId, { stock: 0, currency: "XTS" });
    const otherCurrency = await createProduct(categoryId, { price: 10, stock: 5, currency: "EUR" });

    async function order(product: string, quantity: number, createdAt: string, status: string, paymentStatus: string) {
      const cart = await customer.client.rpc("add_to_cart", { p_product_id: product, p_quantity: quantity });
      if (cart.error) throw new Error(cart.error.message);
      const placed = await placeOrder(customer);
      if (placed.error) throw new Error(placed.error.message);
      const update = await adminClient().from("orders").update({ created_at: createdAt, status, payment_status: paymentStatus }).eq("id", placed.data);
      if (update.error) throw new Error(update.error.message);
    }

    await order(productId, 2, `${date}T00:00:00Z`, "completed", "paid");
    await order(productId, 1, `${date}T12:00:00Z`, "pending", "pending");
    await order(productId, 1, `${date}T12:00:00Z`, "pending", "failed");
    await order(productId, 1, `${date}T12:00:00Z`, "pending", "refunded");
    await order(productId, 1, `${date}T23:59:59Z`, "cancelled", "paid");
    await order(productId, 1, "2317-01-03T00:00:00Z", "pending", "paid");
    await order(otherCurrency, 1, `${date}T12:00:00Z`, "pending", "paid");
  });
  afterAll(cleanupTestData);

  it("enforces active-admin access and validates RPC inputs", async () => {
    expect((await anonClient().rpc("admin_ecommerce_analytics", args)).error).not.toBeNull();
    expect((await customer.client.rpc("admin_ecommerce_analytics", args)).error).not.toBeNull();
    expect((await admin.client.rpc("admin_ecommerce_analytics", { ...args, p_bucket: "year" })).error).not.toBeNull();
    expect((await admin.client.rpc("admin_ecommerce_analytics", { ...args, p_offset: -1 })).error).not.toBeNull();
    const disabled = await adminClient().from("profiles").update({ is_active: false }).eq("id", admin.id);
    if (disabled.error) throw new Error(disabled.error.message);
    try {
      expect((await admin.client.rpc("admin_ecommerce_analytics", args)).error).not.toBeNull();
    } finally {
      const restored = await adminClient().from("profiles").update({ is_active: true }).eq("id", admin.id);
      if (restored.error) throw new Error(restored.error.message);
    }
  });

  it("separates paid, unpaid, refunded and cancelled orders at UTC boundaries", async () => {
    const result = await admin.client.rpc("admin_ecommerce_analytics", args);
    if (result.error) throw new Error(result.error.message);
    const data = analyticsSchema.parse(result.data);
    expect(data).toMatchObject({ orders: 5, completed: 1, cancelled: 1, gross: 50, paid: 20, unpaid: 20, average: 12.5, repeat_customers: 1 });
    expect(data.timeline).toEqual([{ bucket: date, orders: 5, revenue: 20 }]);
    expect(data.best_products.find((row) => row.product_id === productId)).toMatchObject({ quantity: 2, revenue: 20 });
    expect(data.categories.find((row) => row.category_id === categoryId)).toMatchObject({ quantity: 2, revenue: 20, orders: 1 });
    expect(data.top_customers.find((row) => row.id === customer.id)).toMatchObject({ orders: 4, revenue: 50 });
    expect(data.least_products.find((row) => row.id === outOfStockId)).toMatchObject({ quantity: 0, revenue: 0 });
    expect(data.out_of_stock.some((row) => row.id === outOfStockId)).toBe(true);
  });
});
