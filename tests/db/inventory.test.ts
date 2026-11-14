import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestData, createCategory, createProduct, createTestUser, dbTestsEnabled, placeOrder, stockOf, type TestUser } from "../helpers/db";

describe.skipIf(!dbTestsEnabled)("inventory management (dedicated database)", () => {
  let admin: TestUser;
  let customer: TestUser;
  let category: string;
  beforeAll(async () => {
    [admin, customer] = await Promise.all([createTestUser("inventory-admin"), createTestUser("inventory-customer")]);
    const promotion = await adminClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    if (promotion.error) throw new Error(promotion.error.message);
    category = await createCategory();
  });
  afterAll(cleanupTestData);

  it("enforces access and records atomic changes with reason and actor", async () => {
    const first = await createProduct(category, { stock: 5 });
    const second = await createProduct(category, { stock: 3 });
    const args = { p_ids: [first, second], p_expected: [5, 3], p_operation: "decrease", p_quantity: 2, p_reason: "count" };
    expect((await anonClient().rpc("admin_adjust_inventory", args)).error).not.toBeNull();
    expect((await customer.client.rpc("admin_adjust_inventory", args)).error).not.toBeNull();
    expect((await admin.client.from("products").update({ stock_quantity: 99 }).eq("id", first)).error).not.toBeNull();
    const result = await admin.client.rpc("admin_adjust_inventory", args);
    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
    expect(await stockOf(first)).toBe(3);
    expect(await stockOf(second)).toBe(1);
    const logs = await admin.client.from("inventory_logs").select("*").in("product_id", [first, second]).eq("reason", "count");
    expect(logs.error).toBeNull();
    expect(logs.data).toHaveLength(2);
    expect(logs.data?.find((row) => row.product_id === first)).toMatchObject({ admin_user_id: admin.id, previous_quantity: 5, new_quantity: 3, quantity_change: -2 });
    expect((await admin.client.rpc("admin_adjust_inventory", args)).error?.message).toContain("stock_conflict");
    const negative = await admin.client.rpc("admin_adjust_inventory", { ...args, p_expected: [3, 1], p_quantity: 2 });
    expect(negative.error?.message).toContain("invalid_resulting_stock");
    expect(await stockOf(first)).toBe(3);
    expect(await stockOf(second)).toBe(1);
    expect((await customer.client.rpc("admin_inventory_list", {})).error).not.toBeNull();
    const product = await adminClient().from("products").select("name").eq("id", first).single();
    if (product.error) throw new Error(product.error.message);
    const list = await admin.client.rpc("admin_inventory_list", { p_query: product.data.name, p_status: "all" });
    expect(list.error).toBeNull();
    expect(list.data?.find((row: { id: string }) => row.id === first)).toMatchObject({ stock_quantity: 3 });
    const inStock = await admin.client.rpc("admin_inventory_list", { p_query: product.data.name, p_status: "in" });
    expect(inStock.error).toBeNull();
    expect(inStock.data?.some((row: { id: string }) => row.id === first)).toBe(true);
    expect((await customer.client.from("inventory_logs").select("id").eq("product_id", first)).data).toEqual([]);
  });

  it("serializes concurrent adjustments and preserves checkout and single cancellation restoration", async () => {
    const product = await createProduct(category, { stock: 5 });
    const args = { p_ids: [product], p_expected: [5], p_operation: "increase", p_quantity: 1, p_reason: "restock" };
    const changes = await Promise.all([admin.client.rpc("admin_adjust_inventory", args), admin.client.rpc("admin_adjust_inventory", args)]);
    expect(changes.filter((result) => result.data === true)).toHaveLength(1);
    expect(await stockOf(product)).toBe(6);
    expect((await customer.client.rpc("add_to_cart", { p_product_id: product, p_quantity: 2 })).error).toBeNull();
    const order = await placeOrder(customer);
    expect(order.error).toBeNull();
    expect(await stockOf(product)).toBe(4);
    const cancelled = await admin.client.rpc("admin_transition_order", { p_order_id: order.data, p_expected: "pending", p_status: "cancelled" });
    expect(cancelled.error).toBeNull();
    expect(await stockOf(product)).toBe(6);
    expect((await admin.client.rpc("admin_transition_order", { p_order_id: order.data, p_expected: "pending", p_status: "cancelled" })).error).not.toBeNull();
    expect(await stockOf(product)).toBe(6);
    const logs = await admin.client.from("inventory_logs").select("quantity_change,reason").eq("product_id", product);
    expect(logs.error).toBeNull();
    expect(logs.data?.filter((row) => row.quantity_change === -2)).toHaveLength(1);
    expect(logs.data?.filter((row) => row.quantity_change === 2)).toHaveLength(1);
    expect(logs.data?.every((row) => row.reason)).toBe(true);
  });

  it("does not overwrite checkout when an administrator races a buyer", async () => {
    const buyer = await createTestUser("inventory-race");
    const product = await createProduct(category, { stock: 5 });
    expect((await buyer.client.rpc("add_to_cart", { p_product_id: product, p_quantity: 2 })).error).toBeNull();
    const [order, change] = await Promise.all([
      placeOrder(buyer),
      admin.client.rpc("admin_adjust_inventory", { p_ids: [product], p_expected: [5], p_operation: "increase", p_quantity: 1, p_reason: "race" }),
    ]);
    expect(order.error).toBeNull();
    if (change.error) {
      expect(change.error.message).toContain("stock_conflict");
      expect(await stockOf(product)).toBe(3);
    } else {
      expect(change.data).toBe(true);
      expect(await stockOf(product)).toBe(4);
    }
  });
});
