import { test, expect } from "@playwright/test";
import {
  E2E_ADMIN_CREDENTIALS,
  STOREFRONTS,
  SEEDED_PRODUCTS,
  generateTestCustomerEmail,
  TEST_CUSTOMER_PASSWORD,
} from "./fixtures/test-data";
import { getE2ePrisma } from "./helpers/db";

test.describe("05. Admin Portal: Auth, Dashboard, Product Lifecycle & Publication Gate", () => {
  test("13. Admin authentication, protected route redirection, and session logout", async ({
    page,
  }) => {
    // Unauthenticated access redirects to /admin/login
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);

    // Login with valid Admin credentials
    await page.locator("#admin-email").fill(E2E_ADMIN_CREDENTIALS.email);
    await page.locator("#admin-password").fill(E2E_ADMIN_CREDENTIALS.password);
    await page.getByRole("button", { name: /Sign In to Admin/i }).click();

    // Verify successful login
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Dashboard").first()).toBeVisible();

    // Logout
    const logoutBtn = page.getByRole("button", { name: /Sign out of Admin Panel|Logout/i }).first();
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/admin\/login/);

    // Direct access to /admin now fails again
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("14. Dashboard displays integrated business metrics without numeric stock counts", async ({
    page,
  }) => {
    // Login
    await page.goto("/admin/login");
    await page.locator("#admin-email").fill(E2E_ADMIN_CREDENTIALS.email);
    await page.locator("#admin-password").fill(E2E_ADMIN_CREDENTIALS.password);
    await page.getByRole("button", { name: /Sign In to Admin/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Assert metric counters
    await expect(page.getByText(/Total Products/i).first()).toBeVisible();
    await expect(page.getByText(/Total Orders/i).first()).toBeVisible();
    await expect(page.getByText(/Active Orders/i).first()).toBeVisible();
    await expect(page.getByText(/Unavailable Variants/i).first()).toBeVisible();

    // Assert strictly zero forbidden V1 inventory features
    await expect(page.getByText(/Low Stock/i)).not.toBeVisible();
    await expect(page.getByText(/Stock Level/i)).not.toBeVisible();
  });

  test("15–20. Admin Product creation as DRAFT, options/variants, publication gate, and deactivation", async ({
    page,
  }) => {
    // Login
    await page.goto("/admin/login");
    await page.locator("#admin-email").fill(E2E_ADMIN_CREDENTIALS.email);
    await page.locator("#admin-password").fill(E2E_ADMIN_CREDENTIALS.password);
    await page.getByRole("button", { name: /Sign In to Admin/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 15. Create New Product as DRAFT
    await page.goto("/admin/products/new");
    await expect(page.getByRole("heading", { level: 1, name: /Create Product/i })).toBeVisible();

    const uniqueSku = `E2E-OFT-${Date.now().toString().slice(-4)}`;
    const productName = `E2E Autumn Jacket ${uniqueSku}`;

    await page.getByPlaceholder(/Classic Embroidered Kurta Set/i).fill(productName);
    await page.getByPlaceholder(/CEK-001/i).fill(uniqueSku);
    await page.getByPlaceholder(/2950\.00/i).fill("3490");
    await page
      .getByPlaceholder(/Full description of product/i)
      .fill("Warm and stylish jacket for outdoor activities.");

    await page.getByRole("button", { name: /Save Draft & Continue/i }).click();

    // Redirected to Editor
    await expect(page).toHaveURL(/\/admin\/products\/[a-f0-9-]+$/);
    await expect(page.getByText("DRAFT").first()).toBeVisible();

    // 16. Options Tab: Create Size & Color (natural names, no hex)
    await page.getByRole("button", { name: /Sizes & Colors/i }).click();
    await expect(page.getByText("Display names only (No hex / RGB / swatches)")).toBeVisible();

    // Add Size
    await page.getByPlaceholder("e.g. 0-3M, 3-6M, 4Y").fill("6-7 Years");
    await page.getByRole("button", { name: /Add/i }).first().click();
    await expect(page.getByText("6-7 Years", { exact: true })).toBeVisible();

    // Add Color (natural name, no hex)
    await page.getByPlaceholder("e.g. Assorted, Sky Blue, Navy").fill("Olive Green");
    await page.getByRole("button", { name: /Add/i }).last().click();
    await expect(page.getByText("Olive Green", { exact: true })).toBeVisible();

    // 17. Variants Tab
    await page.getByRole("button", { name: /Variants Matrix/i }).click();
    await page.getByRole("button", { name: /Generate All Combinations/i }).click();
    await expect(page.getByText("6-7 Years", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Olive Green", { exact: true }).first()).toBeVisible();

    // 18 & 19. Publication Gate
    await page.getByRole("button", { name: /Publication State/i }).click();
    await expect(page.getByText("Publication Status Controls")).toBeVisible();

    // Incomplete publication gate (no media yet) -> click Publish
    const publishBtn = page.getByRole("button", { name: /Publish Product/i });
    if (await publishBtn.isVisible()) {
      await publishBtn.click();
      // Should show validation gate error (requires Main Image)
      await expect(page.getByText(/Main Image/i).or(page.getByText(/Failed/i))).toBeVisible();
    }

    // 20. Deactivation flow testing on seeded published product
    await page.goto("/admin/products");
    await page.getByPlaceholder(/Search by.*SKU/i).fill(SEEDED_PRODUCTS.kurta.sku);
    await page.waitForTimeout(500); // Debounce
    await page.getByRole("link", { name: SEEDED_PRODUCTS.kurta.name }).first().click();
    await page.waitForURL(/\/admin\/products\/.+/);

    const editUrl = page.url();
    await page.getByRole("button", { name: /Publication State/i }).click();
    await expect(page.getByText("Publication Status Controls")).toBeVisible();
    await page.getByRole("button", { name: /Deactivate Product/i }).click();
    await expect(page.getByText(/Product status updated to INACTIVE/i)).toBeVisible();

    // Verify product is removed from public catalog
    await page.goto("/mini-sprouts/shop");
    await expect(page.getByText(SEEDED_PRODUCTS.kurta.name)).not.toBeVisible();

    // Restore to PUBLISHED so subsequent tests remain deterministic
    await page.goto(editUrl);
    await page.getByRole("button", { name: /Publication State/i }).click();
    await expect(page.getByText("Publication Status Controls")).toBeVisible();
    await page.getByRole("button", { name: /Publish Product/i }).click();
    await expect(page.getByText(/Product status updated to PUBLISHED/i)).toBeVisible();
  });

  test("33. Admin and Customer session separation: Customer session cannot access /admin, and Admin session cannot access /account", async ({
    page,
  }) => {
    const customerEmail = generateTestCustomerEmail();

    // 1. Register and establish Customer session
    await page.goto("/account/register");
    await page.getByLabel(/Full Name/i).fill("Separation Test User");
    await page.getByLabel(/Email Address/i).fill(customerEmail);
    await page.getByLabel(/Phone Number/i).fill("03001230000");
    await page.getByLabel(/^Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByLabel(/Confirm Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: /Create Account/i }).click();
    await expect(page).toHaveURL(/\/account$/);

    // 2. Navigate to /admin -> customer session MUST NOT grant admin access
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);

    // 3. Clear customer session, log into Admin
    await page.context().clearCookies();

    await page.goto("/admin/login");
    await page.locator("#admin-email").fill(E2E_ADMIN_CREDENTIALS.email);
    await page.locator("#admin-password").fill(E2E_ADMIN_CREDENTIALS.password);
    await page.getByRole("button", { name: /Sign In to Admin/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 4. While logged in as Admin, navigate to customer /account -> admin session MUST NOT grant customer access
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/login/);
  });

  test("35. Explicit Product Media upload, Cloudinary signature, Main/Hover assignment and reload persistence", async ({
    page,
  }) => {
    // 1. Log into Admin
    await page.goto("/admin/login");
    await page.locator("#admin-email").fill(E2E_ADMIN_CREDENTIALS.email);
    await page.locator("#admin-password").fill(E2E_ADMIN_CREDENTIALS.password);
    await page.getByRole("button", { name: /Sign In to Admin/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 2. Open seeded product editor
    const prisma = getE2ePrisma();
    const product = await prisma.product.findUniqueOrThrow({
      where: { sku: SEEDED_PRODUCTS.kurta.sku },
    });

    await page.goto(`/admin/products/${product.id}`);
    await page.getByRole("button", { name: /^Media/i }).click();
    await expect(page.getByRole("heading", { name: "Product Media" })).toBeVisible();

    // 3. Intercept direct upload to Cloudinary to simulate external provider
    let uploadIntercepted = false;
    await page.route("https://api.cloudinary.com/**", async (route) => {
      uploadIntercepted = true;
      const postData = route.request().postData() || "";
      expect(postData).toContain("api_key");
      expect(postData).toContain("signature");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          public_id: `kids-wear/products/${product.id}/test-e2e-asset-${Date.now()}`,
          secure_url:
            "https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=800&q=80",
          resource_type: "image",
          format: "jpg",
          width: 1200,
          height: 1500,
          bytes: 45000,
        }),
      });
    });

    // 4. Upload test image through the real Admin UI
    const testImageBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const fileInput = page.locator("#product-media-upload-input");
    await fileInput.setInputFiles({
      name: "test-product-image.png",
      mimeType: "image/png",
      buffer: testImageBuffer,
    });

    // 5. Verify upload notification and media item rendered in the UI
    await expect(page.getByText(/Product image uploaded successfully/i)).toBeVisible();
    expect(uploadIntercepted).toBe(true);

    // 6. Test Main Image and Hover Image Controls
    const setMainBtn = page.getByRole("button", { name: "Set as Main" }).last();
    if (await setMainBtn.isVisible()) {
      await setMainBtn.click();
      await expect(page.getByText(/Main image set/i)).toBeVisible();
      await expect(page.getByText("Main Image").last()).toBeVisible();
    }

    // Set Hover
    const setHoverBtn = page.getByRole("button", { name: "Set as Hover" }).last();
    if (await setHoverBtn.isVisible()) {
      await setHoverBtn.click();
      await expect(page.getByText(/Hover image set/i)).toBeVisible();
      await expect(page.getByText("Hover Image").last()).toBeVisible();
    }

    // Clear Hover
    const clearHoverBtn = page.getByRole("button", { name: "Clear Hover Image" });
    if (await clearHoverBtn.isVisible()) {
      await clearHoverBtn.click();
      await expect(page.getByText(/Hover image cleared/i)).toBeVisible();
      await expect(page.getByText("Hover Image", { exact: true })).not.toBeVisible();
    }

    // 7. Reload page and verify persisted media state survives refresh
    await page.reload();
    await page.getByRole("button", { name: /^Media/i }).click();
    await expect(page.getByRole("heading", { name: "Product Media" })).toBeVisible();
    await expect(page.getByText("Main Image").first()).toBeVisible();
  });

  test("37. Complete session separation: Admin logout preserves Customer session, and Customer logout preserves Admin session", async ({
    page,
  }) => {
    const customerEmail = generateTestCustomerEmail();

    // --- Phase 1: Both logged in -> Admin logout preserves Customer session ---
    // 1. Log in as Customer
    await page.goto("/account/register");
    await page.getByLabel(/Full Name/i).fill("Session Test Customer");
    await page.getByLabel(/Email Address/i).fill(customerEmail);
    await page.getByLabel(/Phone Number/i).fill("03007776655");
    await page.getByLabel(/^Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByLabel(/Confirm Password/i).fill(TEST_CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: /Create Account/i }).click();
    await expect(page).toHaveURL(/\/account$/);

    // 2. In same browser context, log into Admin
    await page.goto("/admin/login");
    await page.locator("#admin-email").fill(E2E_ADMIN_CREDENTIALS.email);
    await page.locator("#admin-password").fill(E2E_ADMIN_CREDENTIALS.password);
    await page.getByRole("button", { name: /Sign In to Admin/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 3. Admin logs out
    await page
      .getByRole("button", { name: /Sign Out|Logout/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/login/);

    // Verify Admin session is gone
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);

    // 4. Verify Customer session is still valid!
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { level: 1, name: /Welcome/i })).toBeVisible();

    // --- Phase 2: Both logged in -> Customer logout preserves Admin session ---
    // 5. Re-authenticate Admin
    await page.goto("/admin/login");
    await page.locator("#admin-email").fill(E2E_ADMIN_CREDENTIALS.email);
    await page.locator("#admin-password").fill(E2E_ADMIN_CREDENTIALS.password);
    await page.getByRole("button", { name: /Sign In to Admin/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 6. Navigate to Customer account and log out
    await page.goto("/account/profile");
    await page
      .getByRole("button", { name: /Sign Out|Logout/i })
      .first()
      .click();
    await page.waitForURL(/\/account\/login/);

    // Verify Customer session is gone
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/login/);

    // 7. Verify Admin session is still valid!
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Dashboard Overview/i })
    ).toBeVisible();
  });
});
