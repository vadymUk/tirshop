import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/query-builder";

const state = vi.hoisted(() => ({ db: null as unknown, authorize: vi.fn(), send: vi.fn(), render: vi.fn(), notifyFailure: vi.fn() }));
vi.mock("@/lib/admin/notifications-email", () => ({ notifyOrderEmailFailure: state.notifyFailure }));
vi.mock("@/lib/admin/security", () => ({ authorizeAdminOperation: state.authorize }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (state.db as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/email/resend", () => ({ getFromAddress: () => "store@example.test", getResend: () => ({ emails: { send: state.send } }) }));
vi.mock("@react-email/components", async (importOriginal) => {
  const original = await importOriginal<typeof import("@react-email/components")>();
  return { ...original, render: state.render };
});

import { transitionOrder } from "@/lib/admin/order-actions";
const id = "33333333-3333-4333-8333-333333333333";
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ id, expected: "pending", status: "confirmed", note: "secret", notify: "on" })) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.db = createFakeSupabase();
  (state.db as ReturnType<typeof createFakeSupabase>).setRpc("get_admin_site_settings", { data: [{ order_status_notifications: true }], error: null });
  state.authorize.mockResolvedValue({ id });
  state.render.mockResolvedValue("<p>status</p>");
  state.send.mockResolvedValue({ error: null });
});

describe("order transition actions", () => {
  it("uses the saved recipient and event idempotency key, without private notes", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_transition_order", { data: id, error: null });
    db.queueTable("orders", { data: { customer_email: "buyer@example.test", customer_name: "Buyer", order_number: 123 }, error: null });
    const result = await transitionOrder({}, form());
    expect(result.success).toBeTruthy();
    expect(state.authorize).toHaveBeenCalled();
    expect(state.send).toHaveBeenCalledWith(expect.objectContaining({ to: "buyer@example.test", html: "<p>status</p>" }), { idempotencyKey: `order-status/${id}` });
    expect(state.render.mock.calls[0][0].props).not.toHaveProperty("note");
  });
  it("never emails if the transition fails", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_transition_order", { data: null, error: { message: "order_status_conflict" } });
    expect((await transitionOrder({}, form())).error).toBeTruthy();
    expect(state.send).not.toHaveBeenCalled();
  });
  it("surfaces provider errors after the status was committed", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_transition_order", { data: id, error: null });
    db.queueTable("orders", { data: { customer_email: "buyer@example.test", customer_name: "Buyer", order_number: 123 }, error: null });
    state.send.mockResolvedValue({ error: { message: "unavailable" } });
    expect((await transitionOrder({}, form())).warning).toContain("Resend");
    expect(state.notifyFailure).toHaveBeenCalledWith(id, id);
  });
  it("does not send status notifications when disabled", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_transition_order", { data: id, error: null });
    db.setRpc("get_admin_site_settings", { data: [{ order_status_notifications: false }], error: null });
    expect((await transitionOrder({}, form())).warning).toContain("вимкнено");
    expect(state.send).not.toHaveBeenCalled();
  });
});
