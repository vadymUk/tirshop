import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/query-builder";

const fake = vi.hoisted(() => ({ current: null as unknown }));
const rateLimited = vi.hoisted(() => ({ value: false }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => (fake.current as ReturnType<typeof createFakeSupabase>).client,
}));
vi.mock("@/lib/rate-limit", () => ({ isRateLimited: async () => rateLimited.value }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/lib/auth/actions";

let supabase: ReturnType<typeof createFakeSupabase>;

beforeEach(() => {
  supabase = createFakeSupabase();
  fake.current = supabase;
  rateLimited.value = false;
});

const registration = {
  fullName: "Jan Kowalski",
  email: "jan@example.com",
  password: "Secret123",
  confirmPassword: "Secret123",
};

describe("signUpAction (register)", () => {
  it("rejects invalid input without calling Supabase", async () => {
    const result = await signUpAction({ ...registration, confirmPassword: "nope" });
    expect(result.success).toBe(false);
    expect(supabase.client.auth.signUp).not.toHaveBeenCalled();
  });

  it("registers, passes the name as metadata and asks the user to verify the email", async () => {
    supabase.client.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await signUpAction(registration);

    expect(result.success).toBe(true);
    const args = supabase.client.auth.signUp.mock.calls[0][0];
    expect(args.email).toBe("jan@example.com");
    expect(args.options.data).toEqual({ full_name: "Jan Kowalski" });
    expect(args.options.emailRedirectTo).toBe("http://localhost:3000/auth/callback?next=/account");
  });

  it("redirects to /account when the project auto-confirms and returns a session", async () => {
    supabase.client.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    await expect(signUpAction(registration)).rejects.toThrow("NEXT_REDIRECT:/account");
  });

  it("does not reveal whether an email is already taken", async () => {
    supabase.client.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { code: "user_already_exists", message: "User already registered" },
    });
    const result = await signUpAction(registration);
    expect(JSON.stringify(result)).not.toMatch(/already registered|exists/i);
  });

  it("reports weak passwords and is rate limited", async () => {
    supabase.client.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { code: "weak_password", message: "weak" },
    });
    expect(await signUpAction(registration)).toMatchObject({ success: false });

    rateLimited.value = true;
    supabase.client.auth.signUp.mockClear();
    const limited = await signUpAction(registration);
    expect(limited).toMatchObject({ success: false });
    expect(supabase.client.auth.signUp).not.toHaveBeenCalled();
  });
});

describe("signInAction (login)", () => {
  const credentials = { email: "jan@example.com", password: "Secret123" };

  it("signs in and redirects to the requested safe path", async () => {
    supabase.client.auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signInAction(credentials, "/checkout")).rejects.toThrow("NEXT_REDIRECT:/checkout");
  });

  it("ignores external redirect targets", async () => {
    supabase.client.auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signInAction(credentials, "https://evil.example")).rejects.toThrow(
      "NEXT_REDIRECT:/account",
    );
    await expect(signInAction(credentials, "//evil.example")).rejects.toThrow("NEXT_REDIRECT:/account");
  });

  it("returns one generic error for wrong credentials (no user enumeration)", async () => {
    supabase.client.auth.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });
    const result = await signInAction(credentials);
    expect(result).toEqual({ success: false, error: "Invalid email or password." });
  });

  it("explains unverified emails", async () => {
    supabase.client.auth.signInWithPassword.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "x" },
    });
    const result = await signInAction(credentials);
    expect(result).toMatchObject({ success: false, error: expect.stringMatching(/verify/i) });
  });

  it("validates input and enforces the rate limit before hitting Supabase", async () => {
    expect(await signInAction({ email: "bad", password: "" })).toMatchObject({ success: false });

    rateLimited.value = true;
    await signInAction(credentials);
    expect(supabase.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("password reset", () => {
  it("answers identically whether or not the email exists", async () => {
    supabase.client.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    const known = await requestPasswordResetAction({ email: "known@example.com" });

    supabase.client.auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: "User not found" },
    });
    const unknown = await requestPasswordResetAction({ email: "unknown@example.com" });

    expect(known).toEqual(unknown);
    expect(known.success).toBe(true);
  });

  it("builds the reset link from the configured site URL, not the request", async () => {
    supabase.client.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    await requestPasswordResetAction({ email: "a@example.com" });
    expect(supabase.client.auth.resetPasswordForEmail.mock.calls[0][1].redirectTo).toBe(
      "http://localhost:3000/auth/callback?next=/auth/reset-password",
    );
  });

  it("refuses to change a password without a valid recovery session", async () => {
    supabase.signedInAs(null);
    const result = await updatePasswordAction({ password: "Secret123", confirmPassword: "Secret123" });
    expect(result.success).toBe(false);
    expect(supabase.client.auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password for a verified session", async () => {
    supabase.signedInAs({ id: "u1", email: "a@example.com" });
    supabase.client.auth.updateUser.mockResolvedValue({ error: null });
    await expect(
      updatePasswordAction({ password: "Secret123", confirmPassword: "Secret123" }),
    ).rejects.toThrow(/NEXT_REDIRECT:\/account/);
    expect(supabase.client.auth.updateUser).toHaveBeenCalledWith({ password: "Secret123" });
  });
});
