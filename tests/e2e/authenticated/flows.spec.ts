import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD (see .env.e2e.example)");

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.locator("#email").fill(email!);
  await page.locator("#password").fill(password!);
  await page.getByRole("button", { name: "Увійти" }).last().click();
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

async function openFirstInStockProduct(page: Page) {
  await page.goto("/products");
  await page.locator('a[href^="/products/"]').first().click();
  await expect(page.getByRole("button", { name: "Додати до кошика" })).toBeEnabled();
}

test.describe("session", () => {
  test("login works, logout ends the session and protected routes lock again", async ({ page }) => {
    await login(page);

    await page.getByRole("button", { name: "Меню акаунта" }).click();
    await page.getByRole("menuitem", { name: "Вийти" }).click();

    await expect(page.getByRole("button", { name: "Меню акаунта" })).toBeVisible();
    await page.goto("/cart");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("session survives a reload", async ({ page }) => {
    await login(page);
    await page.goto("/account");
    await page.reload();
    await expect(page).toHaveURL(/\/account/);
  });

  test("signed-in users are sent away from the login page", async ({ page }) => {
    await login(page);
    await page.goto("/auth/login");
    await expect(page).toHaveURL(/\/account/);
  });
});

test.describe("favorites", () => {
  test("toggle a favorite on and off", async ({ page }) => {
    await login(page);
    await page.goto("/products");
    const toggle = page.locator("button[aria-pressed]").first();
    await expect(toggle).toBeVisible();

    const before = await toggle.getAttribute("aria-pressed");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", before!);
  });
});

test.describe("cart", () => {
  test("add, change quantity and remove", async ({ page }) => {
    await login(page);
    await openFirstInStockProduct(page);
    await page.getByRole("button", { name: "Додати до кошика" }).click();

    await page.goto("/cart");
    const increase = page.getByRole("button", { name: /Збільшити кількість/ }).first();
    await expect(increase).toBeVisible();
    await increase.click();
    await expect(page.locator("[aria-live]").first()).toBeVisible();

    await page.getByRole("button", { name: /Видалити/ }).first().click();
    await expect(page.getByRole("button", { name: /Збільшити кількість/ })).toHaveCount(0);
  });
});

test.describe("checkout", () => {
  test("requires accepting the terms before placing the order", async ({ page }) => {
    await login(page);
    await openFirstInStockProduct(page);
    await page.getByRole("button", { name: "Додати до кошика" }).click();

    await page.goto("/checkout");
    await expect(page.locator("#acceptTerms")).not.toBeChecked();
    await page.getByRole("button", { name: "Оформити замовлення" }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator("#acceptTerms")).toBeVisible();
  });

  test("full order flow (opt-in: creates a real order and sends emails)", async ({ page }) => {
    test.skip(process.env.E2E_PLACE_ORDER !== "true", "Set E2E_PLACE_ORDER=true to create a real order");
    await login(page);
    await openFirstInStockProduct(page);
    await page.getByRole("button", { name: "Додати до кошика" }).click();

    await page.goto("/checkout");
    for (const [name, value] of Object.entries({
      customerName: "E2E Customer",
      customerPhone: "+48 600 100 200",
      country: "Poland",
      city: "Warszawa",
      postalCode: "00-001",
      address: "Testowa 1",
    })) {
      const field = page.locator(`[name="${name}"]`);
      if (await field.count()) await field.fill(value);
    }
    await page.locator("#acceptTerms").check();
    await page.getByRole("button", { name: "Оформити замовлення" }).click();

    await expect(page).toHaveURL(/\/(account\/orders|checkout\/success|orders)/);
    await page.goto("/cart");
    await expect(page.getByRole("button", { name: /Збільшити кількість/ })).toHaveCount(0);
  });
});
