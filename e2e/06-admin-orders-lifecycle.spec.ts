import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { E2E_ADMIN_CREDENTIALS, SEEDED_PRODUCTS } from "./fixtures/test-data";
import { getE2ePrisma } from "./helpers/db";

test.describe("06. Admin Order Management & Fulfillment Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    // Login as Admin before each scenario
    await page.goto("/admin/login");
    await page.locator("#admin-email").fill(E2E_ADMIN_CREDENTIALS.email);
    await page.locator("#admin-password").fill(E2E_ADMIN_CREDENTIALS.password);
    await page.getByRole("button", { name: /Sign In to Admin/i }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("21. COD Order full progression: ORDER_RECEIVED -> CONFIRMED -> IN_PRODUCTION -> READY_TO_SHIP -> SHIPPED -> DELIVERED", async ({
    page,
    request,
  }) => {
    // 1. Create a fresh COD Order via API for predictable isolation
    const prisma = getE2ePrisma();
    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: SEEDED_PRODUCTS.kurta.sku },
      include: { variants: true },
    });
    const variant = product.variants.find((v) => v.isAvailable)!;

    // Checkout creation via backend
    const createRes = await request.post("http://127.0.0.1:4000/api/v1/orders", {
      data: {
        idempotencyKey: crypto.randomUUID(),
        customer: {
          fullName: "Fulfillment Test Shopper",
          phone: "03001234567",
          address: "House 1, Street 1",
          city: "Lahore",
          province: "Punjab",
        },
        paymentMethod: "CASH_ON_DELIVERY",
        items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createJson = await createRes.json();
    const orderNumber = createJson.data.orderNumber;

    // 2. Open Order Detail in Admin
    await page.goto(`/admin/orders/${orderNumber}`);
    await expect(
      page.getByText(`Order Details: ${orderNumber}`).or(page.getByText(orderNumber).first())
    ).toBeVisible();
    await expect(page.getByText("Order Received").first()).toBeVisible();

    // 3. ORDER_RECEIVED -> CONFIRMED
    await page.getByRole("button", { name: /Confirm Order/i }).click();
    await expect(page.getByText(/Order status updated to Confirmed/i)).toBeVisible();

    // 4. CONFIRMED -> IN_PRODUCTION
    await page.getByRole("button", { name: /Send to Production/i }).click();
    await expect(
      page.getByText(/Order status updated to Stitching \/ In Production/i)
    ).toBeVisible();

    // 5. IN_PRODUCTION -> READY_TO_SHIP
    await page.getByRole("button", { name: /Mark Ready to Ship/i }).click();
    await expect(page.getByText(/Order status updated to Ready to Ship/i)).toBeVisible();

    // 6. READY_TO_SHIP -> SHIPPED
    await page.getByRole("button", { name: /Dispatch \/ Mark Shipped/i }).click();
    await expect(page.getByText(/Order status updated to Shipped/i)).toBeVisible();

    // 7. SHIPPED -> DELIVERED
    await page.getByRole("button", { name: /Mark Delivered/i }).click();
    await expect(page.getByText(/Order status updated to Delivered/i)).toBeVisible();

    // 8. Verify terminal state guidance is displayed
    await expect(page.getByText(/This order is in a terminal state/i)).toBeVisible();

    // 9. Verify database history contains all steps
    const updatedOrder = await prisma.order.findUnique({
      where: { orderNumber },
      include: { statusHistory: true },
    });
    expect(updatedOrder?.status).toBe("DELIVERED");
    expect(updatedOrder?.statusHistory.length).toBe(6);
  });

  test("22. Bank Transfer Order payment verification: AWAITING_PAYMENT -> CONFIRMED", async ({
    page,
    request,
  }) => {
    const prisma = getE2ePrisma();
    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: SEEDED_PRODUCTS.kurta.sku },
      include: { variants: true },
    });
    const variant = product.variants.find((v) => v.isAvailable)!;

    // Create Bank Transfer Order
    const createRes = await request.post("http://127.0.0.1:4000/api/v1/orders", {
      data: {
        idempotencyKey: crypto.randomUUID(),
        customer: {
          fullName: "Bank Verification Buyer",
          phone: "03009876543",
          address: "House 2, Street 2",
          city: "Islamabad",
          province: "Federal",
        },
        paymentMethod: "BANK_TRANSFER",
        items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createJson = await createRes.json();
    const orderNumber = createJson.data.orderNumber;

    // Open in Admin
    await page.goto(`/admin/orders/${orderNumber}`);
    await expect(page.getByText("Awaiting Payment").first()).toBeVisible();

    // Click Confirm Payment / Confirm Order
    await page.getByRole("button", { name: /Confirm Payment \/ Confirm Order/i }).click();
    await expect(page.getByText(/Order status updated to Confirmed/i)).toBeVisible();

    // Verify DB
    const dbOrder = await prisma.order.findUnique({ where: { orderNumber } });
    expect(dbOrder?.status).toBe("CONFIRMED");
  });

  test("23. Admin Cancellation flow: Pre-shipment Order transitions to terminal CANCELLED with dialog confirmation", async ({
    page,
    request,
  }) => {
    const prisma = getE2ePrisma();
    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: SEEDED_PRODUCTS.kurta.sku },
      include: { variants: true },
    });
    const variant = product.variants.find((v) => v.isAvailable)!;

    // Create Order to cancel
    const createRes = await request.post("http://127.0.0.1:4000/api/v1/orders", {
      data: {
        idempotencyKey: crypto.randomUUID(),
        customer: {
          fullName: "Cancel Test Buyer",
          phone: "03331112233",
          address: "Flat 12",
          city: "Karachi",
          province: "Sindh",
        },
        paymentMethod: "CASH_ON_DELIVERY",
        items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createJson = await createRes.json();
    const orderNumber = createJson.data.orderNumber;

    // Navigate to Admin
    await page.goto(`/admin/orders/${orderNumber}`);

    // Accept cancellation dialog automatically
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // Click Cancel Order
    await page.getByRole("button", { name: /Cancel Order/i }).click();
    await expect(page.getByText(/Order status updated to Cancelled/i)).toBeVisible();

    // Terminal notice
    await expect(page.getByText(/This order is in a terminal state \(Cancelled\)/i)).toBeVisible();

    // Verify DB
    const cancelledOrder = await prisma.order.findUnique({ where: { orderNumber } });
    expect(cancelledOrder?.status).toBe("CANCELLED");
  });
});
