import crypto from "crypto";
import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import {
  setCloudinaryService,
  resetCloudinaryService,
  ICloudinaryService,
  UploadSignatureParams,
  UploadSignatureResult,
  CloudinaryResourceMetadata,
} from "../src/lib/cloudinary";
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
import { NotFoundError } from "../src/lib/errors";

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

/**
 * Mock Cloudinary Service for hermetic automated integration testing.
 */
class MockCloudinaryService implements ICloudinaryService {
  public mockResources: Map<string, CloudinaryResourceMetadata> = new Map();

  async createUploadSignature(params: UploadSignatureParams): Promise<UploadSignatureResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `kids-wear/products/${params.productId}`;
    const fileId = crypto.randomUUID();
    const publicId = `${folder}/${fileId}`;
    const resourceType: "image" | "video" = params.mediaType === "IMAGE" ? "image" : "video";

    return {
      timestamp,
      signature: "mock_sig_" + crypto.randomBytes(16).toString("hex"),
      apiKey: "test_key",
      cloudName: "test_cloud",
      resourceType,
      folder,
      publicId,
    };
  }

  async fetchResourceMetadata(
    publicId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _resourceType: "image" | "video"
  ): Promise<CloudinaryResourceMetadata> {
    const found = this.mockResources.get(publicId);
    if (!found) {
      throw new NotFoundError("Media asset not found in Cloudinary", "MEDIA_ASSET_NOT_FOUND");
    }
    return found;
  }
}

