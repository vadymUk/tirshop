import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { e2eConfiguration } from "../../helpers/test-environment.cjs";

const { baseURL, supabase } = e2eConfiguration(process.env);
let service: SupabaseClient;
let anonymous: SupabaseClient;
const run = randomUUID().slice(0, 8);
const password = "E2E-Test-Password-12345";
const productSlug = `e2e-product-${run}`;
const orderProductSlug = `e2e-order-product-${run}`;
const categorySlug = `e2e-category-${run}`;
const managedCategorySlug = `e2e-managed-${run}`;
const users: string[] = [];
const emails = {
  admin: `e2e-admin-${run}@example.test`,
  customer: `e2e-customer-${run}@example.test`,
  inactive: `e2e-inactive-${run}@example.test`,
};
let categoryId: string;
let customerId: string;
let orderId: string | undefined;

async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Увійти" }).last().click();
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

test.describe("isolated administrator workflows", () => {
  test.describe.configure({ mode: "default" });

  test.beforeAll(async () => {
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    service = createClient(supabase.url, supabase.secretKey, options);
    anonymous = createClient(supabase.url, supabase.publishableKey, options);
    for (const [kind, email] of Object.entries(emails)) {
      const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(`Failed to create ${kind} fixture: ${created.error?.message}`);
      users.push(created.data.user.id);
      if (kind === "customer") customerId = created.data.user.id;
      if (kind !== "customer") {
        const profile = await service.from("profiles")
          .update({ role: "admin", is_active: kind !== "inactive" })
          .eq("id", created.data.user.id).select("id").single();
        if (profile.error) throw new Error(`Failed to configure ${kind} fixture: ${profile.error.message}`);
      }
    }
    const category = await service.from("categories")
      .insert({ name: `E2E category ${run}`, slug: categorySlug, is_active: true })
      .select("id").single();
    if (category.error) throw new Error(`Failed to create category fixture: ${category.error.message}`);
    categoryId = category.data.id;
  });

  test.afterAll(async () => {
    if (!service) return;
    const errors: string[] = [];
    if (orderId) {
      const order = await service.from("orders").delete().eq("id", orderId);
      if (order.error) errors.push(`order: ${order.error.message}`);
    }
    const products = await service.from("products").delete().in("slug", [productSlug, orderProductSlug]);
    if (products.error) errors.push(`product: ${products.error.message}`);
    const categories = await service.from("categories").delete().in("slug", [categorySlug, managedCategorySlug]);
    if (categories.error) errors.push(`categories: ${categories.error.message}`);
    for (const id of users) {
      const result = await service.auth.admin.deleteUser(id);
      if (result.error) errors.push(`user: ${result.error.message}`);
    }
    if (errors.length) throw new Error(`E2E cleanup failed: ${errors.join("; ")}`);
  });

  test("customers and inactive administrators cannot enter admin", async ({ browser }) => {
    for (const email of [emails.customer, emails.inactive]) {
      const context = await browser.newContext({ baseURL });
      await context.addCookies([{ name: "site-language", value: "ua", url: baseURL }]);
      const page = await context.newPage();
      await login(page, email);
      const response = await page.goto("/admin/products");
      expect(response?.status()).toBe(403);
      await expect(page.getByRole("heading", { name: /доступ/i })).toBeVisible();
      await context.close();
    }
  });

  test("an active admin can create, edit, unpublish and delete a product", async ({ page }) => {
    await login(page, emails.admin);
    await page.goto("/admin/products/new");
    await page.getByLabel("Назва", { exact: true }).fill(`E2E product ${run}`);
    await page.getByLabel("Slug", { exact: true }).fill(productSlug);
    await page.getByLabel("Категорія", { exact: true }).selectOption(categoryId);
    const price = page.getByLabel("Ціна", { exact: true });
    await price.fill("0");
    await page.getByRole("button", { name: "Зберегти товар" }).click();
    expect(await price.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
    await price.fill("15.50");
    await page.getByLabel("Залишок", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Зберегти товар" }).click();
    await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]+\/edit\?saved=1/);
    await expect(page.getByRole("status").filter({ hasText: "Товар збережено" })).toBeVisible();

    const publicProduct = await anonymous.from("products").select("id,price,stock_quantity").eq("slug", productSlug).single();
    expect(publicProduct.error).toBeNull();
    expect(publicProduct.data).toMatchObject({ price: 15.5, stock_quantity: 8 });

    await page.getByLabel("Ціна", { exact: true }).fill("21.75");
    await page.getByLabel("Залишок", { exact: true }).fill("4");
    await page.getByLabel("Активний", { exact: true }).uncheck();
    await page.getByRole("button", { name: "Зберегти товар" }).click();
    await expect.poll(async () => {
      const result = await service.from("products").select("price,stock_quantity,is_active").eq("slug", productSlug).single();
      if (result.error) throw new Error(result.error.message);
      return result.data;
    }).toEqual({ price: 21.75, stock_quantity: 4, is_active: false });
    const hidden = await anonymous.from("products").select("id").eq("slug", productSlug);
    expect(hidden.error).toBeNull();
    expect(hidden.data).toEqual([]);

    await page.goto(`/admin/products?q=${encodeURIComponent(`E2E product ${run}`)}`);
    await page.getByLabel(`Вибрати E2E product ${run}`).check();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Видалити", exact: true }).click();
    await expect.poll(async () => {
      const result = await service.from("products").select("id").eq("slug", productSlug);
      if (result.error) throw new Error(result.error.message);
      return result.data?.length;
    }).toBe(0);
  });

  test("an admin can create, edit and delete an empty category", async ({ page }) => {
    await login(page, emails.admin);
    await page.goto("/admin/categories");
    await page.getByText("Додати категорію", { exact: true }).click();
    const add = page.locator("form").filter({ has: page.getByRole("button", { name: "Зберегти категорію" }) }).first();
    await add.getByLabel("Назва").fill(`E2E managed ${run}`);
    await add.getByLabel("Slug").fill(managedCategorySlug);
    await add.getByRole("button", { name: "Зберегти категорію" }).click();
    await expect(add.getByRole("status")).toContainText("Категорію збережено");

    await page.goto(`/admin/categories?q=${encodeURIComponent(`E2E managed ${run}`)}`);
    const category = page.locator("section").filter({ has: page.getByRole("heading", { name: `E2E managed ${run}` }) });
    await category.getByText("Редагувати", { exact: true }).click();
    await category.getByLabel("Назва").fill(`E2E edited ${run}`);
    await category.getByRole("button", { name: "Зберегти категорію" }).click();
    await expect.poll(async () => {
      const result = await service.from("categories").select("name").eq("slug", managedCategorySlug).single();
      if (result.error) throw new Error(result.error.message);
      return result.data.name;
    }).toBe(`E2E edited ${run}`);

    await page.goto(`/admin/categories?q=${encodeURIComponent(`E2E edited ${run}`)}`);
    const edited = page.locator("section").filter({ has: page.getByRole("heading", { name: `E2E edited ${run}` }) });
    await edited.getByText("Редагувати", { exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await edited.getByRole("button", { name: "Видалити категорію" }).click();
    await expect.poll(async () => {
      const result = await service.from("categories").select("id").eq("slug", managedCategorySlug);
      if (result.error) throw new Error(result.error.message);
      return result.data?.length;
    }).toBe(0);
  });

  test("an admin can find an order, change its status and view the customer history", async ({ page }) => {
    const product = await service.from("products").insert({
      category_id: categoryId, name: `E2E order item ${run}`, slug: orderProductSlug,
      short_description: "test", price: 12, currency: "EUR", stock_quantity: 5, is_active: true,
    }).select("id").single();
    if (product.error) throw new Error(`Failed to create order product: ${product.error.message}`);
    const signedIn = await anonymous.auth.signInWithPassword({ email: emails.customer, password });
    if (signedIn.error) throw new Error(`Failed to sign in order fixture: ${signedIn.error.message}`);
    const cart = await anonymous.rpc("add_to_cart", { p_product_id: product.data.id, p_quantity: 2 });
    if (cart.error) throw new Error(`Failed to create order cart: ${cart.error.message}`);
    const placed = await anonymous.rpc("place_order", {
      p_customer_name: "E2E Customer", p_customer_email: emails.customer,
      p_customer_phone: "+48 600 100 200", p_country: "Poland", p_city: "Warszawa",
      p_postal_code: "00-001", p_address: "Testowa 1", p_apartment: null, p_notes: null,
    });
    if (placed.error || typeof placed.data !== "string") throw new Error(`Failed to create order: ${placed.error?.message}`);
    orderId = placed.data;
    const order = await service.from("orders").select("order_number,payment_status").eq("id", orderId).single();
    if (order.error) throw new Error(`Failed to load order fixture: ${order.error.message}`);

    const paymentChange = await anonymous.from("orders").update({ payment_status: "paid" }).eq("id", orderId).select("id");
    expect(paymentChange.error || paymentChange.data?.length === 0).toBeTruthy();

    await login(page, emails.admin);
    await page.goto("/admin/orders");
    await page.getByLabel("Номер замовлення").fill(String(order.data.order_number));
    await page.getByLabel("Статус замовлення").selectOption("pending");
    await page.getByRole("button", { name: "Застосувати" }).click();
    await page.locator(`a[href="/admin/orders/${orderId}"]`).click();
    await expect(page.getByRole("heading", { name: `Замовлення #${order.data.order_number}` })).toBeVisible();
    await page.getByLabel("Новий статус").selectOption("confirmed");
    await page.getByLabel("Внутрішня примітка до історії").fill("E2E confirmation");
    await page.getByRole("button", { name: "Змінити статус" }).click();
    await expect.poll(async () => {
      const result = await service.from("order_status_history")
        .select("previous_status,new_status,note").eq("order_id", orderId).eq("new_status", "confirmed").maybeSingle();
      if (result.error) throw new Error(result.error.message);
      return result.data;
    }).toMatchObject({ previous_status: "pending", new_status: "confirmed", note: "E2E confirmation" });
    const updated = await service.from("orders").select("payment_status").eq("id", orderId).single();
    expect(updated.error).toBeNull();
    expect(updated.data?.payment_status).toBe(order.data.payment_status);

    await page.goto(`/admin/customers/${customerId}`);
    await expect(page.getByRole("heading", { name: "Історія замовлень і адреси доставки" })).toBeVisible();
    await expect(page.locator(`a[href="/admin/orders/${orderId}"]`)).toBeVisible();
  });

  test("admin product controls fit required viewport widths", async ({ page }) => {
    await login(page, emails.admin);
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/products");
      await expect(page.getByRole("heading", { name: "Товари", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}px`).toBeLessThanOrEqual(0);
      if (width < 768) {
        await page.getByRole("button", { name: "Відкрити меню" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.getByRole("button", { name: "Закрити меню" }).click();
      }
    }
  });
});
