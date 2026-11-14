import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestData, createTestUser, dbTestsEnabled, type TestUser } from "../helpers/db";

describe.skipIf(!dbTestsEnabled)("store settings access (dedicated database)", () => {
  let admin: TestUser;
  let customer: TestUser;

  beforeAll(async () => {
    [admin, customer] = await Promise.all([createTestUser("settings-admin"), createTestUser("settings-customer")]);
    const result = await adminClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    if (result.error) throw new Error(result.error.message);
  });
  afterAll(cleanupTestData);

  it("exposes business details but not notification settings publicly", async () => {
    const publicFields = await anonClient().from("site_settings").select("id,company_name,nip,regon,vat_details,return_address").limit(1);
    expect(publicFields.error).toBeNull();
    expect((await anonClient().from("site_settings").select("seller_notification_email")).error).not.toBeNull();
    expect((await customer.client.rpc("get_admin_site_settings")).error).not.toBeNull();
    expect((await admin.client.rpc("get_admin_site_settings")).error).toBeNull();
  });

  it("rejects a customer update of settings", async () => {
    const row = await anonClient().from("site_settings").select("id").limit(1).single();
    if (row.error || !row.data) throw new Error(row.error?.message ?? "missing settings");
    const result = await customer.client.from("site_settings").update({ store_name: "unauthorized" }).eq("id", row.data.id).select("id");
    expect(result.error || result.data?.length === 0).toBeTruthy();
  });
});