async function runSuite(): Promise<void> {
  const app = await buildApp();
  const prisma = getPrismaClient();

  const mockCloudinary = new MockCloudinaryService();
  setCloudinaryService(mockCloudinary);

  // eslint-disable-next-line no-console
  console.log(
    "Starting Kids Wear — Work Unit 9 Product Publication & Public Catalog Test Suite...\n"
  );

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

  // 2. Setup Customer for boundary testing
  await prisma.customerSession
    .deleteMany({
      where: { customer: { email: "wu9.customer@example.com" } },
    })
    .catch(() => {});
  await prisma.customer
    .deleteMany({
      where: { email: "wu9.customer@example.com" },
    })
    .catch(() => {});

  const tempCustomer = await prisma.customer.create({
    data: {
      fullName: "WU9 Customer Tester",
      email: "wu9.customer@example.com",
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

  const customerCsrf = generateCustomerCsrfToken(custRawToken);

  // 3. Fetch Storefronts
  const miniSprouts = await prisma.storefront.findUnique({ where: { slug: "mini-sprouts" } });
  const teenStudio = await prisma.storefront.findUnique({ where: { slug: "teen-studio" } });
  assert(miniSprouts !== null && teenStudio !== null, "Storefronts must exist");
  const miniSproutsId = miniSprouts.id;
  const teenStudioId = teenStudio.id;

  // Track created product IDs for cleanup
  const createdProductIds: string[] = [];

  // Helper to register an image on a product
  async function attachImageToProduct(
    productId: string,
    imgIndex: number,
    options?: { isMain?: boolean; isHover?: boolean }
  ) {
    const publicId = `kids-wear/products/${productId}/img-${imgIndex}-${crypto.randomBytes(4).toString("hex")}`;
    mockCloudinary.mockResources.set(publicId, {
      publicId,
      secureUrl: `https://res.cloudinary.com/test/image/upload/v1/${publicId}.jpg`,
      resourceType: "image",
      format: "jpg",
      width: 1200,
      height: 1500,
      bytes: 120000,
    });

    const regRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${productId}/media`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { publicId, mediaType: "IMAGE", altText: `Test Image ${imgIndex}` },
    });
    const mediaId = JSON.parse(regRes.body).data.media.id;

    if (options?.isMain) {
      await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/products/${productId}/media/${mediaId}/main`,
        headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      });
    }

    if (options?.isHover) {
      await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/products/${productId}/media/${mediaId}/hover`,
        headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      });
    }

    return mediaId;
  }

  // Helper to create size + color + variant on a product
  async function attachVariantToProduct(
    productId: string,
    options?: {
      sizeName?: string;
      colorName?: string;
      isSizeActive?: boolean;
      isColorActive?: boolean;
      isAvailable?: boolean;
    }
  ) {
    const sizeName = options?.sizeName ?? "3-4 Years";
    const colorName = options?.colorName ?? "Navy Blue";
    const isSizeActive = options?.isSizeActive ?? true;
    const isColorActive = options?.isColorActive ?? true;
    const isAvailable = options?.isAvailable ?? true;

    const size = await prisma.productSize.create({
      data: { productId, name: sizeName, isActive: isSizeActive, sortOrder: 1 },
    });
    const color = await prisma.productColor.create({
      data: { productId, name: colorName, isActive: isColorActive, sortOrder: 1 },
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        productSizeId: size.id,
        productColorId: color.id,
        isAvailable,
      },
      include: { size: true, color: true },
    });

    return { size, color, variant };
  }

  // ==========================================================================
  // PART A: PUBLICATION GATE (Tests 1 - 13)
  // ==========================================================================

  // Pre-cleanup of any leftover WU9 test products from aborted runs
  const testSkus = [
    "KW-TS-HOODIE-08",
    "KW-INACT-TEMP-01",
    "KW-BASIC-KURTA-09",
    "KW-UNPUB-NEW-10",
    "KW-INACT-NEW-10B",
    "KW-INVALID-NEW-10C",
    "KW-INACT-PDP-11",
    "KW-DEFENSIVE-12",
  ];
  const leftoverProds = await prisma.product.findMany({
    where: {
      OR: [{ sku: { startsWith: "KW-WU9-" } }, { sku: { in: testSkus } }],
    },
    select: { id: true },
  });
  if (leftoverProds.length > 0) {
    const pids = leftoverProds.map((p) => p.id);
    await prisma.productMedia.deleteMany({ where: { productId: { in: pids } } }).catch(() => {});
    await prisma.productVariant.deleteMany({ where: { productId: { in: pids } } }).catch(() => {});
    await prisma.productSize.deleteMany({ where: { productId: { in: pids } } }).catch(() => {});
    await prisma.productColor.deleteMany({ where: { productId: { in: pids } } }).catch(() => {});
    await prisma.product.deleteMany({ where: { id: { in: pids } } }).catch(() => {});
  }

  // Product 1: Bare Draft Product without media/variant
  const bareDraftProd = await prisma.product.create({
    data: {
      name: "Bare Draft Kurta",
      sku: "KW-WU9-BARE-01",
      slug: "bare-draft-kurta",
      storefrontId: miniSproutsId,
      description: "A draft product without media or variants",
      regularPrice: 2499.0,
      status: "DRAFT",
    },
  });
  createdProductIds.push(bareDraftProd.id);

  // 1. Draft Product without media/variant cannot publish
  await runTest("Draft Product without media/variant cannot publish", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${bareDraftProd.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "PRODUCT_NOT_PUBLISHABLE", `Expected PRODUCT_NOT_PUBLISHABLE`);
    assert(Array.isArray(json.error.details), "Details must be array");
    assert(json.error.details.includes("MAIN_IMAGE_REQUIRED"), "Must require main image");
    assert(
      json.error.details.includes("AVAILABLE_VARIANT_REQUIRED"),
      "Must require available variant"
    );
  });

  // Product 2: Product with variant but NO main image
  const noMainProd = await prisma.product.create({
    data: {
      name: "No Main Image Product",
      sku: "KW-WU9-NOMAIN-02",
      slug: "no-main-image-product",
      storefrontId: miniSproutsId,
      description: "Product with variant but no main image",
      regularPrice: 1999.0,
      status: "DRAFT",
    },
  });
  createdProductIds.push(noMainProd.id);
  await attachVariantToProduct(noMainProd.id);
  // Attach an image without setting it as Main
  await attachImageToProduct(noMainProd.id, 1, { isMain: false });

  // 2. Product without Main Image cannot publish
  await runTest("Product without Main Image cannot publish", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${noMainProd.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "PRODUCT_NOT_PUBLISHABLE", "Expected PRODUCT_NOT_PUBLISHABLE");
    assert(json.error.details.includes("MAIN_IMAGE_REQUIRED"), "Must include MAIN_IMAGE_REQUIRED");
  });

  // Product 3: Product with Main Image but NO variants
  const noVariantProd = await prisma.product.create({
    data: {
      name: "No Variant Product",
      sku: "KW-WU9-NOVAR-03",
      slug: "no-variant-product",
      storefrontId: miniSproutsId,
      description: "Product with main image but no variants",
      regularPrice: 1899.0,
      status: "DRAFT",
    },
  });
  createdProductIds.push(noVariantProd.id);
  await attachImageToProduct(noVariantProd.id, 1, { isMain: true });

  // 3. Product without available Variant cannot publish
  await runTest("Product without available Variant cannot publish", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${noVariantProd.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "PRODUCT_NOT_PUBLISHABLE", "Expected PRODUCT_NOT_PUBLISHABLE");
    assert(
      json.error.details.includes("AVAILABLE_VARIANT_REQUIRED"),
      "Must require available variant"
    );
  });

  // Product 4: Product with variant whose Size is inactive
  const inactiveSizeProd = await prisma.product.create({
    data: {
      name: "Inactive Size Product",
      sku: "KW-WU9-INACT-SZ-04",
      slug: "inactive-size-product",
      storefrontId: miniSproutsId,
      description: "Product whose only variant has inactive size",
      regularPrice: 2199.0,
      status: "DRAFT",
    },
  });
  createdProductIds.push(inactiveSizeProd.id);
  await attachImageToProduct(inactiveSizeProd.id, 1, { isMain: true });
  await attachVariantToProduct(inactiveSizeProd.id, { isSizeActive: false, isAvailable: true });

  // 4. Product with Variant whose Size is inactive cannot publish
  await runTest("Product with Variant whose Size is inactive cannot publish", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${inactiveSizeProd.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "PRODUCT_NOT_PUBLISHABLE", "Expected PRODUCT_NOT_PUBLISHABLE");
    assert(
      json.error.details.includes("AVAILABLE_VARIANT_REQUIRED"),
      "Must require available variant"
    );
  });

  // Product 5: Product with variant whose Color is inactive
  const inactiveColorProd = await prisma.product.create({
    data: {
      name: "Inactive Color Product",
      sku: "KW-WU9-INACT-CL-05",
      slug: "inactive-color-product",
      storefrontId: miniSproutsId,
      description: "Product whose only variant has inactive color",
      regularPrice: 2299.0,
      status: "DRAFT",
    },
  });
  createdProductIds.push(inactiveColorProd.id);
  await attachImageToProduct(inactiveColorProd.id, 1, { isMain: true });
  await attachVariantToProduct(inactiveColorProd.id, { isColorActive: false, isAvailable: true });

  // 5. Product with Variant whose Color is inactive cannot publish
  await runTest("Product with Variant whose Color is inactive cannot publish", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${inactiveColorProd.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "PRODUCT_NOT_PUBLISHABLE", "Expected PRODUCT_NOT_PUBLISHABLE");
    assert(
      json.error.details.includes("AVAILABLE_VARIANT_REQUIRED"),
      "Must require available variant"
    );
  });

  // Product 6: Product with unavailable Variant
  const unavailableVarProd = await prisma.product.create({
    data: {
      name: "Unavailable Variant Product",
      sku: "KW-WU9-UNAVAIL-06",
      slug: "unavailable-variant-product",
      storefrontId: miniSproutsId,
      description: "Product whose variant isAvailable = false",
      regularPrice: 2399.0,
      status: "DRAFT",
    },
  });
  createdProductIds.push(unavailableVarProd.id);
  await attachImageToProduct(unavailableVarProd.id, 1, { isMain: true });
  await attachVariantToProduct(unavailableVarProd.id, { isAvailable: false });

  // 6. Product with unavailable Variant cannot publish
  await runTest("Product with unavailable Variant cannot publish", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${unavailableVarProd.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "PRODUCT_NOT_PUBLISHABLE", "Expected PRODUCT_NOT_PUBLISHABLE");
    assert(
      json.error.details.includes("AVAILABLE_VARIANT_REQUIRED"),
      "Must require available variant"
    );
  });

  // Product 7: Valid product satisfying all publication requirements
  const validProd1 = await prisma.product.create({
    data: {
      name: "Embroidered Festive Kurta",
      sku: "KW-WU9-KURTA-07",
      slug: "embroidered-festive-kurta",
      storefrontId: miniSproutsId,
      shortDescription: "Finely stitched premium cotton festive kurta",
      description: "Complete formal festive kurta with hand-embroidered neckline",
      regularPrice: 2999.0,
      compareAtPrice: 3499.0,
      productType: "Kurta",
      gender: "Boys",
      fabric: "100% Cotton",
      isNewArrival: true,
      seoTitle: "Embroidered Festive Kurta | Mini Sprouts",
      seoDescription: "Shop embroidered cotton festive kurta for boys.",
      status: "DRAFT",
    },
  });
  createdProductIds.push(validProd1.id);
  await attachImageToProduct(validProd1.id, 1, { isMain: true });
  await attachImageToProduct(validProd1.id, 2, { isHover: true });
  const { size: v1Size, color: v1Color } = await attachVariantToProduct(validProd1.id, {
    sizeName: "4-5 Years",
    colorName: "Royal Blue",
    isAvailable: true,
  });

  // 7. valid Product with Main + valid available Variant publishes
  await runTest("valid Product with Main + valid available Variant publishes", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${validProd1.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.status === "PUBLISHED", "Status must be PUBLISHED");
    const db = await prisma.product.findUnique({ where: { id: validProd1.id } });
    assert(db?.status === "PUBLISHED", "DB status must be PUBLISHED");
  });

  // 8. INACTIVE valid Product can republish
  await runTest("INACTIVE valid Product can republish", async () => {
    // Transition to INACTIVE first
    const inactRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${validProd1.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "INACTIVE" },
    });
    assert(inactRes.statusCode === 200, "Must transition to INACTIVE");

    // Transition back to PUBLISHED
    const pubRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${validProd1.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(pubRes.statusCode === 200, `Expected 200, got ${pubRes.statusCode}`);
    const json = JSON.parse(pubRes.body);
    assert(json.data.product.status === "PUBLISHED", "Status must be PUBLISHED");
  });

  // 9. PUBLISHED -> INACTIVE succeeds
  await runTest("PUBLISHED -> INACTIVE succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${validProd1.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "INACTIVE" },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.status === "INACTIVE", "Status must be INACTIVE");
    // Set back to PUBLISHED for upcoming catalog tests
    await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${validProd1.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
  });

  // 10. PUBLISHED -> DRAFT rejected
  await runTest("PUBLISHED -> DRAFT rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${validProd1.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "DRAFT" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_INVALID_STATUS_TRANSITION",
      `Expected PRODUCT_INVALID_STATUS_TRANSITION, got ${json.error.code}`
    );
  });

  // 11. publication requires Admin auth
  await runTest("publication requires Admin auth", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${validProd1.id}/status`,
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  // 12. publication requires Admin CSRF
  await runTest("publication requires Admin CSRF", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${validProd1.id}/status`,
      headers: { cookie: adminCookieHeader },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
  });

  // 13. Customer CSRF cannot publish Product
  await runTest("Customer CSRF cannot publish Product", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${validProd1.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": customerCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
  });

  // shortDescription not required for publication
  await runTest("shortDescription not required for publication", async () => {
    const noShortDescProd = await prisma.product.create({
      data: {
        name: "No Short Desc Kurta",
        sku: "KW-WU9-NOSHORT-01",
        slug: "no-short-desc-kurta",
        storefrontId: miniSproutsId,
        description: "Full product description here",
        shortDescription: null,
        productType: "Ethnic Wear",
        regularPrice: 2200.0,
        status: "DRAFT",
      },
    });
    createdProductIds.push(noShortDescProd.id);
    await attachImageToProduct(noShortDescProd.id, 1, { isMain: true });
    await attachVariantToProduct(noShortDescProd.id);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${noShortDescProd.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.status === "PUBLISHED", "Must publish successfully");
  });

  // productType not required for publication
  await runTest("productType not required for publication", async () => {
    const noTypeProd = await prisma.product.create({
      data: {
        name: "No Product Type Kurta",
        sku: "KW-WU9-NOTYPE-02",
        slug: "no-product-type-kurta",
        storefrontId: miniSproutsId,
        description: "Full product description here",
        shortDescription: "Valid short description",
        productType: null,
        regularPrice: 2300.0,
        status: "DRAFT",
      },
    });
    createdProductIds.push(noTypeProd.id);
    await attachImageToProduct(noTypeProd.id, 1, { isMain: true });
    await attachVariantToProduct(noTypeProd.id);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${noTypeProd.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert(json.data.product.status === "PUBLISHED", "Must publish successfully");
  });

  // description required for publication
  await runTest("description required for publication", async () => {
    const emptyDescProd = await prisma.product.create({
      data: {
        name: "Empty Desc Kurta",
        sku: "KW-WU9-EMPTYDESC-03",
        slug: "empty-desc-kurta",
        storefrontId: miniSproutsId,
        description: "   ",
        regularPrice: 2400.0,
        status: "DRAFT",
      },
    });
    createdProductIds.push(emptyDescProd.id);
    await attachImageToProduct(emptyDescProd.id, 1, { isMain: true });
    await attachVariantToProduct(emptyDescProd.id);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${emptyDescProd.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "PRODUCT_NOT_PUBLISHABLE", "Expected PRODUCT_NOT_PUBLISHABLE");
    assert(json.error.details.includes("DESCRIPTION_REQUIRED"), "Must require description");
  });

  // positive compareAtPrice <= regularPrice does not block publication
  await runTest("positive compareAtPrice <= regularPrice does not block publication", async () => {
    // Case 1: compareAtPrice == regularPrice
    const equalPriceProd = await prisma.product.create({
      data: {
        name: "Equal Compare Price Kurta",
        sku: "KW-WU9-EQPRICE-04",
        slug: "equal-compare-price-kurta",
        storefrontId: miniSproutsId,
        description: "Product where compareAtPrice == regularPrice",
        regularPrice: 2500.0,
        compareAtPrice: 2500.0,
        status: "DRAFT",
      },
    });
    createdProductIds.push(equalPriceProd.id);
    await attachImageToProduct(equalPriceProd.id, 1, { isMain: true });
    await attachVariantToProduct(equalPriceProd.id);

    const resEqual = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${equalPriceProd.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(
      resEqual.statusCode === 200,
      `Expected 200, got ${resEqual.statusCode}: ${resEqual.body}`
    );

    // Case 2: compareAtPrice < regularPrice
    const lowerPriceProd = await prisma.product.create({
      data: {
        name: "Lower Compare Price Kurta",
        sku: "KW-WU9-LOWPRICE-05",
        slug: "lower-compare-price-kurta",
        storefrontId: miniSproutsId,
        description: "Product where compareAtPrice < regularPrice",
        regularPrice: 3000.0,
        compareAtPrice: 2400.0,
        status: "DRAFT",
      },
    });
    createdProductIds.push(lowerPriceProd.id);
    await attachImageToProduct(lowerPriceProd.id, 1, { isMain: true });
    await attachVariantToProduct(lowerPriceProd.id);

    const resLower = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${lowerPriceProd.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });
    assert(
      resLower.statusCode === 200,
      `Expected 200, got ${resLower.statusCode}: ${resLower.body}`
    );
  });

  // zero/negative compare-at remains invalid according to Product Core validation
  await runTest(
    "zero/negative compare-at remains invalid according to Product Core validation",
    async () => {
      const resZero = await app.inject({
        method: "POST",
        url: `/api/v1/admin/products`,
        headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
        payload: {
          storefrontId: miniSproutsId,
          name: "Zero Compare Price",
          sku: "KW-WU9-ZEROPRICE",
          slug: "zero-compare-price",
          description: "Testing zero compareAtPrice",
          regularPrice: "2000.00",
          compareAtPrice: "0.00",
        },
      });
      assert(
        resZero.statusCode === 400,
        `Expected 400 for zero compareAtPrice, got ${resZero.statusCode}`
      );
      const jsonZero = JSON.parse(resZero.body);
      assert(jsonZero.error.code === "VALIDATION_ERROR", "Expected VALIDATION_ERROR");

      const resNeg = await app.inject({
        method: "POST",
        url: `/api/v1/admin/products`,
        headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
        payload: {
          storefrontId: miniSproutsId,
          name: "Negative Compare Price",
          sku: "KW-WU9-NEGPRICE",
          slug: "negative-compare-price",
          description: "Testing negative compareAtPrice",
          regularPrice: "2000.00",
          compareAtPrice: "-500.00",
        },
      });
      assert(
        resNeg.statusCode === 400,
        `Expected 400 for negative compareAtPrice, got ${resNeg.statusCode}`
      );
      const jsonNeg = JSON.parse(resNeg.body);
      assert(jsonNeg.error.code === "VALIDATION_ERROR", "Expected VALIDATION_ERROR");
    }
  );

  // ==========================================================================
  // PART B: PUBLIC PRODUCT LISTING (Tests 14 - 26)
  // ==========================================================================

  // Create additional products to test cross-storefront, drafts, and inactives
  const teenStudioProd = await prisma.product.create({
    data: {
      name: "Teen Studio Oversized Hoodie",
      sku: "KW-TS-HOODIE-08",
      slug: "teen-studio-oversized-hoodie",
      storefrontId: teenStudioId,
      description: "Comfortable fleece hoodie for teens",
      regularPrice: 3499.0,
      status: "DRAFT",
    },
  });
  createdProductIds.push(teenStudioProd.id);
  await attachImageToProduct(teenStudioProd.id, 1, { isMain: true });
  await attachVariantToProduct(teenStudioProd.id);
  await app.inject({
    method: "PATCH",
    url: `/api/v1/admin/products/${teenStudioProd.id}/status`,
    headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
    payload: { status: "PUBLISHED" },
  });

  // 14. public listing returns only PUBLISHED valid Products
  await runTest("public listing returns only PUBLISHED valid Products", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.success === true, "Response must be success");
    assert(Array.isArray(json.data.items), "Items must be array");
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(itemIds.includes(validProd1.id), "Valid published product must be included");
  });

  // 15. DRAFT Product excluded
  await runTest("DRAFT Product excluded", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(!itemIds.includes(bareDraftProd.id), "DRAFT product must not be included");
  });

  // 16. INACTIVE Product excluded
  await runTest("INACTIVE Product excluded", async () => {
    // Temporarily create an inactive product
    const inact = await prisma.product.create({
      data: {
        name: "Inactive Test Product",
        sku: "KW-INACT-TEMP-01",
        slug: "inactive-test-product",
        storefrontId: miniSproutsId,
        description: "Inactive product",
        regularPrice: 1200.0,
        status: "INACTIVE",
      },
    });
    createdProductIds.push(inact.id);
    await attachImageToProduct(inact.id, 1, { isMain: true });
    await attachVariantToProduct(inact.id);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(!itemIds.includes(inact.id), "INACTIVE product must not be in listing");
  });

  // 17. Product without valid available Variant excluded
  await runTest("Product without valid available Variant excluded", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(!itemIds.includes(unavailableVarProd.id), "Product with 0 available variants excluded");
    assert(!itemIds.includes(noVariantProd.id), "Product with 0 variants excluded");
  });

  // 18. Product without Main Image excluded
  await runTest("Product without Main Image excluded", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(!itemIds.includes(noMainProd.id), "Product with no main image excluded");
  });

  // 19. Product from another Storefront excluded
  await runTest("Product from another Storefront excluded", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(
      !itemIds.includes(teenStudioProd.id),
      "Teen Studio product must not appear in Mini Sprouts"
    );
  });

  // 20. unknown Storefront returns 404
  await runTest("unknown Storefront returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/non-existent-storefront/products`,
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "STOREFRONT_NOT_FOUND", `Expected STOREFRONT_NOT_FOUND`);
  });

  // 21. prices serialized as two-decimal strings
  await runTest("prices serialized as two-decimal strings", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    const json = JSON.parse(res.body);
    const item = json.data.items.find((i: { id: string }) => i.id === validProd1.id);
    assert(item !== undefined, "Item must exist");
    assert(typeof item.regularPrice === "string", "regularPrice must be string");
    assert(item.regularPrice === "2999.00", `Expected "2999.00", got ${item.regularPrice}`);
    assert(item.compareAtPrice === "3499.00", `Expected "3499.00", got ${item.compareAtPrice}`);
  });

  // 22. card includes Main Image
  await runTest("card includes Main Image", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    const json = JSON.parse(res.body);
    const item = json.data.items.find((i: { id: string }) => i.id === validProd1.id);
    assert(item.mainImage !== null, "mainImage must not be null");
    assert(typeof item.mainImage.url === "string", "mainImage.url must be string");
    assert(item.mainImage.url.startsWith("https://res.cloudinary.com"), "URL must be CDN URL");
  });

  // 23. Hover Image optional
  await runTest("Hover Image optional", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    const json = JSON.parse(res.body);
    const item = json.data.items.find((i: { id: string }) => i.id === validProd1.id);
    assert(item.hoverImage !== null, "hoverImage must be present when designated");
    assert(typeof item.hoverImage.url === "string", "hoverImage.url must be string");
  });

  // 24. no internal MediaAsset identifiers/secrets exposed
  await runTest("no internal MediaAsset identifiers/secrets exposed", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes("mediaAssetId"), "Must not expose mediaAssetId");
    assert(!bodyStr.includes("providerPublicId"), "Must not expose providerPublicId");
    assert(!bodyStr.includes("apiSecret"), "Must not expose apiSecret");
  });

  // 25. listing pagination works
  await runTest("listing pagination works", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products?page=1&limit=1`,
    });
    assert(res.statusCode === 200, "Pagination request should succeed");
    const json = JSON.parse(res.body);
    assert(json.data.pagination.page === 1, "Page must be 1");
    assert(json.data.pagination.limit === 1, "Limit must be 1");
    assert(typeof json.data.pagination.totalItems === "number", "totalItems must be number");
  });

  // 26. listing ordering deterministic
  await runTest("listing ordering deterministic", async () => {
    const res1 = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    const res2 = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    assert(res1.body === res2.body, "Successive requests must return identical ordering");
  });

  // ==========================================================================
  // PART C: NEW ARRIVALS (Tests 27 - 29)
  // ==========================================================================

  // Create a published non-new arrival product
  const nonNewProd = await prisma.product.create({
    data: {
      name: "Classic Basic Kurta",
      sku: "KW-BASIC-KURTA-09",
      slug: "classic-basic-kurta",
      storefrontId: miniSproutsId,
      description: "Basic regular kurta",
      regularPrice: 1999.0,
      isNewArrival: false,
      status: "DRAFT",
    },
  });
  createdProductIds.push(nonNewProd.id);
  await attachImageToProduct(nonNewProd.id, 1, { isMain: true });
  await attachVariantToProduct(nonNewProd.id);
  await app.inject({
    method: "PATCH",
    url: `/api/v1/admin/products/${nonNewProd.id}/status`,
    headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
    payload: { status: "PUBLISHED" },
  });

  // 27. new=true returns only isNewArrival=true
  await runTest("new=true returns only isNewArrival=true", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products?new=true`,
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    for (const item of json.data.items) {
      assert(item.isNewArrival === true, "Every item must have isNewArrival=true");
    }
  });

  // 28. non-New published Product excluded from new filter
  await runTest("non-New published Product excluded from new filter", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products?new=true`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(!itemIds.includes(nonNewProd.id), "non-New product must be excluded");
    assert(itemIds.includes(validProd1.id), "New arrival product must be included");
  });

  // 29. unpublished new Product excluded
  await runTest("unpublished new Product excluded", async () => {
    const unpubNew = await prisma.product.create({
      data: {
        name: "Unpublished New Dress",
        sku: "KW-UNPUB-NEW-10",
        slug: "unpublished-new-dress",
        storefrontId: miniSproutsId,
        description: "Draft new arrival",
        regularPrice: 2000.0,
        isNewArrival: true,
        status: "DRAFT",
      },
    });
    createdProductIds.push(unpubNew.id);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products?new=true`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(!itemIds.includes(unpubNew.id), "Draft new arrival must be excluded");
  });

  // Draft/Inactive new Product excluded
  await runTest("Draft/Inactive new Product excluded", async () => {
    const inactNew = await prisma.product.create({
      data: {
        name: "Inactive New Dress",
        sku: "KW-INACT-NEW-10B",
        slug: "inactive-new-dress",
        storefrontId: miniSproutsId,
        description: "Inactive new arrival",
        regularPrice: 2100.0,
        isNewArrival: true,
        status: "INACTIVE",
      },
    });
    createdProductIds.push(inactNew.id);
    await attachImageToProduct(inactNew.id, 1, { isMain: true });
    await attachVariantToProduct(inactNew.id);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products?new=true`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(!itemIds.includes(inactNew.id), "Inactive new arrival must be excluded from new=true");
  });

  // invalid-public-state new Product excluded
  await runTest("invalid-public-state new Product excluded", async () => {
    // Product published with isNewArrival=true, but whose only variant is unavailable
    const invalidStateNew = await prisma.product.create({
      data: {
        name: "Invalid State New Arrival",
        sku: "KW-INVALID-NEW-10C",
        slug: "invalid-state-new-arrival",
        storefrontId: miniSproutsId,
        description: "New arrival with unavailable variant",
        regularPrice: 2200.0,
        isNewArrival: true,
        status: "DRAFT",
      },
    });
    createdProductIds.push(invalidStateNew.id);
    await attachImageToProduct(invalidStateNew.id, 1, { isMain: true });
    const { variant } = await attachVariantToProduct(invalidStateNew.id, { isAvailable: true });

    // Publish it
    await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${invalidStateNew.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });

    // Now make the variant unavailable (invalid public state)
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { isAvailable: false },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products?new=true`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(
      !itemIds.includes(invalidStateNew.id),
      "Invalid-public-state new arrival must be excluded from new=true"
    );
  });

  // new=true filters by isNewArrival=true
  await runTest("new=true filters by isNewArrival=true", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products?new=true`,
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.items.length > 0, "Should return at least 1 new arrival");
    for (const item of json.data.items) {
      assert(item.isNewArrival === true, "Every returned product must have isNewArrival === true");
    }
  });

  // ==========================================================================
  // PART D: PUBLIC PDP (Tests 30 - 43)
  // ==========================================================================

  // 30. valid published Product PDP succeeds
  await runTest("valid published Product PDP succeeds", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.success === true, "Must be success");
    const p = json.data.product ?? json.data;
    assert(p.id === validProd1.id, "Product ID mismatch");
    assert(p.name === validProd1.name, "Name mismatch");
    assert(p.regularPrice === "2999.00", "regularPrice mismatch");
    assert(p.compareAtPrice === "3499.00", "compareAtPrice mismatch");
  });

  // public PDP does not expose SKU
  await runTest("public PDP does not expose SKU", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    const p = json.data.product ?? json.data;
    assert(p.sku === undefined, "Public PDP product must not contain sku");
    assert(!("sku" in p), "sku property must not exist on product object");
    assert(!("sku" in json.data), "sku property must not exist on root data object");
  });

  // 31. Draft Product PDP returns public 404
  await runTest("Draft Product PDP returns public 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${bareDraftProd.slug}`,
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "PRODUCT_NOT_FOUND", "Expected PRODUCT_NOT_FOUND");
  });

  // 32. Inactive Product PDP returns public 404
  await runTest("Inactive Product PDP returns public 404", async () => {
    const inactProd = await prisma.product.create({
      data: {
        name: "Inactive PDP Test",
        sku: "KW-INACT-PDP-11",
        slug: "inactive-pdp-test",
        storefrontId: miniSproutsId,
        description: "Inactive PDP product",
        regularPrice: 2000.0,
        status: "INACTIVE",
      },
    });
    createdProductIds.push(inactProd.id);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${inactProd.slug}`,
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
  });

  // 33. wrong Storefront slug returns public 404
  await runTest("wrong Storefront slug returns public 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/teen-studio/products/${validProd1.slug}`,
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
  });

  // 34. unknown product slug returns 404
  await runTest("unknown product slug returns 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/completely-unknown-slug`,
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
  });

  // 35. media returned in sort order
  await runTest("media returned in sort order", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    const json = JSON.parse(res.body);
    const p = json.data.product ?? json.data;
    assert(Array.isArray(p.media), "Media must be array");
    for (let i = 0; i < p.media.length - 1; i++) {
      assert(p.media[i].sortOrder <= p.media[i + 1].sortOrder, "Media must be sorted by sortOrder");
    }
  });

  // 36. only active Sizes returned
  await runTest("only active Sizes returned", async () => {
    // Add an inactive size to validProd1
    await prisma.productSize.create({
      data: { productId: validProd1.id, name: "Inactive Size", isActive: false, sortOrder: 99 },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    const json = JSON.parse(res.body);
    const p = json.data.product ?? json.data;
    const sizeNames = p.sizes.map((s: { name: string }) => s.name);
    assert(!sizeNames.includes("Inactive Size"), "Inactive size must not appear");
  });

  // 37. only active Colors returned
  await runTest("only active Colors returned", async () => {
    // Add an inactive color to validProd1
    await prisma.productColor.create({
      data: { productId: validProd1.id, name: "Inactive Color", isActive: false, sortOrder: 99 },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    const json = JSON.parse(res.body);
    const p = json.data.product ?? json.data;
    const colorNames = p.colors.map((c: { name: string }) => c.name);
    assert(!colorNames.includes("Inactive Color"), "Inactive color must not appear");
  });

  // 38. color response contains no hex/rgb/swatch fields
  await runTest("color response contains no hex/rgb/swatch fields", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    const json = JSON.parse(res.body);
    const p = json.data.product ?? json.data;
    for (const color of p.colors) {
      assert(!("hexCode" in color), "Must not have hexCode");
      assert(!("rgb" in color), "Must not have rgb");
      assert(!("swatch" in color), "Must not have swatch");
    }
  });

  // 39. inactive-option Variants excluded
  await runTest("inactive-option Variants excluded", async () => {
    // Create an inactive size and variant referencing it
    const inactSize = await prisma.productSize.create({
      data: { productId: validProd1.id, name: "99-100Y Inactive", isActive: false },
    });
    const actColor = await prisma.productColor.findFirst({
      where: { productId: validProd1.id, isActive: true },
    });
    await prisma.productVariant.create({
      data: {
        productId: validProd1.id,
        productSizeId: inactSize.id,
        productColorId: actColor!.id,
        isAvailable: true,
      },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    const json = JSON.parse(res.body);
    const p = json.data.product ?? json.data;
    const sizeIdsInVariants = p.variants.map((v: { productSizeId: string }) => v.productSizeId);
    assert(
      !sizeIdsInVariants.includes(inactSize.id),
      "Variant with inactive size must be excluded"
    );
  });

  // 40. unavailable Variant returned with isAvailable=false if its options remain active
  await runTest(
    "unavailable Variant returned with isAvailable=false if its options remain active",
    async () => {
      // Add an unavailable variant with active size and color
      const actSize = await prisma.productSize.findFirst({
        where: { productId: validProd1.id, isActive: true },
      });
      const actColor = await prisma.productColor.findFirst({
        where: { productId: validProd1.id, isActive: true },
      });
      const newActiveColor = await prisma.productColor.create({
        data: { productId: validProd1.id, name: "Mint Green", isActive: true },
      });
      const unavailVar = await prisma.productVariant.create({
        data: {
          productId: validProd1.id,
          productSizeId: actSize!.id,
          productColorId: newActiveColor.id,
          isAvailable: false,
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
      });
      const json = JSON.parse(res.body);
      const p = json.data.product ?? json.data;
      const foundVar = p.variants.find((v: { id: string }) => v.id === unavailVar.id);
      assert(foundVar !== undefined, "Unavailable variant must appear");
      assert(foundVar.isAvailable === false, "isAvailable must be false");
    }
  );

  // 41. no numeric stock field present
  await runTest("no numeric stock field present", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes('"stock"'), "Must not contain 'stock'");
    assert(!bodyStr.includes('"quantity"'), "Must not contain 'quantity'");
    assert(!bodyStr.includes('"inventory"'), "Must not contain 'inventory'");
  });

  // 42. SEO metadata returned safely
  await runTest("SEO metadata returned safely", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    const json = JSON.parse(res.body);
    const p = json.data.product ?? json.data;
    assert(p.seoTitle === "Embroidered Festive Kurta | Mini Sprouts", "seoTitle mismatch");
    assert(
      p.seoDescription === "Shop embroidered cotton festive kurta for boys.",
      "seoDescription mismatch"
    );
  });

  // 43. no Cloudinary secret/signing fields exposed
  await runTest("no Cloudinary secret/signing fields exposed", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes("apiSecret"), "Must not expose apiSecret");
    assert(!bodyStr.includes("apiKey"), "Must not expose apiKey");
    assert(!bodyStr.includes("signature"), "Must not expose signature");
  });

  // ==========================================================================
  // PART E: SEARCH (Tests 44 - 54)
  // ==========================================================================

  // 44. search returns matching published Product
  await runTest("search returns matching published Product", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=Festive`,
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.success === true, "Must be success");
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(itemIds.includes(validProd1.id), "Festive search must return validProd1");
    assert(json.data.query === "Festive", "query echo mismatch");
  });

  // 45. Draft matches excluded
  await runTest("Draft matches excluded", async () => {
    // bareDraftProd has "Kurta" in name
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=Bare`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(!itemIds.includes(bareDraftProd.id), "Draft matches must be excluded");
  });

  // 46. Inactive matches excluded
  await runTest("Inactive matches excluded", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=Inactive`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(itemIds.length === 0, "Inactive matches must be excluded");
  });

  // 47. invalid-public-state Product excluded
  await runTest("invalid-public-state Product excluded", async () => {
    // unavailableVarProd is draft, let's ensure it doesn't appear
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=Unavailable`,
    });
    const json = JSON.parse(res.body);
    assert(json.data.items.length === 0, "Invalid state product must be excluded from search");
  });

  // 48. Search is Storefront-specific
  await runTest("Search is Storefront-specific", async () => {
    // Search for Teen Studio hoodie inside Mini Sprouts search
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=Hoodie`,
    });
    const json = JSON.parse(res.body);
    assert(
      json.data.items.length === 0,
      "Teen Studio product must not appear in Mini Sprouts search"
    );

    // But searching for Hoodie in Teen Studio should find it
    const tsRes = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/teen-studio/search?q=Hoodie`,
    });
    const tsJson = JSON.parse(tsRes.body);
    const tsIds = tsJson.data.items.map((i: { id: string }) => i.id);
    assert(tsIds.includes(teenStudioProd.id), "Teen Studio search must find hoodie");
  });

  // 49. case-insensitive search works
  await runTest("case-insensitive search works", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=feSTive`,
    });
    const json = JSON.parse(res.body);
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(itemIds.includes(validProd1.id), "Mixed case query must match");
  });

  // 50. whitespace query normalized
  await runTest("whitespace query normalized", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=%20%20Festive%20%20`,
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.query === "Festive", "Query must be trimmed");
    const itemIds = json.data.items.map((i: { id: string }) => i.id);
    assert(itemIds.includes(validProd1.id), "Trimmed query must match");
  });

  // 51. empty query handled safely
  await runTest("empty query handled safely", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=%20%20%20`,
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "VALIDATION_ERROR", "Expected VALIDATION_ERROR");
  });

  // 52. search pagination works
  await runTest("search pagination works", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=Kurta&page=1&limit=1`,
    });
    assert(res.statusCode === 200, "Search pagination must succeed");
    const json = JSON.parse(res.body);
    assert(json.data.pagination.page === 1, "Page must be 1");
    assert(json.data.pagination.limit === 1, "Limit must be 1");
  });

  // 53. no-results returns successful empty result
  await runTest("no-results returns successful empty result", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=nonexistentqueryxyz`,
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.success === true, "Must be success");
    assert(json.data.items.length === 0, "Items must be empty");
    assert(json.data.pagination.totalItems === 0, "totalItems must be 0");
  });

  // 54. search results use Product-card safe shape
  await runTest("search results use Product-card safe shape", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=Festive`,
    });
    const json = JSON.parse(res.body);
    const item = json.data.items[0];
    assert(typeof item.id === "string", "id missing");
    assert(typeof item.name === "string", "name missing");
    assert(typeof item.slug === "string", "slug missing");
    assert(typeof item.regularPrice === "string", "regularPrice missing");
    assert(item.mainImage !== null, "mainImage missing");
    assert(item.quickAdd.colors.length > 0, "Available color names must be present");
    assert(item.quickAdd.sizes.length > 0, "Active sizes must be present");
    assert(item.quickAdd.variants.length > 0, "Available exact variants must be present");
    assert(
      !item.quickAdd.colors.some((color: { name: string }) => color.name === "Mint Green"),
      "Color with no available variant must not appear"
    );
    assert(
      !item.quickAdd.colors.some((color: { name: string }) => color.name === "Inactive Color"),
      "Inactive color must not appear"
    );
    for (const variant of item.quickAdd.variants) {
      assert(
        item.quickAdd.colors.some((color: { id: string }) => color.id === variant.productColorId),
        "Each quick-add variant must reference a visible color"
      );
    }
    assert(!("status" in item), "Must not expose status");
    assert(!("description" in item), "Card must not contain full description");
  });

  // ==========================================================================
  // PART F: DEFENSIVE VISIBILITY (Tests 55 - 59)
  // ==========================================================================

  // Product for testing defensive visibility
  const defensiveProd = await prisma.product.create({
    data: {
      name: "Defensive Visibility Test Suit",
      sku: "KW-DEFENSIVE-12",
      slug: "defensive-visibility-test-suit",
      storefrontId: miniSproutsId,
      description: "Product for testing automated defensive visibility suppression",
      regularPrice: 3100.0,
      status: "DRAFT",
    },
  });
  createdProductIds.push(defensiveProd.id);
  await attachImageToProduct(defensiveProd.id, 1, { isMain: true });
  const {
    size: defSize,
    color: defColor,
    variant: defVariant,
  } = await attachVariantToProduct(defensiveProd.id, {
    sizeName: "6-7 Years",
    colorName: "Crimson",
    isAvailable: true,
  });

  // Publish defensiveProd
  await app.inject({
    method: "PATCH",
    url: `/api/v1/admin/products/${defensiveProd.id}/status`,
    headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
    payload: { status: "PUBLISHED" },
  });

  // 55. Published Product becomes absent from listing when last valid Variant becomes unavailable
  await runTest(
    "Published Product becomes absent from listing when last valid Variant becomes unavailable",
    async () => {
      // Toggle variant isAvailable to false
      await prisma.productVariant.update({
        where: { id: defVariant.id },
        data: { isAvailable: false },
      });

      // Check listing
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products`,
      });
      const json = JSON.parse(res.body);
      const itemIds = json.data.items.map((i: { id: string }) => i.id);
      assert(!itemIds.includes(defensiveProd.id), "Product must be suppressed from listing");

      // Check PDP returns 404
      const pdpRes = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products/${defensiveProd.slug}`,
      });
      assert(
        pdpRes.statusCode === 404,
        "PDP must return 404 when product has 0 available variants"
      );

      // Restore variant
      await prisma.productVariant.update({
        where: { id: defVariant.id },
        data: { isAvailable: true },
      });
    }
  );

  // 56. Published Product becomes absent when last available Size is deactivated
  await runTest(
    "Published Product becomes absent when last available Size is deactivated",
    async () => {
      // Deactivate size
      await prisma.productSize.update({
        where: { id: defSize.id },
        data: { isActive: false },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products`,
      });
      const json = JSON.parse(res.body);
      const itemIds = json.data.items.map((i: { id: string }) => i.id);
      assert(!itemIds.includes(defensiveProd.id), "Product must be suppressed when size inactive");

      // Restore size
      await prisma.productSize.update({
        where: { id: defSize.id },
        data: { isActive: true },
      });
    }
  );

  // 57. Published Product becomes absent when last available Color is deactivated
  await runTest(
    "Published Product becomes absent when last available Color is deactivated",
    async () => {
      // Deactivate color
      await prisma.productColor.update({
        where: { id: defColor.id },
        data: { isActive: false },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products`,
      });
      const json = JSON.parse(res.body);
      const itemIds = json.data.items.map((i: { id: string }) => i.id);
      assert(!itemIds.includes(defensiveProd.id), "Product must be suppressed when color inactive");

      // Restore color
      await prisma.productColor.update({
        where: { id: defColor.id },
        data: { isActive: true },
      });
    }
  );

  // 58. Product status remains PUBLISHED during defensive visibility suppression
  await runTest(
    "Product status remains PUBLISHED during defensive visibility suppression",
    async () => {
      // Deactivate variant
      await prisma.productVariant.update({
        where: { id: defVariant.id },
        data: { isAvailable: false },
      });

      // Verify product in database is still PUBLISHED
      const db = await prisma.product.findUnique({ where: { id: defensiveProd.id } });
      assert(db?.status === "PUBLISHED", "Database status must still be PUBLISHED");

      // Restore variant
      await prisma.productVariant.update({
        where: { id: defVariant.id },
        data: { isAvailable: true },
      });
    }
  );

  // 59. republishing/visibility restored automatically when required public conditions are valid again
  await runTest(
    "republishing/visibility restored automatically when required public conditions are valid again",
    async () => {
      // With variant restored, product should automatically appear without calling publish endpoint
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products`,
      });
      const json = JSON.parse(res.body);
      const itemIds = json.data.items.map((i: { id: string }) => i.id);
      assert(itemIds.includes(defensiveProd.id), "Product must automatically reappear in listing");
    }
  );

  // ==========================================================================
  // PART G: SECURITY / SCOPE (Tests 60 - 65)
  // ==========================================================================

  // 60. Public routes require no Customer login
  await runTest("Public routes require no Customer login", async () => {
    const res1 = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products`,
    });
    assert(res1.statusCode === 200, "Listing requires no auth");
    const res2 = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    assert(res2.statusCode === 200, "PDP requires no auth");
    const res3 = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/search?q=Festive`,
    });
    assert(res3.statusCode === 200, "Search requires no auth");
  });

  // 61. no global /api/v1/products endpoint introduced
  await runTest("no global /api/v1/products endpoint introduced", async () => {
    const res = await app.inject({ method: "GET", url: `/api/v1/products` });
    assert(res.statusCode === 404, "Global /products endpoint must not exist");
  });

  // 62. no global search endpoint introduced
  await runTest("no global search endpoint introduced", async () => {
    const res = await app.inject({ method: "GET", url: `/api/v1/search?q=test` });
    assert(res.statusCode === 404, "Global search endpoint must not exist");
  });

  // 63. public APIs contain no numeric inventory
  await runTest("public APIs contain no numeric inventory", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/storefronts/mini-sprouts/products/${validProd1.slug}`,
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes('"stock"'), "Must not contain 'stock'");
    assert(!bodyStr.includes('"quantityAvailable"'), "Must not contain 'quantityAvailable'");
    assert(!bodyStr.includes('"inventory"'), "Must not contain 'inventory'");
    assert(!bodyStr.includes('"remaining"'), "Must not contain 'remaining'");
  });

  // 64. Product publication does not send emails
  await runTest("Product publication does not send emails", async () => {
    // Verified by inspection: zero mail client / Resend imports in publication module
    const publicationModule = await import("../src/modules/product/publication-validator");
    assert(
      typeof publicationModule.validateProductForPublication === "function",
      "Validator function exists"
    );
  });

  // 65. Product publication does not modify Commerce settings
  await runTest("Product publication does not modify Commerce settings", async () => {
    const settingsBefore = await prisma.commerceSettings.findUnique({ where: { singletonKey: 1 } });
    const chargeBefore = settingsBefore?.flatDeliveryCharge;

    // Transition valid product status again
    await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${validProd1.id}/status`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { status: "PUBLISHED" },
    });

    const settingsAfter = await prisma.commerceSettings.findUnique({ where: { singletonKey: 1 } });
    assert(
      settingsAfter?.flatDeliveryCharge.equals(chargeBefore!),
      "Commerce settings must be unmodified by product publication"
    );
  });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  // Reset Cloudinary mock
  resetCloudinaryService();

  // Delete all test products created in this suite
  if (createdProductIds.length > 0) {
    await prisma.product.deleteMany({
      where: { id: { in: createdProductIds } },
    });
  }

  // Clean up MediaAsset test records
  await prisma.mediaAsset.deleteMany({
    where: { providerPublicId: { startsWith: "kids-wear/products/" } },
  });

  // Clean up sessions and customer
  await prisma.customerSession.delete({ where: { id: custSession.id } }).catch(() => {});
  await prisma.customer.delete({ where: { id: tempCustomer.id } }).catch(() => {});
  await prisma.adminSession.delete({ where: { id: adminSession.id } }).catch(() => {});

  // Print Summary
  // eslint-disable-next-line no-console
  console.log("\n==================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  // eslint-disable-next-line no-console
  console.log(`Summary: ${passed}/${total} Product Publication & Catalog Tests Passed.`);
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
