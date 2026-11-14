import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ getClaims: vi.fn(), getUser: vi.fn() }));
const rpc = vi.hoisted(() => vi.fn());
const productQuery = vi.hoisted(() => ({
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth, rpc }),
}));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({ from: () => productQuery }),
}));

import { updateSession } from "@/lib/supabase/proxy";
import { proxy } from "@/proxy";

const signedIn = () => auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
const signedOut = () => auth.getClaims.mockResolvedValue({ data: null });

const run = (path: string) => updateSession(new NextRequest(`http://localhost:3000${path}`));
const location = (response: Response) => response.headers.get("location");

beforeEach(() => signedOut());

describe("protected routes", () => {
  it.each(["/cart", "/checkout", "/favorites", "/account", "/account/orders"])(
    "redirects guests from %s to login and preserves the return path",
    async (path) => {
      const response = await run(path);
      expect(response.status).toBe(307);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(location(response)).toBe(
        `http://localhost:3000/auth/login?next=${encodeURIComponent(path)}`,
      );
    },
  );

  it("returns 401 for a guest before the admin page can stream", async () => {
    const response = await run("/admin");
    expect(response.status).toBe(401);
    expect(location(response)).toBeNull();
  });

  it("checks the verified user and active database role on admin routes", async () => {
    signedIn();
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await run("/admin/products")).status).toBe(403);
    rpc.mockResolvedValue({ data: true, error: null });
    expect((await run("/admin/products")).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("is_active_admin");
    rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await run("/admin/products")).status).toBe(503);
  });

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

describe("product status before streaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedOut();
    productQuery.select.mockReturnValue(productQuery);
    productQuery.eq.mockReturnValue(productQuery);
  });

  it("allows an active product through using the decoded slug", async () => {
    productQuery.maybeSingle.mockResolvedValue({ data: { id: "product-1" }, error: null });
    const response = await proxy(new NextRequest("http://localhost:3000/products/%74est-item"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(productQuery.eq).toHaveBeenCalledWith("slug", "test-item");
    expect(productQuery.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("rewrites missing or inactive products to a 404 without redirecting", async () => {
    productQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await proxy(new NextRequest("http://localhost:3000/products/missing?ref=test"));
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/__product-not-found__/__missing__?ref=test",
    );
  });

  it("reports database failures as unavailable, not missing", async () => {
    productQuery.maybeSingle.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await proxy(new NextRequest("http://localhost:3000/products/item"));
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("does not intercept product page actions or other routes", async () => {
    const action = new NextRequest("http://localhost:3000/products/item", { method: "POST" });
    expect((await proxy(action)).status).toBe(200);
    expect((await proxy(new NextRequest("http://localhost:3000/products"))).status).toBe(200);
    expect(productQuery.select).not.toHaveBeenCalled();
  });
});
