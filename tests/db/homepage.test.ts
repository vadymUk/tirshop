import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestData, createTestUser, dbTestsEnabled, type TestUser } from "../helpers/db";

describe.skipIf(!dbTestsEnabled)("homepage CMS access (real database)", () => {
  let admin: TestUser;
  let user: TestUser;
  const bannerId = randomUUID();
  beforeAll(async () => {
    [admin, user] = await Promise.all([createTestUser("homepage-admin"), createTestUser("homepage-user")]);
    const result = await adminClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    if (result.error) throw new Error(result.error.message);
  });
  afterAll(async () => {
    await adminClient().from("banners").delete().eq("id", bannerId);
    await cleanupTestData();
  });
  it("keeps the draft private and blocks direct publishing by clients", async () => {
    expect((await anonClient().from("homepage_draft").select("*")).error).not.toBeNull();
    expect((await user.client.from("homepage_draft").select("*")).data).toEqual([]);
    const args = { p_revision: 1, p_document: {}, p_actor: admin.id };
    expect((await anonClient().rpc("publish_homepage", args)).error).not.toBeNull();
    expect((await user.client.rpc("publish_homepage", args)).error).not.toBeNull();
    expect((await admin.client.rpc("publish_homepage", args)).error).not.toBeNull();
    const result = await admin.client.from("banners").insert({ id: bannerId, title: "test", image_path: "test.webp" });
    expect(result.error).not.toBeNull();
  });
  it("rejects invalid actors and revisions in the trusted publishing RPC", async () => {
    const result = await adminClient().rpc("publish_homepage", { p_revision: 2147483647, p_document: {}, p_actor: user.id });
    expect(result.error?.message).toContain("admin_required");
    const stale = await adminClient().rpc("publish_homepage", { p_revision: 2147483647, p_document: {}, p_actor: admin.id });
    expect(stale.error?.message).toContain("homepage_draft_conflict");
  });
});
