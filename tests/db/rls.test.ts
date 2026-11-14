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
  let administrator: TestUser;
  let inactiveAdministrator: TestUser;
  let categoryId: string;
  let productId: string;
  let orderId: string;

  beforeAll(async () => {
    [alice, mallory, administrator, inactiveAdministrator] = await Promise.all([
      createTestUser("alice"),
      createTestUser("mallory"),
      createTestUser("administrator"),
      createTestUser("inactive-administrator"),
    ]);
    const promotion = await adminClient()
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", administrator.id);
    if (promotion.error) throw new Error(`Could not prepare admin fixture: ${promotion.error.message}`);

    const deactivation = await adminClient()
      .from("profiles")
      .update({ role: "admin", is_active: false })
      .eq("id", inactiveAdministrator.id);
    if (deactivation.error) {
      throw new Error(`Could not prepare inactive admin fixture: ${deactivation.error.message}`);
    }

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

  describe("administrator role and access", () => {
    it("keeps product costs private while permitting verified administrators to retrieve them", async () => {
      const item = await createProduct(categoryId, { price: 12, stock: 5 });
      expect((await adminClient().from("products").update({ cost_price: 4.75 }).eq("id", item)).error).toBeNull();
      for (const client of [anonClient(), alice.client, inactiveAdministrator.client, administrator.client]) {
        expect((await client.from("products").select("id,cost_price").eq("id", item)).error).not.toBeNull();
        expect((await client.from("products").select("*").eq("id", item)).error).not.toBeNull();
      }
      const publicProduct = await anonClient().from("products").select("id,name,price").eq("id", item).single();
      expect(publicProduct.error).toBeNull();
      expect(publicProduct.data).toMatchObject({ id: item, price: 12 });
      expect((await anonClient().from("categories").select("id,products(cost_price)").eq("id", categoryId)).error).not.toBeNull();
      const args = { p_product_id: item };
      expect((await anonClient().rpc("admin_product_cost", args)).error).not.toBeNull();
      expect((await alice.client.rpc("admin_product_cost", args)).error).not.toBeNull();
      expect((await inactiveAdministrator.client.rpc("admin_product_cost", args)).error).not.toBeNull();
      const result = await administrator.client.rpc("admin_product_cost", args);
      expect(result.error).toBeNull();
      expect(result.data).toEqual([{ product_id: item, cost_price: 4.75 }]);
    });

    it("restricts customer summaries and filters order counts", async () => {
      const args = { p_id: alice.id };
      expect((await alice.client.rpc("admin_customers", args)).error).not.toBeNull();
      expect((await inactiveAdministrator.client.rpc("admin_customers", args)).error).not.toBeNull();
      expect((await anonClient().rpc("admin_customers", args)).error).not.toBeNull();
      const result = await administrator.client.rpc("admin_customers", args);
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ id: alice.id, order_count: 1, totals: [{ currency: "EUR", amount: 25 }] });
      expect((await administrator.client.rpc("admin_customers", { ...args, p_min_orders: 2 })).data).toEqual([]);
      expect((await administrator.client.rpc("admin_customers", { ...args, p_max_orders: 0 })).data).toEqual([]);
      expect((await administrator.client.rpc("admin_customers", { p_min_orders: 3, p_max_orders: 2 })).error).not.toBeNull();
      expect((await administrator.client.rpc("admin_customers", { ...args, p_from: "1900-01-01", p_to: "1900-01-01" })).data).toEqual([]);
      expect((await administrator.client.rpc("admin_customers", { ...args, p_query: "not-a-customer-name" })).data).toEqual([]);
    });

    it("searches profiles and separates all order totals by currency", async () => {
      const buyer = await createTestUser("customer-summary");
      const updateProfile = await adminClient().from("profiles").update({
        full_name: "Customer Summary Test", phone: "+48123456789", created_at: "2020-06-15T12:00:00Z",
      }).eq("id", buyer.id);
      expect(updateProfile.error).toBeNull();
      const item = await createProduct(categoryId, { price: 10, stock: 5 });
      for (const currency of ["EUR", "PLN"]) {
        expect((await buyer.client.rpc("add_to_cart", { p_product_id: item, p_quantity: 1 })).error).toBeNull();
        const order = await placeOrder(buyer);
        expect(order.error).toBeNull();
        expect((await adminClient().from("orders").update({ currency }).eq("id", order.data)).error).toBeNull();
      }
      const args = { p_id: buyer.id, p_query: "123456", p_from: "2020-06-15", p_to: "2020-06-15", p_min_orders: 2, p_max_orders: 2 };
      const result = await administrator.client.rpc("admin_customers", args);
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ order_count: 2, totals: [{ currency: "EUR", amount: 10 }, { currency: "PLN", amount: 10 }] });
      expect((await administrator.client.rpc("admin_customers", { ...args, p_from: "2020-06-16", p_to: "2020-06-16" })).data).toEqual([]);
      const noOrders = await administrator.client.rpc("admin_customers", { p_id: mallory.id, p_max_orders: 0 });
      expect(noOrders.data[0]).toMatchObject({ order_count: 0, latest_order: null, totals: [] });
    });

    it("protects category operations and moves products before deletion", async () => {
      const source = await createCategory();
      const item = await createProduct(source);
      const args = { p_id: source, p_target: categoryId };
      expect((await alice.client.rpc("admin_delete_category", args)).error).not.toBeNull();
      expect((await inactiveAdministrator.client.rpc("admin_delete_category", args)).error).not.toBeNull();
      expect((await anonClient().rpc("admin_delete_category", args)).error).not.toBeNull();
      expect((await administrator.client.from("categories").delete().eq("id", source)).error).not.toBeNull();
      expect((await administrator.client.rpc("admin_delete_category", { p_id: source })).error?.message).toContain("category_has_products");
      const moved = await administrator.client.rpc("admin_move_category", { p_id: source, p_target: categoryId });
      expect(moved.error).toBeNull();
      expect(moved.data).toBe(true);
      const removed = await administrator.client.rpc("admin_delete_category", args);
      expect(removed.error).toBeNull();
      expect(removed.data).toBe(true);
      const product = await adminClient().from("products").select("category_id").eq("id", item).single();
      expect(product.error).toBeNull();
      expect(product.data?.category_id).toBe(categoryId);
    });

    it("protects product saves and blocks deletion of historical products", async () => {
      const payload = {
        category_id: categoryId, name: "Managed product", slug: `managed-${Date.now()}`, sku: "",
        short_description: "", description: "", price: 10, compare_at_price: "",
        currency: "EUR", weight: "", is_active: true, is_featured: false,
        meta_title: "", meta_description: "", og_image_path: "",
      };
      expect((await alice.client.rpc("admin_save_product", { p_id: null, p_product: payload, p_stock: 3 })).error).not.toBeNull();
      const created = await administrator.client.rpc("admin_save_product", { p_id: null, p_product: payload, p_stock: 3 });
      expect(created.error).toBeNull();
      expect(created.data).toBeTruthy();
      const stale = await administrator.client.rpc("admin_save_product", { p_id: created.data, p_product: payload, p_stock: 5, p_expected_stock: 2 });
      expect(stale.error?.message).toContain("stock_conflict");
      const saved = await administrator.client.rpc("admin_save_product", { p_id: created.data, p_product: payload, p_stock: 5, p_expected_stock: 3 });
      expect(saved.error).toBeNull();
      const referenced = await administrator.client.rpc("admin_bulk_products", { p_ids: [productId], p_operation: "delete" });
      expect(referenced.error?.message).toContain("product_has_orders");
      const removed = await administrator.client.rpc("admin_bulk_products", { p_ids: [created.data], p_operation: "delete" });
      expect(removed.error).toBeNull();
      expect(removed.data).toBe(true);
    });

    it("restricts aggregate analytics to active admins and validates the date range", async () => {
      const filter = { p_period: "custom", p_from: "1901-02-03", p_to: "1901-02-03" };
      expect((await alice.client.rpc("admin_dashboard_overview", filter)).error).not.toBeNull();
      expect((await inactiveAdministrator.client.rpc("admin_dashboard_overview", filter)).error).not.toBeNull();
      expect((await anonClient().rpc("admin_dashboard_overview", filter)).error).not.toBeNull();
      expect((await administrator.client.rpc("admin_dashboard_overview", { ...filter, p_to: "1905-02-03" })).error).not.toBeNull();
      const result = await administrator.client.rpc("admin_dashboard_overview", filter);
      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({ from: "1901-02-03", to: "1901-02-03" });
    });

    it("aggregates paid, pending, cancelled and refunded orders separately by currency", async () => {
      const buyer = await createTestUser("analytics");
      const analyticsProduct = await createProduct(categoryId, { price: 10, stock: 50 });
      const filter = { p_period: "custom", p_from: "1901-02-03", p_to: "1901-02-03" };
      const baseline = await administrator.client.rpc("admin_dashboard_overview", filter);
      expect(baseline.error).toBeNull();

      const cases = [
        { status: "processing", payment_status: "paid", currency: "EUR", at: "1901-02-03T00:00:00Z" },
        { status: "completed", payment_status: "pending", currency: "EUR", at: "1901-02-03T12:00:00Z" },
        { status: "cancelled", payment_status: "paid", currency: "EUR", at: "1901-02-03T15:00:00Z" },
        { status: "completed", payment_status: "refunded", currency: "EUR", at: "1901-02-03T18:00:00Z" },
        { status: "completed", payment_status: "paid", currency: "PLN", at: "1901-02-03T23:59:59Z" },
        { status: "completed", payment_status: "paid", currency: "EUR", at: "1901-02-04T00:00:00Z" },
      ];
      for (const item of cases) {
        const cart = await buyer.client.rpc("add_to_cart", { p_product_id: analyticsProduct, p_quantity: 1 });
        expect(cart.error).toBeNull();
        const order = await placeOrder(buyer);
        expect(order.error).toBeNull();
        const update = await adminClient().from("orders").update({
          status: item.status, payment_status: item.payment_status, currency: item.currency, created_at: item.at,
        }).eq("id", order.data);
        expect(update.error).toBeNull();
      }

      const result = await administrator.client.rpc("admin_dashboard_overview", filter);
      expect(result.error).toBeNull();
      expect(result.data.orders - baseline.data.orders).toBe(5);
      expect(result.data.completed_orders - baseline.data.completed_orders).toBe(3);
      expect(result.data.cancelled_orders - baseline.data.cancelled_orders).toBe(1);
      const sum = (data: typeof result.data, currency: string, field: string) =>
        Number(data.money.find((row: { currency: string }) => row.currency === currency)?.[field] ?? 0);
      expect(sum(result.data, "EUR", "order_value") - sum(baseline.data, "EUR", "order_value")).toBe(40);
      expect(sum(result.data, "EUR", "paid_revenue") - sum(baseline.data, "EUR", "paid_revenue")).toBe(10);
      expect(sum(result.data, "EUR", "pending_value") - sum(baseline.data, "EUR", "pending_value")).toBe(10);
      expect(sum(result.data, "EUR", "cancelled_value") - sum(baseline.data, "EUR", "cancelled_value")).toBe(10);
      expect(sum(result.data, "PLN", "paid_revenue") - sum(baseline.data, "PLN", "paid_revenue")).toBe(10);
      expect(result.data.top_products.find((row: { product_id: string; currency: string }) => row.product_id === analyticsProduct && row.currency === "EUR")).toMatchObject({ quantity: 1, revenue: 10 });
      expect(result.data.daily_orders.find((row: { day: string }) => row.day === "1901-02-03").count -
        (baseline.data.daily_orders.find((row: { day: string }) => row.day === "1901-02-03")?.count ?? 0)).toBe(5);
    });

    it("customers cannot promote themselves or change their active status", async () => {
      const roleChange = await alice.client
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", alice.id);
      const activeChange = await alice.client
        .from("profiles")
        .update({ is_active: false })
        .eq("id", alice.id);
      const readPrivilegeFields = await alice.client
        .from("profiles")
        .select("role, is_active")
        .eq("id", alice.id);

      expect(roleChange.error).not.toBeNull();
      expect(activeChange.error).not.toBeNull();
      expect(readPrivilegeFields.error).not.toBeNull();
      const { data } = await adminClient()
        .from("profiles")
        .select("role, is_active")
        .eq("id", alice.id)
        .single();
      expect(data).toMatchObject({ role: "customer", is_active: true });
    });

    it("requires an active database administrator, independent of user metadata", async () => {
      const customer = await alice.client.rpc("is_active_admin");
      const activeAdmin = await administrator.client.rpc("is_active_admin");
      const disabledAdmin = await inactiveAdministrator.client.rpc("is_active_admin");

      expect(customer.data).toBe(false);
      expect(activeAdmin.data).toBe(true);
      expect(disabledAdmin.data).toBe(false);
    });

    it("admins can manage catalog and view customer profiles and orders", async () => {
      const productUpdate = await administrator.client
        .from("products")
        .update({ is_featured: true })
        .eq("id", productId);
      expect(productUpdate.error).toBeNull();

      const productAudit = await administrator.client
        .from("admin_activity_logs")
        .select("id")
        .eq("entity_type", "products")
        .eq("entity_id", productId)
        .eq("action", "update");
      expect(productAudit.data?.length).toBeGreaterThan(0);

      const allProfiles = await administrator.client
        .from("profiles")
        .select("id")
        .eq("id", alice.id);
      expect(allProfiles.data).toHaveLength(1);

      const allOrders = await administrator.client
        .from("orders")
        .select("id")
        .eq("id", orderId);
      expect(allOrders.data).toHaveLength(1);

      await adminClient().from("products").update({ is_featured: false }).eq("id", productId);
    });

    it("admins change stock only through the rate-limited RPC", async () => {
      const directUpdate = await administrator.client
        .from("products")
        .update({ stock_quantity: 21 })
        .eq("id", productId);
      expect(directUpdate.error).not.toBeNull();

      const stockChange = await administrator.client.rpc("admin_set_product_stock", {
        p_product_id: productId,
        p_new_quantity: 21,
        p_reason: "RLS integration test",
      });
      expect(stockChange.error).toBeNull();
      expect(stockChange.data).toBe(true);

      const reset = await administrator.client.rpc("admin_set_product_stock", {
        p_product_id: productId,
        p_new_quantity: 20,
        p_reason: "Restore integration fixture",
      });
      expect(reset.error).toBeNull();
      expect(reset.data).toBe(true);
    });

    it("enforces order transitions, private details and single stock restoration", async () => {
      const buyer = await createTestUser("order-management");
      const item = await createProduct(categoryId, { stock: 5 });
      expect((await buyer.client.rpc("add_to_cart", { p_product_id: item, p_quantity: 2 })).error).toBeNull();
      const order = await placeOrder(buyer);
      expect(order.error).toBeNull();
      const args = { p_order_id: order.data, p_expected: "pending" as const, p_status: "cancelled" as const };
      expect((await buyer.client.rpc("admin_transition_order", args)).error).not.toBeNull();
      expect((await inactiveAdministrator.client.rpc("admin_transition_order", args)).error).not.toBeNull();
      expect((await administrator.client.rpc("admin_update_order_status", { p_order_id: order.data, p_status: "cancelled" })).error).not.toBeNull();
      expect((await administrator.client.rpc("admin_transition_order", { ...args, p_status: "shipped" })).error).not.toBeNull();
      expect((await administrator.client.rpc("admin_save_order_details", { p_order_id: order.data, p_internal_note: "private", p_shipping_provider: "carrier", p_tracking_number: "tracking" })).error).toBeNull();
      const privateData = await buyer.client.from("order_admin_details").select("*").eq("order_id", order.data);
      expect(privateData.error === null ? privateData.data : []).toHaveLength(0);
      expect((await buyer.client.from("orders").update({ payment_status: "paid" }).eq("id", order.data)).error).not.toBeNull();
      const [cancelled, repeated] = await Promise.all([
        administrator.client.rpc("admin_transition_order", args),
        administrator.client.rpc("admin_transition_order", args),
      ]);
      const success = cancelled.error ? repeated : cancelled;
      const conflict = cancelled.error ? cancelled : repeated;
      expect(success.error).toBeNull();
      expect(success.data).toBeTruthy();
      expect(conflict.error).not.toBeNull();
      expect((await administrator.client.rpc("admin_transition_order", args)).error).not.toBeNull();
      const stock = await adminClient().from("products").select("stock_quantity").eq("id", item).single();
      expect(stock.data?.stock_quantity).toBe(5);
      const history = await administrator.client.from("order_status_history").select("new_status,changed_by").eq("id", success.data).single();
      expect(history.data).toMatchObject({ new_status: "cancelled", changed_by: administrator.id });
    });

    it("customers cannot access other profiles or administrative logs", async () => {
      const otherProfile = await mallory.client
        .from("profiles")
        .select("id")
        .eq("id", alice.id);
      const activities = await mallory.client.from("admin_activity_logs").select("id");
      const inventory = await mallory.client.from("inventory_logs").select("id");

      expect(otherProfile.data).toEqual([]);
      expect(activities.error !== null || activities.data?.length === 0).toBe(true);
      expect(inventory.error !== null || inventory.data?.length === 0).toBe(true);
    });

    it("authenticated users cannot append or mutate activity records", async () => {
      const customerWrite = await mallory.client.rpc("record_admin_activity", {
        p_action: "forged",
        p_entity_type: "product",
        p_metadata: {},
      });
      expect(customerWrite.error).not.toBeNull();

      const adminWrite = await administrator.client.rpc("record_admin_activity", {
        p_action: "test",
        p_entity_type: "product",
        p_entity_id: productId,
        p_metadata: { test: true },
      });
      expect(adminWrite.error).not.toBeNull();

      const adminLogs = await administrator.client
        .from("admin_activity_logs")
        .select("action")
        .eq("admin_user_id", administrator.id);
      expect(adminLogs.data?.some((log) => log.action === "test")).toBe(false);
      expect((await administrator.client.from("admin_activity_logs").update({ action: "forged" }).eq("admin_user_id", administrator.id)).error).not.toBeNull();
    });
  });

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
