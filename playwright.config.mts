import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import testEnvironment from "./tests/helpers/test-environment.cjs";

loadEnv({ path: ".env.e2e", quiet: true });

const { port, baseURL, supabase } = testEnvironment.e2eConfiguration(process.env);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Stable Ukrainian UI text for selectors.
    storageState: {
      cookies: [
        { name: "site-language", value: "ua", domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" },
      ],
      origins: [],
    },
  },
  projects: [
    { name: "public", testMatch: /public\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", testMatch: /public\/.*\.spec\.ts/, use: { ...devices["Pixel 7"] } },
    // Needs E2E_USER_EMAIL / E2E_USER_PASSWORD; specs skip themselves without them.
    { name: "authenticated", testMatch: /authenticated\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"] }, workers: 1 },
    { name: "admin", testMatch: /admin\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"] }, workers: 1 },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_PUBLIC_SUPABASE_URL: supabase.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
      NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS: "false",
      SUPABASE_SECRET_KEY: supabase.secretKey,
      RESEND_API_KEY: "",
      RESEND_FROM_EMAIL: "",
      SELLER_EMAIL: "",
    },
  },
});
