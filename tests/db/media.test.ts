import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestData, createCategory, createProduct, createTestUser, dbTestsEnabled, type TestUser } from "../helpers/db";

describe.skipIf(!dbTestsEnabled)("media authorization and references (real database)", () => {
  let admin: TestUser;
  let user: TestUser;
  let product: string;
  let category: string;
  const paths: string[] = [];
  const attemptedPaths: string[] = [];
  const managedFile = async () => {
    const path = `library/${randomUUID()}/image.webp`;
    paths.push(path);
    const uploaded = await adminClient().storage.from("site-media").upload(path, new Uint8Array([1, 2, 3]), { contentType: "image/webp" });
    if (uploaded.error) throw new Error(uploaded.error.message);
    const metadata = await adminClient().from("media_metadata").insert({ bucket: "site-media", path, original_name: "test.webp", width: 1, height: 1 });
    if (metadata.error) throw new Error(metadata.error.message);
    return path;
  };
  beforeAll(async () => {
    [admin, user] = await Promise.all([createTestUser("media-admin"), createTestUser("media-user")]);
    const promotion = await adminClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    if (promotion.error) throw new Error(promotion.error.message);
    category = await createCategory();
    product = await createProduct(category);
  });
  afterAll(async () => {
    if (paths.length || attemptedPaths.length) {
      await adminClient().storage.from("site-media").remove([...paths, ...attemptedPaths]);
    }
    if (paths.length) {
      await adminClient().from("media_delete_claims").delete().in("path", paths);
      await adminClient().from("media_metadata").delete().in("path", paths);
    }
    await cleanupTestData();
  });

  it("denies customer and anonymous access to management operations and Storage writes", async () => {
    const args = { p_bucket: "site-media" };
    expect((await user.client.rpc("admin_media_list", args)).error).not.toBeNull();
    expect((await anonClient().rpc("admin_media_list", args)).error).not.toBeNull();
    const userPath = `test-${randomUUID()}.webp`;
    const adminPath = `test-${randomUUID()}.webp`;
    attemptedPaths.push(userPath, adminPath);
    expect((await user.client.storage.from("site-media").upload(userPath, new Uint8Array([1]), { contentType: "image/webp" })).error).not.toBeNull();
    expect((await admin.client.storage.from("site-media").upload(adminPath, new Uint8Array([1]), { contentType: "image/webp" })).error).not.toBeNull();
  });

  it("detects references including encoded URLs and blocks deletion", async () => {
    const path = await managedFile();
    const url = `https://example.test/storage/v1/object/public/site-media/${path.replace(/\//g, "%2F")}`;
    expect((await adminClient().from("categories").update({ image_url: url }).eq("id", category)).error).toBeNull();
    const list = await admin.client.rpc("admin_media_list", { p_bucket: "site-media", p_query: "test.webp" });
    expect(list.error).toBeNull();
    expect(list.data.find((item: { path: string }) => item.path === path)?.referenced).toBe(true);
    const claim = await admin.client.rpc("admin_claim_media_deletion", { p_bucket: "site-media", p_path: path });
    expect(claim.error?.message).toContain("media_is_referenced");
    expect((await adminClient().from("categories").update({ image_url: null }).eq("id", category)).error).toBeNull();
  });

  it("prevents new references after deletion is claimed, including URL-encoded paths", async () => {
    const path = await managedFile();
    const args = { p_bucket: "site-media", p_path: path };
    expect((await user.client.rpc("admin_claim_media_deletion", args)).error).not.toBeNull();
    expect((await admin.client.rpc("admin_claim_media_deletion", args)).error).toBeNull();
    const updated = await adminClient().from("products").update({ og_image_path: path.replace(/\//g, "%2f") }).eq("id", product);
    expect(updated.error?.message).toContain("media_deleted_or_pending_deletion");
  });

  it("serializes concurrent deletion claims and new references", async () => {
    for (let i = 0; i < 3; i++) {
      const path = await managedFile();
      const [claim, reference] = await Promise.all([
        admin.client.rpc("admin_claim_media_deletion", { p_bucket: "site-media", p_path: path }),
        adminClient().from("products").update({ og_image_path: path }).eq("id", product),
      ]);
      expect(Boolean(claim.error) || Boolean(reference.error)).toBe(true);
      expect((await adminClient().from("products").update({ og_image_path: null }).eq("id", product)).error).toBeNull();
    }
  });

  it("refuses deletion of unregistered legacy objects", async () => {
    const claim = await admin.client.rpc("admin_claim_media_deletion", { p_bucket: "site-media", p_path: "legacy/example.webp" });
    expect(claim.error?.message).toContain("legacy_media_requires_manual_review");
  });
});
