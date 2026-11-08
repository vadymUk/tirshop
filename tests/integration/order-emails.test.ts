import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryBuilder } from "../helpers/query-builder";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  orderResult: { current: null as unknown },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => createQueryBuilder(mocks.orderResult.current),
  }),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

import { sendOrderEmails } from "@/lib/email/send-order-emails";

const ORDER_ID = "55555555-5555-4555-8555-555555555555";

const order = {
  id: ORDER_ID,
  order_number: 1042,
  user_id: "user-1",
  status: "pending",
  payment_status: "pending",
  currency: "EUR",
  total_amount: 45.5,
  customer_name: "Jan Kowalski",
  customer_email: "jan@example.com",
  customer_phone: "+48 600 100 200",
  country: "Poland",
  city: "Warszawa",
  postal_code: "00-001",
  address: "Marszałkowska 1",
  apartment: null,
  notes: "Leave at the gate <b>please</b>",
  created_at: "2026-10-24T12:00:00Z",
  order_items: [
    {
      id: "i1",
      product_name: "Dual-channel dash cam",
      product_description: "2K recording",
      quantity: 2,
      unit_price: 20,
      subtotal: 40,
    },
    {
      id: "i2",
      product_name: "Cable tie set",
      product_description: null,
      quantity: 1,
      unit_price: 5.5,
      subtotal: 5.5,
    },
  ],
};

beforeEach(() => {
  mocks.send.mockReset();
  mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });
  mocks.orderResult.current = { data: order, error: null };
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const sentTo = (recipient: string) =>
  mocks.send.mock.calls.find(([message]) => message.to === recipient);

describe("order emails", () => {
  it("sends the seller notification and the customer confirmation", async () => {
    const result = await sendOrderEmails(ORDER_ID);

    expect(result).toEqual({ seller: true, customer: true });
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it("seller email: goes to the seller, replies to the customer, lists order data", async () => {
    await sendOrderEmails(ORDER_ID);
    const [message] = sentTo("seller@example.test")!;

    expect(message.from).toBe("Truck Shop <orders@example.test>");
    expect(message.replyTo).toBe("jan@example.com");
    expect(message.subject).toContain("TS-001042");
    expect(message.html).toContain("Jan Kowalski");
    expect(message.html).toContain("Dual-channel dash cam");
    expect(message.html).toContain("Warszawa");
  });

  it("customer confirmation: goes to the customer's order email and replies to the seller", async () => {
    await sendOrderEmails(ORDER_ID);
    const [message] = sentTo("jan@example.com")!;

    expect(message.replyTo).toBe("seller@example.test");
    expect(message.subject).toContain("TS-001042");
    expect(message.html).toContain("Dual-channel dash cam");
    expect(message.html).toContain("Cable tie set");
    expect(message.html).toMatch(/45[.,]50/);
  });

  it("escapes user-provided text in the HTML (no injected markup)", async () => {
    await sendOrderEmails(ORDER_ID);
    const [message] = sentTo("seller@example.test")!;
    expect(message.html).not.toContain("<b>please</b>");
    expect(message.html).toContain("&lt;b&gt;please&lt;/b&gt;");
  });

  it("uses idempotency keys so a retry never double-sends", async () => {
    await sendOrderEmails(ORDER_ID);
    const keys = mocks.send.mock.calls.map(([, options]) => options.idempotencyKey).sort();
    expect(keys).toEqual([`order-customer/${ORDER_ID}`, `order-seller/${ORDER_ID}`]);
  });

  it("a failing customer email does not stop the seller email (and vice versa)", async () => {
    mocks.send.mockImplementation(async (message: { to: string }) =>
      message.to === "jan@example.com"
        ? { data: null, error: { name: "validation_error", message: "bad address" } }
        : { data: { id: "ok" }, error: null },
    );
    expect(await sendOrderEmails(ORDER_ID)).toEqual({ seller: true, customer: false });

    mocks.send.mockImplementation(async (message: { to: string }) => {
      if (message.to === "seller@example.test") throw new Error("network");
      return { data: { id: "ok" }, error: null };
    });
    expect(await sendOrderEmails(ORDER_ID)).toEqual({ seller: false, customer: true });
  });

  it("never throws when the order is missing or cannot be loaded", async () => {
    mocks.orderResult.current = { data: null, error: null };
    expect(await sendOrderEmails(ORDER_ID)).toEqual({ seller: false, customer: false });

    mocks.orderResult.current = { data: null, error: { message: "db down" } };
    expect(await sendOrderEmails(ORDER_ID)).toEqual({ seller: false, customer: false });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not log customer data or API keys when sending fails", async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: "rate limit" } });
    await sendOrderEmails(ORDER_ID);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("jan@example.com");
    expect(logged).not.toContain("re_test_key");
  });
});
