import { describe, expect, it } from "vitest";
import { SHIPPING_COUNTRIES } from "@/lib/checkout/countries";
import { cartItemSchema, checkoutSchema } from "@/lib/validations/checkout";

const valid = {
  fullName: "Jan Kowalski",
  email: "jan@example.com",
  phone: "+48 600 100 200",
  country: SHIPPING_COUNTRIES[0],
  city: "Warszawa",
  postalCode: "00-001",
  address: "Marszałkowska 1",
  apartment: "",
  notes: "",
  acceptTerms: true,
};

describe("checkoutSchema", () => {
  it("accepts a complete order", () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["missing name", { fullName: "" }],
    ["bad email", { email: "x" }],
    ["letters in phone", { phone: "call me" }],
    ["too-short phone", { phone: "+1 2" }],
    ["unsupported country", { country: "Atlantis" }],
    ["empty city", { city: "" }],
    ["bad postal code", { postalCode: "!!" }],
    ["short address", { address: "a" }],
    ["too-long notes", { notes: "x".repeat(1001) }],
  ])("rejects %s", (_label, override) => {
    expect(checkoutSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("requires explicit acceptance of terms and privacy policy", () => {
    expect(checkoutSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, acceptTerms: "true" }).success).toBe(false);
    const withoutConsent: Partial<typeof valid> = { ...valid };
    delete withoutConsent.acceptTerms;
    expect(checkoutSchema.safeParse(withoutConsent).success).toBe(false);
  });

  it("strips price, total and stock fields (mass assignment)", () => {
    const parsed = checkoutSchema.parse({
      ...valid,
      price: 0.01,
      total_amount: 0,
      totalAmount: 0,
      payment_status: "paid",
      user_id: "someone-else",
    });
    expect(Object.keys(parsed)).not.toEqual(
      expect.arrayContaining(["price", "total_amount", "totalAmount", "payment_status", "user_id"]),
    );
  });
});

describe("cartItemSchema", () => {
  const id = "33333333-3333-4333-8333-333333333333";

  it("accepts quantities 1..99", () => {
    expect(cartItemSchema.safeParse({ productId: id, quantity: 1 }).success).toBe(true);
    expect(cartItemSchema.safeParse({ productId: id, quantity: 99 }).success).toBe(true);
  });

  it.each([0, -1, 100, 1.5, Number.NaN, Infinity])("rejects quantity %s", (quantity) => {
    expect(cartItemSchema.safeParse({ productId: id, quantity }).success).toBe(false);
  });

  it("rejects non-uuid product ids", () => {
    expect(cartItemSchema.safeParse({ productId: "1 OR 1=1", quantity: 1 }).success).toBe(false);
  });
});
