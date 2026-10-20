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
  console.log("Starting Kids Wear — Work Unit 6 Product Core Test Suite...\n");

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
      fullName: "Product Security Tester",
      email: "product.security@example.com",
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

  // 3. Storefronts
  const miniSprouts = await prisma.storefront.findUnique({ where: { slug: "mini-sprouts" } });
  const teenStudio = await prisma.storefront.findUnique({ where: { slug: "teen-studio" } });
  const auraStudio = await prisma.storefront.findUnique({ where: { slug: "aura-studio" } });

  assert(miniSprouts !== null, "Mini Sprouts storefront must exist");
  assert(teenStudio !== null, "Teen Studio storefront must exist");
  assert(auraStudio !== null, "Aura Studio storefront must exist");

  const miniSproutsId = miniSprouts.id;
  const teenStudioId = teenStudio.id;

  // Track created products for final cleanup
  const createdProductIds: string[] = [];

  // ==========================================================================
  // Authentication / Security
  // ==========================================================================

  // 1. unauthenticated Product list rejected
  await runTest("unauthenticated Product list rejected", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/products",
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 2. Customer cookie cannot access Product list
  await runTest("Customer cookie cannot access Product list", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/products",
      headers: { cookie: customerCookieHeader },
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 3. Product creation requires Admin CSRF
  await runTest("Product creation requires Admin CSRF", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: { cookie: adminCookieHeader },
      payload: {
        name: "Test Shirt",
        sku: "TEST-SHIRT-001",
        slug: "test-shirt-001",
        storefrontId: miniSproutsId,
        description: "Test shirt description",
        regularPrice: "1200.00",
      },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_MISSING", `Expected CSRF_MISSING, got ${json.error.code}`);
  });

  // 4. Customer CSRF cannot create Product
  await runTest("Customer CSRF cannot create Product", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": customerCsrf,
      },
      payload: {
        name: "Test Shirt",
        sku: "TEST-SHIRT-001",
        slug: "test-shirt-001",
        storefrontId: miniSproutsId,
        description: "Test shirt description",
        regularPrice: "1200.00",
      },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_INVALID", `Expected CSRF_INVALID, got ${json.error.code}`);
  });

  // 5. Admin authenticated Product list succeeds
  await runTest("Admin authenticated Product list succeeds", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/products",
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.success === true, "success should be true");
    assert(Array.isArray(json.data.items), "items should be an array");
    assert(json.data.pagination !== undefined, "pagination metadata should be present");
  });

  // ==========================================================================
  // Create
  // ==========================================================================

  let createdProduct1Id = "";

  // 6. valid Draft Product creation succeeds
  await runTest("valid Draft Product creation succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Classic Linen Kurta",
        sku: "kw-ms-kurta-01",
        slug: "classic-linen-kurta",
        storefrontId: miniSproutsId,
        description: "Breathable pure linen kurta designed for everyday comfort.",
        shortDescription: "Pure linen kids kurta.",
        regularPrice: "2499.00",
        compareAtPrice: "2999.00",
        productType: "Kurta",
        gender: "Unisex",
        fabric: "100% Linen",
        includedPieces: "1 Piece (Kurta)",
        fit: "Regular",
        patternDesign: "Solid",
        occasion: "Festive & Casual",
        season: "Summer",
        careInstructions: "Machine wash cold, gentle cycle.",
        isNewArrival: true,
        seoTitle: "Classic Linen Kurta | Kids Wear",
        seoDescription: "Shop our handcrafted pure linen kurta for boys and girls.",
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.name === "Classic Linen Kurta", "Product name mismatch");
    assert(json.data.product.sku === "KW-MS-KURTA-01", "SKU should be normalized to uppercase");
    assert(json.data.product.status === "DRAFT", "Product must be created as DRAFT");
    assert(json.data.product.regularPrice === "2499.00", "regularPrice serialization mismatch");
    assert(json.data.product.compareAtPrice === "2999.00", "compareAtPrice serialization mismatch");
    assert(json.data.product.storefront.id === miniSproutsId, "Storefront ID mismatch");
    createdProduct1Id = json.data.product.id;
    createdProductIds.push(createdProduct1Id);
  });

  // 7. Product is always created as DRAFT
  await runTest("Product is always created as DRAFT", async () => {
    const inDb = await prisma.product.findUnique({ where: { id: createdProduct1Id } });
    assert(inDb?.status === "DRAFT", "Status in DB must be DRAFT");
  });

  // 8. valid Storefront relationship saved
  await runTest("valid Storefront relationship saved", async () => {
    const inDb = await prisma.product.findUnique({
      where: { id: createdProduct1Id },
      include: { storefront: true },
    });
    assert(inDb?.storefront.slug === "mini-sprouts", "Storefront relation slug mismatch");
  });

  // 9. duplicate SKU rejected
  await runTest("duplicate SKU rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Another Kurta",
        sku: "kw-ms-kurta-01", // duplicate SKU (case-insensitive due to uppercase normalization)
        slug: "another-kurta",
        storefrontId: miniSproutsId,
        description: "Another kurta",
        regularPrice: "1999.00",
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_SKU_EXISTS",
      `Expected PRODUCT_SKU_EXISTS, got ${json.error.code}`
    );
  });

  // 10. same slug in same Storefront rejected
  await runTest("same slug in same Storefront rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Different Kurta Name",
        sku: "KW-MS-KURTA-02",
        slug: "classic-linen-kurta", // duplicate slug in miniSproutsId
        storefrontId: miniSproutsId,
        description: "Description",
        regularPrice: "1800.00",
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_SLUG_EXISTS",
      `Expected PRODUCT_SLUG_EXISTS, got ${json.error.code}`
    );
  });

  // 11. same slug in different Storefront allowed
  let teenProductId = "";
  await runTest("same slug in different Storefront allowed", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Teen Linen Kurta",
        sku: "KW-TS-KURTA-01",
        slug: "classic-linen-kurta", // same slug, but in teenStudioId
        storefrontId: teenStudioId,
        description: "Teen studio linen kurta description",
        regularPrice: "2999.00",
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.slug === "classic-linen-kurta", "Slug mismatch");
    teenProductId = json.data.product.id;
    createdProductIds.push(teenProductId);
  });

  // 12. unknown Storefront rejected
  await runTest("unknown Storefront rejected", async () => {
    const fakeStorefrontId = "00000000-0000-0000-0000-000000000000";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Unknown Storefront Product",
        sku: "KW-UNKNOWN-01",
        slug: "unknown-sf-product",
        storefrontId: fakeStorefrontId,
        description: "Some description",
        regularPrice: "1500.00",
      },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "STOREFRONT_NOT_FOUND",
      `Expected STOREFRONT_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 13. missing required core field rejected
  await runTest("missing required core field rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        // missing name and description
        sku: "KW-MISSING-01",
        slug: "missing-field-product",
        storefrontId: miniSproutsId,
        regularPrice: "1500.00",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 14. featured rejected
  await runTest("featured rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Featured Attempt",
        sku: "KW-FEAT-01",
        slug: "featured-attempt",
        storefrontId: miniSproutsId,
        description: "Attempt with unapproved featured flag",
        regularPrice: "1500.00",
        featured: true,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 15. numeric stock field rejected
  await runTest("numeric stock field rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Stock Attempt",
        sku: "KW-STOCK-01",
        slug: "stock-attempt",
        storefrontId: miniSproutsId,
        description: "Attempt with unapproved stock field",
        regularPrice: "1500.00",
        stock: 50,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 16. attempt to create as PUBLISHED rejected
  await runTest("attempt to create as PUBLISHED rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Published Attempt",
        sku: "KW-PUB-01",
        slug: "published-attempt",
        storefrontId: miniSproutsId,
        description: "Attempt with published status",
        regularPrice: "1500.00",
        status: "PUBLISHED",
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
  // Money
  // ==========================================================================

  // 17. regularPrice returned as fixed two-decimal string
  await runTest("regularPrice returned as fixed two-decimal string", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(typeof json.data.product.regularPrice === "string", "regularPrice should be string");
    assert(
      /^\d+\.\d{2}$/.test(json.data.product.regularPrice),
      "regularPrice must match 2 decimal places"
    );
  });

  // 18. zero regularPrice rejected
  await runTest("zero regularPrice rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Zero Price Product",
        sku: "KW-ZERO-01",
        slug: "zero-price-product",
        storefrontId: miniSproutsId,
        description: "Zero price test",
        regularPrice: "0.00",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 19. negative regularPrice rejected
  await runTest("negative regularPrice rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Negative Price Product",
        sku: "KW-NEG-01",
        slug: "negative-price-product",
        storefrontId: miniSproutsId,
        description: "Negative price test",
        regularPrice: "-500.00",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 20. valid compareAtPrice accepted
  let productWithCompareAtId = "";
  await runTest("valid compareAtPrice accepted", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Compare At Product",
        sku: "KW-COMP-01",
        slug: "compare-at-product",
        storefrontId: miniSproutsId,
        description: "Compare at test",
        regularPrice: "1500.00",
        compareAtPrice: "1800.00",
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.compareAtPrice === "1800.00", "compareAtPrice mismatch");
    productWithCompareAtId = json.data.product.id;
    createdProductIds.push(productWithCompareAtId);
  });

  // 21. zero compareAtPrice rejected
  await runTest("zero compareAtPrice rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Zero Compare Product",
        sku: "KW-COMP-ZERO",
        slug: "zero-compare-product",
        storefrontId: miniSproutsId,
        description: "Zero compare test",
        regularPrice: "1500.00",
        compareAtPrice: "0.00",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 22. negative compareAtPrice rejected
  await runTest("negative compareAtPrice rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Negative Compare Product",
        sku: "KW-COMP-NEG",
        slug: "negative-compare-product",
        storefrontId: miniSproutsId,
        description: "Negative compare test",
        regularPrice: "1500.00",
        compareAtPrice: "-200.00",
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
  // Product Detail / Edit
  // ==========================================================================

  // 23. Admin Product detail succeeds
  await runTest("Admin Product detail succeeds", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.id === createdProduct1Id, "Product ID mismatch");
    assert(json.data.product.fabric === "100% Linen", "Garment fabric field mismatch");
  });

  // 24. unknown Product returns 404
  await runTest("unknown Product returns 404", async () => {
    const fakeProductId = "00000000-0000-0000-0000-000000000000";
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${fakeProductId}`,
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_NOT_FOUND",
      `Expected PRODUCT_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 25. Product Core update succeeds
  await runTest("Product Core update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Classic Organic Linen Kurta",
        regularPrice: "2699.00",
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.name === "Classic Organic Linen Kurta", "Name not updated");
    assert(json.data.product.regularPrice === "2699.00", "regularPrice not updated");
  });

  // 26. Storefront change to valid Storefront succeeds when uniqueness remains valid
  await runTest(
    "Storefront change to valid Storefront succeeds when uniqueness remains valid",
    async () => {
      // Change createdProduct1Id to auraStudioId (slug "classic-linen-kurta" is not in auraStudioId)
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/products/${createdProduct1Id}`,
        headers: {
          cookie: adminCookieHeader,
          "x-csrf-token": adminCsrf,
        },
        payload: {
          storefrontId: auraStudio.id,
        },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.data.product.storefront.id === auraStudio.id, "Storefront ID not updated");

      // Revert back to miniSproutsId
      await prisma.product.update({
        where: { id: createdProduct1Id },
        data: { storefrontId: miniSproutsId },
      });
    }
  );

  // 27. Storefront change causing slug collision rejected
  await runTest("Storefront change causing slug collision rejected", async () => {
    // teenStudioId already has "classic-linen-kurta". Changing createdProduct1Id (slug: "classic-linen-kurta") to teenStudioId should fail.
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        storefrontId: teenStudioId,
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_SLUG_EXISTS",
      `Expected PRODUCT_SLUG_EXISTS, got ${json.error.code}`
    );
  });

  // 28. SKU update uniqueness enforced
  await runTest("SKU update uniqueness enforced", async () => {
    // teenProductId has SKU "KW-TS-KURTA-01". Attempt to set createdProduct1Id's SKU to that.
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        sku: "KW-TS-KURTA-01",
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_SKU_EXISTS",
      `Expected PRODUCT_SKU_EXISTS, got ${json.error.code}`
    );
  });

  // 29. unknown fields rejected
  await runTest("unknown fields rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        name: "Valid Name",
        featuredProduct: true,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 30. generic PATCH cannot modify status
  await runTest("generic PATCH cannot modify status", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        status: "INACTIVE",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 31. isNewArrival update succeeds
  await runTest("isNewArrival update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        isNewArrival: false,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.isNewArrival === false, "isNewArrival should be false");
  });

  // 32. SEO fields update succeeds
  await runTest("SEO fields update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        seoTitle: "New SEO Title",
        seoDescription: "New SEO Description",
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.seoTitle === "New SEO Title", "seoTitle not updated");
    assert(
      json.data.product.seoDescription === "New SEO Description",
      "seoDescription not updated"
    );
  });

  // 33. optional garment fields update succeeds
  await runTest("optional garment fields update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        fabric: "Pure Organic Cotton",
        fit: "Loose",
        careInstructions: "Hand wash only.",
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.fabric === "Pure Organic Cotton", "fabric not updated");
    assert(json.data.product.fit === "Loose", "fit not updated");
    assert(
      json.data.product.careInstructions === "Hand wash only.",
      "careInstructions not updated"
    );
  });

  // ==========================================================================
  // List / Search / Filters
  // ==========================================================================

  // 34. pagination works
  await runTest("pagination works", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/products?page=1&limit=2",
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.items.length <= 2, "Items length should be <= limit");
    assert(json.data.pagination.page === 1, "Page should be 1");
    assert(json.data.pagination.limit === 2, "Limit should be 2");
    assert(json.data.pagination.total >= 2, "Total should be >= 2");
    assert(json.data.pagination.totalPages >= 1, "totalPages should be >= 1");
  });

  // 35. search by name works
  await runTest("search by name works", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/products?search=Organic%20Linen",
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.items.length >= 1, "Should find at least 1 product");
    assert(
      json.data.items.some((p: { id: string }) => p.id === createdProduct1Id),
      "Should include searched product"
    );
  });

  // 36. search by SKU works
  await runTest("search by SKU works", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/products?search=KW-TS-KURTA",
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.data.items.some((p: { id: string }) => p.id === teenProductId),
      "Should find teen product by SKU"
    );
  });

  // 37. Storefront filter works
  await runTest("Storefront filter works", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/products?storefront=teen-studio",
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.data.items.every(
        (p: { storefront: { slug: string } }) => p.storefront.slug === "teen-studio"
      ),
      "All items must belong to teen-studio"
    );
  });

  // 38. status filter works
  await runTest("status filter works", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/products?status=DRAFT",
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.data.items.every((p: { status: string }) => p.status === "DRAFT"),
      "All items must be DRAFT"
    );
  });

  // 39. deterministic ordering verified
  await runTest("deterministic ordering verified", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/products?limit=10",
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    const items = json.data.items;
    for (let i = 0; i < items.length - 1; i++) {
      const current = new Date(items[i].updatedAt).getTime();
      const next = new Date(items[i + 1].updatedAt).getTime();
      assert(current >= next, "Products must be ordered by updatedAt DESC");
    }
  });

  // ==========================================================================
  // Status
  // ==========================================================================

  // 40. DRAFT -> INACTIVE succeeds
  await runTest("DRAFT -> INACTIVE succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}/status`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        status: "INACTIVE",
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.status === "INACTIVE", "Status should be INACTIVE");
  });

  // 41. INACTIVE -> DRAFT succeeds
  await runTest("INACTIVE -> DRAFT succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}/status`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        status: "DRAFT",
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.status === "DRAFT", "Status should be DRAFT");
  });

  // 42. PUBLISHED target rejected in Work Unit 6
  await runTest("PUBLISHED target rejected in Work Unit 6", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}/status`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        status: "PUBLISHED",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_NOT_PUBLISHABLE" ||
        json.error.code === "PRODUCT_PUBLICATION_NOT_AVAILABLE",
      `Expected PRODUCT_NOT_PUBLISHABLE, got ${json.error.code}`
    );
  });

  // 43. unauthenticated status mutation rejected
  await runTest("unauthenticated status mutation rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}/status`,
      payload: {
        status: "INACTIVE",
      },
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 44. missing/invalid CSRF rejected
  await runTest("missing/invalid CSRF rejected on status mutation", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${createdProduct1Id}/status`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": "invalid-csrf-token",
      },
      payload: {
        status: "INACTIVE",
      },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_INVALID", `Expected CSRF_INVALID, got ${json.error.code}`);
  });

  // ==========================================================================
  // Delete
  // ==========================================================================

  let draftToDeleteId = "";

  // 45. unused Draft Product deletion succeeds
  await runTest("unused Draft Product deletion succeeds", async () => {
    const tempDraft = await prisma.product.create({
      data: {
        name: "Temporary Draft To Delete",
        sku: "KW-TEMP-DEL-01",
        slug: "temp-draft-del-01",
        storefrontId: miniSproutsId,
        description: "Draft to be deleted",
        regularPrice: 1000.0,
        status: "DRAFT",
      },
    });
    draftToDeleteId = tempDraft.id;

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${draftToDeleteId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const inDb = await prisma.product.findUnique({ where: { id: draftToDeleteId } });
    assert(inDb === null, "Draft product should be deleted from DB");
  });

  // 46. Inactive Product hard deletion rejected
  await runTest("Inactive Product hard deletion rejected", async () => {
    // Set createdProduct1Id to INACTIVE
    await prisma.product.update({
      where: { id: createdProduct1Id },
      data: { status: "INACTIVE" },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_DELETE_FORBIDDEN",
      `Expected PRODUCT_DELETE_FORBIDDEN, got ${json.error.code}`
    );

    // Revert to DRAFT
    await prisma.product.update({
      where: { id: createdProduct1Id },
      data: { status: "DRAFT" },
    });
  });

  // 47. unknown Product delete returns 404
  await runTest("unknown Product delete returns 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${fakeId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_NOT_FOUND",
      `Expected PRODUCT_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 48. delete requires Admin CSRF
  await runTest("delete requires Admin CSRF", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${createdProduct1Id}`,
      headers: {
        cookie: adminCookieHeader,
      },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_MISSING", `Expected CSRF_MISSING, got ${json.error.code}`);
  });

  // 49. deletion rejected when referenced by historical Order or Review
  await runTest("deletion rejected when referenced by historical Order or Review", async () => {
    const refProduct = await prisma.product.create({
      data: {
        name: "Referenced Product",
        sku: "KW-REF-01",
        slug: "referenced-product",
        storefrontId: miniSproutsId,
        description: "Product referenced by historical review",
        regularPrice: 1500.0,
        status: "DRAFT",
      },
    });
    createdProductIds.push(refProduct.id);

    // Create a temporary review referencing this product
    const review = await prisma.review.create({
      data: {
        productId: refProduct.id,
        reviewerName: "Historic Reviewer",
        rating: 5,
        reviewText: "High quality stitch.",
      },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${refProduct.id}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_DELETE_FORBIDDEN",
      `Expected PRODUCT_DELETE_FORBIDDEN, got ${json.error.code}`
    );

    // Clean up review so product can be cleaned up
    await prisma.review.delete({ where: { id: review.id } });
  });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  // Delete all test products created in this run
  if (createdProductIds.length > 0) {
    await prisma.product.deleteMany({
      where: { id: { in: createdProductIds } },
    });
  }

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
  console.log(`Summary: ${passed}/${total} Product Core Tests Passed.`);
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
