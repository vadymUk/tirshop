import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestData, createCategory, createProduct, createTestUser, dbTestsEnabled, type TestUser } from "../helpers/db";

describe.skipIf(!dbTestsEnabled)("administrator notifications (dedicated database)", () => {
  let first: TestUser;
  let second: TestUser;
  let customer: TestUser;
  let product: string;

  beforeAll(async () => {
    [first, second, customer] = await Promise.all([createTestUser("notifications-a"), createTestUser("notifications-b"), createTestUser("notifications-customer")]);
    const promoted = await adminClient().from("profiles").update({ role: "admin" }).in("id", [first.id, second.id]);
    if (promoted.error) throw new Error(promoted.error.message);
    product = await createProduct(await createCategory(), { stock: 0 });
  });

  afterAll(async () => {
    if (product && first && second) {
      const cleanup = await adminClient().from("admin_notification_events").delete().in("entity_id", [product, first.id, second.id]);
      if (cleanup.error) throw new Error(cleanup.error.message);
    }
    await cleanupTestData();
  });

  it("imports a zero-stock product once under concurrent synchronization", async () => {
    const results = await Promise.all([first.client.rpc("admin_sync_notifications"), second.client.rpc("admin_sync_notifications")]);
    expect(results.map((result) => result.error)).toEqual([null, null]);
    const events = await adminClient().from("admin_notification_events").select("id").eq("kind", "out_of_stock").eq("entity_id", product);
    expect(events.error).toBeNull();
    expect(events.data).toHaveLength(1);
    const notification = events.data![0].id;
    expect((await first.client.rpc("admin_notification_mark", { p_id: notification })).error).toBeNull();
    const reads = await adminClient().from("admin_notification_reads").select("admin_user_id").eq("notification_id", notification);
    expect(reads.error).toBeNull();
    expect(reads.data).toEqual([{ admin_user_id: first.id }]);
  });

  it("reports restocking from zero into the configured low-stock range", async () => {
    const settings = await adminClient().from("site_settings").select("low_stock_threshold").eq("singleton", true).single();
    expect(settings.error).toBeNull();
    const update = await first.client.rpc("admin_set_product_stock", { p_product_id: product, p_new_quantity: 1, p_reason: "count" });
    expect(update.error).toBeNull();
    expect((await first.client.rpc("admin_sync_notifications")).error).toBeNull();
    const events = await adminClient().from("admin_notification_events").select("id").eq("kind", "low_stock").eq("entity_id", product);
    expect(events.error).toBeNull();
    expect(events.data).toHaveLength(settings.data!.low_stock_threshold >= 1 ? 1 : 0);
  });

  it("isolates preferences and rejects direct access, customer access and forged events", async () => {
    const preferences = { new_order: true, low_stock: true, out_of_stock: false, order_cancelled: true, email_failure: true, security: true };
    expect((await first.client.rpc("admin_notification_set_preferences", { p_preferences: preferences })).error).toBeNull();
    const a = await first.client.rpc("admin_notification_feed");
    const b = await second.client.rpc("admin_notification_feed");
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.data.preferences.out_of_stock).toBe(false);
    expect(b.data.preferences.out_of_stock).toBe(true);
    expect((await first.client.from("admin_notification_reads").select("*")).error).not.toBeNull();
    expect((await first.client.from("admin_notification_events").insert({ kind: "security", source_id: first.id })).error).not.toBeNull();
    expect((await first.client.rpc("record_order_email_failure", { p_order: product, p_source: product })).error).not.toBeNull();
    expect((await customer.client.rpc("admin_notification_feed")).error).not.toBeNull();
    expect((await anonClient().rpc("admin_sync_notifications")).error).not.toBeNull();
    expect((await first.client.rpc("admin_notification_set_preferences", { p_preferences: { ...preferences, security: "true" } })).error).not.toBeNull();
  });
});
