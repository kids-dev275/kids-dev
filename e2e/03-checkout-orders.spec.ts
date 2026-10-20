import { test, expect } from "@playwright/test";
import { SEEDED_PRODUCTS } from "./fixtures/test-data";
import { getE2ePrisma } from "./helpers/db";

test.describe("03. Guest Checkout (COD & Bank Transfer)", () => {
  test("8. Critical Path: Guest COD Checkout completes with dynamic delivery charge and Order Success (ORDER_RECEIVED)", async ({
    page,
  }) => {
    // 1. Add item to cart
    await page.goto(SEEDED_PRODUCTS.kurta.pdpPath);
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableColor, exact: false })
      .click();
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableSize, exact: false })
      .click();
    await page.getByRole("button", { name: /Add.*to cart/i }).click();
    await expect(page.getByRole("status")).toContainText(/Added to cart/i);

    // 2. Navigate to Checkout
    await page.goto("/checkout");
    await expect(page.getByText("Delivery Details")).toBeVisible();

    // 3. Enter required guest customer information
    await page.getByLabel(/Full Name/i).fill("E2E Guest Customer");
    await page.getByLabel(/Phone Number/i).fill("03001234567");
    await page.getByLabel(/Email/i).fill("e2e-guest-checkout@example.com");
    await page.getByLabel(/Street Address/i).fill("House 42, Street 8, Sector F-7");
    await page.getByLabel(/City/i).fill("Islamabad");
    await page.getByLabel(/Province/i).fill("Federal");

    // 4. Verify COD is selected
    const codRadio = page.locator('input[value="CASH_ON_DELIVERY"]');
    await expect(codRadio).toBeChecked();

    // 5. Submit form to transition to Reviewed State
    const reviewOrderBtn = page.getByRole("button", { name: /Review Order/i });
    await reviewOrderBtn.click();

    // 6. Assert Reviewed State is active
    await expect(page.getByTestId("checkout-reviewed-state")).toBeVisible();
    await expect(page.getByText("Order Details Verified")).toBeVisible();
    await expect(page.getByText("Rs. 300").first()).toBeVisible(); // Flat delivery charge from settings

    // 7. Place Order
    const placeOrderBtn = page.getByTestId("place-order-button");
    await expect(placeOrderBtn).toBeVisible();
    await placeOrderBtn.click();

    // 8. Order Success
    await expect(page).toHaveURL(/\/order-success\?orderNumber=KW-/);
    const orderNumberDisplay = page.getByTestId("order-number-display");
    await expect(orderNumberDisplay).toBeVisible();
    const orderNumberText = await orderNumberDisplay.innerText();
    expect(orderNumberText).toMatch(/^KW-\d+$/);

    // 9. Verify database snapshot
    const prisma = getE2ePrisma();
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderNumberText },
      include: { items: true, statusHistory: true },
    });

    expect(order).not.toBeNull();
    expect(order?.paymentMethod).toBe("CASH_ON_DELIVERY");
    expect(order?.status).toBe("ORDER_RECEIVED");
    expect(order?.customerId).toBeNull(); // Guest order
    expect(order?.items.length).toBeGreaterThanOrEqual(1);
    expect(order?.deliveryCharge.toString()).toBe("300");
  });

  test("9. Critical Path: Guest Manual Bank Transfer Checkout displays bank details and sets status to AWAITING_PAYMENT", async ({
    page,
  }) => {
    // 1. Add item to cart
    await page.goto(SEEDED_PRODUCTS.kurta.pdpPath);
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableColor, exact: false })
      .click();
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableSize, exact: false })
      .click();
    await page.getByRole("button", { name: /Add.*to cart/i }).click();

    // 2. Navigate to Checkout
    await page.goto("/checkout");
    await expect(page.getByText("Delivery Details")).toBeVisible();

    // 3. Fill details
    await page.getByLabel(/Full Name/i).fill("E2E Bank Buyer");
    await page.getByLabel(/Phone Number/i).fill("03219876543");
    await page.getByLabel(/Street Address/i).fill("Apartment 5B, Street 10");
    await page.getByLabel(/City/i).fill("Lahore");
    await page.getByLabel(/Province/i).fill("Punjab");

    // 4. Select Manual Bank Transfer
    const bankRadio = page.locator('input[value="BANK_TRANSFER"]');
    await bankRadio.check();
    await expect(bankRadio).toBeChecked();

    // Verify configured bank details are rendered dynamically
    const bankDetails = page.getByTestId("bank-transfer-details");
    await expect(bankDetails).toBeVisible();
    await expect(bankDetails).toContainText("Meezan Bank");
    await expect(bankDetails).toContainText("PK36MEZN0001234567890102");

    // 5. Review Order
    await page.getByRole("button", { name: /Review Order/i }).click();
    await expect(page.getByTestId("checkout-reviewed-state")).toBeVisible();

    // 6. Place Order
    const placeOrderBtn = page.getByTestId("place-order-button");
    await placeOrderBtn.click();

    // 7. Order Success
    await expect(page).toHaveURL(/\/order-success\?orderNumber=KW-/);
    const orderNumberDisplay = page.getByTestId("order-number-display");
    const orderNumberText = await orderNumberDisplay.innerText();
    expect(orderNumberText).toMatch(/^KW-\d+$/);

    // 8. Verify database snapshot
    const prisma = getE2ePrisma();
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderNumberText },
    });

    expect(order).not.toBeNull();
    expect(order?.paymentMethod).toBe("BANK_TRANSFER");
    expect(order?.status).toBe("AWAITING_PAYMENT");
    expect(order?.customerId).toBeNull();
  });
});
