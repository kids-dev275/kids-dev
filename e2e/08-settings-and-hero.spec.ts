import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { E2E_ADMIN_CREDENTIALS, SEEDED_PRODUCTS } from "./fixtures/test-data";
import { getE2ePrisma } from "./helpers/db";

test.describe("08. Commerce Settings, Announcement Bar & Hero Integration", () => {
  test.beforeEach(async ({ page }) => {
    // Login as Admin
    await page.goto("/admin/login");
    await page.locator("#admin-email").fill(E2E_ADMIN_CREDENTIALS.email);
    await page.locator("#admin-password").fill(E2E_ADMIN_CREDENTIALS.password);
    await page.getByRole("button", { name: /Sign In to Admin/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("28 & 29. Shipping settings update propagates dynamically to Checkout while preserving historical order totals", async ({
    page,
    request,
  }) => {
    const prisma = getE2ePrisma();

    // 1. Create a historical Order with current 300 delivery charge
    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: SEEDED_PRODUCTS.kurta.sku },
      include: { variants: true },
    });
    const variant = product.variants.find((v) => v.isAvailable)!;

    const historicalRes = await request.post("http://127.0.0.1:4000/api/v1/orders", {
      data: {
        idempotencyKey: crypto.randomUUID(),
        customer: {
          fullName: "Historical Shipping Customer",
          phone: "03001112233",
          address: "House 99",
          city: "Lahore",
          province: "Punjab",
        },
        paymentMethod: "CASH_ON_DELIVERY",
        items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
      },
    });
    expect(historicalRes.ok()).toBeTruthy();
    const historicalJson = await historicalRes.json();
    const historicalOrderNumber = historicalJson.data.orderNumber;

    // 2. Admin Settings: Update Flat Delivery Charge to 450.00
    await page.goto("/admin/settings");
    await expect(page.getByText("Shipping & Delivery Charge")).toBeVisible();

    const deliveryInput = page.locator('input[placeholder="250.00"]');
    await deliveryInput.fill("450.00");
    await page.getByRole("button", { name: /Save Delivery Charge/i }).click();
    await expect(page.getByText(/Flat delivery charge saved/i)).toBeVisible();

    // 3. Verify public Checkout reflects the updated delivery charge (Rs. 450)
    // Add item to cart
    await page.goto(SEEDED_PRODUCTS.kurta.pdpPath);
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableColor, exact: false })
      .click();
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableSize, exact: false })
      .click();
    await page.getByRole("button", { name: /Add.*to cart/i }).click();

    await page.goto("/checkout");
    await expect(page.getByText("Rs. 450").first()).toBeVisible();

    // 29. Historical Order Preservation
    const historicalOrder = await prisma.order.findUnique({
      where: { orderNumber: historicalOrderNumber },
    });
    expect(historicalOrder?.deliveryCharge.toString()).toBe("300");

    // Restore delivery charge to 300.00
    await page.goto("/admin/settings");
    await page.locator('input[placeholder="250.00"]').fill("300.00");
    await page.getByRole("button", { name: /Save Delivery Charge/i }).click();
    await expect(page.getByText(/Flat delivery charge saved/i)).toBeVisible();
  });

  test("30. Bank settings update propagates dynamically to Checkout details", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page.getByText("Manual Bank Transfer Details")).toBeVisible();

    const bankNameInput = page.getByPlaceholder(/Meezan Bank/i);
    await bankNameInput.fill("Habib Bank Limited (HBL)");
    await page.getByRole("button", { name: /Save Bank Details/i }).click();
    await expect(page.getByText(/Bank transfer settings saved/i)).toBeVisible();

    // Verify in Checkout
    await page.goto(SEEDED_PRODUCTS.kurta.pdpPath);
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableColor, exact: false })
      .click();
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableSize, exact: false })
      .click();
    await page.getByRole("button", { name: /Add.*to cart/i }).click();

    await page.goto("/checkout");
    await page.locator('input[value="BANK_TRANSFER"]').check();
    await expect(page.getByTestId("bank-transfer-details")).toContainText(
      "Habib Bank Limited (HBL)"
    );

    // Restore to Meezan Bank
    await page.goto("/admin/settings");
    await page.getByPlaceholder(/Meezan Bank/i).fill("Meezan Bank");
    await page.getByRole("button", { name: /Save Bank Details/i }).click();
    await expect(page.getByText(/Bank transfer settings saved/i)).toBeVisible();
  });

  test("31. Announcement Bar: activation, content change, and deactivation reflect across storefront", async ({
    page,
  }) => {
    const announcementText = "E2E Special: 10-day Nationwide Delivery on all orders!";

    await page.goto("/admin/settings");
    await expect(page.getByText("Storefront Announcement Bar")).toBeVisible();

    // Set announcement text and activate
    await page
      .locator('input[placeholder*="Complimentary standard delivery"]')
      .fill(announcementText);
    const activeCheckbox = page.locator('input[type="checkbox"]').first();
    if (!(await activeCheckbox.isChecked())) {
      await activeCheckbox.check();
    }

    await page.getByRole("button", { name: /Save Announcement/i }).click();
    await expect(page.getByText(/Announcement bar settings saved/i)).toBeVisible();

    // Verify public storefront renders Announcement
    await page.goto("/mini-sprouts");
    await expect(page.getByText(announcementText).first()).toBeVisible();

    // Deactivate Announcement
    await page.goto("/admin/settings");
    await page.locator('input[type="checkbox"]').first().uncheck();
    await page.getByRole("button", { name: /Save Announcement/i }).click();
    await expect(page.getByText(/Announcement bar settings saved/i)).toBeVisible();

    // Verify it disappears from public storefront
    await page.goto("/mini-sprouts");
    await expect(page.getByText(announcementText)).not.toBeVisible();
  });

  test("32. Hero management: Storefront Hero reflects authoritative content", async ({ page }) => {
    // Navigate to Admin Storefronts
    await page.goto("/admin/storefronts");
    await expect(
      page.getByRole("heading", { name: /Storefronts & Hero Management/i })
    ).toBeVisible();
    await expect(page.getByText("E2E Mini Sprouts Collection").first()).toBeVisible();

    // Verify public storefront reflects the hero slide
    await page.goto("/mini-sprouts");
    await expect(page.getByText("E2E Mini Sprouts Collection").first()).toBeVisible();
  });
});
