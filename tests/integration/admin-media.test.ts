import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createFakeSupabase } from "../helpers/query-builder";

const state = vi.hoisted(() => ({
  db: null as unknown, adminDb: null as unknown,
  authorize: vi.fn(), audit: vi.fn(), upload: vi.fn(), remove: vi.fn(), download: vi.fn(), updateTag: vi.fn(),
}));
vi.mock("@/lib/admin/security", () => ({ authorizeAdminOperation: state.authorize, logAdminActivity: state.audit }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (state.db as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  ...(state.adminDb as ReturnType<typeof createFakeSupabase>).client,
  storage: { from: () => ({ upload: state.upload, remove: state.remove, download: state.download }) },
}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: state.updateTag }));

import { attachMedia, deleteMedia, uploadMedia } from "@/lib/admin/media-actions";
import { mediaFilters, mediaUrl } from "@/lib/admin/media-shared";

const product = "33333333-3333-4333-8333-333333333333";
const path = "library/11111111-1111-4111-8111-111111111111/example.webp";
function fileForm(file: File) { const form = new FormData(); form.set("file", file); form.set("bucket", "site-media"); return form; }

beforeEach(() => {
  vi.clearAllMocks();
  state.db = createFakeSupabase();
  state.adminDb = createFakeSupabase();
  state.authorize.mockResolvedValue({ id: product });
  state.audit.mockResolvedValue(undefined);
  state.upload.mockResolvedValue({ error: null });
  state.remove.mockResolvedValue({ error: null });
});

describe("media operations", () => {
  it("validates and re-encodes images and stores dimensions", async () => {
    const png = await sharp({ create: { width: 20, height: 10, channels: 3, background: "red" } }).png().toBuffer();
    const metadata = (state.adminDb as ReturnType<typeof createFakeSupabase>).queueTable("media_metadata", { error: null });
    const result = await uploadMedia(fileForm(new File([png], "test.png", { type: "image/png" })));
    expect(result.path).toMatch(/^library\/[a-f0-9-]+\/test-[a-f0-9-]+\.webp$/);
    expect(state.upload).toHaveBeenCalledOnce();
    expect((await sharp(state.upload.mock.calls[0][1]).metadata()).format).toBe("webp");
    expect(metadata.calls).toContainEqual(["insert", [expect.objectContaining({ width: 20, height: 10, original_name: "test.png" })]]);
  });

  it("rejects SVG, spoofed MIME, invalid content and oversized uploads", async () => {
    await expect(uploadMedia(fileForm(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" })))).rejects.toThrow();
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
    await expect(uploadMedia(fileForm(new File([png], "x.jpg", { type: "image/jpeg" })))).rejects.toThrow();
    await expect(uploadMedia(fileForm(new File(["not an image"], "x.png", { type: "image/png" })))).rejects.toThrow();
    await expect(uploadMedia(fileForm(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "x.png", { type: "image/png" })))).rejects.toThrow();
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("checks deletion in the database before calling Storage", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_claim_media_deletion", { data: null, error: { message: "media_is_referenced" } });
    await expect(deleteMedia({ bucket: "site-media", path })).rejects.toThrow("використовується");
    expect(state.remove).not.toHaveBeenCalled();
    db.setRpc("admin_claim_media_deletion", { data: true, error: null });
    await deleteMedia({ bucket: "site-media", path });
    expect(state.remove).toHaveBeenCalledWith([path]);
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "delete" }));
  });

  it("reports Storage deletion failures and keeps the deletion claim", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_claim_media_deletion", { data: true, error: null });
    state.remove.mockResolvedValueOnce({ error: { message: "unavailable" } });
    await expect(deleteMedia({ bucket: "site-media", path })).rejects.toThrow("повторіть операцію");
    expect(db.client.rpc).toHaveBeenCalledTimes(1);
    expect(state.audit).not.toHaveBeenCalled();
  });

  it("stops privileged operations on authorization failure", async () => {
    state.authorize.mockRejectedValueOnce(new Error("forbidden"));
    await expect(deleteMedia({ bucket: "site-media", path })).rejects.toThrow("forbidden");
    expect(state.remove).not.toHaveBeenCalled();
  });

  it("creates a product-folder copy before linking it", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
    state.download.mockResolvedValue({ data: new Blob([png], { type: "image/png" }), error: null });
    const adminDb = state.adminDb as ReturnType<typeof createFakeSupabase>;
    adminDb.queueTable("media_metadata", { error: null });
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_attach_product_image", { data: product, error: null });
    await attachMedia({ product, path, bucket: "site-media" });
    expect(state.upload.mock.calls[0][0]).toMatch(new RegExp(`^${product}/.*\\.webp$`));
    expect(db.client.rpc).toHaveBeenCalledWith("admin_attach_product_image", { p_product: product, p_path: state.upload.mock.calls[0][0] });
  });

  it("leaves a recoverable orphan if the product link fails", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
    state.download.mockResolvedValue({ data: new Blob([png]), error: null });
    (state.adminDb as ReturnType<typeof createFakeSupabase>).queueTable("media_metadata", { error: null });
    (state.db as ReturnType<typeof createFakeSupabase>).setRpc("admin_attach_product_image", { data: null, error: { message: "too_many_images" } });
    await expect(attachMedia({ product, path, bucket: "site-media" })).rejects.toThrow("Копія залишилась");
    expect(state.remove).not.toHaveBeenCalled();
  });

  it("invalidates product data even if the audit fails after attaching an image", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer();
    state.download.mockResolvedValue({ data: new Blob([png]), error: null });
    (state.adminDb as ReturnType<typeof createFakeSupabase>).queueTable("media_metadata", { error: null });
    (state.db as ReturnType<typeof createFakeSupabase>).setRpc("admin_attach_product_image", { data: product, error: null });
    state.audit.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(attachMedia({ product, path, bucket: "site-media" })).rejects.toThrow("audit unavailable");
    expect(state.updateTag).toHaveBeenCalledWith("products");
    expect(state.updateTag).not.toHaveBeenCalledWith("catalog");
  });

  it("normalizes filters and encodes public URLs", () => {
    expect(mediaFilters({ page: "-2", bucket: "private", type: "image/svg+xml", orphan: "1" })).toMatchObject({ page: 1, bucket: "site-media", type: "", orphan: true });
    expect(mediaUrl("site-media", "folder/my file.webp")).toContain("/site-media/folder/my%20file.webp");
  });
});
