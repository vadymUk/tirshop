import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

const validRegistration = {
  fullName: "Jan Kowalski",
  email: "jan@example.com",
  password: "Secret123",
  confirmPassword: "Secret123",
};

describe("registerSchema", () => {
  it("accepts a valid registration and trims the email", () => {
    const result = registerSchema.parse({ ...validRegistration, email: "  jan@example.com " });
    expect(result.email).toBe("jan@example.com");
  });

  it.each([
    ["short password", { password: "Ab1", confirmPassword: "Ab1" }],
    ["password without digit", { password: "OnlyLetters", confirmPassword: "OnlyLetters" }],
    ["password without letter", { password: "12345678", confirmPassword: "12345678" }],
    ["password over 72 chars", { password: "a1".repeat(40), confirmPassword: "a1".repeat(40) }],
    ["mismatched confirmation", { confirmPassword: "Different1" }],
    ["invalid email", { email: "not-an-email" }],
    ["one-letter name", { fullName: "J" }],
  ])("rejects %s", (_label, override) => {
    expect(registerSchema.safeParse({ ...validRegistration, ...override }).success).toBe(false);
  });

  it("reports the mismatch on the confirmPassword field", () => {
    const result = registerSchema.safeParse({ ...validRegistration, confirmPassword: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
    }
  });
});

describe("loginSchema", () => {
  it("only requires a password to be present (no strength rules)", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("rejects malformed emails and non-string input", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: { $ne: 1 }, password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse(null).success).toBe(false);
  });
});

describe("password reset schemas", () => {
  it("forgot password needs a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });

  it("reset password enforces strength and matching confirmation", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "Secret123", confirmPassword: "Secret123" }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ password: "Secret123", confirmPassword: "Other123" }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ password: "short1", confirmPassword: "short1" }).success,
    ).toBe(false);
  });
});
