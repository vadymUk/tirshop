import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestData, createCategory, createProduct, createTestUser, dbTestsEnabled, type TestUser } from "../helpers/db";

describe.skipIf(!dbTestsEnabled)("administrator audit (dedicated database)", () => {
  let admin: TestUser;
  let customer: TestUser;
  let product: string;
  beforeAll(async () => {
    [admin, customer] = await Promise.all([createTestUser("audit-admin"), createTestUser("audit-customer")]);
    const promoted = await adminClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    if (promoted.error) throw new Error(promoted.error.message);
    product = await createProduct(await createCategory(), { price: 10, stock: 5 });
  });
  afterAll(cleanupTestData);

  it("logs price and stock changes with safe metadata and rejects direct mutation", async () => {
    const update = await admin.client.from("products").update({ price: 12 }).eq("id", product);
    expect(update.error).toBeNull();
    expect((await admin.client.rpc("admin_set_product_stock", { p_product_id: product, p_new_quantity: 3, p_reason: "count" })).error).toBeNull();
    const logs = await admin.client.from("admin_activity_logs").select("*").eq("entity_id", product).eq("admin_user_id", admin.id);
    expect(logs.error).toBeNull();
    expect(logs.data?.some((row) => row.metadata?.price_before === 10 && row.metadata?.price_after === 12)).toBe(true);
    expect(logs.data?.some((row) => row.metadata?.stock_before === 5 && row.metadata?.stock_after === 3)).toBe(true);
    expect((await admin.client.from("admin_activity_logs").delete().eq("entity_id", product)).error).not.toBeNull();
    expect((await customer.client.rpc("admin_activity_list", {})).error).not.toBeNull();
    expect((await anonClient().rpc("admin_activity_list", {})).error).not.toBeNull();
    const filtered = await admin.client.rpc("admin_activity_list", { p_admin: admin.id, p_entity: "products", p_query: product });
    expect(filtered.error).toBeNull();
    expect(filtered.data?.length).toBeGreaterThan(0);
  });

  it("allows only trusted, sanitized activity and records admin sign-in without credentials", async () => {
    expect((await admin.client.rpc("record_admin_login", { p_actor: admin.id })).error).not.toBeNull();
    expect((await adminClient().rpc("record_admin_login", { p_actor: customer.id })).data).toBe(false);
    expect((await adminClient().rpc("record_admin_login", { p_actor: admin.id })).data).toBe(true);
    const args = { p_actor: admin.id, p_action: "upload", p_entity_type: "media", p_entity_id: null, p_metadata: { password: "secret" } };
    expect((await adminClient().rpc("record_trusted_admin_activity", args)).error).not.toBeNull();
    expect((await admin.client.rpc("record_trusted_admin_activity", { ...args, p_metadata: {} })).error).not.toBeNull();
    const logs = await admin.client.from("admin_activity_logs").select("metadata").eq("action", "login").eq("admin_user_id", admin.id);
    expect(logs.data?.[0]?.metadata).toEqual({});
  });
});
