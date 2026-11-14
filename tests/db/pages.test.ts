import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestData, createTestUser, dbTestsEnabled, type TestUser } from "../helpers/db";

describe.skipIf(!dbTestsEnabled)("page CMS access (real database)", () => {
  let admin: TestUser;
  let user: TestUser;
  const id = randomUUID();
  const document = { slug: `db-test-${id}`, title: "Test", excerpt: "", content: { type: "doc", content: [{ type: "paragraph" }] },
    featured_image_path: "", meta_title: "", meta_description: "", canonical_url: "", og_image_path: "", published_at: "" };
  beforeAll(async () => {
    [admin, user] = await Promise.all([createTestUser("pages-admin"), createTestUser("pages-user")]);
    const result = await adminClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    if (result.error) throw new Error(result.error.message);
  });
  afterAll(async () => {
    await adminClient().from("page_drafts").delete().eq("id", id);
    await adminClient().from("pages").delete().eq("id", id);
    await cleanupTestData();
  });
  it("keeps drafts private and blocks direct publishing by clients", async () => {
    expect((await admin.client.from("page_drafts").insert({ id, document, revision: 1 })).error).toBeNull();
    expect((await anonClient().from("page_drafts").select("*").eq("id", id)).error).not.toBeNull();
    expect((await user.client.from("page_drafts").select("*").eq("id", id)).data).toEqual([]);
    expect((await admin.client.from("pages").insert({ id, slug: document.slug, title: document.title })).error).not.toBeNull();
    expect((await admin.client.rpc("admin_publish_page", { p_id: id, p_revision: 1, p_document: document, p_actor: admin.id })).error).not.toBeNull();
    expect((await user.client.rpc("admin_page_operation", { p_id: id, p_operation: "delete" })).error).not.toBeNull();
  });
  it("publishes only matching revisions and enforces public scheduling", async () => {
    const db = adminClient();
    const args = { p_id: id, p_revision: 1, p_document: document, p_actor: admin.id };
    expect((await db.rpc("admin_publish_page", { ...args, p_revision: 2 })).error?.message).toContain("page_draft_conflict");
    expect((await db.rpc("admin_publish_page", { ...args, p_actor: user.id })).error?.message).toContain("admin_required");
    expect((await db.rpc("admin_publish_page", args)).error).toBeNull();
    expect((await anonClient().from("pages").select("id").eq("id", id)).data).toHaveLength(1);
    expect((await admin.client.rpc("admin_page_operation", { p_id: id, p_operation: "unpublish" })).error).toBeNull();
    expect((await anonClient().from("pages").select("id").eq("id", id)).data).toHaveLength(0);
    const scheduled = { ...document, published_at: "2100-01-01T00:00:00.000Z" };
    expect((await admin.client.from("page_drafts").update({ document: scheduled, revision: 2 }).eq("id", id)).error).toBeNull();
    expect((await db.rpc("admin_publish_page", { ...args, p_revision: 2, p_document: scheduled })).error).toBeNull();
    expect((await anonClient().from("pages").select("id").eq("id", id)).data).toHaveLength(0);
  });
});
