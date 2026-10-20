import { test, expect } from "@playwright/test";
import { SEEDED_PRODUCTS } from "./fixtures/test-data";

test.describe("09. Mobile Viewport Critical Journey (Scenario 34)", () => {
  test("34. Mobile responsive journey: Storefront navigation -> PDP -> Variant selection -> Cart -> Checkout without horizontal overflow", async ({
    page,
  }) => {
    // 1. Visit mobile storefront
    await page.goto("/mini-sprouts");
    await expect(page.getByText("Kids Wear").first()).toBeVisible();

    // Verify viewport has mobile dimensions (Pixel 7 is 412px wide)
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBeLessThanOrEqual(500);

    // 2. Open mobile drawer menu
    const menuButton = page.getByRole("button", { name: /Open main menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    // 3. Navigate to Shop via mobile menu drawer
    const drawer = page.locator("#mobile-navigation-drawer");
    await expect(drawer).toBeVisible();
    const shopLink = drawer.getByRole("link", { name: "Shop", exact: true });
    await expect(shopLink).toBeVisible();
    await shopLink.click();

    await expect(page).toHaveURL(/\/mini-sprouts\/shop/);
    await expect(page.getByText(SEEDED_PRODUCTS.kurta.name).first()).toBeVisible();

    // 4. Navigate to Product PDP
    await page
      .getByRole("link", { name: new RegExp(SEEDED_PRODUCTS.kurta.name) })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(SEEDED_PRODUCTS.kurta.pdpPath));
    await expect(
      page.getByRole("heading", { level: 1, name: SEEDED_PRODUCTS.kurta.name })
    ).toBeVisible();

    // 5. Select Variant (Color & Size) on mobile
    const colorBtn = page.getByRole("button", {
      name: SEEDED_PRODUCTS.kurta.availableColor,
      exact: false,
    });
    await expect(colorBtn).toBeVisible();
    await colorBtn.click();

    const sizeBtn = page.getByRole("button", {
      name: SEEDED_PRODUCTS.kurta.availableSize,
      exact: false,
    });
    await expect(sizeBtn).toBeVisible();
    await sizeBtn.click();

    // Add to Cart
    const addToCartBtn = page.getByRole("button", { name: /Add.*to cart/i });
    await expect(addToCartBtn).toBeEnabled();
    await addToCartBtn.click();

    // 6. Navigate to Cart via header icon
    const cartIcon = page.getByRole("link", { name: /Shopping Cart/i });
    await expect(cartIcon).toBeVisible();
    await cartIcon.click();

    await expect(page).toHaveURL(/\/cart/);
    await expect(page.getByText(SEEDED_PRODUCTS.kurta.name).first()).toBeVisible();

    // 7. Proceed to Checkout
    const checkoutLink = page.getByRole("link", { name: /Proceed to Checkout/i });
    await expect(checkoutLink).toBeVisible();
    await checkoutLink.click();

    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText("Delivery Details")).toBeVisible();

    // 8. Verify No Horizontal Overflow on mobile checkout page
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 9. Complete mobile checkout (COD)
    await page.getByLabel(/Full Name/i).fill("Ayesha Mobile Shopper");
    await page.getByLabel(/Phone Number/i).fill("03001239876");
    await page.getByLabel(/Street Address/i).fill("Street 4, Sector G-9");
    await page.getByLabel(/City/i).fill("Islamabad");
    await page.getByLabel(/Province/i).fill("Islamabad Capital");

    // Review Order step
    const reviewBtn = page.getByRole("button", { name: /Review Order/i });
    await reviewBtn.scrollIntoViewIfNeeded();
    await reviewBtn.click();

    await expect(page.getByTestId("checkout-reviewed-state")).toBeVisible();

    // Place Order step
    const placeOrderBtn = page.getByTestId("place-order-button");
    await placeOrderBtn.scrollIntoViewIfNeeded();
    await placeOrderBtn.click();

    // 10. Verify Order Success
    await expect(page).toHaveURL(/\/order-success\?orderNumber=KW-/);
    await expect(page.getByRole("heading", { name: "Thank You for Your Order" })).toBeVisible();
    await expect(page.getByText("Order Reference Number", { exact: true })).toBeVisible();
  });
});
