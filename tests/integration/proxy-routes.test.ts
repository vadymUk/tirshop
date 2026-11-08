import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ getClaims: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth }),
}));

import { updateSession } from "@/lib/supabase/proxy";

const signedIn = () => auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
const signedOut = () => auth.getClaims.mockResolvedValue({ data: null });

const run = (path: string) => updateSession(new NextRequest(`http://localhost:3000${path}`));
const location = (response: Response) => response.headers.get("location");

beforeEach(() => signedOut());

describe("protected routes", () => {
  it.each(["/cart", "/checkout", "/favorites", "/account", "/account/orders", "/admin"])(
    "redirects guests from %s to login and preserves the return path",
    async (path) => {
      const response = await run(path);
      expect(response.status).toBe(307);
      expect(location(response)).toBe(
        `http://localhost:3000/auth/login?next=${encodeURIComponent(path)}`,
      );
    },
  );

  it("keeps the query string in the return path", async () => {
    const response = await run("/checkout?step=2");
    expect(location(response)).toContain(encodeURIComponent("/checkout?step=2"));
  });

  it("does not treat look-alike paths as protected", async () => {
    for (const path of ["/cartoon", "/accounting", "/favorites-info"]) {
      expect(location(await run(path))).toBeNull();
    }
  });

  it("lets signed-in users through", async () => {
    signedIn();
    for (const path of ["/cart", "/checkout", "/account/orders/123"]) {
      const response = await run(path);
      expect(location(response)).toBeNull();
      expect(response.status).toBe(200);
    }
  });
});

describe("public routes", () => {
  it.each(["/", "/products", "/products/some-slug", "/category/electronics", "/privacy", "/terms", "/auth/login"])(
    "are open to guests: %s",
    async (path) => {
      const response = await run(path);
      expect(response.status).toBe(200);
      expect(location(response)).toBeNull();
    },
  );
});

describe("guest-only pages", () => {
  it.each(["/auth/login", "/auth/register", "/auth/forgot-password"])(
    "send signed-in users from %s to /account",
    async (path) => {
      signedIn();
      expect(location(await run(path))).toBe("http://localhost:3000/account");
    },
  );

  it("still allows the auth callback and password reset for signed-in users", async () => {
    signedIn();
    expect(location(await run("/auth/callback"))).toBeNull();
    expect(location(await run("/auth/reset-password"))).toBeNull();
  });
});
