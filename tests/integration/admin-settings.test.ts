import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsOf, createFakeSupabase } from "../helpers/query-builder";

const state = vi.hoisted(() => ({ db: null as unknown, authorize: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/admin/security", () => ({ authorizeAdminOperation: state.authorize }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (state.db as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("next/cache", () => ({ revalidatePath: state.revalidate }));
import { saveStoreSettings } from "@/lib/admin/settings-actions";

const id = "11111111-1111-4111-8111-111111111111";
const revision = "2025-01-01T10:00:00+00:00";
const general = { store_name: "Store", store_description: "", currency: "EUR", default_language: "uk", timezone: "Europe/Warsaw" };

beforeEach(() => {
  vi.clearAllMocks();
  state.db = createFakeSupabase();
  state.authorize.mockResolvedValue({ id });
});

describe("store settings actions", () => {
  it("updates only the selected section and detects concurrent changes", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    const builder = db.queueTable("site_settings", { data: { updated_at: "2025-01-01T10:01:00+00:00" }, error: null });
    expect(await saveStoreSettings("general", id, revision, general)).toBe("2025-01-01T10:01:00+00:00");
    expect(callsOf(builder, "update")).toEqual([[general]]);
    expect(callsOf(builder, "eq")).toContainEqual(["updated_at", revision]);
    expect(state.revalidate).toHaveBeenCalledWith("/", "layout");
    db.queueTable("site_settings", { data: null, error: null });
    await expect(saveStoreSettings("general", id, revision, general)).rejects.toThrow("змінилися");
  });

  it("rejects unauthorized and malformed writes before touching the database", async () => {
    await expect(saveStoreSettings("general", id, revision, { ...general, timezone: "bad-zone" })).rejects.toThrow("Перевірте");
    await expect(saveStoreSettings("behavior", id, revision, { low_stock_threshold: "" })).rejects.toThrow("Перевірте");
    await expect(saveStoreSettings("social", id, revision, { facebook_url: "javascript:alert(1)", instagram_url: "", tiktok_url: "", youtube_url: "" })).rejects.toThrow("Перевірте");
    state.authorize.mockRejectedValueOnce(new Error("forbidden"));
    await expect(saveStoreSettings("general", id, revision, general)).rejects.toThrow("forbidden");
    expect((state.db as ReturnType<typeof createFakeSupabase>).client.from).not.toHaveBeenCalled();
  });

  it("rejects invalid images and enabled announcements without text", async () => {
    const appearance = { logo_path: "", favicon_path: "", announcement_text: "", announcement_enabled: true };
    await expect(saveStoreSettings("appearance", id, revision, appearance)).rejects.toThrow("Перевірте");
    await expect(saveStoreSettings("appearance", id, revision, { ...appearance, announcement_enabled: false, logo_path: "//evil.test/a" })).rejects.toThrow("Перевірте");
  });

  it("does not invalidate the entire storefront for private notification settings", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.queueTable("site_settings", { data: { updated_at: revision }, error: null });
    await saveStoreSettings("notifications", id, revision, { seller_notification_email: "", customer_email_notifications: true, order_status_notifications: true });
    expect(state.revalidate).not.toHaveBeenCalledWith("/", "layout");
    expect(state.revalidate).toHaveBeenCalledWith("/admin/settings");
  });
});
