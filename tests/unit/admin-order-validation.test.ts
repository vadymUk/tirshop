import { describe, expect, it } from "vitest";
import { orderDetailsSchema, orderTransitionSchema, transitions } from "@/lib/admin/order-validation";
import type { OrderStatus } from "@/types/database";

const id = "33333333-3333-4333-8333-333333333333";
describe("order management validation", () => {
  it("only allows the defined status transitions", () => {
    for (const [from, destinations] of Object.entries(transitions)) {
      for (const to of Object.keys(transitions)) {
        expect(orderTransitionSchema.safeParse({ id, expected: from, status: to, note: "", notify: false }).success).toBe(destinations.includes(to as OrderStatus));
      }
    }
  });
  it("rejects oversized private notes", () => {
    expect(orderDetailsSchema.safeParse({ id, internal_note: "x".repeat(5001), shipping_provider: "", tracking_number: "" }).success).toBe(false);
  });
});
