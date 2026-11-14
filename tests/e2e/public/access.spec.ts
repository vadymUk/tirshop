import { expect, test } from "@playwright/test";

test.describe("protected routes (guest)", () => {
  test("private responses and redirects are not cacheable", async ({ request }) => {
    for (const path of ["/admin", "/cart", "/checkout", "/favorites", "/account"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.headers()["cache-control"]).toContain("no-store");
    }
  });

  for (const path of ["/cart", "/checkout", "/favorites", "/account"]) {
    test(`${path} redirects to login and remembers the destination`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/auth\/login/);
      expect(decodeURIComponent(new URL(page.url()).searchParams.get("next") ?? "")).toContain(path);
    });
  }

  test("admin returns 401 to guests before rendering", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(401);
    await expect(page.getByRole("heading", { name: /Потрібен вхід/ })).toBeVisible();
  });

  test("login page does not follow external redirects", async ({ page }) => {
    await page.goto("/auth/login?next=https://evil.example");
    await expect(page.locator("#email")).toBeVisible();
  });
});

test.describe("auth forms", () => {
  test("login with wrong credentials shows an error and stays on the page", async ({ page }) => {
    await page.goto("/auth/login");
    await page.locator("#email").fill("nobody@example.test");
    await page.locator("#password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Увійти" }).last().click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("registration validates mismatching passwords on the client or server", async ({ page }) => {
    await page.goto("/auth/register");
    await page.locator("#fullName").fill("Test User");
    await page.locator("#email").fill("new-user@example.test");
    await page.locator("#password").fill("Test-Pass-12345");
    await page.locator("#confirmPassword").fill("Different-Pass-1");
    await page.getByRole("button", { name: "Створити акаунт" }).click();
    await expect(page).toHaveURL(/\/auth\/register/);
  });
});

test.describe("legal pages", () => {
  for (const path of ["/privacy", "/terms", "/shipping", "/returns"]) {
    test(`${path} renders and shows the placeholder warning`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("mark").first()).toBeVisible();
    });
  }
});

test.describe("responsive layout", () => {
  test("header fits at 360px without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
