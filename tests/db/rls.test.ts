import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  cleanupTestData,
  createCategory,
  createProduct,
  createTestUser,
  dbTestsEnabled,
  placeOrder,
  type TestUser,
} from "../helpers/db";

describe.skipIf(!dbTestsEnabled)("RLS and authorization (real database)", () => {
  let alice: TestUser;
  let mallory: TestUser;
  let categoryId: string;
  let productId: string;
  let orderId: string;

  beforeAll(async () => {
    [alice, mallory] = await Promise.all([createTestUser("alice"), createTestUser("mallory")]);
    categoryId = await createCategory();
    productId = await createProduct(categoryId, { price: 12.5, stock: 20 });

    await alice.client.from("favorites").insert({ user_id: alice.id, product_id: productId });
    await alice.client.rpc("add_to_cart", { p_product_id: productId, p_quantity: 2 });

    const order = await placeOrder(alice);
    expect(order.error).toBeNull();
    orderId = order.data as string;
    // place_order clears the cart; put one line back for the cart tests.
    await alice.client.rpc("add_to_cart", { p_product_id: productId, p_quantity: 1 });
  });

  afterAll(cleanupTestData);

  describe("favorites", () => {
    it("owner can read their favorite", async () => {
      const { data } = await alice.client.from("favorites").select("product_id");
      expect(data).toHaveLength(1);
    });

    it("another user cannot read it", async () => {
      const { data } = await mallory.client.from("favorites").select("product_id");
      expect(data).toEqual([]);
    });

    it("anonymous visitors cannot read favorites", async () => {
      const { data, error } = await anonClient().from("favorites").select("product_id");
      expect(error !== null || data?.length === 0).toBe(true);
    });

    it("cannot insert a favorite for someone else", async () => {
      const { error } = await mallory.client
        .from("favorites")
        .insert({ user_id: alice.id, product_id: productId });
      expect(error).not.toBeNull();
    });

    it("cannot delete someone else's favorite", async () => {
      await mallory.client.from("favorites").delete().eq("user_id", alice.id);
      const { data } = await alice.client.from("favorites").select("product_id");
      expect(data).toHaveLength(1);
    });
  });

  describe("cart", () => {
    it("another user cannot read, update or delete the cart", async () => {
      expect((await mallory.client.from("cart_items").select("id")).data).toEqual([]);

      await mallory.client.from("cart_items").update({ quantity: 9 }).eq("user_id", alice.id);
      await mallory.client.from("cart_items").delete().eq("user_id", alice.id);

      const { data } = await alice.client.from("cart_items").select("quantity");
      expect(data).toEqual([{ quantity: 1 }]);
    });

    it("cannot insert a cart line for someone else", async () => {
      const { error } = await mallory.client
        .from("cart_items")
        .insert({ user_id: alice.id, product_id: productId, quantity: 1 });
      expect(error).not.toBeNull();
    });

    it("rejects quantities above stock via RPC, insert and update", async () => {
      const tight = await createProduct(categoryId, { stock: 2 });

      const viaRpc = await mallory.client.rpc("add_to_cart", { p_product_id: tight, p_quantity: 3 });
      expect(viaRpc.error?.message).toContain("insufficient_stock");

      const viaInsert = await mallory.client
        .from("cart_items")
        .insert({ user_id: mallory.id, product_id: tight, quantity: 3 });
      expect(viaInsert.error).not.toBeNull();

      await mallory.client.rpc("add_to_cart", { p_product_id: tight, p_quantity: 2 });
      const viaUpdate = await mallory.client
        .from("cart_items")
        .update({ quantity: 3 })
        .eq("product_id", tight);
      expect(viaUpdate.error).not.toBeNull();
    });

    it("rejects invalid quantities and inactive products", async () => {
      for (const quantity of [0, -1, 100]) {
        const { error } = await mallory.client.rpc("add_to_cart", { p_product_id: productId, p_quantity: quantity });
        expect(error).not.toBeNull();
      }
      const inactive = await createProduct(categoryId, { active: false });
      const { error } = await mallory.client.rpc("add_to_cart", { p_product_id: inactive, p_quantity: 1 });
      expect(error).not.toBeNull();
    });
  });

  describe("orders and order ownership", () => {
    it("the buyer sees their order and its items", async () => {
      const { data } = await alice.client.from("orders").select("id, order_items(id)").eq("id", orderId);
      expect(data).toHaveLength(1);
      expect(data![0].order_items.length).toBeGreaterThan(0);
    });

    it("another user cannot see the order or its items (IDOR)", async () => {
      expect((await mallory.client.from("orders").select("id").eq("id", orderId)).data).toEqual([]);
      expect((await mallory.client.from("order_items").select("id").eq("order_id", orderId)).data).toEqual([]);
    });

    it("anonymous visitors see no orders", async () => {
      const { data } = await anonClient().from("orders").select("id");
      expect(data ?? []).toEqual([]);
    });

    it("users cannot insert orders directly (price and owner would be client-controlled)", async () => {
      const { error } = await mallory.client.from("orders").insert({
        user_id: mallory.id,
        customer_name: "Mallory",
        customer_email: "m@example.test",
        customer_phone: "+48 600 100 200",
        country: "Poland",
        city: "Warszawa",
        postal_code: "00-001",
        address: "Testowa 1",
        total_amount: 0.01,
      });
      expect(error).not.toBeNull();
    });

    it("users cannot insert order items", async () => {
      const { error } = await alice.client.from("order_items").insert({
        order_id: orderId,
        product_id: productId,
        product_name: "Free stuff",
        unit_price: 0.01,
        quantity: 1,
        subtotal: 0.01,
      });
      expect(error).not.toBeNull();
    });

    it("users cannot change totals, status or payment status of their own order", async () => {
      await alice.client.from("orders").update({ total_amount: 0.01, payment_status: "paid", status: "completed" }).eq("id", orderId);
      const { data } = await adminClient().from("orders").select("total_amount, payment_status, status").eq("id", orderId).single();
      expect(Number(data!.total_amount)).toBe(25);
      expect(data!.payment_status).toBe("pending");
      expect(data!.status).toBe("pending");
    });

    it("users cannot delete orders", async () => {
      await alice.client.from("orders").delete().eq("id", orderId);
      const { data } = await adminClient().from("orders").select("id").eq("id", orderId);
      expect(data).toHaveLength(1);
    });
  });

  describe("payments cannot be forged by clients", () => {
    it("clients cannot write payments or payment events, nor call apply_payment_event", async () => {
      const insert = await alice.client.from("payments").insert({
        order_id: orderId,
        provider: "test-provider",
        amount: 25,
        currency: "EUR",
        status: "paid",
      });
      expect(insert.error).not.toBeNull();

      const events = await alice.client.from("payment_events").select("*");
      expect(events.error !== null || events.data?.length === 0).toBe(true);

      const rpc = await alice.client.rpc("apply_payment_event", {
        p_provider: "test-provider",
        p_event_id: "evt_forged",
        p_provider_payment_id: "pay_forged",
        p_status: "paid",
        p_amount: 25,
        p_currency: "EUR",
        p_payload: {},
      });
      expect(rpc.error).not.toBeNull();
    });
  });

  describe("catalog and storage", () => {
    it("inactive products are invisible to the public", async () => {
      const inactive = await createProduct(categoryId, { active: false });
      const { data } = await anonClient().from("products").select("id").eq("id", inactive);
      expect(data).toEqual([]);
    });

    it("customers cannot create, change or delete products (price manipulation)", async () => {
      const insert = await mallory.client.from("products").insert({
        category_id: categoryId,
        name: "Hacked",
        slug: `hacked-${Date.now()}`,
        price: 0.01,
      });
      expect(insert.error).not.toBeNull();

      await mallory.client.from("products").update({ price: 0.01, stock_quantity: 9999 }).eq("id", productId);
      const { data } = await adminClient().from("products").select("price, stock_quantity").eq("id", productId).single();
      expect(Number(data!.price)).toBe(12.5);

      await mallory.client.from("products").delete().eq("id", productId);
      expect((await adminClient().from("products").select("id").eq("id", productId)).data).toHaveLength(1);
    });

    it("customers cannot upload, overwrite or delete product images", async () => {
      const file = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
      const upload = await mallory.client.storage.from("product-images").upload(`hack/${Date.now()}.png`, file);
      expect(upload.error).not.toBeNull();

      const anon = await anonClient().storage.from("product-images").upload(`hack/${Date.now()}.png`, file);
      expect(anon.error).not.toBeNull();

      const remove = await mallory.client.storage.from("product-images").remove(["does-not-matter.png"]);
      expect(remove.data ?? []).toEqual([]);
    });
  });
});
