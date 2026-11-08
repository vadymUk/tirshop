import { beforeEach, describe, expect, it, vi } from "vitest";
import { SHIPPING_COUNTRIES } from "@/lib/checkout/countries";
import { createFakeSupabase, callsOf, USER_A, USER_B } from "../helpers/query-builder";

const fake = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => (fake.current as ReturnType<typeof createFakeSupabase>).client,
}));

import { getOrder, getUserOrders, placeOrder, PlaceOrderError } from "@/lib/db/queries/orders";

let supabase: ReturnType<typeof createFakeSupabase>;

const details = {
  fullName: "Jan Kowalski",
  email: "jan@example.com",
  phone: "+48 600 100 200",
  country: SHIPPING_COUNTRIES[0],
  city: "Warszawa",
  postalCode: "00-001",
  address: "Marszałkowska 1",
  apartment: "",
  notes: "",
  acceptTerms: true as const,
};

beforeEach(() => {
  supabase = createFakeSupabase();
  fake.current = supabase;
  supabase.signedInAs(USER_A);
});

describe("placeOrder (RPC wrapper)", () => {
  it("calls place_order with customer details only, and returns the new order id", async () => {
    supabase.setRpc("place_order", { data: "order-123", error: null });

    expect(await placeOrder(details)).toBe("order-123");

    const [name, args] = supabase.client.rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(name).toBe("place_order");
    expect(Object.keys(args).sort()).toEqual(
      [
        "p_address",
        "p_apartment",
        "p_city",
        "p_country",
        "p_customer_email",
        "p_customer_name",
        "p_customer_phone",
        "p_notes",
        "p_postal_code",
      ].sort(),
    );
    expect(JSON.stringify(args)).not.toMatch(/price|total|stock|user_id|status/i);
  });

  it("refuses to run for guests", async () => {
    supabase.signedInAs(null);
    await expect(placeOrder(details)).rejects.toMatchObject({ code: "unauthenticated" });
    expect(supabase.client.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["cart_empty", "cart_empty"],
    ["items_unavailable: product X", "items_unavailable"],
    ["mixed_currencies", "mixed_currencies"],
    ["rate_limited", "rate_limited"],
    ["not_authenticated", "unauthenticated"],
  ])("maps database error %j to %s", async (message, code) => {
    supabase.setRpc("place_order", { data: null, error: { message, code: "P0001" } });
    const error = await placeOrder(details).catch((e) => e);
    expect(error).toBeInstanceOf(PlaceOrderError);
    expect(error.code).toBe(code);
  });

  it("maps check violations to invalid_data and everything else to unknown", async () => {
    supabase.setRpc("place_order", { data: null, error: { message: "check", code: "23514" } });
    await expect(placeOrder(details)).rejects.toMatchObject({ code: "invalid_data" });

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    supabase.setRpc("place_order", { data: null, error: { message: "boom", code: "XX000" } });
    await expect(placeOrder(details)).rejects.toMatchObject({ code: "unknown" });
  });
});

describe("order ownership (query layer)", () => {
  it("lists only the signed-in user's orders", async () => {
    const table = supabase.queueTable("orders", { data: [], error: null });
    await getUserOrders();
    expect(callsOf(table, "eq")).toContainEqual(["user_id", USER_A.id]);
  });

  it("filters a single order by id AND owner, so another user's id yields nothing", async () => {
    const table = supabase.queueTable("orders", { data: null, error: null });
    supabase.signedInAs(USER_B);

    expect(await getOrder("order-owned-by-a")).toBeNull();
    expect(callsOf(table, "eq")).toEqual(
      expect.arrayContaining([
        ["id", "order-owned-by-a"],
        ["user_id", USER_B.id],
      ]),
    );
  });

  it("returns nothing for guests without querying", async () => {
    supabase.signedInAs(null);
    expect(await getUserOrders()).toEqual([]);
    expect(await getOrder("any")).toBeNull();
    expect(supabase.client.from).not.toHaveBeenCalled();
  });
});
