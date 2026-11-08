import { expect, test } from "@playwright/test";

test.describe("catalog", () => {
  test("home page renders with header, search and footer legal links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("search").first()).toBeVisible();
    for (const path of ["/privacy", "/terms", "/shipping", "/returns"]) {
      await expect(page.locator(`footer a[href="${path}"]`)).toBeVisible();
    }
  });

  test("product listing shows products and pagination keeps the page in the URL", async ({ page }) => {
    await page.goto("/products");
    const cards = page.locator('a[href^="/products/"]');
    await expect(cards.first()).toBeVisible();

    const pagination = page.locator("nav[aria-label='Сторінки']");
    test.skip((await pagination.count()) === 0, "Not enough products for a second page");
    await pagination.locator("a[aria-label='Сторінка 2']").click();
    await expect(page).toHaveURL(/page=2/);
    await expect(cards.first()).toBeVisible();
  });

  test("product details page opens from the listing", async ({ page }) => {
    await page.goto("/products");
    const first = page.locator('a[href^="/products/"]').first();
    const href = await first.getAttribute("href");
    await first.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("unknown product slug shows the not-found page", async ({ page }) => {
    const response = await page.goto("/products/this-product-does-not-exist-xyz");
    expect(response?.status()).toBe(404);
  });

  test("category page lists its products", async ({ page }) => {
    await page.goto("/products");
    const link = page.locator('a[href^="/category/"]').first();
    test.skip((await link.count()) === 0, "No category links on the listing page");
    await link.click();
    await expect(page).toHaveURL(/\/category\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("search finds a product by a word from its name", async ({ page }) => {
    await page.goto("/products");
    const card = page.locator('a[href^="/products/"]').first();
    await expect(card).toBeVisible();
    const word = ((await card.innerText()).match(/[\p{L}\d]{4,}/u) ?? [])[0];
    test.skip(!word, "Could not derive a search word");

    const search = page.getByRole("search").first();
    await search.locator("input[name=q]").fill(word!);
    await search.locator("input[name=q]").press("Enter");
    await expect(page).toHaveURL(/q=/);
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
  });

  test("search with no matches shows an empty state instead of crashing", async ({ page }) => {
    await page.goto("/products?q=zzzzqqqqxxxx");
    await expect(page.locator('a[href^="/products/"]')).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("malicious query strings do not break the listing", async ({ page }) => {
    const response = await page.goto("/products?page=-5&q=%22)%2Cname.eq.x&sort=;drop");
    expect(response?.status()).toBeLessThan(500);
  });
});
