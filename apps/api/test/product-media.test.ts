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
  public failNextLookup = false;

  async createUploadSignature(params: UploadSignatureParams): Promise<UploadSignatureResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `kids-wear/products/${params.productId}`;
    const fileId = crypto.randomUUID();
    const publicId = `${folder}/${fileId}`;
    const resourceType: "image" | "video" = params.mediaType === "IMAGE" ? "image" : "video";

    return {
      timestamp,
      signature: "mock_signature_" + crypto.randomBytes(16).toString("hex"),
      apiKey: "test_cloudinary_api_key",
      cloudName: "test_cloudinary_cloud_name",
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
    if (this.failNextLookup) {
      this.failNextLookup = false;
      throw new NotFoundError("Media asset not found in Cloudinary", "MEDIA_ASSET_NOT_FOUND");
    }

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
  console.log("Starting Kids Wear — Work Unit 8 Product Media & Cloudinary Test Suite...\n");

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
  await prisma.customerSession
    .deleteMany({
      where: { customer: { email: { startsWith: "media.security" } } },
    })
    .catch(() => {});
  await prisma.customer
    .deleteMany({
      where: { email: { startsWith: "media.security" } },
    })
    .catch(() => {});

  const tempCustomer = await prisma.customer.create({
    data: {
      fullName: "Media Security Tester",
      email: `media.security.${Date.now()}@example.com`,
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
      name: "WU8 Test Product 1",
      sku: "KW-WU8-PROD-01",
      slug: "wu8-test-prod-01",
      storefrontId: miniSproutsId,
      description: "Test product 1 for media attachments",
      regularPrice: 1999.0,
      status: "DRAFT",
    },
  });

  const testProduct2 = await prisma.product.create({
    data: {
      name: "WU8 Test Product 2",
      sku: "KW-WU8-PROD-02",
      slug: "wu8-test-prod-02",
      storefrontId: miniSproutsId,
      description: "Test product 2 for cross-product media isolation",
      regularPrice: 2499.0,
      status: "DRAFT",
    },
  });

  const prod1Id = testProduct1.id;
  const prod2Id = testProduct2.id;

  // ==========================================================================
  // PART A — SECURITY
  // ==========================================================================

  // 1. unauthenticated Product media list rejected
  await runTest("unauthenticated Product media list rejected", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/media`,
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 2. Customer cookie cannot access Product media
  await runTest("Customer cookie cannot access Product media", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: { cookie: customerCookieHeader },
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 3. upload signature requires Admin auth
  await runTest("upload signature requires Admin auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
      payload: { mediaType: "IMAGE" },
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 4. upload signature mutation requires Admin CSRF
  await runTest("upload signature mutation requires Admin CSRF", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
      headers: { cookie: adminCookieHeader },
      payload: { mediaType: "IMAGE" },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_MISSING", `Expected CSRF_MISSING, got ${json.error.code}`);
  });

  // 5. Customer CSRF cannot request upload signature
  await runTest("Customer CSRF cannot request upload signature", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": customerCsrf,
      },
      payload: { mediaType: "IMAGE" },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_INVALID", `Expected CSRF_INVALID, got ${json.error.code}`);
  });

  // 6. media registration requires Admin CSRF
  await runTest("media registration requires Admin CSRF", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: { cookie: adminCookieHeader },
      payload: {
        publicId: `kids-wear/products/${prod1Id}/sample`,
        mediaType: "IMAGE",
      },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_MISSING", `Expected CSRF_MISSING, got ${json.error.code}`);
  });

  // ==========================================================================
  // PART B — UPLOAD SIGNING
  // ==========================================================================

  // 7. IMAGE signed-upload request succeeds with server-controlled Product namespace
  await runTest(
    "IMAGE signed-upload request succeeds with server-controlled Product namespace",
    async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
        headers: {
          cookie: adminCookieHeader,
          "x-csrf-token": adminCsrf,
        },
        payload: { mediaType: "IMAGE" },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.success === true, "Response must be success");
      assert(typeof json.data.signature === "string", "Signature must be a string");
      assert(typeof json.data.timestamp === "number", "Timestamp must be a number");
      assert(json.data.resourceType === "image", "Resource type must be image");
      assert(json.data.folder === `kids-wear/products/${prod1Id}`, "Folder mismatch");
      assert(
        json.data.publicId.startsWith(`kids-wear/products/${prod1Id}/`),
        "Public ID must be in product namespace"
      );
    }
  );

  // 8. VIDEO signed-upload request succeeds
  await runTest("VIDEO signed-upload request succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { mediaType: "VIDEO" },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.resourceType === "video", "Resource type must be video");
  });

  // 9. unsupported media type rejected
  await runTest("unsupported media type rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { mediaType: "AUDIO" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 10. unknown Product rejected
  await runTest("unknown Product rejected", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${fakeId}/media/upload-signature`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { mediaType: "IMAGE" },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_NOT_FOUND",
      `Expected PRODUCT_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 11. response never exposes API secret
  await runTest("response never exposes API secret", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { mediaType: "IMAGE" },
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes("apiSecret"), "Response must not contain apiSecret");
    assert(!bodyStr.includes("api_secret"), "Response must not contain api_secret");
    assert(
      !bodyStr.includes("CLOUDINARY_API_SECRET"),
      "Response must not contain CLOUDINARY_API_SECRET"
    );
  });

  // 12. Client-supplied folder rejected
  await runTest("Client-supplied folder rejected", async () => {
    // Attempt folder in upload-signature
    const sigRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        mediaType: "IMAGE",
        folder: "attacker-controlled-folder",
      },
    });
    assert(sigRes.statusCode === 400, `Expected 400, got ${sigRes.statusCode}`);
    const sigJson = JSON.parse(sigRes.body);
    assert(
      sigJson.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${sigJson.error.code}`
    );

    // Attempt folder in media registration
    const regRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        publicId: `kids-wear/products/${prod1Id}/sample`,
        mediaType: "IMAGE",
        folder: "attacker-controlled-folder",
      },
    });
    assert(regRes.statusCode === 400, `Expected 400, got ${regRes.statusCode}`);
    const regJson = JSON.parse(regRes.body);
    assert(
      regJson.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${regJson.error.code}`
    );
  });

  // 13. Client-supplied public ID/signing identity rejected where applicable
  await runTest(
    "Client-supplied public ID/signing identity rejected where applicable",
    async () => {
      // Client cannot specify publicId in signature request
      const pubIdRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
        headers: {
          cookie: adminCookieHeader,
          "x-csrf-token": adminCsrf,
        },
        payload: {
          mediaType: "IMAGE",
          publicId: "attacker-controlled-public-id",
        },
      });
      assert(pubIdRes.statusCode === 400, `Expected 400, got ${pubIdRes.statusCode}`);
      const pubIdJson = JSON.parse(pubIdRes.body);
      assert(
        pubIdJson.error.code === "VALIDATION_ERROR",
        `Expected VALIDATION_ERROR, got ${pubIdJson.error.code}`
      );

      // Client cannot specify signature, apiKey, or timestamp in signature request
      const extraSigRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
        headers: {
          cookie: adminCookieHeader,
          "x-csrf-token": adminCsrf,
        },
        payload: {
          mediaType: "IMAGE",
          signature: "forged-signature",
        },
      });
      assert(extraSigRes.statusCode === 400, `Expected 400, got ${extraSigRes.statusCode}`);
    }
  );

  // ==========================================================================
  // PART C — CLOUDINARY VERIFICATION & REGISTRATION
  // ==========================================================================

  const validImg1PublicId = `kids-wear/products/${prod1Id}/img-1`;
  mockCloudinary.mockResources.set(validImg1PublicId, {
    publicId: validImg1PublicId,
    secureUrl: `https://res.cloudinary.com/test/image/upload/v1/${validImg1PublicId}.jpg`,
    resourceType: "image",
    format: "jpg",
    width: 1200,
    height: 1500,
    bytes: 150000,
  });

  let img1MediaId = "";

  // 13. verified image registration succeeds
  await runTest("verified image registration succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        publicId: validImg1PublicId,
        mediaType: "IMAGE",
        altText: "Main Front View",
        sortOrder: 1,
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.media.mediaType === "IMAGE", "mediaType mismatch");
    assert(json.data.media.width === 1200, "width mismatch");
    assert(json.data.media.height === 1500, "height mismatch");
    assert(json.data.media.altText === "Main Front View", "altText mismatch");
    assert(json.data.media.isMain === false, "isMain should initially be false");
    assert(json.data.media.isHover === false, "isHover should initially be false");
    img1MediaId = json.data.media.id;
  });

  // 14. First image registration leaves isMain=false
  await runTest("First image registration leaves isMain=false", async () => {
    const dbMedia = await prisma.productMedia.findUnique({ where: { id: img1MediaId } });
    assert(dbMedia !== null, "img1 must exist in DB");
    assert(dbMedia.isMain === false, "First image must have isMain=false in DB");
    assert(dbMedia.isHover === false, "First image must have isHover=false in DB");
  });

  // 15. Draft Product may have images with zero Main
  await runTest("Draft Product may have images with zero Main", async () => {
    // Create an isolated draft product
    const draftProd = await prisma.product.create({
      data: {
        name: "Zero Main Draft Product",
        sku: "KW-ZERO-MAIN-DRAFT",
        slug: "zero-main-draft",
        storefrontId: miniSproutsId,
        description: "Test product for verifying draft products with zero main images",
        regularPrice: 1500.0,
        status: "DRAFT",
      },
    });
    const d1PubId = `kids-wear/products/${draftProd.id}/draft-img-1`;
    const d2PubId = `kids-wear/products/${draftProd.id}/draft-img-2`;
    mockCloudinary.mockResources.set(d1PubId, {
      publicId: d1PubId,
      secureUrl: `https://res.cloudinary.com/test/image/upload/v1/${d1PubId}.jpg`,
      resourceType: "image",
      format: "jpg",
      width: 1200,
      height: 1500,
      bytes: 120000,
    });
    mockCloudinary.mockResources.set(d2PubId, {
      publicId: d2PubId,
      secureUrl: `https://res.cloudinary.com/test/image/upload/v1/${d2PubId}.jpg`,
      resourceType: "image",
      format: "jpg",
      width: 1200,
      height: 1500,
      bytes: 130000,
    });

    await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${draftProd.id}/media`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { publicId: d1PubId, mediaType: "IMAGE" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${draftProd.id}/media`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { publicId: d2PubId, mediaType: "IMAGE" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${draftProd.id}/media`,
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, "Draft product media list should succeed");
    const json = JSON.parse(res.body);
    assert(json.data.media.length === 2, "Expected 2 registered images");
    assert(json.data.media[0].isMain === false, "Image 1 must have isMain=false");
    assert(json.data.media[1].isMain === false, "Image 2 must have isMain=false");

    const dbProd = await prisma.product.findUnique({ where: { id: draftProd.id } });
    assert(dbProd?.status === "DRAFT", "Product must remain in DRAFT status");

    // Clean up draft product
    await prisma.product.delete({ where: { id: draftProd.id } });
  });

  const validVid1PublicId = `kids-wear/products/${prod1Id}/vid-1`;
  mockCloudinary.mockResources.set(validVid1PublicId, {
    publicId: validVid1PublicId,
    secureUrl: `https://res.cloudinary.com/test/video/upload/v1/${validVid1PublicId}.mp4`,
    resourceType: "video",
    format: "mp4",
    width: 1080,
    height: 1350,
    bytes: 850000,
    duration: 12.4,
  });

  let vid1MediaId = "";

  // 14. verified video registration succeeds
  await runTest("verified video registration succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        publicId: validVid1PublicId,
        mediaType: "VIDEO",
        sortOrder: 9,
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.media.mediaType === "VIDEO", "mediaType mismatch");
    assert(json.data.media.width === 1080, "width mismatch");
    assert(json.data.media.height === 1350, "height mismatch");
    assert(json.data.media.duration === 12.4, "duration mismatch");
    vid1MediaId = json.data.media.id;
  });

  // 15. nonexistent Cloudinary resource rejected
  await runTest("nonexistent Cloudinary resource rejected", async () => {
    const nonExistentId = `kids-wear/products/${prod1Id}/non-existent`;
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        publicId: nonExistentId,
        mediaType: "IMAGE",
      },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "MEDIA_ASSET_NOT_FOUND",
      `Expected MEDIA_ASSET_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 16. resource type mismatch rejected
  await runTest("resource type mismatch rejected", async () => {
    // vid1 is video, but client attempts to register as IMAGE
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        publicId: validVid1PublicId,
        mediaType: "IMAGE",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "MEDIA_RESOURCE_TYPE_INVALID",
      `Expected MEDIA_RESOURCE_TYPE_INVALID, got ${json.error.code}`
    );
  });

  // 17. external/foreign Product namespace rejected
  await runTest("external/foreign Product namespace rejected", async () => {
    const foreignPublicId = `kids-wear/products/${prod2Id}/img-foreign`;
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        publicId: foreignPublicId,
        mediaType: "IMAGE",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_MEDIA_FOREIGN_PRODUCT",
      `Expected PRODUCT_MEDIA_FOREIGN_PRODUCT, got ${json.error.code}`
    );
  });

  // 18. incorrect image dimensions rejected
  await runTest("incorrect image dimensions rejected", async () => {
    const badDimImg = `kids-wear/products/${prod1Id}/bad-dim-img`;
    mockCloudinary.mockResources.set(badDimImg, {
      publicId: badDimImg,
      secureUrl: `https://res.cloudinary.com/test/image/upload/v1/${badDimImg}.jpg`,
      resourceType: "image",
      format: "jpg",
      width: 800,
      height: 600, // not 1200x1500
      bytes: 90000,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        publicId: badDimImg,
        mediaType: "IMAGE",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "MEDIA_DIMENSIONS_INVALID",
      `Expected MEDIA_DIMENSIONS_INVALID, got ${json.error.code}`
    );
  });

  // 19. incorrect video dimensions rejected
  await runTest("incorrect video dimensions rejected", async () => {
    const badDimVid = `kids-wear/products/${prod1Id}/bad-dim-vid`;
    mockCloudinary.mockResources.set(badDimVid, {
      publicId: badDimVid,
      secureUrl: `https://res.cloudinary.com/test/video/upload/v1/${badDimVid}.mp4`,
      resourceType: "video",
      format: "mp4",
      width: 1920,
      height: 1080, // not 1080x1350
      bytes: 900000,
      duration: 10,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        publicId: badDimVid,
        mediaType: "VIDEO",
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "MEDIA_DIMENSIONS_INVALID",
      `Expected MEDIA_DIMENSIONS_INVALID, got ${json.error.code}`
    );
  });

  // 20. failed Cloudinary verification creates no MediaAsset/ProductMedia
  await runTest("failed Cloudinary verification creates no MediaAsset/ProductMedia", async () => {
    const badDimImg = `kids-wear/products/${prod1Id}/bad-dim-img`;
    const assetBefore = await prisma.mediaAsset.findFirst({
      where: { providerPublicId: badDimImg },
    });
    assert(assetBefore === null, "Asset must not exist in DB before");
    const mediaBefore = await prisma.productMedia.findFirst({
      where: { productId: prod1Id, mediaAsset: { providerPublicId: badDimImg } },
    });
    assert(mediaBefore === null, "ProductMedia must not exist in DB");
  });

  // ==========================================================================
  // PART D — LIMITS (8 images, 1 video)
  // ==========================================================================

  // Helper to register valid images
  const registeredImageIds: string[] = [img1MediaId];

  // 21. Product can attach image 1 through image 8
  await runTest("Product can attach image 1 through image 8", async () => {
    for (let i = 2; i <= 8; i++) {
      const publicId = `kids-wear/products/${prod1Id}/img-${i}`;
      mockCloudinary.mockResources.set(publicId, {
        publicId,
        secureUrl: `https://res.cloudinary.com/test/image/upload/v1/${publicId}.jpg`,
        resourceType: "image",
        format: "jpg",
        width: 1200,
        height: 1500,
        bytes: 120000,
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/products/${prod1Id}/media`,
        headers: {
          cookie: adminCookieHeader,
          "x-csrf-token": adminCsrf,
        },
        payload: {
          publicId,
          mediaType: "IMAGE",
          sortOrder: i,
        },
      });
      assert(res.statusCode === 201, `Expected 201 for image ${i}, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      registeredImageIds.push(json.data.media.id);
    }
    assert(registeredImageIds.length === 8, "Expected 8 registered images");
  });

  // 22. image 9 rejected
  await runTest("image 9 rejected", async () => {
    const publicId = `kids-wear/products/${prod1Id}/img-9`;
    mockCloudinary.mockResources.set(publicId, {
      publicId,
      secureUrl: `https://res.cloudinary.com/test/image/upload/v1/${publicId}.jpg`,
      resourceType: "image",
      format: "jpg",
      width: 1200,
      height: 1500,
      bytes: 120000,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        publicId,
        mediaType: "IMAGE",
        sortOrder: 9,
      },
    });
    assert(res.statusCode === 400, `Expected 400 for image 9, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_IMAGE_LIMIT_REACHED",
      `Expected PRODUCT_IMAGE_LIMIT_REACHED, got ${json.error.code}`
    );
  });

  // 23. first Product video accepted
  await runTest("first Product video accepted", async () => {
    const videoCount = await prisma.productMedia.count({
      where: { productId: prod1Id, mediaAsset: { mediaType: "VIDEO" } },
    });
    assert(videoCount === 1, "Exactly 1 video should exist from test 14");
  });

  // 24. second Product video rejected
  await runTest("second Product video rejected", async () => {
    const secondVidPublicId = `kids-wear/products/${prod1Id}/vid-2`;
    mockCloudinary.mockResources.set(secondVidPublicId, {
      publicId: secondVidPublicId,
      secureUrl: `https://res.cloudinary.com/test/video/upload/v1/${secondVidPublicId}.mp4`,
      resourceType: "video",
      format: "mp4",
      width: 1080,
      height: 1350,
      bytes: 700000,
      duration: 8,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: {
        publicId: secondVidPublicId,
        mediaType: "VIDEO",
      },
    });
    assert(res.statusCode === 400, `Expected 400 for 2nd video, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_VIDEO_LIMIT_REACHED",
      `Expected PRODUCT_VIDEO_LIMIT_REACHED, got ${json.error.code}`
    );
  });

  // 25. failed limit operation creates no partial association
  await runTest("failed limit operation creates no partial association", async () => {
    const imageCount = await prisma.productMedia.count({
      where: { productId: prod1Id, mediaAsset: { mediaType: "IMAGE" } },
    });
    const videoCount = await prisma.productMedia.count({
      where: { productId: prod1Id, mediaAsset: { mediaType: "VIDEO" } },
    });
    assert(imageCount === 8, `Image count must remain 8, got ${imageCount}`);
    assert(videoCount === 1, `Video count must remain 1, got ${videoCount}`);
  });

  // ==========================================================================
  // PART E — LISTING
  // ==========================================================================

  // 26. Product media list succeeds
  await runTest("Product media list succeeds", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: { cookie: adminCookieHeader },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.media.length === 9, `Expected 9 total media, got ${json.data.media.length}`);
  });

  // 27. deterministic ordering verified
  await runTest("deterministic ordering verified", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: { cookie: adminCookieHeader },
    });
    const json = JSON.parse(res.body);
    const media = json.data.media;
    for (let i = 0; i < media.length - 1; i++) {
      assert(
        media[i].sortOrder <= media[i + 1].sortOrder,
        "Media must be ordered by sortOrder ASC"
      );
    }
  });

  // 28. response contains approved media metadata
  await runTest("response contains approved media metadata", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: { cookie: adminCookieHeader },
    });
    const json = JSON.parse(res.body);
    const first = json.data.media[0];
    assert(typeof first.id === "string", "id missing");
    assert(typeof first.productId === "string", "productId missing");
    assert(typeof first.mediaAssetId === "string", "mediaAssetId missing");
    assert(typeof first.mediaType === "string", "mediaType missing");
    assert(typeof first.secureUrl === "string", "secureUrl missing");
    assert(typeof first.width === "number", "width missing");
    assert(typeof first.height === "number", "height missing");
    assert(typeof first.isMain === "boolean", "isMain missing");
    assert(typeof first.isHover === "boolean", "isHover missing");
  });

  // 29. response does not expose secret/signature fields
  await runTest("response does not expose secret/signature fields", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: { cookie: adminCookieHeader },
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes("apiSecret"), "Response must not contain apiSecret");
    assert(!bodyStr.includes("signature"), "Response must not contain signature");
  });

  // ==========================================================================
  // PART F — METADATA UPDATE
  // ==========================================================================

  // 30. alt text update succeeds
  await runTest("alt text update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img1MediaId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { altText: "Updated Alt Text Description" },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.media.altText === "Updated Alt Text Description", "altText not updated");
  });

  // 31. sort order update succeeds
  await runTest("sort order update succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img1MediaId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { sortOrder: 0 },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.media.sortOrder === 0, "sortOrder not updated");
  });

  // 32. generic PATCH rejects Main role mutation
  await runTest("generic PATCH rejects Main role mutation", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img1MediaId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { isMain: true },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 33. generic PATCH rejects Hover role mutation
  await runTest("generic PATCH rejects Hover role mutation", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img1MediaId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { isHover: true },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 34. generic PATCH rejects Cloudinary identity mutation
  await runTest("generic PATCH rejects Cloudinary identity mutation", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img1MediaId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { publicId: "new-id" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 35. cross-Product ProductMedia update rejected
  await runTest("cross-Product ProductMedia update rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod2Id}/media/${img1MediaId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { altText: "Hacked" },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_MEDIA_NOT_FOUND",
      `Expected PRODUCT_MEDIA_NOT_FOUND, got ${json.error.code}`
    );
  });

  // ==========================================================================
  // PART G — MAIN IMAGE
  // ==========================================================================

  // 36. Explicit Main assignment succeeds
  await runTest("Explicit Main assignment succeeds", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img1MediaId}/main`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.media.isMain === true, "isMain should be true");
    const db = await prisma.productMedia.findUnique({ where: { id: img1MediaId } });
    assert(db?.isMain === true, "isMain must be true in DB");
  });

  // 37. assigning new Main atomically removes previous Main
  const img2MediaId = registeredImageIds[1];
  await runTest("assigning new Main atomically removes previous Main", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img2MediaId}/main`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.media.isMain === true, "img2 should be main");

    // Check img1 in DB is no longer main
    const img1 = await prisma.productMedia.findUnique({ where: { id: img1MediaId } });
    assert(img1?.isMain === false, "img1 must no longer be main");
  });

  // 38. video cannot be Main
  await runTest("video cannot be Main", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${vid1MediaId}/main`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "MEDIA_RESOURCE_TYPE_INVALID",
      `Expected MEDIA_RESOURCE_TYPE_INVALID, got ${json.error.code}`
    );
  });

  // 39. Main Image direct deletion rejected
  await runTest("Main Image direct deletion rejected", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod1Id}/media/${img2MediaId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_MAIN_MEDIA_DELETE_FORBIDDEN",
      `Expected PRODUCT_MAIN_MEDIA_DELETE_FORBIDDEN, got ${json.error.code}`
    );
  });

  // 40. Main uniqueness remains enforced
  await runTest("Main uniqueness remains enforced", async () => {
    const img3MediaId = registeredImageIds[2];
    await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img3MediaId}/main`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    const mainCount = await prisma.productMedia.count({
      where: { productId: prod1Id, isMain: true },
    });
    assert(mainCount === 1, `Exactly 1 main image allowed, found ${mainCount}`);

    // Verify DB-level constraint prevents duplicate Main rows on same product
    let dbRejected = false;
    try {
      const extraAsset = await prisma.mediaAsset.create({
        data: {
          mediaType: "IMAGE",
          provider: "cloudinary",
          providerPublicId: `kids-wear/products/${prod1Id}/db-test-asset-main-unique`,
          secureUrl: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
          width: 1200,
          height: 1500,
          bytes: 100000,
          format: "jpg",
        },
      });
      await prisma.productMedia.create({
        data: {
          productId: prod1Id,
          mediaAssetId: extraAsset.id,
          isMain: true,
        },
      });
    } catch (err: unknown) {
      dbRejected = true;
      const errMsg = err instanceof Error ? err.message : String(err);
      assert(
        errMsg.includes("product_media_main_unique") || errMsg.includes("Unique constraint failed"),
        `Expected unique constraint violation, got: ${errMsg}`
      );
    }
    assert(
      dbRejected,
      "PostgreSQL partial unique index product_media_main_unique must reject second Main row"
    );
  });

  // ==========================================================================
  // PART H — HOVER IMAGE
  // ==========================================================================

  const img4MediaId = registeredImageIds[3];
  const img5MediaId = registeredImageIds[4];

  // 41. image can be assigned Hover
  await runTest("image can be assigned Hover", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img4MediaId}/hover`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.media.isHover === true, "isHover should be true");
  });

  // 42. assigning new Hover removes prior Hover
  await runTest("assigning new Hover removes prior Hover", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img5MediaId}/hover`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.media.isHover === true, "img5 should be hover");

    const img4 = await prisma.productMedia.findUnique({ where: { id: img4MediaId } });
    assert(img4?.isHover === false, "img4 should no longer be hover");
  });

  // 43. video cannot be Hover
  await runTest("video cannot be Hover", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${vid1MediaId}/hover`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "MEDIA_RESOURCE_TYPE_INVALID",
      `Expected MEDIA_RESOURCE_TYPE_INVALID, got ${json.error.code}`
    );
  });

  // 44. Hover designation can be cleared without deleting media
  await runTest("Hover designation can be cleared without deleting media", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod1Id}/media/hover`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const img5 = await prisma.productMedia.findUnique({ where: { id: img5MediaId } });
    assert(img5 !== null, "img5 must still exist");
    assert(img5.isHover === false, "img5 isHover must be false");
  });

  // 45. clearing Hover does not affect Main role
  await runTest("clearing Hover does not affect Main role", async () => {
    const mainCount = await prisma.productMedia.count({
      where: { productId: prod1Id, isMain: true },
    });
    assert(mainCount === 1, "Main image must still exist after clearing hover");
  });

  // 46. Main and Hover independence follows approved rule
  await runTest("Main and Hover independence follows approved rule", async () => {
    const img3MediaId = registeredImageIds[2];
    // img3MediaId is currently Main (isMain === true, isHover === false)
    const img3Before = await prisma.productMedia.findUnique({ where: { id: img3MediaId } });
    assert(img3Before?.isMain === true, "img3 must currently be main");
    assert(img3Before?.isHover === false, "img3 must currently not be hover");

    // 1. Assign img3 as Hover as well
    const setHoverRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img3MediaId}/hover`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(setHoverRes.statusCode === 200, `Expected 200, got ${setHoverRes.statusCode}`);
    const setHoverJson = JSON.parse(setHoverRes.body);
    assert(setHoverJson.data.media.isMain === true, "img3 must remain main");
    assert(setHoverJson.data.media.isHover === true, "img3 must now also be hover");

    // 2. Verify in PostgreSQL that a single row in ProductMedia holds BOTH isMain=true and isHover=true
    const img3Db = await prisma.productMedia.findUnique({ where: { id: img3MediaId } });
    assert(
      img3Db?.isMain === true && img3Db?.isHover === true,
      "PostgreSQL row must simultaneously hold isMain=true and isHover=true"
    );

    // 3. Assign a different image as Hover (img4MediaId)
    await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img4MediaId}/hover`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    const img3AfterImg4Hover = await prisma.productMedia.findUnique({ where: { id: img3MediaId } });
    assert(
      img3AfterImg4Hover?.isMain === true,
      "img3 must retain isMain=true when another image becomes hover"
    );
    assert(
      img3AfterImg4Hover?.isHover === false,
      "img3 isHover must be false when another image becomes hover"
    );

    // 4. Set img4 as Main as well -> img4 now holds both Main and Hover
    await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img4MediaId}/main`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    const img4Db = await prisma.productMedia.findUnique({ where: { id: img4MediaId } });
    assert(img4Db?.isMain === true, "img4 must be main");
    assert(img4Db?.isHover === true, "img4 must retain hover");

    // 5. Clear Hover -> img4 retains isMain=true
    await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod1Id}/media/hover`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    const img4AfterClearHover = await prisma.productMedia.findUnique({
      where: { id: img4MediaId },
    });
    assert(img4AfterClearHover?.isMain === true, "img4 must still be main after hover cleared");
    assert(img4AfterClearHover?.isHover === false, "img4 isHover must be false");
  });

  // ==========================================================================
  // PART I — REORDER
  // ==========================================================================

  // 46. media reorder succeeds
  await runTest("media reorder succeeds", async () => {
    const currentList = await prisma.productMedia.findMany({
      where: { productId: prod1Id },
      orderBy: { createdAt: "asc" },
    });
    const reversedIds = currentList.map((m) => m.id).reverse();

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/reorder`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { mediaIds: reversedIds },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    const updatedMedia = json.data.media;
    assert(updatedMedia[0].id === reversedIds[0], "First item ID mismatch after reorder");
    assert(updatedMedia[0].sortOrder === 0, "First item sortOrder must be 0");
  });

  // 47. duplicate IDs rejected
  await runTest("duplicate IDs rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/reorder`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { mediaIds: [img1MediaId, img1MediaId] },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "VALIDATION_ERROR",
      `Expected VALIDATION_ERROR, got ${json.error.code}`
    );
  });

  // 48. foreign-Product media ID rejected
  await runTest("foreign-Product media ID rejected", async () => {
    // Register 1 media on prod2
    const prod2Img = `kids-wear/products/${prod2Id}/p2-img`;
    mockCloudinary.mockResources.set(prod2Img, {
      publicId: prod2Img,
      secureUrl: `https://res.cloudinary.com/test/image/upload/v1/${prod2Img}.jpg`,
      resourceType: "image",
      format: "jpg",
      width: 1200,
      height: 1500,
      bytes: 100000,
    });
    const regRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod2Id}/media`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { publicId: prod2Img, mediaType: "IMAGE" },
    });
    const prod2MediaId = JSON.parse(regRes.body).data.media.id;

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/reorder`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { mediaIds: [img1MediaId, prod2MediaId] },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_MEDIA_FOREIGN_PRODUCT",
      `Expected PRODUCT_MEDIA_FOREIGN_PRODUCT, got ${json.error.code}`
    );
  });

  // 49. unknown ID rejected
  await runTest("unknown ID rejected", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/reorder`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { mediaIds: ["00000000-0000-0000-0000-000000000000"] },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_MEDIA_NOT_FOUND",
      `Expected PRODUCT_MEDIA_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 50. failed reorder does not partially modify ordering
  await runTest("failed reorder does not partially modify ordering", async () => {
    const beforeList = await prisma.productMedia.findMany({
      where: { productId: prod1Id },
      orderBy: { sortOrder: "asc" },
    });
    await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/reorder`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { mediaIds: ["00000000-0000-0000-0000-000000000000"] },
    });
    const afterList = await prisma.productMedia.findMany({
      where: { productId: prod1Id },
      orderBy: { sortOrder: "asc" },
    });
    assert(beforeList[0].id === afterList[0].id, "Order should not have changed on failed request");
  });

  // ==========================================================================
  // PART J — DELETE
  // ==========================================================================

  // 51. non-Main ProductMedia deletion succeeds
  let deletedAssetId = "";
  await runTest("non-Main ProductMedia deletion succeeds", async () => {
    // img1 is currently non-main (img3 is main)
    const mediaToDelete = await prisma.productMedia.findUnique({
      where: { id: img1MediaId },
    });
    assert(
      mediaToDelete !== null && mediaToDelete.isMain === false,
      "img1 must exist and not be main"
    );
    deletedAssetId = mediaToDelete.mediaAssetId;

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod1Id}/media/${img1MediaId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const checkDb = await prisma.productMedia.findUnique({ where: { id: img1MediaId } });
    assert(checkDb === null, "ProductMedia row must be deleted");
  });

  // 52. deleting ProductMedia preserves MediaAsset
  await runTest("deleting ProductMedia preserves MediaAsset", async () => {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: deletedAssetId } });
    assert(asset !== null, "Underlying MediaAsset must still exist in DB");
  });

  // 53. deleting Hover ProductMedia succeeds
  await runTest("deleting Hover ProductMedia succeeds", async () => {
    // Make img6 hover, then delete it
    const img6MediaId = registeredImageIds[5];
    await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/media/${img6MediaId}/hover`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod1Id}/media/${img6MediaId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const check = await prisma.productMedia.findUnique({ where: { id: img6MediaId } });
    assert(check === null, "Hover ProductMedia should be deleted");
  });

  // 54. cross-Product delete rejected
  await runTest("cross-Product delete rejected", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod2Id}/media/${img2MediaId}`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_MEDIA_NOT_FOUND",
      `Expected PRODUCT_MEDIA_NOT_FOUND, got ${json.error.code}`
    );
  });

  // 55. unknown ProductMedia delete returns 404
  await runTest("unknown ProductMedia delete returns 404", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod1Id}/media/00000000-0000-0000-0000-000000000000`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
    });
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_MEDIA_NOT_FOUND",
      `Expected PRODUCT_MEDIA_NOT_FOUND, got ${json.error.code}`
    );
  });

  // ==========================================================================
  // PART K — SCOPE PROTECTION
  // ==========================================================================

  // 56. Product remains DRAFT after media operations
  await runTest("Product remains DRAFT after media operations", async () => {
    const prod = await prisma.product.findUnique({ where: { id: prod1Id } });
    assert(prod?.status === "DRAFT", `Expected DRAFT, got ${prod?.status}`);
  });

  // 57. media operation cannot set Product PUBLISHED
  await runTest("media operation cannot set Product PUBLISHED", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${prod1Id}/status`,
      headers: {
        cookie: adminCookieHeader,
        "x-csrf-token": adminCsrf,
      },
      payload: { status: "PUBLISHED" },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "PRODUCT_NOT_PUBLISHABLE" ||
        json.error.code === "PRODUCT_PUBLICATION_NOT_AVAILABLE",
      `Expected PRODUCT_NOT_PUBLISHABLE, got ${json.error.code}`
    );
  });

  // 58. no numeric inventory introduced
  await runTest("no numeric inventory introduced", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: { cookie: adminCookieHeader },
    });
    const bodyStr = res.body;
    assert(!bodyStr.includes('"stock"'), "Response must not contain 'stock'");
    assert(!bodyStr.includes('"quantity"'), "Response must not contain 'quantity'");
    assert(!bodyStr.includes('"inventory"'), "Response must not contain 'inventory'");
  });

  // 59. Cloudinary test double does not bypass DB/business validation
  await runTest("Cloudinary test double does not bypass DB/business validation", async () => {
    // 1. Unauthenticated request rejected before reaching Cloudinary
    const unauthRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
      payload: { mediaType: "IMAGE" },
    });
    assert(unauthRes.statusCode === 401, "Auth guard must run");

    // 2. CSRF guard rejected before reaching Cloudinary
    const noCsrfRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media/upload-signature`,
      headers: { cookie: adminCookieHeader },
      payload: { mediaType: "IMAGE" },
    });
    assert(noCsrfRes.statusCode === 403, "CSRF guard must run");

    // 3. Database product existence check runs before signature creation
    const nonExistentProdRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/00000000-0000-0000-0000-000000000000/media/upload-signature`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { mediaType: "IMAGE" },
    });
    assert(nonExistentProdRes.statusCode === 404, "DB product lookup check must run");

    // 4. Dimension validation runs and rejects invalid dimensions even if Cloudinary returns them
    const badDimPubId = `kids-wear/products/${prod1Id}/test-double-bad-dim`;
    mockCloudinary.mockResources.set(badDimPubId, {
      publicId: badDimPubId,
      secureUrl: `https://res.cloudinary.com/test/image/upload/v1/${badDimPubId}.jpg`,
      resourceType: "image",
      format: "jpg",
      width: 1000, // invalid (must be 1200x1500)
      height: 1000,
      bytes: 50000,
    });
    const badDimRes = await app.inject({
      method: "POST",
      url: `/api/v1/admin/products/${prod1Id}/media`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
      payload: { publicId: badDimPubId, mediaType: "IMAGE" },
    });
    assert(badDimRes.statusCode === 400, "Dimension business validation must run");

    // 5. Deleting Main image returns 409 conflict
    const currentMain = await prisma.productMedia.findFirst({
      where: { productId: prod1Id, isMain: true },
    });
    assert(currentMain !== null, "Main image must exist");
    const delMainRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${prod1Id}/media/${currentMain.id}`,
      headers: { cookie: adminCookieHeader, "x-csrf-token": adminCsrf },
    });
    assert(delMainRes.statusCode === 409, "Main deletion business validation must run");
  });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  // Reset Cloudinary Service
  resetCloudinaryService();

  // Delete test products (cascades to product media)
  await prisma.product.deleteMany({
    where: { id: { in: [prod1Id, prod2Id] } },
  });

  // Clean up MediaAsset test records and any referencing ProductMedia
  await prisma.productMedia.deleteMany({
    where: { mediaAsset: { providerPublicId: { startsWith: "kids-wear/products/" } } },
  });

  await prisma.mediaAsset.deleteMany({
    where: { providerPublicId: { startsWith: "kids-wear/products/" } },
  });

  // Clean up sessions and customer
  await prisma.customerSession.delete({ where: { id: custSession.id } }).catch(() => {});
  await prisma.customer.delete({ where: { id: tempCustomer.id } }).catch(() => {});
  await prisma.adminSession.delete({ where: { id: adminSession.id } }).catch(() => {});

  // Summary
  // eslint-disable-next-line no-console
  console.log("\n==================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  // eslint-disable-next-line no-console
  console.log(`Summary: ${passed}/${total} Product Media & Cloudinary Tests Passed.`);
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
