import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/admin-auth/services/password";
import {
  generateAdminCsrfToken,
  generateRawSessionToken as generateAdminRawToken,
  hashSessionToken as hashAdminToken,
} from "../src/modules/admin-auth/services/session";
import {
  generateCustomerCsrfToken,
  generateRawCustomerSessionToken,
  hashCustomerSessionToken,
} from "../src/modules/customer-auth/services/session";
import { env } from "../src/config/env";

const TEST_ADMIN_EMAIL = "sk.fabrica@gmail.com";
const TEST_ADMIN_PASSWORD = "TestAdminSecurePassword123!";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: errorMsg });
    // eslint-disable-next-line no-console
    console.error(`  ❌ ${name}: ${errorMsg}`);
  }
}

async function runSuite(): Promise<void> {
  const app = await buildApp();
  const prisma = getPrismaClient();

  // eslint-disable-next-line no-console
  console.log("Starting Kids Wear — Work Unit 7 Product Sizes, Colors & Variants Test Suite...\n");

  // 1. Setup Admin User and Session
  let adminUser = await prisma.adminUser.findUnique({
    where: { email: TEST_ADMIN_EMAIL },
  });

  if (!adminUser) {
    const passwordHash = await hashPassword(TEST_ADMIN_PASSWORD);
    adminUser = await prisma.adminUser.create({
      data: {
        email: TEST_ADMIN_EMAIL,
        passwordHash,
      },
    });
  }

  const adminRawToken = generateAdminRawToken();
  const adminTokenHash = hashAdminToken(adminRawToken);
  const adminSession = await prisma.adminSession.create({
    data: {
      adminUserId: adminUser.id,
      tokenHash: adminTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  const adminCsrf = generateAdminCsrfToken(adminRawToken);
  const adminCookieHeader = `${env.ADMIN_SESSION_COOKIE_NAME}=${adminRawToken}`;

  // 2. Setup Customer and Session for boundary testing
  const tempCustomer = await prisma.customer.create({
    data: {
      fullName: "Option Security Tester",
      email: "option.security@example.com",
      passwordHash: await hashPassword("CustomerPass123!"),
      isActive: true,
    },
  });

  const custRawToken = generateRawCustomerSessionToken();
  const custTokenHash = hashCustomerSessionToken(custRawToken);
  const custSession = await prisma.customerSession.create({
    data: {
      customerId: tempCustomer.id,
      tokenHash: custTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  const customerCookieHeader = `${env.CUSTOMER_SESSION_COOKIE_NAME}=${custRawToken}`;
  const customerCsrf = generateCustomerCsrfToken(custRawToken);

  // 3. Fetch storefront
  const miniSprouts = await prisma.storefront.findUnique({ where: { slug: "mini-sprouts" } });
  assert(miniSprouts !== null, "Mini Sprouts storefront must exist");
  const miniSproutsId = miniSprouts.id;

  // 4. Create two test products for testing product-scoping
  const testProduct1 = await prisma.product.create({
    data: {
      name: "WU7 Test Product 1",
      sku: "KW-WU7-PROD-01",
      slug: "wu7-test-prod-01",
      storefrontId: miniSproutsId,
      description: "Test product 1 for sizes and variants",
      regularPrice: 1999.0,
      status: "DRAFT",
    },
  });

  const testProduct2 = await prisma.product.create({
    data: {
      name: "WU7 Test Product 2",
      sku: "KW-WU7-PROD-02",
      slug: "wu7-test-prod-02",
      storefrontId: miniSproutsId,
      description: "Test product 2 for cross-product isolation",
      regularPrice: 2499.0,
      status: "DRAFT",
    },
  });

  const prod1Id = testProduct1.id;
  const prod2Id = testProduct2.id;

  // ==========================================================================
  // PART A — PRODUCT SIZES
  // ==========================================================================

  // 1. unauthenticated Size list rejected
  await runTest("unauthenticated Size list rejected", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/sizes`,
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 2. Customer cookie cannot access Size list
  await runTest("Customer cookie cannot access Size list", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/sizes`,
      headers: { cookie: customerCookieHeader },
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 3. Size creation requires Admin CSRF
  await runTest("Size creation requires Admin CSRF", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/sizes`,
      headers: { cookie: adminCookieHeader },
      payload: { name: "3-4 Years" },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_MISSING", `Expected CSRF_MISSING, got ${json.error.code}`);
  });

  // 4. Customer CSRF cannot create Size
  await runTest("Customer CSRF cannot create Size", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/sizes`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": customerCsrf,
      },
      payload: { name: "3-4 Years" },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_INVALID", `Expected CSRF_INVALID, got ${json.error.code}`);
  });

  // 5. valid Size creation succeeds
  let size1Id = "";
  await runTest("valid Size creation succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/sizes`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "3-4 Years",
        sortOrder: 1,
        isActive: true,
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.size.name === "3-4 Years", "Size name mismatch");
    assert(json.data.size.sortOrder === 1, "sortOrder mismatch");
    assert(json.data.size.isActive === true, "isActive should be true");
    size1Id = json.data.size.id;
  });

  // 6. Size is scoped to Product
  await runTest("Size is scoped to Product", async () => {
    const inDb = await prisma.productSize.findUnique({ where: { id: size1Id } });
    assert(inDb?.productId === prod1Id, "Size productId mismatch");
  });

  // 7. duplicate Size within Product rejected
  await runTest("duplicate Size within Product rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/sizes`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { name: "3-4 Years" },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_SIZE_EXISTS",
      `Expected PRODUCT_SIZE_EXISTS, got ${json.error.code}`
    );
  });

  // 8. same Size label on different Product allowed
  let prod2SizeId = "";
  await runTest("same Size label on different Product allowed", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod2Id}/sizes`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { name: "3-4 Years" },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.size.name === "3-4 Years", "Size name mismatch");
    prod2SizeId = json.data.size.id;
  });

  // 9. unknown Product rejected
  await runTest("unknown Product rejected on size create", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${fakeId}/sizes`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { name: "Small" },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_NOT_FOUND",
      `Expected PRODUCT_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 10. Size update succeeds
  await runTest("Size update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/sizes/${size1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "3-4 Y",
        sortOrder: 2,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.size.name === "3-4 Y", "Name not updated");
    assert(json.data.size.sortOrder === 2, "sortOrder not updated");

    // Revert name back to "3-4 Years"
    await prisma.productSize.update({
      where: { id: size1Id },
      data: { name: "3-4 Years", sortOrder: 1 },
    });
  });

  // 11. cross-Product Size update rejected
  await runTest("cross-Product Size update rejected", async () => {
    // Attempt updating size1Id (from prod1) via prod2's route
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod2Id}/sizes/${size1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { name: "Hacked" },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_SIZE_NOT_FOUND",
      `Expected PRODUCT_SIZE_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 12. inactive Size preserved, not deleted
  let inactiveSizeId = "";
  await runTest("inactive Size preserved, not deleted", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/sizes`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "9-10 Years",
        isActive: false,
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.size.isActive === false, "isActive should be false");
    inactiveSizeId = json.data.size.id;

    const inDb = await prisma.productSize.findUnique({ where: { id: inactiveSizeId } });
    assert(inDb !== null && inDb.isActive === false, "Inactive size record must exist in DB");
  });

  // ==========================================================================
  // PART B — PRODUCT COLORS
  // ==========================================================================

  // 19. valid Color creation succeeds
  let color1Id = "";
  await runTest("valid Color creation succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/colors`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Navy Blue",
        sortOrder: 1,
        isActive: true,
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.color.name === "Navy Blue", "Color name mismatch");
    assert(json.data.color.sortOrder === 1, "sortOrder mismatch");
    assert(json.data.color.isActive === true, "isActive should be true");
    assert(!("hexCode" in json.data.color), "Color response must not contain hexCode");
    assert(!("rgb" in json.data.color), "Color response must not contain rgb");
    assert(!("swatch" in json.data.color), "Color response must not contain swatch");
    assert(!("colorFamily" in json.data.color), "Color response must not contain colorFamily");
    color1Id = json.data.color.id;
  });

  // 20. Assorted accepted
  let assortedColorId = "";
  await runTest("Assorted accepted", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/colors`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Assorted",
        sortOrder: 2,
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.color.name === "Assorted", "Color name should be Assorted");
    assert(!("hexCode" in json.data.color), "Assorted response must not contain hexCode");
    assert(!("rgb" in json.data.color), "Assorted response must not contain rgb");
    assortedColorId = json.data.color.id;
  });

  // 20a. Color creation rejects hexCode as unapproved field
  await runTest("Color creation rejects hexCode as unapproved field", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/colors`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Burgundy",
        hexCode: "#800020",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 20b. Color creation rejects rgb, swatch, and colorFamily
  await runTest("Color creation rejects rgb, swatch, and colorFamily", async () => {
    for (const field of ["rgb", "swatch", "colorFamily", "colorCode"]) {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/products/${prod1Id}/colors`,
        headers: {
          cookie: adminCookieHeader,
          "x-csrf-token": adminCsrf,
        },
        payload: {
          name: "Test Option",
          [field]: "unapproved_value",
        },
      });
      assert(
        res.statusCode === 400,
        `Expected 400 for unapproved field ${field}, got ${res.statusCode}`
      );
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "VALIDATION_ERROR",
        `Expected VALIDATION_ERROR for ${field}, got ${json.error.code}`
      );
    }
  });

  // 20c. Color update rejects hexCode
  await runTest("Color update rejects hexCode", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/colors/${color1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        hexCode: "#000080",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 20d. Color list response contains no hexCode
  await runTest("Color list response contains no hexCode", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/colors`,
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(Array.isArray(json.data.colors), "Expected colors array");
    for (const color of json.data.colors) {
      assert(!("hexCode" in color), "Color in list must not have hexCode");
      assert(!("rgb" in color), "Color in list must not have rgb");
      assert(!("swatch" in color), "Color in list must not have swatch");
    }
    assert(!res.body.includes('"hexCode"'), "Response body must not contain 'hexCode'");
    assert(!res.body.includes('"rgb"'), "Response body must not contain 'rgb'");
    assert(!res.body.includes('"swatch"'), "Response body must not contain 'swatch'");
  });

  // 21. duplicate Color within Product rejected
  await runTest("duplicate Color within Product rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/colors`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { name: "Navy Blue" },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_COLOR_EXISTS",
      `Expected PRODUCT_COLOR_EXISTS, got ${json.error.code}`
    );
  });

  // 22. same Color on different Product allowed
  let prod2ColorId = "";
  await runTest("same Color on different Product allowed", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod2Id}/colors`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { name: "Navy Blue" },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.color.name === "Navy Blue", "Color name mismatch");
    prod2ColorId = json.data.color.id;
  });

  // 23. Color update succeeds
  await runTest("Color update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/colors/${color1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Dark Navy",
        sortOrder: 3,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.color.name === "Dark Navy", "Name not updated");
    assert(json.data.color.sortOrder === 3, "sortOrder not updated");
    assert(!("hexCode" in json.data.color), "Color update response must not contain hexCode");

    // Revert back
    await prisma.productColor.update({
      where: { id: color1Id },
      data: { name: "Navy Blue", sortOrder: 1 },
    });
  });

  // 24. cross-Product Color update rejected
  await runTest("cross-Product Color update rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod2Id}/colors/${color1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { name: "Hacked" },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_COLOR_NOT_FOUND",
      `Expected PRODUCT_COLOR_NOT_FOUND, got ${json.error.code}`
    );
  });

  // ==========================================================================
  // PART C — PRODUCT VARIANTS (Creation & Validation)
  // ==========================================================================

  // Create a 2nd active size for multi-variant testing
  const size2 = await prisma.productSize.create({
    data: {
      productId: prod1Id,
      name: "5-6 Years",
      sortOrder: 2,
      isActive: true,
    },
  });
  const size2Id = size2.id;

  // Create an inactive color for validation testing
  const inactiveColor = await prisma.productColor.create({
    data: {
      productId: prod1Id,
      name: "Pastel Yellow",
      isActive: false,
    },
  });
  const inactiveColorId = inactiveColor.id;

  // 30. valid exact Variant creation through bulk succeeds
  let variant1Id = "";
  await runTest("valid exact Variant creation through bulk succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: size1Id,
            productColorId: color1Id,
            isAvailable: true,
          },
        ],
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.variants.length === 1, "Expected 1 variant created");
    assert(json.data.variants[0].productSizeId === size1Id, "Size ID mismatch");
    assert(json.data.variants[0].productColorId === color1Id, "Color ID mismatch");
    assert(json.data.variants[0].isAvailable === true, "isAvailable should be true");
    variant1Id = json.data.variants[0].id;
  });

  // 31. multiple combinations created atomically
  let variant2Id = "";
  let variant3Id = "";
  await runTest("multiple combinations created atomically", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: size2Id,
            productColorId: color1Id,
            isAvailable: true,
          },
          {
            productSizeId: size1Id,
            productColorId: assortedColorId,
            isAvailable: true,
          },
        ],
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.variants.length === 2, "Expected 2 variants created");
    variant2Id = json.data.variants[0].id;
    variant3Id = json.data.variants[1].id;
  });

  // 32. duplicate combination in same request rejected
  await runTest("duplicate combination in same request rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: size2Id,
            productColorId: assortedColorId,
          },
          {
            productSizeId: size2Id,
            productColorId: assortedColorId, // duplicate
          },
        ],
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 33. already-existing exact Variant rejected
  await runTest("already-existing exact Variant rejected", async () => {
    // Attempt creating (size1Id, color1Id) which already exists
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: size1Id,
            productColorId: color1Id,
          },
        ],
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_VARIANT_EXISTS",
      `Expected PRODUCT_VARIANT_EXISTS, got ${json.error.code}`
    );
  });

  // 34. Size from another Product rejected
  await runTest("Size from another Product rejected", async () => {
    // prod2SizeId belongs to prod2, attempting on prod1
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: prod2SizeId,
            productColorId: color1Id,
          },
        ],
      },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_SIZE_NOT_FOUND",
      `Expected PRODUCT_SIZE_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 35. Color from another Product rejected
  await runTest("Color from another Product rejected", async () => {
    // prod2ColorId belongs to prod2, attempting on prod1
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: size1Id,
            productColorId: prod2ColorId,
          },
        ],
      },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_COLOR_NOT_FOUND",
      `Expected PRODUCT_COLOR_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 36. inactive Size rejected
  await runTest("inactive Size rejected on variant creation", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: inactiveSizeId,
            productColorId: color1Id,
          },
        ],
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_OPTION_INACTIVE",
      `Expected PRODUCT_OPTION_INACTIVE, got ${json.error.code}`
    );
  });

  // 37. inactive Color rejected
  await runTest("inactive Color rejected on variant creation", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: size1Id,
            productColorId: inactiveColorId,
          },
        ],
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_OPTION_INACTIVE",
      `Expected PRODUCT_OPTION_INACTIVE, got ${json.error.code}`
    );
  });

  // 38. failed bulk operation creates zero requested Variants
  await runTest("failed bulk operation creates zero requested Variants", async () => {
    const preCount = await prisma.productVariant.count({ where: { productId: prod1Id } });

    // Request containing 1 valid and 1 invalid row (inactive color)
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: size2Id,
            productColorId: assortedColorId, // valid
          },
          {
            productSizeId: size2Id,
            productColorId: inactiveColorId, // invalid
          },
        ],
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);

    const postCount = await prisma.productVariant.count({ where: { productId: prod1Id } });
    assert(postCount === preCount, "No variants should have been created on failed bulk request");
  });

  // 39. numeric stock field rejected
  await runTest("numeric stock field rejected on variant create", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: size2Id,
            productColorId: assortedColorId,
            stock: 25,
          },
        ],
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 40. quantity field rejected
  await runTest("quantity field rejected on variant create", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: size2Id,
            productColorId: assortedColorId,
            quantity: 10,
          },
        ],
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 41. variant SKU field rejected
  await runTest("variant SKU field rejected on variant create", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/variants/bulk`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        variants: [
          {
            productSizeId: size2Id,
            productColorId: assortedColorId,
            sku: "VAR-SKU-01",
          },
        ],
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // ==========================================================================
  // Size & Color Deactivation & Hard Delete Rules
  // ==========================================================================

  // 13. deactivating Size sets associated Variants unavailable
  await runTest("deactivating Size sets associated Variants unavailable", async () => {
    // Currently variant1Id (size1Id, color1Id) and variant3Id (size1Id, assortedColorId) are isAvailable: true
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/sizes/${size1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isActive: false,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.size.isActive === false, "Size isActive should be false");

    // Verify in DB that all variants using size1Id are now isAvailable: false
    const v1 = await prisma.productVariant.findUnique({ where: { id: variant1Id } });
    const v3 = await prisma.productVariant.findUnique({ where: { id: variant3Id } });
    assert(v1?.isAvailable === false, "Variant 1 must be set to unavailable");
    assert(v3?.isAvailable === false, "Variant 3 must be set to unavailable");
  });

  // 14. Size + Variant update is atomic
  await runTest("Size + Variant update is atomic", async () => {
    const sizeInDb = await prisma.productSize.findUnique({ where: { id: size1Id } });
    const variantsInDb = await prisma.productVariant.findMany({
      where: { productSizeId: size1Id },
    });
    assert(sizeInDb?.isActive === false, "Size is inactive");
    assert(
      variantsInDb.every((v) => v.isAvailable === false),
      "All variants are unavailable"
    );
  });

  // 15. reactivating Size does not automatically reactivate Variant
  await runTest("reactivating Size does not automatically reactivate Variant", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/sizes/${size1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isActive: true,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);

    // Variants should STILL be unavailable
    const v1 = await prisma.productVariant.findUnique({ where: { id: variant1Id } });
    assert(v1?.isAvailable === false, "Variant must remain unavailable when size is reactivated");
  });

  // 16. Draft unused Size hard delete succeeds
  await runTest("Draft unused Size hard delete succeeds", async () => {
    // inactiveSizeId was created above and is not referenced by any variants
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod1Id}/sizes/${inactiveSizeId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const inDb = await prisma.productSize.findUnique({ where: { id: inactiveSizeId } });
    assert(inDb === null, "Unused size should be deleted");
  });

  // 17. Size referenced by Variant cannot be hard deleted
  await runTest("Size referenced by Variant cannot be hard deleted", async () => {
    // size1Id is referenced by variant1Id
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod1Id}/sizes/${size1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_SIZE_DELETE_FORBIDDEN",
      `Expected PRODUCT_SIZE_DELETE_FORBIDDEN, got ${json.error.code}`
    );
  });

  // 18. Size on non-Draft Product cannot be hard deleted
  await runTest("Size on non-Draft Product cannot be hard deleted", async () => {
    // Create an unused size on prod2, set prod2 to INACTIVE, then attempt delete
    const unusedSizeProd2 = await prisma.productSize.create({
      data: { productId: prod2Id, name: "Unused Size Prod 2" },
    });
    await prisma.product.update({ where: { id: prod2Id }, data: { status: "INACTIVE" } });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod2Id}/sizes/${unusedSizeProd2.id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_SIZE_DELETE_FORBIDDEN",
      `Expected PRODUCT_SIZE_DELETE_FORBIDDEN, got ${json.error.code}`
    );

    // Revert prod2 to DRAFT
    await prisma.product.update({ where: { id: prod2Id }, data: { status: "DRAFT" } });
  });

  // 25. deactivating Color sets associated Variants unavailable
  await runTest("deactivating Color sets associated Variants unavailable", async () => {
    // Make variant2 (size2Id, color1Id) available
    await prisma.productVariant.update({ where: { id: variant2Id }, data: { isAvailable: true } });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/colors/${color1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isActive: false,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);

    const v2 = await prisma.productVariant.findUnique({ where: { id: variant2Id } });
    assert(v2?.isAvailable === false, "Variant 2 must be set to unavailable on color deactivation");
  });

  // 26. reactivating Color does not automatically reactivate Variant
  await runTest("reactivating Color does not automatically reactivate Variant", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/colors/${color1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isActive: true,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);

    const v2 = await prisma.productVariant.findUnique({ where: { id: variant2Id } });
    assert(v2?.isAvailable === false, "Variant must remain unavailable when color is reactivated");
  });

  // 27. Draft unused Color hard delete succeeds
  await runTest("Draft unused Color hard delete succeeds", async () => {
    // inactiveColorId is not referenced by any variants
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod1Id}/colors/${inactiveColorId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const inDb = await prisma.productColor.findUnique({ where: { id: inactiveColorId } });
    assert(inDb === null, "Unused color should be deleted");
  });

  // 28. Color referenced by Variant cannot be hard deleted
  await runTest("Color referenced by Variant cannot be hard deleted", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod1Id}/colors/${color1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_COLOR_DELETE_FORBIDDEN",
      `Expected PRODUCT_COLOR_DELETE_FORBIDDEN, got ${json.error.code}`
    );
  });

  // 29. Color on non-Draft Product cannot be hard deleted
  await runTest("Color on non-Draft Product cannot be hard deleted", async () => {
    const unusedColorProd2 = await prisma.productColor.create({
      data: { productId: prod2Id, name: "Unused Color Prod 2" },
    });
    await prisma.product.update({ where: { id: prod2Id }, data: { status: "INACTIVE" } });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod2Id}/colors/${unusedColorProd2.id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_COLOR_DELETE_FORBIDDEN",
      `Expected PRODUCT_COLOR_DELETE_FORBIDDEN, got ${json.error.code}`
    );

    await prisma.product.update({ where: { id: prod2Id }, data: { status: "DRAFT" } });
  });

  // ==========================================================================
  // PART D — VARIANT AVAILABILITY & IMMUTABILITY
  // ==========================================================================

  // 42. available -> unavailable succeeds
  await runTest("available -> unavailable succeeds", async () => {
    // variant3Id (size1Id, assortedColorId) - set available first
    await prisma.productVariant.update({ where: { id: variant3Id }, data: { isAvailable: true } });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/variants/${variant3Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isAvailable: false,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.variant.isAvailable === false, "isAvailable should be false");
  });

  // 43. unavailable -> available succeeds with active options
  await runTest("unavailable -> available succeeds with active options", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/variants/${variant3Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isAvailable: true,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.variant.isAvailable === true, "isAvailable should be true");
  });

  // 44. cannot make Variant available when Size inactive
  await runTest("cannot make Variant available when Size inactive", async () => {
    // Set size1 to inactive directly
    await prisma.productSize.update({ where: { id: size1Id }, data: { isActive: false } });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/variants/${variant3Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isAvailable: true,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_OPTION_INACTIVE",
      `Expected PRODUCT_OPTION_INACTIVE, got ${json.error.code}`
    );

    // Restore size1 to active
    await prisma.productSize.update({ where: { id: size1Id }, data: { isActive: true } });
  });

  // 45. cannot make Variant available when Color inactive
  await runTest("cannot make Variant available when Color inactive", async () => {
    // Set assortedColor to inactive
    await prisma.productColor.update({ where: { id: assortedColorId }, data: { isActive: false } });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/variants/${variant3Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isAvailable: true,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_OPTION_INACTIVE",
      `Expected PRODUCT_OPTION_INACTIVE, got ${json.error.code}`
    );

    // Restore assortedColor to active
    await prisma.productColor.update({ where: { id: assortedColorId }, data: { isActive: true } });
  });

  // 46. generic Variant PATCH cannot change Size
  await runTest("generic Variant PATCH cannot change Size", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/variants/${variant3Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isAvailable: true,
        productSizeId: size2Id,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 47. generic Variant PATCH cannot change Color
  await runTest("generic Variant PATCH cannot change Color", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/variants/${variant3Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isAvailable: true,
        productColorId: color1Id,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 48. cross-Product Variant update rejected
  await runTest("cross-Product Variant update rejected", async () => {
    // Attempt updating variant3Id (prod1) via prod2 route
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod2Id}/variants/${variant3Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isAvailable: false,
      },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_VARIANT_NOT_FOUND",
      `Expected PRODUCT_VARIANT_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 49. unknown Variant returns 404
  await runTest("unknown Variant returns 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/variants/${fakeId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isAvailable: false,
      },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_VARIANT_NOT_FOUND",
      `Expected PRODUCT_VARIANT_NOT_FOUND, got ${json.error.code}`
    );
  });

  // ==========================================================================
  // PART E — LISTING / ORDERING
  // ==========================================================================

  // 50. Size list ordered deterministically
  await runTest("Size list ordered deterministically", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/sizes`,
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    const sizes = json.data.sizes;
    for (let i = 0; i < sizes.length - 1; i++) {
      assert(
        sizes[i].sortOrder <= sizes[i + 1].sortOrder,
        "Sizes must be ordered by sortOrder ASC"
      );
    }
  });

  // 51. Color list ordered deterministically
  await runTest("Color list ordered deterministically", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/colors`,
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    const colors = json.data.colors;
    for (let i = 0; i < colors.length - 1; i++) {
      assert(
        colors[i].sortOrder <= colors[i + 1].sortOrder,
        "Colors must be ordered by sortOrder ASC"
      );
    }
  });

  // 52. Variant list ordered by Size/Color sort order
  await runTest("Variant list ordered by Size/Color sort order", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/variants`,
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    const variants = json.data.variants;
    assert(variants.length >= 2, "Expected at least 2 variants");
    for (let i = 0; i < variants.length - 1; i++) {
      const sOrderCurrent = variants[i].productSize.sortOrder;
      const sOrderNext = variants[i + 1].productSize.sortOrder;
      assert(
        sOrderCurrent <= sOrderNext,
        "Variants must be ordered primarily by size sortOrder ASC"
      );
    }
  });

  // 53. Variant response contains no numeric stock field
  await runTest("Variant response contains no numeric stock field", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/variants`,
      headers: { cookie: adminCookieHeader },
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes('"stock"'), "Variant response must not contain stock field");
    assert(!bodyStr.includes('"quantity"'), "Variant response must not contain quantity field");
    assert(!bodyStr.includes('"inventory"'), "Variant response must not contain inventory field");
  });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  // Delete all created test products (cascade deletes variants, sizes, colors)
  await prisma.product.deleteMany({
    where: { id: { in: [prod1Id, prod2Id] } },
  });

  // Clean up Customer and CustomerSession
  await prisma.customerSession.delete({ where: { id: custSession.id } }).catch(() => {});
  await prisma.customer.delete({ where: { id: tempCustomer.id } }).catch(() => {});

  // Clean up AdminSession
  await prisma.adminSession.delete({ where: { id: adminSession.id } }).catch(() => {});

  // Summary
  // eslint-disable-next-line no-console
  console.log("\n==================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  // eslint-disable-next-line no-console
  console.log(`Summary: ${passed}/${total} Product Options & Variants Tests Passed.`);
  // eslint-disable-next-line no-console
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
