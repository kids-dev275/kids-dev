import { test, expect } from "@playwright/test";
import {
  generateTestCustomerEmail,
  TEST_CUSTOMER_PASSWORD,
  SEEDED_PRODUCTS,
} from "./fixtures/test-data";
import { getE2ePrisma } from "./helpers/db";

test.describe("04. Customer Account, Authenticated Orders & Non-Claim Invariant", () => {
  test("10. Customer registration, account dashboard access, profile update, and logout", async ({
    page,
  }) => {
    const customerEmail = generateTestCustomerEmail();

    // 1. Register
    await page.goto("/account/register");
    await expect(page.getByRole("heading", { level: 1, name: /Create an Account/i })).toBeVisible();

    await page.getByLabel(/Full Name/i).fill("E2E Test Customer");
    await page.getByLabel(/Email Address/i).fill(customerEmail);
    await page.getByLabel(/Phone Number/i).fill("03009998877");
    await page.getByLabel(/^Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByLabel(/Confirm Password/i).fill(TEST_CUSTOMER_PASSWORD);

    await page.getByRole("button", { name: /Create Account/i }).click();

    // 2. Redirect to Account Dashboard
    await expect(page.getByRole("heading", { level: 1, name: /Welcome/i })).toBeVisible();

    // 3. Profile Update
    await page.goto("/account/profile");
    await expect(page.getByRole("heading", { level: 2, name: /Profile Settings/i })).toBeVisible();
    const nameInput = page.getByLabel("Full Name", { exact: false });
    await nameInput.fill("E2E Updated Customer");
    await page.getByRole("button", { name: /Save Changes/i }).click();
    await expect(page.getByText(/successfully updated/i)).toBeVisible();

    // 4. Logout
    const logoutBtn = page.getByRole("button", { name: /Sign Out|Logout/i }).first();
    await logoutBtn.click();

    // 5. Protected route redirection
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test("11. Authenticated customer checkout creates linked Order that appears in Account Order History", async ({
    page,
  }) => {
    const customerEmail = generateTestCustomerEmail();

    // 1. Register Customer
    await page.goto("/account/register");
    await page.getByLabel(/Full Name/i).fill("E2E Auth Shopper");
    await page.getByLabel(/Email Address/i).fill(customerEmail);
    await page.getByLabel(/Phone Number/i).fill("03001112233");
    await page.getByLabel(/^Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByLabel(/Confirm Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: /Create Account/i }).click();
    await expect(page).toHaveURL(/\/account$/);

    // 2. Add product to cart as authenticated customer
    await page.goto(SEEDED_PRODUCTS.kurta.pdpPath);
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableColor, exact: false })
      .click();
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableSize, exact: false })
      .click();
    await page.getByRole("button", { name: /Add.*to cart/i }).click();

    // 3. Checkout
    await page.goto("/checkout");
    await page.getByLabel(/Full Name/i).fill("E2E Auth Shopper");
    await page.getByLabel(/Phone Number/i).fill("03001112233");
    await page.getByLabel(/Street Address/i).fill("Street 10, House 5");
    await page.getByLabel(/City/i).fill("Rawalpindi");
    await page.getByLabel(/Province/i).fill("Punjab");

    await page.getByRole("button", { name: /Review Order/i }).click();
    await expect(page.getByTestId("checkout-reviewed-state")).toBeVisible();

    await page.getByTestId("place-order-button").click();
    await expect(page).toHaveURL(/\/order-success\?orderNumber=KW-/);

    const orderNumberText = await page.getByTestId("order-number-display").innerText();

    // 4. Navigate to Customer Account Orders
    await page.goto("/account/orders");
    await expect(page.getByText(orderNumberText)).toBeVisible();

    // 5. Open Order Detail
    await page.getByRole("link", { name: new RegExp(orderNumberText) }).click();
    await expect(page).toHaveURL(new RegExp(`/account/orders/${orderNumberText}`));
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(`Order ${orderNumberText}`) })
    ).toBeVisible();
    await expect(page.getByText(SEEDED_PRODUCTS.kurta.name).first()).toBeVisible();

    // 6. Verify in DB that customerId is attached
    const prisma = getE2ePrisma();
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderNumberText },
    });
    expect(order?.customerId).not.toBeNull();
  });

  test("12. Guest Order Non-Claim Regression: Past guest orders are NEVER claimed when a customer later registers with the same email", async ({
    page,
  }) => {
    const sharedEmail = generateTestCustomerEmail();

    // 1. Guest places an order with sharedEmail
    await page.goto(SEEDED_PRODUCTS.kurta.pdpPath);
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableColor, exact: false })
      .click();
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableSize, exact: false })
      .click();
    await page.getByRole("button", { name: /Add.*to cart/i }).click();

    await page.goto("/checkout");
    await page.getByLabel(/Full Name/i).fill("Guest Email Owner");
    await page.getByLabel(/Phone Number/i).fill("03451234567");
    await page.getByLabel(/Email/i).fill(sharedEmail);
    await page.getByLabel(/Street Address/i).fill("House 1, Street 2");
    await page.getByLabel(/City/i).fill("Peshawar");
    await page.getByLabel(/Province/i).fill("KPK");

    await page.getByRole("button", { name: /Review Order/i }).click();
    await expect(page.getByTestId("checkout-reviewed-state")).toBeVisible();

    await page.getByTestId("place-order-button").click();
    await expect(page).toHaveURL(/\/order-success\?orderNumber=KW-/);
    const guestOrderNumber = await page.getByTestId("order-number-display").innerText();

    // 2. Clear browser state/cookies and later register using the same email
    await page.context().clearCookies();

    await page.goto("/account/register");
    await page.getByLabel(/Full Name/i).fill("Registered Email Owner");
    await page.getByLabel(/Email Address/i).fill(sharedEmail);
    await page.getByLabel(/Phone Number/i).fill("03451234567");
    await page.getByLabel(/^Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByLabel(/Confirm Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: /Create Account/i }).click();
    await expect(page).toHaveURL(/\/account$/);

    // 3. Inspect Customer Order History
    await page.goto("/account/orders");

    // The guest order must NOT appear
    await expect(page.getByText(guestOrderNumber)).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: /No orders yet/i })).toBeVisible();

    // 4. Verify in DB that customerId remains null on the guest order
    const prisma = getE2ePrisma();
    const guestOrderInDb = await prisma.order.findUnique({
      where: { orderNumber: guestOrderNumber },
    });
    expect(guestOrderInDb?.customerId).toBeNull();
  });

  test("36. Customer Order Ownership Isolation: Customer B cannot access Customer A order detail and receives safe 404", async ({
    page,
  }) => {
    const customerAEmail = generateTestCustomerEmail();
    const customerBEmail = generateTestCustomerEmail();

    // 1. Register Customer A
    await page.goto("/account/register");
    await page.getByLabel(/Full Name/i).fill("Customer Alpha");
    await page.getByLabel(/Email Address/i).fill(customerAEmail);
    await page.getByLabel(/Phone Number/i).fill("03001111111");
    await page.getByLabel(/^Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByLabel(/Confirm Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: /Create Account/i }).click();
    await expect(page).toHaveURL(/\/account$/);

    // 2. Customer A places Order via UI
    await page.goto(SEEDED_PRODUCTS.kurta.pdpPath);
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableColor, exact: false })
      .click();
    await page
      .getByRole("button", { name: SEEDED_PRODUCTS.kurta.availableSize, exact: false })
      .click();
    await page.getByRole("button", { name: /Add.*to cart/i }).click();

    await page.goto("/checkout");
    await page.getByLabel(/Full Name/i).fill("Customer Alpha");
    await page.getByLabel(/Phone Number/i).fill("03001111111");
    await page.getByLabel(/Street Address/i).fill("House Alpha, Street 1");
    await page.getByLabel(/City/i).fill("Lahore");
    await page.getByLabel(/Province/i).fill("Punjab");

    await page.getByRole("button", { name: /Review Order/i }).click();
    await expect(page.getByTestId("checkout-reviewed-state")).toBeVisible();
    await page.getByTestId("place-order-button").click();
    await expect(page).toHaveURL(/\/order-success\?orderNumber=KW-/);

    const orderNumberA = await page.getByTestId("order-number-display").innerText();

    // Verify order appears in Customer A's history
    await page.goto("/account/orders");
    await expect(page.getByText(orderNumberA)).toBeVisible();

    // 3. Customer A logs out
    await page.goto("/account/profile");
    await page
      .getByRole("button", { name: /Sign Out|Logout/i })
      .first()
      .click();
    await page.waitForURL(/\/account\/login/);

    // 4. Customer B registers
    await page.goto("/account/register");
    await page.getByLabel(/Full Name/i).fill("Customer Beta");
    await page.getByLabel(/Email Address/i).fill(customerBEmail);
    await page.getByLabel(/Phone Number/i).fill("03002222222");
    await page.getByLabel(/^Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByLabel(/Confirm Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: /Create Account/i }).click();
    await expect(page).toHaveURL(/\/account$/);

    // 5. Customer B attempts to open Customer A's order detail URL directly
    await page.goto(`/account/orders/${orderNumberA}`);

    // Must display established ownership-safe error state
    await expect(page.getByRole("heading", { level: 2, name: /Order Not Found/i })).toBeVisible();
    await expect(
      page.getByText(/Order not found\. It may have been placed under a different account/i)
    ).toBeVisible();

    // Ensure Customer A's address or name is NEVER leaked
    await expect(page.getByText("House Alpha, Street 1")).not.toBeVisible();
    await expect(page.getByText("Customer Alpha")).not.toBeVisible();
  });
});
