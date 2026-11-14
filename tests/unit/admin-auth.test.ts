import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActiveAdmin: vi.fn(),
  unauthorized: vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;401");
  }),
  forbidden: vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;403");
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: mocks.isActiveAdmin,
  }),
}));

vi.mock("next/navigation", () => ({
  unauthorized: mocks.unauthorized,
  forbidden: mocks.forbidden,
}));

import {
  getAdminUser,
  isAdmin,
  requireActiveAdmin,
  requireAdmin,
} from "@/lib/admin/auth";

const user = { id: "user-1", email: "admin@example.test" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(user);
  mocks.isActiveAdmin.mockResolvedValue({ data: true, error: null });
});

describe("admin authorization", () => {
  it("uses the verified Supabase user and profile role, not auth metadata", async () => {
    const userWithUntrustedMetadata = {
      ...user,
      app_metadata: { role: "admin" },
      user_metadata: { role: "admin" },
    };
    mocks.getCurrentUser.mockResolvedValue(userWithUntrustedMetadata);
    mocks.isActiveAdmin.mockResolvedValue({ data: false, error: null });

    await expect(getAdminUser()).resolves.toBeNull();
    await expect(requireAdmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(mocks.isActiveAdmin).toHaveBeenCalled();
  });

  it("returns 401 for a missing authenticated Supabase user", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;401");
    await expect(getAdminUser()).resolves.toBeNull();
    await expect(isAdmin()).resolves.toBe(false);
  });

  it("returns 403 for customers and inactive administrators", async () => {
    mocks.isActiveAdmin.mockResolvedValue({ data: false, error: null });
    await expect(requireAdmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");

    mocks.isActiveAdmin.mockResolvedValue({ data: false, error: null });
    await expect(requireActiveAdmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    await expect(getAdminUser()).resolves.toBeNull();
  });

  it("allows only an active database administrator", async () => {
    await expect(getAdminUser()).resolves.toEqual(user);
    await expect(requireActiveAdmin()).resolves.toEqual(user);
    await expect(isAdmin()).resolves.toBe(true);
    expect(mocks.isActiveAdmin).toHaveBeenCalled();
  });

  it("surfaces database authorization errors instead of granting access", async () => {
    mocks.isActiveAdmin.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    await expect(getAdminUser()).rejects.toThrow(
      "Failed to verify administrator access: database unavailable",
    );
  });
});
