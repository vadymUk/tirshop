import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsOf, createFakeSupabase } from "../helpers/query-builder";

const fake = vi.hoisted(() => ({ current: null as unknown }));
const requireActiveAdmin = vi.hoisted(() => vi.fn());
const getUserById = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn(() => ({ auth: { admin: { getUserById } } })));
vi.mock("@/lib/admin/auth", () => ({ requireActiveAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => (fake.current as ReturnType<typeof createFakeSupabase>).client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { getCustomerOrders, getCustomers, formatCustomerTotals } from "@/lib/admin/customers";
import { parseCustomerFilters } from "@/lib/admin/customer-filters";

const profile = { id: "customer", full_name: "Customer", phone: null, created_at: "2020-01-01T00:00:00Z",
  is_active: true, order_count: 2, latest_order: "2020-02-01T00:00:00Z",
  totals: [{ currency: "EUR", amount: 10 }, { currency: "PLN", amount: 20 }] };

beforeEach(() => {
  fake.current = createFakeSupabase();
  requireActiveAdmin.mockResolvedValue({ id: "admin" });
  getUserById.mockResolvedValue({ data: { user: { email: "customer@example.test", created_at: profile.created_at, email_confirmed_at: profile.created_at, banned_until: null } }, error: null });
});

describe("customer management", () => {
  it("authorizes first, sends filters to the database, and fetches Auth data only for the displayed page", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_customers", { data: Array.from({ length: 21 }, (_, i) => ({ ...profile, id: String(i) })), error: null });
    const result = await getCustomers(parseCustomerFilters({ q: " Joe ", min: "2", max: "10", from: "2020-01-01", sort: "asc", page: "2" }));
    expect(db.client.rpc).toHaveBeenCalledWith("admin_customers", expect.objectContaining({ p_query: "Joe", p_min_orders: 2, p_max_orders: 10, p_from: "2020-01-01", p_ascending: true, p_offset: 20 }));
    expect(requireActiveAdmin.mock.invocationCallOrder[0]).toBeLessThan(createAdminClient.mock.invocationCallOrder[0]);
    expect(getUserById).toHaveBeenCalledTimes(20);
    expect(result.hasNext).toBe(true);
    expect(result.customers[0]).toMatchObject({ email: "customer@example.test", status: "Активний" });
    expect(formatCustomerTotals(result.customers[0].totals)).toBe("10.00 EUR · 20.00 PLN");
  });

  it("never creates a privileged client when authorization fails", async () => {
    requireActiveAdmin.mockRejectedValueOnce(new Error("forbidden"));
    await expect(getCustomers(parseCustomerFilters({}))).rejects.toThrow("forbidden");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("surfaces Auth and database errors", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_customers", { data: [profile], error: null });
    getUserById.mockResolvedValueOnce({ data: { user: null }, error: { message: "Auth unavailable" } });
    await expect(getCustomers(parseCustomerFilters({}))).rejects.toThrow("Auth unavailable");
    db.setRpc("admin_customers", { data: null, error: { message: "DB unavailable" } });
    await expect(getCustomers(parseCustomerFilters({}))).rejects.toThrow("DB unavailable");
  });

  it("reports blocked and inactive accounts without returning Auth secrets", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    db.setRpc("admin_customers", { data: [profile, { ...profile, id: "inactive", is_active: false }], error: null });
    getUserById.mockResolvedValue({ data: { user: { email: "customer@example.test", created_at: profile.created_at,
      email_confirmed_at: profile.created_at, banned_until: "2999-01-01T00:00:00Z", password: "secret", access_token: "secret" } }, error: null });
    const result = await getCustomers(parseCustomerFilters({}));
    expect(result.customers.map((customer) => customer.status)).toEqual(["Заблокований", "Неактивний профіль"]);
    expect(result.customers[0]).not.toHaveProperty("password");
    expect(result.customers[0]).not.toHaveProperty("access_token");
  });

  it("paginates order history by user ID", async () => {
    const db = fake.current as ReturnType<typeof createFakeSupabase>;
    const builder = db.queueTable("orders", { data: Array.from({ length: 21 }, (_, i) => ({ id: i })), error: null });
    const result = await getCustomerOrders("customer", 2);
    expect(callsOf(builder, "eq")).toEqual([["user_id", "customer"]]);
    expect(callsOf(builder, "range")).toEqual([[20, 40]]);
    expect(result.orders).toHaveLength(20);
    expect(result.hasNext).toBe(true);
  });

  it("validates dates and bounds pagination", () => {
    expect(parseCustomerFilters({ from: "2024-02-30", page: "-1", min: "-3", max: "0" })).toMatchObject({ from: "", page: 1, min: null, max: 0 });
  });
});
