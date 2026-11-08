import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth }),
}));

import { GET } from "@/app/auth/callback/route";

beforeEach(() => {
  vi.clearAllMocks();
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ error: null });
});

describe("auth callback redirects", () => {
  it("uses the configured site origin instead of the request Host", async () => {
    const request = new NextRequest(
      "https://attacker.example/auth/callback?code=valid-code&next=%2Faccount",
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/account");
  });

  it("rejects an external return path and keeps the redirect on the configured origin", async () => {
    const request = new NextRequest(
      "https://attacker.example/auth/callback?code=valid-code&next=%2F%2Fevil.example",
    );

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/account");
  });
});
