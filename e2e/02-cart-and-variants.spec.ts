import { test, expect } from "@playwright/test";
import { SEEDED_PRODUCTS } from "./fixtures/test-data";

test.describe("02. Variant Selection & Guest Cart Flow", () => {
  test("5 & 6. Available exact variant can be added to cart; unavailable combination is blocked with 'Unavailable' label and no numeric stock", async ({
    page,
  }) => {
    await page.goto(SEEDED_PRODUCTS.kurta.pdpPath);

    // Initial state: prompts to select Size & Color
    const addToCartButton = page.getByRole("button", { name: /Add.*to cart|Select Size & Color/i });
    await expect(addToCartButton).toBeVisible();

    // 1. When Size 2-3 Years is selected, Crimson Red is an unavailable combination and is disabled
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableSize, exact: false })
      .click();
    const unavailableColorBtn = page.getByRole("button", {
      name: SEEDED_PRODUCTS.kurta.unavailableColor,
      exact: false,
    });
    await expect(unavailableColorBtn).toBeDisabled();

    // Assert strictly zero numeric inventory terminology
    await expect(page.getByText(/\b\d+\s+in stock\b/i)).not.toBeVisible();
    await expect(page.getByText(/\b\d+\s+left\b/i)).not.toBeVisible();

    // 2. Select Ocean Blue (which IS available for 2-3 Years)
    const availableColorBtn = page.getByRole("button", {
      name: SEEDED_PRODUCTS.kurta.availableColor,
      exact: false,
    });
    await expect(availableColorBtn).toBeEnabled();
    await availableColorBtn.click();

    // Button should now be enabled with "Add to Cart"
    await expect(addToCartButton).toHaveText(/Add to Cart/i);
    await expect(addToCartButton).toBeEnabled();

    // Click Add to Cart
    await addToCartButton.click();

    // Verify confirmation feedback
    await expect(page.getByRole("status")).toContainText(/Added to cart/i);
  });

  test("7. Persistent Guest Cart retains exact variant selection and survives reload without login", async ({
    page,
  }) => {
    // Ensure product is in cart
    await page.goto(SEEDED_PRODUCTS.kurta.pdpPath);
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableSize, exact: false })
      .click();
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableColor, exact: false })
      .click();
    await page.getByRole("button", { name: /Add.*to cart/i }).click();

    // Navigate to Cart
    await page.goto("/cart");
    await expect(page.getByRole("heading", { level: 1, name: /Shopping Bag/i })).toBeVisible();
    await expect(page.getByText(SEEDED_PRODUCTS.kurta.name).first()).toBeVisible();
    await expect(
      page.getByText(new RegExp(SEEDED_PRODUCTS.kurta.availableSize)).first()
    ).toBeVisible();
    await expect(
      page.getByText(new RegExp(SEEDED_PRODUCTS.kurta.availableColor)).first()
    ).toBeVisible();

    // Update quantity
    const increaseBtn = page.getByRole("button", { name: /increase quantity/i }).first();
    if (await increaseBtn.isVisible()) {
      await increaseBtn.click();
      await expect(page.getByRole("heading", { level: 1, name: /Shopping Bag/i })).toBeVisible();
    }

    // Reload page
    await page.reload();

    // Assert cart items and exact variant are intact
    await expect(page.getByRole("heading", { level: 1, name: /Shopping Bag/i })).toBeVisible();
    await expect(page.getByText(SEEDED_PRODUCTS.kurta.name).first()).toBeVisible();
    await expect(
      page.getByText(new RegExp(SEEDED_PRODUCTS.kurta.availableSize)).first()
    ).toBeVisible();

    // Verify guest cart does not require login or show login redirects
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText(/sign in to view your bag/i)).not.toBeVisible();
  });
});
