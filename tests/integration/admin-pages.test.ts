import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsOf, createFakeSupabase } from "../helpers/query-builder";
import { emptyPage } from "@/lib/pages/schema";

const state = vi.hoisted(() => ({ db: null as unknown, privileged: null as unknown, authorize: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/security", () => ({ authorizeAdminOperation: state.authorize }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (state.db as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => (state.privileged as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("next/cache", () => ({ revalidatePath: state.revalidatePath }));
import { operatePage, publishPage, savePageDraft } from "@/lib/admin/page-actions";

const id = "11111111-1111-4111-8111-111111111111";
const document = { ...emptyPage, slug: "privacy", title: "Privacy" };
beforeEach(() => {
  vi.clearAllMocks(); state.db = createFakeSupabase(); state.privileged = createFakeSupabase(); state.authorize.mockResolvedValue({ id });
});

describe("page CMS actions", () => {
  it("saves only a draft with an optimistic revision check", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    const query = db.queueTable("page_drafts", { data: { revision: 3 }, error: null });
    expect(await savePageDraft(id, document, 2)).toBe(3);
    expect(callsOf(query, "eq")).toContainEqual(["revision", 2]);
    expect((state.privileged as ReturnType<typeof createFakeSupabase>).client.rpc).not.toHaveBeenCalled();
  });
  it("publishes the exact validated revision and invalidates old and new paths", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.queueTable("page_drafts", { data: { revision: 2, document }, error: null });
    db.queueTable("pages", { data: { slug: "old-page" }, error: null });
    const privileged = state.privileged as ReturnType<typeof createFakeSupabase>;
    privileged.setRpc("admin_publish_page", { data: true, error: null });
    await publishPage(id, 2);
    expect(privileged.client.rpc).toHaveBeenCalledWith("admin_publish_page", { p_id: id, p_revision: 2, p_document: document, p_actor: id });
    expect(state.revalidatePath).toHaveBeenCalledWith("/privacy");
    expect(state.revalidatePath).toHaveBeenCalledWith("/pages/old-page");
  });
  it("does not publish stale, unsafe or unauthorized data", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.queueTable("page_drafts", { data: { revision: 3, document }, error: null });
    db.queueTable("pages", { data: null, error: null });
    await expect(publishPage(id, 2)).rejects.toThrow("змінено");
    db.queueTable("page_drafts", { data: { revision: 2, document: { ...document, canonical_url: "javascript:alert(1)" } }, error: null });
    db.queueTable("pages", { data: null, error: null });
    await expect(publishPage(id, 2)).rejects.toThrow();
    state.authorize.mockRejectedValueOnce(new Error("forbidden"));
    await expect(publishPage(id, 2)).rejects.toThrow("forbidden");
    expect((state.privileged as ReturnType<typeof createFakeSupabase>).client.rpc).not.toHaveBeenCalled();
  });
  it("invalidates the public route when unpublishing", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.queueTable("pages", { data: { slug: "privacy" }, error: null });
    db.setRpc("admin_page_operation", { data: true, error: null });
    await operatePage(id, "unpublish");
    expect(state.revalidatePath).toHaveBeenCalledWith("/privacy");
  });
});
