import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { e2eConfiguration } from "../../helpers/test-environment.cjs";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const { supabase } = e2eConfiguration(process.env);

test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD (see .env.e2e.example)");

function localClient() {
  return createClient(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.locator("#email").fill(email!);
  await page.locator("#password").fill(password!);
  await page.getByRole("button", { name: "Увійти" }).last().click();
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

async function clearTestCart(page: Page) {
  await page.goto("/cart");
  const clear = page.getByRole("button", { name: "Очистити кошик" });
  if (await clear.isVisible()) await clear.click();
  await expect(page.getByText("Ваш кошик порожній")).toBeVisible();
}

async function addInStockProduct(page: Page) {
  const result = await localClient().from("products")
    .select("id,slug,price,currency,stock_quantity")
    .eq("is_active", true).gte("stock_quantity", 2).order("id").limit(1).single();
  if (result.error) throw new Error(`Could not find an in-stock test product: ${result.error.message}`);
  const product = result.data;
  await page.goto(`/products/${product.slug}`);
  const purchase = page.getByRole("heading", { level: 1 }).locator("..").locator("..");
  const add = purchase.getByRole("button", { name: "Додати до кошика" });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByText(/додано до кошика/)).toBeVisible();
  return product;
}

async function fillCheckout(page: Page) {
  await page.locator("#fullName").fill("E2E Customer");
  await page.locator("#email").fill(email!);
  await page.locator("#phone").fill("+48 600 100 200");
  await page.locator("#country").selectOption("Poland");
  await page.locator("#city").fill("Warszawa");
  await page.locator("#postalCode").fill("00-001");
  await page.locator("#address").fill("Testowa 1");
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
    await clearTestCart(page);
    await addInStockProduct(page);

    await page.goto("/cart");
    const increase = page.getByRole("button", { name: /Збільшити кількість/ }).first();
    await expect(increase).toBeVisible();
    const quantity = page.getByRole("group", { name: /Кількість:/ }).locator('[aria-live="polite"]');
    await expect(quantity).toHaveText("1");
    await increase.click();
    await expect(quantity).toHaveText("2");

    await page.getByRole("button", { name: /Видалити/ }).first().click();
    await expect(page.getByText("Ваш кошик порожній")).toBeVisible();
  });
});

test.describe("checkout", () => {
  test("requires accepting the terms before placing the order", async ({ page }) => {
    await login(page);
    await clearTestCart(page);
    await addInStockProduct(page);

    await page.goto("/checkout");
    await fillCheckout(page);
    await expect(page.locator("#acceptTerms")).not.toBeChecked();
    await page.getByRole("button", { name: "Оформити замовлення" }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.locator("#acceptTerms-error")).toBeVisible();
  });

  test("full order flow (opt-in: creates an order in local Supabase)", async ({ page }) => {
    test.skip(process.env.E2E_PLACE_ORDER !== "true", "Set E2E_PLACE_ORDER=true to create a local test order");
    await login(page);
    await clearTestCart(page);
    const product = await addInStockProduct(page);

    await page.goto("/checkout");
    await fillCheckout(page);
    await page.locator("#acceptTerms").check();
    await page.getByRole("button", { name: "Оформити замовлення" }).click();

    await expect(page).toHaveURL(/\/checkout\/success\?order=[0-9a-f-]+/);
    await expect(page.getByRole("heading", { name: "Замовлення оформлено" })).toBeVisible();
    const orderId = new URL(page.url()).searchParams.get("order");
    expect(orderId).toBeTruthy();

    const client = localClient();
    const signedIn = await client.auth.signInWithPassword({ email: email!, password: password! });
    if (signedIn.error) throw new Error(`Could not verify the test order: ${signedIn.error.message}`);
    const order = await client.from("orders")
      .select("id,customer_email,total_amount,currency,order_items(product_id,quantity,subtotal)")
      .eq("id", orderId!).single();
    expect(order.error).toBeNull();
    expect(order.data).toMatchObject({
      customer_email: email,
      total_amount: product.price,
      currency: product.currency,
      order_items: [{ product_id: product.id, quantity: 1, subtotal: product.price }],
    });
    const stock = await client.from("products").select("stock_quantity").eq("id", product.id).single();
    expect(stock.error).toBeNull();
    expect(stock.data?.stock_quantity).toBe(product.stock_quantity - 1);

    await page.goto("/cart");
    await expect(page.getByText("Ваш кошик порожній")).toBeVisible();
  });
});
