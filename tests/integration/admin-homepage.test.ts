import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsOf, createFakeSupabase } from "../helpers/query-builder";
import { emptySettings } from "@/lib/homepage/schema";

const state = vi.hoisted(() => ({ db: null as unknown, privileged: null as unknown, authorize: vi.fn(), updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/security", () => ({ authorizeAdminOperation: state.authorize }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (state.db as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => (state.privileged as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("next/cache", () => ({ updateTag: state.updateTag, revalidatePath: state.revalidatePath }));
import { publishHomepage, saveHomepageDraft } from "@/lib/admin/homepage-actions";

const id = "11111111-1111-4111-8111-111111111111";
const document = { sections: [{ id, section_key: "hero", section_type: "hero", title: "Test", subtitle: "", content: "",
  settings: { ...emptySettings }, sort_order: 0, is_visible: true }], banners: [] };
beforeEach(() => {
  vi.clearAllMocks(); state.db = createFakeSupabase(); state.privileged = createFakeSupabase(); state.authorize.mockResolvedValue({ id });
});

describe("homepage draft actions", () => {
  it("saves a draft with an optimistic revision check without publishing", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    const builder = db.queueTable("homepage_draft", { data: { revision: 3 }, error: null });
    expect(await saveHomepageDraft(document, 2)).toBe(3);
    expect(callsOf(builder, "eq")).toContainEqual(["revision", 2]);
    expect((state.privileged as ReturnType<typeof createFakeSupabase>).client.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid documents and stale draft revisions", async () => {
    await expect(saveHomepageDraft({ ...document, sections: [] }, 1)).rejects.toThrow("Перевірте дані");
    (state.db as ReturnType<typeof createFakeSupabase>).queueTable("homepage_draft", { data: null, error: null });
    await expect(saveHomepageDraft(document, 2)).rejects.toThrow("інший адміністратор");
  });
  it("publishes only the validated exact revision and invalidates the homepage", async () => {
    (state.db as ReturnType<typeof createFakeSupabase>).queueTable("homepage_draft", { data: { revision: 2, document }, error: null });
    const privileged = state.privileged as ReturnType<typeof createFakeSupabase>;
    privileged.setRpc("publish_homepage", { data: true, error: null });
    await publishHomepage(2);
    expect(privileged.client.rpc).toHaveBeenCalledWith("publish_homepage", { p_revision: 2, p_document: document, p_actor: id });
    expect(state.updateTag).toHaveBeenCalledWith("homepage");
    expect(state.revalidatePath).toHaveBeenCalledWith("/");
  });
  it("does not publish unvalidated or stale data", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.queueTable("homepage_draft", { data: { revision: 4, document }, error: null });
    await expect(publishHomepage(2)).rejects.toThrow("змінено");
    db.queueTable("homepage_draft", { data: { revision: 2, document: { ...document, sections: [] } }, error: null });
    await expect(publishHomepage(2)).rejects.toThrow();
    expect((state.privileged as ReturnType<typeof createFakeSupabase>).client.rpc).not.toHaveBeenCalled();
  });
  it("rejects unauthorized users before privileged access", async () => {
    state.authorize.mockRejectedValueOnce(new Error("forbidden"));
    await expect(publishHomepage(2)).rejects.toThrow("forbidden");
    expect((state.privileged as ReturnType<typeof createFakeSupabase>).client.rpc).not.toHaveBeenCalled();
  });
});
