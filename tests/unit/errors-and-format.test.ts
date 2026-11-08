import { describe, expect, it } from "vitest";
import { CartError, cartErrorMessage, toCartError } from "@/lib/cart/errors";
import { formatOrderNumber } from "@/lib/checkout/format";
import { formatPrice } from "@/lib/utils";

describe("toCartError", () => {
  it.each([
    [{ message: "insufficient_stock" }, "insufficient_stock"],
    [{ message: "product_unavailable" }, "product_unavailable"],
    [{ message: "not_authenticated" }, "unauthenticated"],
    [{ message: "permission denied", code: "42501" }, "unauthenticated"],
    [{ message: "check", code: "23514" }, "invalid_quantity"],
    [{ message: "fk", code: "23503" }, "product_unavailable"],
    [{ message: "boom" }, "unknown"],
  ])("maps %j to %s", (error, code) => {
    const mapped = toCartError(error);
    expect(mapped).toBeInstanceOf(CartError);
    expect(mapped.code).toBe(code);
  });

  it("never leaks raw database messages to users", () => {
    expect(cartErrorMessage("unknown")).not.toMatch(/sql|postgres|constraint/i);
  });
});

describe("formatting", () => {
  it("pads order numbers", () => {
    expect(formatOrderNumber(42)).toBe("TS-000042");
  });

  it("formats money in the given currency", () => {
    expect(formatPrice(12.5, "EUR", "en-IE")).toContain("12.50");
    expect(formatPrice(12.5, "PLN", "pl-PL")).toMatch(/12,50/);
  });
});
