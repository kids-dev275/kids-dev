import { test, expect } from "@playwright/test";
import { STOREFRONTS, SEEDED_PRODUCTS } from "./fixtures/test-data";

test.describe("01. Storefront Gateway & Public Catalog Flow", () => {
  test("1. Gateway renders and allows navigation to all three storefront roots without /storefront alias", async ({
    page,
  }) => {
    // Navigate to root gateway
    await page.goto("/");
    await expect(page).toHaveTitle(/Kids Wear/i);

    // Verify all 3 storefront links exist
    const miniSproutsLink = page.locator('a[href="/mini-sprouts"]').first();
    const teenStudioLink = page.locator('a[href="/teen-studio"]').first();
    const auraStudioLink = page.locator('a[href="/aura-studio"]').first();

    await expect(miniSproutsLink).toBeVisible();
    await expect(teenStudioLink).toBeVisible();
    await expect(auraStudioLink).toBeVisible();

    // Navigate to Mini Sprouts
    await miniSproutsLink.click();
    await expect(page).toHaveURL(/\/mini-sprouts$/);
    await expect(page.getByText(STOREFRONTS.miniSprouts.name).first()).toBeVisible();
    await expect(page.getByText(STOREFRONTS.miniSprouts.ageLabel).first()).toBeVisible();

    // Navigate to Teen Studio
    await page.goto("/teen-studio");
    await expect(page).toHaveURL(/\/teen-studio$/);
    await expect(page.getByText(STOREFRONTS.teenStudio.name).first()).toBeVisible();
    await expect(page.getByText(STOREFRONTS.teenStudio.ageLabel).first()).toBeVisible();

    // Navigate to Aura Studio
    await page.goto("/aura-studio");
    await expect(page).toHaveURL(/\/aura-studio$/);
    await expect(page.getByText(STOREFRONTS.auraStudio.name).first()).toBeVisible();
    await expect(page.getByText(STOREFRONTS.auraStudio.ageLabel).first()).toBeVisible();

    // Verify no broken /storefront/... links
    const brokenLinks = await page.locator('a[href*="/storefront/"]').count();
    expect(brokenLinks).toBe(0);
  });

  test("2. Public Product browse and PDP resolution per storefront", async ({ page }) => {
    // Browse Mini Sprouts shop
    await page.goto("/mini-sprouts/shop");
    await expect(page.getByText(SEEDED_PRODUCTS.kurta.name).first()).toBeVisible();

    // Teen Studio product should NOT be in Mini Sprouts
    await expect(page.getByText(SEEDED_PRODUCTS.polo.name)).not.toBeVisible();

    // Click product to navigate to PDP
    await page.getByText(SEEDED_PRODUCTS.kurta.name).first().click();
    await expect(page).toHaveURL(new RegExp(SEEDED_PRODUCTS.kurta.pdpPath));

    // Verify PDP elements
    await expect(page.locator("h1").first()).toContainText(SEEDED_PRODUCTS.kurta.name);
    await expect(page.getByText("Rs. 2,490").first()).toBeVisible();
    await expect(page.getByText("100% Breathable Cotton").first()).toBeVisible();

    // Verify Teen Studio catalog isolation
    await page.goto("/teen-studio/shop");
    await expect(page.getByText(SEEDED_PRODUCTS.polo.name).first()).toBeVisible();
    await expect(page.getByText(SEEDED_PRODUCTS.kurta.name)).not.toBeVisible();
  });

  test("3. Search flow: matching product resolves; non-matching query returns honest no-results state", async ({
    page,
  }) => {
    // Search match
    await page.goto("/mini-sprouts/search?q=Kurta");
    await expect(page.getByText(SEEDED_PRODUCTS.kurta.name).first()).toBeVisible();

    // Click result navigates to PDP
    await page.getByText(SEEDED_PRODUCTS.kurta.name).first().click();
    await expect(page).toHaveURL(new RegExp(SEEDED_PRODUCTS.kurta.pdpPath));

    // Search no results
    await page.goto("/mini-sprouts/search?q=NonExistentGarmentXYZ");
    await expect(
      page
        .getByText(/No products found/i)
        .or(page.getByText(/couldn't find any products/i))
        .first()
    ).toBeVisible();
    await expect(page.getByText(SEEDED_PRODUCTS.kurta.name)).not.toBeVisible();
  });
});
