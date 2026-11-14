import { describe, expect, it } from "vitest";
import { databaseTestsEnabled, e2eConfiguration, localSupabaseConfiguration } from "../helpers/test-environment.cjs";

const local = {
  TEST_SUPABASE_URL: "http://127.0.0.1:54321",
  TEST_SUPABASE_PUBLISHABLE_KEY: "local-anon",
  TEST_SUPABASE_SECRET_KEY: "local-service",
};

describe("destructive test isolation", () => {
  it("skips database tests unless explicitly enabled, and rejects incomplete configuration", () => {
    expect(databaseTestsEnabled({})).toBe(false);
    expect(() => databaseTestsEnabled({ ALLOW_DB_TESTS: "true" })).toThrow("Set TEST_SUPABASE");
    expect(databaseTestsEnabled({ ...local, ALLOW_DB_TESTS: "true" })).toBe(true);
  });

  it.each([
    "https://example.supabase.co",
    "http://localhost:54321",
    "http://127.0.0.1:54322",
    "http://127.0.0.1:54321@evil.example",
    "http://127.0.0.1:54321/redirect",
  ])("rejects non-local or ambiguous Supabase URL %s", (url) => {
    expect(() => localSupabaseConfiguration({ ...local, TEST_SUPABASE_URL: url })).toThrow("disposable local Supabase");
  });

  it("requires an isolated, Playwright-managed application and validates the port", () => {
    expect(() => e2eConfiguration(local)).toThrow("E2E_ISOLATED");
    expect(() => e2eConfiguration({ ...local, E2E_ISOLATED: "true", E2E_BASE_URL: "https://example.com" })).toThrow("E2E_BASE_URL");
    expect(() => e2eConfiguration({ ...local, E2E_ISOLATED: "true", E2E_PORT: "3000;other" })).toThrow("E2E_PORT");
    expect(e2eConfiguration({ ...local, E2E_ISOLATED: "true", E2E_PORT: "3100" }).baseURL).toBe("http://localhost:3100");
  });
});
