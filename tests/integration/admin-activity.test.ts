import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/query-builder";

const fake = vi.hoisted(() => ({ current: null as unknown }));
const requireActiveAdmin = vi.hoisted(() => vi.fn());
const getAdminUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin, getAdminUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (fake.current as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => (fake.current as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("@/lib/rate-limit", () => ({ isRateLimited: vi.fn().mockResolvedValue(false) }));

import { auditLog } from "@/lib/admin/security";
import { GET } from "@/app/admin/activity/export/route";

const id = "33333333-3333-4333-8333-333333333333";
beforeEach(() => {
  fake.current = createFakeSupabase();
  requireActiveAdmin.mockResolvedValue({ id });
  getAdminUser.mockResolvedValue({ id });
});

describe("trusted activity audit", () => {
  it("sends a safe event through the trusted service and rejects sensitive fields", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.setRpc("record_trusted_admin_activity", { data: true, error: null });
    await auditLog({ action: "upload", entityType: "media", metadata: { bucket: "site-media" } });
    expect(db.client.rpc).toHaveBeenCalledWith("record_trusted_admin_activity", { p_actor: id, p_action: "upload", p_entity_type: "media", p_entity_id: null, p_metadata: { bucket: "site-media" } });
    await expect(auditLog({ action: "upload", entityType: "media", metadata: { password: "secret" } })).rejects.toThrow();
    expect(db.client.rpc).toHaveBeenCalledTimes(1);
    db.setRpc("record_trusted_admin_activity", { data: null, error: { message: "unavailable" } });
    await expect(auditLog({ action: "delete", entityType: "media" })).rejects.toThrow("unavailable");
  });
  it("restricts export and streams paginated data", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    getAdminUser.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/admin/activity/export"))).status).toBe(403);
    expect((await GET(new Request("http://localhost/admin/activity/export?admin=bad"))).status).toBe(400);
    const items = Array.from({ length: 101 }, (_, i) => ({ id: `${i}`, admin_user_id: id, action: "update", entity_type: "products", entity_id: null, description: `item-${i}`, metadata: {}, created_at: "2024-01-01T00:00:00Z" }));
    db.client.rpc.mockImplementationOnce(async () => ({ data: items, error: null })).mockImplementationOnce(async () => ({ data: items.slice(100), error: null }));
    const response = await GET(new Request("http://localhost/admin/activity/export?action=update"));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const text = await response.text();
    expect(text.match(/"item-100"/g)).toHaveLength(1);
    expect(db.client.rpc).toHaveBeenLastCalledWith("admin_activity_list", { p_admin: null, p_action: "update", p_entity: "", p_from: null, p_to: null, p_query: "", p_offset: 100, p_limit: 101 });
  });
});
