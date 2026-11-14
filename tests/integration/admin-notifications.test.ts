import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/query-builder";

const state = vi.hoisted(() => ({ db: null as unknown, requireAdmin: vi.fn(), service: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin: state.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (state.db as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: state.service }) }));

import { loadNotifications, markNotificationsRead, saveNotificationPreferences } from "@/lib/admin/notification-actions";
import { notifyOrderEmailFailure } from "@/lib/admin/notifications-email";

const id = "33333333-3333-4333-8333-333333333333";
const preferences = { new_order: true, low_stock: true, out_of_stock: true, order_cancelled: true, email_failure: true, security: true };
const feed = { unread: 1, items: [{ id, kind: "new_order", entity_id: id, created_at: "2026-01-01T12:00:00+00:00", is_read: false }], preferences };

beforeEach(() => {
  vi.clearAllMocks();
  state.db = createFakeSupabase();
  state.requireAdmin.mockResolvedValue({ id });
  state.service.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("administrator notifications", () => {
  it("verifies the administrator and loads a validated paginated feed after synchronization", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_sync_notifications", { error: null });
    db.setRpc("admin_notification_feed", { data: feed, error: null });
    expect(await loadNotifications(10)).toEqual(feed);
    expect(state.requireAdmin).toHaveBeenCalledOnce();
    expect(db.client.rpc).toHaveBeenCalledWith("admin_notification_feed", { p_offset: 10, p_limit: 11 });
  });

  it("rejects malformed input and surfaces sync or authorization failures", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    await expect(loadNotifications(-1)).rejects.toThrow();
    expect(db.client.rpc).not.toHaveBeenCalled();
    db.setRpc("admin_sync_notifications", { error: { message: "unavailable" } });
    await expect(loadNotifications(0)).rejects.toThrow();
    state.requireAdmin.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(markNotificationsRead(id)).rejects.toThrow("unauthorized");
    await expect(saveNotificationPreferences({ ...preferences, security: "true" })).rejects.toThrow();
  });

  it("submits read state and per-admin preferences using protected RPCs", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_notification_mark", { error: null });
    db.setRpc("admin_notification_set_preferences", { error: null });
    await markNotificationsRead(null);
    await saveNotificationPreferences({ ...preferences, security: false });
    expect(db.client.rpc).toHaveBeenCalledWith("admin_notification_mark", { p_id: null });
    expect(db.client.rpc).toHaveBeenCalledWith("admin_notification_set_preferences", { p_preferences: { ...preferences, security: false } });
  });

  it("records failures through the trusted client and logs an unavailable notification store", async () => {
    state.service.mockResolvedValueOnce({ error: { message: "unavailable" } });
    await expect(notifyOrderEmailFailure(id)).resolves.toBeUndefined();
    expect(state.service).toHaveBeenCalledWith("record_order_email_failure", { p_order: id, p_source: id });
    expect(console.error).toHaveBeenCalled();
  });
});
