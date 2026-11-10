import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

loadEnv({ path: ".env.test", quiet: true });

const root = path.dirname(fileURLToPath(import.meta.url));

/** Deterministic, fake environment: unit and integration tests never touch a real service. */
const fakeEnv = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  SUPABASE_SECRET_KEY: "test-secret-key",
  RESEND_API_KEY: "re_test_key",
  RESEND_FROM_EMAIL: "Truck Shop <orders@example.test>",
  SELLER_EMAIL: "seller@example.test",
};

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // The real package throws outside React Server Components.
      "server-only": path.resolve(root, "tests/helpers/server-only.ts"),
    },
  },
  test: {
    globals: false,
    environment: "node",
    clearMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          env: fakeEnv,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.{ts,tsx}"],
          env: fakeEnv,
        },
      },
      {
        // Runs against a dedicated Supabase project; skipped unless it is configured.
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
