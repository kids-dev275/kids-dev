import crypto from "crypto";
import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import {
  setCloudinaryService,
  resetCloudinaryService,
  ICloudinaryService,
  UploadSignatureParams,
  UploadSignatureResult,
  ReviewUploadSignatureParams,
  ReviewUploadSignatureResult,
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
import { ReviewStatus, MediaType, ProductStatus } from "@prisma/client";
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

class MockCloudinaryService implements ICloudinaryService {
  public mockResources: Map<string, CloudinaryResourceMetadata> = new Map();
  public deletedResources: string[] = [];
  public failNextCleanup = false;

  async createUploadSignature(params: UploadSignatureParams): Promise<UploadSignatureResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `kids-wear/products/${params.productId}`;
    const fileId = crypto.randomUUID();
    const publicId = `${folder}/${fileId}`;
    return {
      timestamp,
      signature: "mock_sig_" + crypto.randomBytes(8).toString("hex"),
      apiKey: "test_cloudinary_api_key",
      cloudName: "test_cloudinary_cloud_name",
      resourceType: params.mediaType === "IMAGE" ? "image" : "video",
      folder,
      publicId,
    };
  }

  async createReviewUploadSignature(
    params: ReviewUploadSignatureParams
  ): Promise<ReviewUploadSignatureResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `kids-wear/reviews/${params.reviewSubmissionId}`;
    const fileId = crypto.randomUUID();
    const publicId = `${folder}/${fileId}`;
    return {
      timestamp,
      signature: "mock_review_sig_" + crypto.randomBytes(8).toString("hex"),
      apiKey: "test_cloudinary_api_key",
      cloudName: "test_cloudinary_cloud_name",
      resourceType: "image",
      folder,
      publicId,
    };
  }

  async fetchResourceMetadata(
    publicId: string,
    resourceType: "image" | "video"
  ): Promise<CloudinaryResourceMetadata> {
    const res = this.mockResources.get(publicId);
    if (!res) {
      throw new NotFoundError("Media asset not found in Cloudinary", "MEDIA_ASSET_NOT_FOUND");
    }
    return res;
  }

  async deleteResource(publicId: string, resourceType: "image" | "video" = "image"): Promise<void> {
    if (this.failNextCleanup) {
      this.failNextCleanup = false;
      throw new Error("Simulated Cloudinary deletion failure");
    }
    this.deletedResources.push(publicId);
  }
}

async function main() {
  const prisma = getPrismaClient();
  const mockCloudinary = new MockCloudinaryService();
  setCloudinaryService(mockCloudinary);

  const app = await buildApp();
  await app.ready();

  let adminSessionCookie = "";
  let adminCsrfToken = "";
  let customerSessionCookie = "";
  let customerCsrfToken = "";

  let adminSessionId: string | null = null;
  let customerId: string | null = null;
  let customerSessionId: string | null = null;

  let ipSeq = 1;
  function nextTestIp(): string {
    ipSeq += 1;
    return `10.42.${Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}`;
  }

  const origInject = app.inject.bind(app);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.inject = function (opts: any) {
    if (opts && typeof opts === "object" && !opts.remoteAddress) {
      opts.remoteAddress = nextTestIp();
    }
    return origInject(opts);
  } as any;

  // Test Storefront & Products
  let miniStorefrontId = "";
  let eligibleProductId = "";
  let draftProductId = "";
  let inactiveProductId = "";
  let invisibleProductId = "";

  // Cleanup helper
  const createdReviewIds: string[] = [];
  const createdMediaAssetIds: string[] = [];
  const createdProductIds: string[] = [];

  try {
    // 1. Setup Admin Account and Session
    let admin = await prisma.adminUser.findUnique({ where: { email: TEST_ADMIN_EMAIL } });
    if (!admin) {
      const passwordHash = await hashPassword(TEST_ADMIN_PASSWORD);
      admin = await prisma.adminUser.create({
        data: {
          email: TEST_ADMIN_EMAIL,
          passwordHash,
          singletonKey: 1,
        },
      });
    }

    const adminRawToken = generateAdminRawToken();
    const adminTokenHash = hashAdminToken(adminRawToken);
    const adminSession = await prisma.adminSession.create({
      data: {
        adminUserId: admin.id,
        tokenHash: adminTokenHash,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });

    adminSessionId = adminSession.id;
    adminSessionCookie = `kw_admin_session=${adminRawToken}`;
    adminCsrfToken = generateAdminCsrfToken(adminRawToken);

    // 2. Setup Customer Account and Session
    const customerPasswordHash = await hashPassword("CustomerPassword123!");
    const customer = await prisma.customer.create({
      data: {
        fullName: "Test Customer",
        email: `review_cust_${Date.now()}@example.com`,
        passwordHash: customerPasswordHash,
      },
    });
    customerId = customer.id;

    const customerRawToken = generateRawCustomerSessionToken();
    const customerTokenHash = hashCustomerSessionToken(customerRawToken);
    const customerSession = await prisma.customerSession.create({
      data: {
        customerId: customer.id,
        tokenHash: customerTokenHash,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });
    customerSessionId = customerSession.id;

    customerSessionCookie = `kw_customer_session=${customerRawToken}`;
    customerCsrfToken = generateCustomerCsrfToken(customerRawToken);

    // 3. Setup Storefront & Test Products
    const mini = await prisma.storefront.findUnique({ where: { slug: "mini-sprouts" } });
    assert(!!mini, "Mini Sprouts storefront must exist");
    miniStorefrontId = mini!.id;

    // A. Eligible Published Product
    const eligibleProd = await prisma.product.create({
      data: {
        storefrontId: miniStorefrontId,
        name: "Eligible Festive Kurta",
        sku: `SKU-REV-ELIG-${Date.now()}`,
        slug: `eligible-festive-kurta-${Date.now()}`,
        description: "Comfortable organic cotton kurta for kids.",
        regularPrice: "2499.00",
        status: ProductStatus.PUBLISHED,
      },
    });
    eligibleProductId = eligibleProd.id;
    createdProductIds.push(eligibleProductId);

    const size1 = await prisma.productSize.create({
      data: { productId: eligibleProductId, name: "2-3Y", sortOrder: 1, isActive: true },
    });
    const color1 = await prisma.productColor.create({
      data: { productId: eligibleProductId, name: "Yellow", sortOrder: 1, isActive: true },
    });
    await prisma.productVariant.create({
      data: {
        productId: eligibleProductId,
        productSizeId: size1.id,
        productColorId: color1.id,
        isAvailable: true,
      },
    });

    const mainAsset = await prisma.mediaAsset.create({
      data: {
        mediaType: MediaType.IMAGE,
        provider: "cloudinary",
        providerPublicId: `kids-wear/products/${eligibleProductId}/main`,
        secureUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        width: 1200,
        height: 1500,
        format: "jpg",
        bytes: 102400,
      },
    });
    createdMediaAssetIds.push(mainAsset.id);

    await prisma.productMedia.create({
      data: {
        productId: eligibleProductId,
        mediaAssetId: mainAsset.id,
        isMain: true,
        isHover: false,
      },
    });

    // B. Draft Product
    const draftProd = await prisma.product.create({
      data: {
        storefrontId: miniStorefrontId,
        name: "Draft Unreleased Kurta",
        sku: `SKU-REV-DRAFT-${Date.now()}`,
        slug: `draft-unreleased-kurta-${Date.now()}`,
        description: "Draft kurta description.",
        regularPrice: "1999.00",
        status: ProductStatus.DRAFT,
      },
    });
    draftProductId = draftProd.id;
    createdProductIds.push(draftProductId);

    // C. Inactive Product
    const inactiveProd = await prisma.product.create({
      data: {
        storefrontId: miniStorefrontId,
        name: "Inactive Archival Kurta",
        sku: `SKU-REV-INACT-${Date.now()}`,
        slug: `inactive-archival-kurta-${Date.now()}`,
        description: "Inactive kurta description.",
        regularPrice: "2999.00",
        status: ProductStatus.INACTIVE,
      },
    });
    inactiveProductId = inactiveProd.id;
    createdProductIds.push(inactiveProductId);

    // D. Published but Defensively Invisible Product (No available variants)
    const invisProd = await prisma.product.create({
      data: {
        storefrontId: miniStorefrontId,
        name: "Invisible Out-Of-Stock Kurta",
        sku: `SKU-REV-INVIS-${Date.now()}`,
        slug: `invisible-kurta-${Date.now()}`,
        description: "Invisible kurta description.",
        regularPrice: "2199.00",
        status: ProductStatus.PUBLISHED,
      },
    });
    invisibleProductId = invisProd.id;
    createdProductIds.push(invisibleProductId);

    // ========================================================================
    // Section 1: Public Submission (Tests 1–18)
    // ========================================================================
    // eslint-disable-next-line no-console
    console.log("\nSection 1: Public Review Submission (Tests 1–18)");

    await runTest("1. submission requires no login", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Anonymous Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Lovely stitching and vibrant color. Fit is true to size.",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.success === true, "Must return success true");
      assert(json.data.submitted === true, "Must confirm submitted true");
    });

    await runTest("2. valid text-only Review creates PENDING", async () => {
      const text = `High quality fabric test ${Date.now()}`;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Sobia Khan",
          productId: eligibleProductId,
          rating: 4,
          reviewText: text,
        },
      });
      assert(res.statusCode === 201, "Expected 201");
      const dbReview = await prisma.review.findFirst({
        where: { reviewText: text },
      });
      assert(!!dbReview, "Review must be persisted");
      assert(dbReview!.status === ReviewStatus.PENDING, "Must start in PENDING status");
      assert(dbReview!.customerId === null, "customerId must be null");
      createdReviewIds.push(dbReview!.id);
    });

    await runTest(
      "2a. markup-like Review text is stored as plain trimmed text, not HTML entities",
      async () => {
        const rawText = "   I like <this> outfit & the fabric.   ";
        const rawName = "   Amna <Parent> & Co.   ";
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/reviews",
          payload: {
            name: rawName,
            productId: eligibleProductId,
            rating: 5,
            reviewText: rawText,
          },
        });
        assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
        const dbReview = await prisma.review.findFirst({
          where: { reviewerName: "Amna <Parent> & Co." },
        });
        assert(!!dbReview, "Review must be found in database");
        createdReviewIds.push(dbReview!.id);

        // Plain text validation: trimmed, not HTML entities
        assert(
          dbReview!.reviewText === "I like <this> outfit & the fabric.",
          "Review text must be stored as plain trimmed text, NOT HTML encoded"
        );
        assert(!dbReview!.reviewText.includes("&lt;"), "Database must not contain &lt;");
        assert(!dbReview!.reviewText.includes("&amp;"), "Database must not contain &amp;");

        // Reviewer name validation: trimmed, not HTML entities
        assert(
          dbReview!.reviewerName === "Amna <Parent> & Co.",
          "Reviewer name must be stored as plain trimmed text, NOT HTML encoded"
        );
        assert(!dbReview!.reviewerName.includes("&lt;"), "Reviewer name must not contain &lt;");
        assert(!dbReview!.reviewerName.includes("&amp;"), "Reviewer name must not contain &amp;");
      }
    );

    await runTest("2b. public API returns text content safely as JSON", async () => {
      // Find the review created in 2a and approve it
      const dbReview = await prisma.review.findFirst({
        where: { reviewerName: "Amna <Parent> & Co." },
      });
      assert(!!dbReview, "Review must exist");
      await prisma.review.update({
        where: { id: dbReview!.id },
        data: { status: ReviewStatus.APPROVED },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/reviews?productId=${eligibleProductId}`,
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      const targetReview = json.data.reviews.find((r: { id: string }) => r.id === dbReview!.id);
      assert(!!targetReview, "Approved review must be returned in public API");
      assert(
        targetReview.reviewText === "I like <this> outfit & the fabric.",
        "JSON response must return plain text exactly"
      );
      assert(
        targetReview.reviewerName === "Amna <Parent> & Co.",
        "JSON response must return plain reviewer name exactly"
      );
    });

    await runTest("3. Product must exist", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Test Parent",
          productId: crypto.randomUUID(),
          rating: 5,
          reviewText: "Review for non-existent product in database.",
        },
      });
      assert(res.statusCode === 400, "Expected 400 for nonexistent product");
    });

    await runTest("4. Draft Product rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Test Parent",
          productId: draftProductId,
          rating: 5,
          reviewText: "Review attempting to review unreleased draft product.",
        },
      });
      assert(res.statusCode === 400, "Draft product review must be rejected");
    });

    await runTest("5. Inactive Product rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Test Parent",
          productId: inactiveProductId,
          rating: 5,
          reviewText: "Review attempting to review inactive product.",
        },
      });
      assert(res.statusCode === 400, "Inactive product review must be rejected");
    });

    await runTest("6. publicly invisible Product rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Test Parent",
          productId: invisibleProductId,
          rating: 5,
          reviewText: "Review attempting to review defensively invisible product.",
        },
      });
      assert(res.statusCode === 400, "Defensively invisible product review must be rejected");
    });

    await runTest("7. name required", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Valid text without reviewer name provided in payload.",
        },
      });
      assert(res.statusCode === 400, "Missing name must fail");
    });

    await runTest("8. whitespace name rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "   ",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Valid text with whitespace-only reviewer name.",
        },
      });
      assert(res.statusCode === 400, "Whitespace name must fail");
    });

    await runTest("9. Review text required", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Valid Name",
          productId: eligibleProductId,
          rating: 5,
        },
      });
      assert(res.statusCode === 400, "Missing reviewText must fail");
    });

    await runTest("10. whitespace Review rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Valid Name",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "            ",
        },
      });
      assert(res.statusCode === 400, "Whitespace reviewText must fail");
    });

    await runTest("11. rating 1 accepted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Valid Parent",
          productId: eligibleProductId,
          rating: 1,
          reviewText: "Did not like the fit for my toddler at all.",
        },
      });
      assert(res.statusCode === 201, "Rating 1 must be accepted");
    });

    await runTest("12. rating 5 accepted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Valid Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Absolutely beautiful material and premium packaging.",
        },
      });
      assert(res.statusCode === 201, "Rating 5 must be accepted");
    });

    await runTest("13. rating 0 rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Valid Parent",
          productId: eligibleProductId,
          rating: 0,
          reviewText: "Rating zero must be rejected by schema and DB.",
        },
      });
      assert(res.statusCode === 400, "Rating 0 must fail");
    });

    await runTest("14. rating 6 rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Valid Parent",
          productId: eligibleProductId,
          rating: 6,
          reviewText: "Rating 6 must be rejected by schema and DB.",
        },
      });
      assert(res.statusCode === 400, "Rating 6 must fail");
    });

    await runTest("15. fractional rating rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Valid Parent",
          productId: eligibleProductId,
          rating: 4.5,
          reviewText: "Fractional rating 4.5 must fail integer validation.",
        },
      });
      assert(res.statusCode === 400, "Fractional rating must fail");
    });

    await runTest("16. unknown fields rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Valid Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Review containing unknown extra properties.",
          unknownField: "malicious_payload",
        },
      });
      assert(res.statusCode === 400, "Strict schema must reject unknown fields");
    });

    await runTest("17. customerId overposting rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Valid Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Attempting to claim customerId in review submission.",
          customerId: customer.id,
        },
      });
      assert(res.statusCode === 400, "customerId overposting must fail");
    });

    await runTest("18. status overposting rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Valid Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Attempting to auto-approve review by sending status APPROVED.",
          status: "APPROVED",
        },
      });
      assert(res.statusCode === 400, "status overposting must fail");
    });

    // ========================================================================
    // Section 2: Review Media & Cloudinary Handling (Tests 19–29)
    // ========================================================================
    // eslint-disable-next-line no-console
    console.log("\nSection 2: Review Media & Cloudinary Handling (Tests 19–29)");

    await runTest("19. zero images accepted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Zero Images Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Review with empty images array accepted.",
          images: [],
        },
      });
      assert(res.statusCode === 201, "Empty images array must succeed");
    });

    await runTest("20. one verified image accepted", async () => {
      const submissionId = crypto.randomUUID();
      const publicId = `kids-wear/reviews/${submissionId}/img-1`;

      mockCloudinary.mockResources.set(publicId, {
        publicId,
        secureUrl: "https://res.cloudinary.com/test/image/upload/img-1.jpg",
        resourceType: "image",
        format: "jpg",
        width: 1200,
        height: 1200,
        bytes: 85000,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Single Photo Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Review with exactly one verified photo attached.",
          reviewSubmissionId: submissionId,
          images: [{ publicId }],
        },
      });

      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const dbReview = await prisma.review.findFirst({
        where: { reviewerName: "Single Photo Parent" },
        include: { media: { include: { mediaAsset: true } } },
      });
      assert(!!dbReview, "Review must be persisted");
      assert(dbReview!.media.length === 1, "Must have exactly 1 media asset");
      assert(dbReview!.media[0].mediaAsset.providerPublicId === publicId, "Public ID must match");
      createdReviewIds.push(dbReview!.id);
      createdMediaAssetIds.push(dbReview!.media[0].mediaAsset.id);
    });

    await runTest("21. three verified images accepted", async () => {
      const submissionId = crypto.randomUUID();
      const images: Array<{ publicId: string }> = [];

      for (let i = 1; i <= 3; i++) {
        const publicId = `kids-wear/reviews/${submissionId}/img-${i}`;
        mockCloudinary.mockResources.set(publicId, {
          publicId,
          secureUrl: `https://res.cloudinary.com/test/image/upload/img-${i}.jpg`,
          resourceType: "image",
          format: "jpg",
          width: 1200,
          height: 1200,
          bytes: 80000,
        });
        images.push({ publicId });
      }

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Three Photos Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Review with maximum 3 photos attached.",
          reviewSubmissionId: submissionId,
          images,
        },
      });

      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const dbReview = await prisma.review.findFirst({
        where: { reviewerName: "Three Photos Parent" },
        include: { media: true },
      });
      assert(!!dbReview, "Review must be persisted");
      assert(dbReview!.media.length === 3, "Must have 3 media assets");
      createdReviewIds.push(dbReview!.id);
    });

    await runTest("22. four images rejected", async () => {
      const submissionId = crypto.randomUUID();
      const images: Array<{ publicId: string }> = [];
      for (let i = 1; i <= 4; i++) {
        images.push({ publicId: `kids-wear/reviews/${submissionId}/img-${i}` });
      }

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Four Photos Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Review with 4 photos must be rejected by schema.",
          reviewSubmissionId: submissionId,
          images,
        },
      });
      assert(res.statusCode === 400, "More than 3 images must fail validation");
    });

    await runTest("23. video asset rejected", async () => {
      const submissionId = crypto.randomUUID();
      const publicId = `kids-wear/reviews/${submissionId}/video-1`;

      mockCloudinary.mockResources.set(publicId, {
        publicId,
        secureUrl: "https://res.cloudinary.com/test/video/upload/video.mp4",
        resourceType: "video",
        format: "mp4",
        width: 1080,
        height: 1350,
        bytes: 500000,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Video Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Review trying to submit a video file.",
          reviewSubmissionId: submissionId,
          images: [{ publicId }],
        },
      });
      assert(res.statusCode === 400, "Video asset must be rejected");
    });

    await runTest("24. unsupported format rejected", async () => {
      const submissionId = crypto.randomUUID();
      const publicId = `kids-wear/reviews/${submissionId}/vector-1`;

      mockCloudinary.mockResources.set(publicId, {
        publicId,
        secureUrl: "https://res.cloudinary.com/test/image/upload/vector.svg",
        resourceType: "image",
        format: "svg",
        width: 800,
        height: 800,
        bytes: 12000,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "SVG Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Review with SVG format must be rejected.",
          reviewSubmissionId: submissionId,
          images: [{ publicId }],
        },
      });
      assert(res.statusCode === 400, "SVG image format must be rejected");
    });

    await runTest("25. unrelated Cloudinary namespace rejected", async () => {
      const submissionId = crypto.randomUUID();
      const unrelatedPublicId = `kids-wear/products/${eligibleProductId}/main`;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Tamper Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Review trying to attach a product media asset directly.",
          reviewSubmissionId: submissionId,
          images: [{ publicId: unrelatedPublicId }],
        },
      });
      assert(res.statusCode === 400, "Foreign namespace must be rejected");
    });

    await runTest("26. nonexistent Cloudinary asset rejected", async () => {
      const submissionId = crypto.randomUUID();
      const publicId = `kids-wear/reviews/${submissionId}/ghost-asset`;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Ghost Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Review referencing a nonexistent Cloudinary asset.",
          reviewSubmissionId: submissionId,
          images: [{ publicId }],
        },
      });
      assert(res.statusCode === 400, "Nonexistent Cloudinary asset must fail");
    });

    await runTest("27. no Cloudinary secret exposed", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews/media/sign",
        payload: {
          reviewSubmissionId: crypto.randomUUID(),
        },
      });
      assert(res.statusCode === 200, "Sign endpoint must return 200");
      const json = JSON.parse(res.body);
      assert(!json.data.apiSecret, "Must not expose apiSecret");
      assert(!res.body.includes("development-api-secret"), "Must not leak secret in body");
    });

    await runTest("28. Review + media DB registration atomic", async () => {
      const submissionId = crypto.randomUUID();
      const publicId = `kids-wear/reviews/${submissionId}/img-atomic`;

      mockCloudinary.mockResources.set(publicId, {
        publicId,
        secureUrl: "https://res.cloudinary.com/test/image/upload/img-atomic.jpg",
        resourceType: "image",
        format: "jpg",
        width: 1200,
        height: 1200,
        bytes: 90000,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "Atomic Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Atomic persistence test review.",
          reviewSubmissionId: submissionId,
          images: [{ publicId }],
        },
      });

      assert(res.statusCode === 201, "Must return 201");
      const review = await prisma.review.findFirst({
        where: { reviewerName: "Atomic Parent" },
        include: { media: true },
      });
      assert(!!review && review.media.length === 1, "Review and media must exist simultaneously");
      createdReviewIds.push(review!.id);
    });

    await runTest(
      "29. failed DB registration does not produce successful Review response",
      async () => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/reviews",
          payload: {
            name: "Invalid Rating DB Fail",
            productId: eligibleProductId,
            rating: 7, // violates DB CHECK
            reviewText: "Invalid rating value.",
          },
        });
        assert(res.statusCode === 400, "Must fail with 400");
      }
    );

    // ========================================================================
    // Section 3: Public Retrieval & Moderation Boundary (Tests 30–38)
    // ========================================================================
    // eslint-disable-next-line no-console
    console.log("\nSection 3: Public Retrieval & Moderation Boundary (Tests 30–38)");

    // Create 1 APPROVED review, 1 PENDING review, 1 HIDDEN review for testing
    const approvedReview = await prisma.review.create({
      data: {
        productId: eligibleProductId,
        reviewerName: "Approved Parent 1",
        rating: 5,
        reviewText: "This approved review should be visible publicly.",
        status: ReviewStatus.APPROVED,
      },
    });
    createdReviewIds.push(approvedReview.id);

    const pendingReview = await prisma.review.create({
      data: {
        productId: eligibleProductId,
        reviewerName: "Pending Parent 1",
        rating: 4,
        reviewText: "This pending review must not be visible publicly.",
        status: ReviewStatus.PENDING,
      },
    });
    createdReviewIds.push(pendingReview.id);

    const hiddenReview = await prisma.review.create({
      data: {
        productId: eligibleProductId,
        reviewerName: "Hidden Parent 1",
        rating: 2,
        reviewText: "This hidden review must not be visible publicly.",
        status: ReviewStatus.HIDDEN,
      },
    });
    createdReviewIds.push(hiddenReview.id);

    await runTest("30. public endpoint returns only APPROVED", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      const names = json.data.reviews.map((r: { reviewerName: string }) => r.reviewerName);
      assert(names.includes("Approved Parent 1"), "Must include Approved review");
      assert(!names.includes("Pending Parent 1"), "Must NOT include Pending review");
      assert(!names.includes("Hidden Parent 1"), "Must NOT include Hidden review");
    });

    await runTest("31. pending excluded", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/reviews?productId=${eligibleProductId}`,
      });
      const json = JSON.parse(res.body);
      const pendingFound = json.data.reviews.some(
        (r: { reviewerName: string }) => r.reviewerName === "Pending Parent 1"
      );
      assert(!pendingFound, "Pending reviews must be excluded");
    });

    await runTest("32. hidden excluded", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/reviews?productId=${eligibleProductId}`,
      });
      const json = JSON.parse(res.body);
      const hiddenFound = json.data.reviews.some(
        (r: { reviewerName: string }) => r.reviewerName === "Hidden Parent 1"
      );
      assert(!hiddenFound, "Hidden reviews must be excluded");
    });

    await runTest("33. Product filter works", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/reviews?productId=${eligibleProductId}`,
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.data.reviews.length > 0, "Must return reviews for eligible product");
      for (const r of json.data.reviews) {
        assert(r.product.id === eligibleProductId, "Every returned review must belong to product");
      }
    });

    await runTest("34. Storefront filter works", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews?storefrontSlug=mini-sprouts",
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      for (const r of json.data.reviews) {
        assert(r.product.storefrontSlug === "mini-sprouts", "Must match storefront slug");
      }
    });

    await runTest("35. pagination works", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews?page=1&limit=1",
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.data.reviews.length <= 1, "Must respect limit 1");
      assert(json.data.pagination.page === 1, "Page must be 1");
      assert(json.data.pagination.limit === 1, "Limit must be 1");
    });

    await runTest("36. newest/stable ordering works", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews?limit=10",
      });
      const json = JSON.parse(res.body);
      const reviews = json.data.reviews;
      for (let i = 0; i < reviews.length - 1; i++) {
        const d1 = new Date(reviews[i].createdAt).getTime();
        const d2 = new Date(reviews[i + 1].createdAt).getTime();
        assert(d1 >= d2, "Must be sorted newest first");
      }
    });

    await runTest("36a. storefront review ranking returns top-rated published reviews first", async () => {
      const rankedReviews = [];
      for (const [name, rating, createdAt] of [
        ["Rated Five Older", 5, "2026-01-01T00:00:00.000Z"],
        ["Rated Five Newer", 5, "2026-01-02T00:00:00.000Z"],
        ["Rated Four", 4, "2026-01-03T00:00:00.000Z"],
        ["Rated Three", 3, "2026-01-04T00:00:00.000Z"],
      ] as const) {
        const review = await prisma.review.create({
          data: {
            productId: eligibleProductId,
            reviewerName: name,
            rating,
            createdAt: new Date(createdAt),
            reviewText: "Published review for storefront ranking verification.",
            status: ReviewStatus.APPROVED,
          },
        });
        rankedReviews.push(review);
        createdReviewIds.push(review.id);
      }
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/reviews?productId=${eligibleProductId}&storefrontSlug=mini-sprouts&sort=rating&limit=4`,
      });
      assert(res.statusCode === 200, "Must return 200");
      const reviews = JSON.parse(res.body).data.reviews;
      assert(reviews.length === 4, "Must return exactly the top four reviews");
      assert(
        reviews.every((review: { rating: number }) => review.rating === 5),
        "Lower-rated reviews must fall outside the top four"
      );
      const ids = reviews.map((review: { id: string }) => review.id);
      assert(ids.includes(rankedReviews[0].id), "Older five-star review must be present");
      assert(ids.includes(rankedReviews[1].id), "Newer five-star review must be present");
      assert(
        ids.indexOf(rankedReviews[1].id) < ids.indexOf(rankedReviews[0].id),
        "Equal-rated reviews must rank newest first"
      );
      for (let i = 0; i < reviews.length; i++) {
        assert(reviews[i].product.storefrontSlug === "mini-sprouts", "Must stay in storefront");
        if (i > 0) {
          assert(reviews[i - 1].rating >= reviews[i].rating, "Must rank by rating descending");
          if (reviews[i - 1].rating === reviews[i].rating) {
            assert(
              reviews[i - 1].createdAt >= reviews[i].createdAt,
              "Must rank equal ratings newest first"
            );
          }
        }
      }
    });

    await runTest("37. response excludes moderation/internal fields", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      const json = JSON.parse(res.body);
      for (const r of json.data.reviews) {
        assert(r.status === undefined, "Must not expose review status publicly");
        assert(r.customerId === undefined, "Must not expose customerId");
        assert(r.adminId === undefined, "Must not expose adminId");
      }
    });

    await runTest("38. response excludes Cloudinary public IDs/asset IDs", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      const json = JSON.parse(res.body);
      for (const r of json.data.reviews) {
        for (const img of r.images) {
          assert(img.publicId === undefined, "Must not expose publicId in public image");
          assert(img.mediaAssetId === undefined, "Must not expose mediaAssetId in public image");
        }
      }
    });

    // ========================================================================
    // Section 4: Admin Authorization & Permissions (Tests 39–43)
    // ========================================================================
    // eslint-disable-next-line no-console
    console.log("\nSection 4: Admin Authorization & Permissions (Tests 39–43)");

    await runTest("39. Admin list requires Admin session", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/reviews",
      });
      assert(res.statusCode === 401, "Must reject unauthenticated admin list");
    });

    await runTest("40. Customer session cannot access Admin Review API", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/reviews",
        headers: {
          cookie: customerSessionCookie,
        },
      });
      assert(res.statusCode === 401, "Customer session must not access admin reviews");
    });

    await runTest("41. moderation requires Admin session", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/reviews/${pendingReview.id}/status`,
        payload: { status: "APPROVED" },
      });
      assert(res.statusCode === 401, "Moderation without session must return 401");
    });

    await runTest("42. moderation mutation requires Admin CSRF", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/reviews/${pendingReview.id}/status`,
        headers: {
          cookie: adminSessionCookie,
        },
        payload: { status: "APPROVED" },
      });
      assert(res.statusCode === 403, "Moderation without CSRF must return 403");
    });

    await runTest("43. delete requires Admin session + CSRF", async () => {
      const resNoSession = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/reviews/${pendingReview.id}`,
      });
      assert(resNoSession.statusCode === 401, "Delete without session must return 401");

      const resNoCsrf = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/reviews/${pendingReview.id}`,
        headers: {
          cookie: adminSessionCookie,
        },
      });
      assert(resNoCsrf.statusCode === 403, "Delete without CSRF must return 403");
    });

    // ========================================================================
    // Section 5: Approve / Hide Lifecycle (Tests 44–51)
    // ========================================================================
    // eslint-disable-next-line no-console
    console.log("\nSection 5: Approve / Hide Lifecycle (Tests 44–51)");

    const testLifecycleReview = await prisma.review.create({
      data: {
        productId: eligibleProductId,
        reviewerName: "Lifecycle Parent",
        rating: 5,
        reviewText: "Testing complete lifecycle of review moderation states.",
        status: ReviewStatus.PENDING,
      },
    });
    createdReviewIds.push(testLifecycleReview.id);

    await runTest("44. Pending -> Approved succeeds", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/reviews/${testLifecycleReview.id}/status`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
        payload: { status: "APPROVED" },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.data.status === "APPROVED", "Status must become APPROVED");
      assert(json.data.updated === true, "updated must be true");
    });

    await runTest("45. Approved Review appears publicly", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      const json = JSON.parse(res.body);
      const found = json.data.reviews.some(
        (r: { reviewerName: string }) => r.reviewerName === "Lifecycle Parent"
      );
      assert(found, "Newly approved review must appear in public reviews");
    });

    await runTest("46. Approved -> Hidden succeeds", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/reviews/${testLifecycleReview.id}/status`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
        payload: { status: "HIDDEN" },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.data.status === "HIDDEN", "Status must become HIDDEN");
      assert(json.data.updated === true, "updated must be true");
    });

    await runTest("47. Hidden Review disappears publicly", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      const json = JSON.parse(res.body);
      const found = json.data.reviews.some(
        (r: { reviewerName: string }) => r.reviewerName === "Lifecycle Parent"
      );
      assert(!found, "Hidden review must disappear from public reviews");
    });

    await runTest("48. Hidden -> Approved succeeds", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/reviews/${testLifecycleReview.id}/status`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
        payload: { status: "APPROVED" },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.data.status === "APPROVED", "Status must become APPROVED");
      assert(json.data.updated === true, "updated must be true");
    });

    await runTest("49. restored Review reappears publicly", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      const json = JSON.parse(res.body);
      const found = json.data.reviews.some(
        (r: { reviewerName: string }) => r.reviewerName === "Lifecycle Parent"
      );
      assert(found, "Restored review must reappear in public reviews");
    });

    await runTest("50. Pending -> Hidden succeeds", async () => {
      const pReview = await prisma.review.create({
        data: {
          productId: eligibleProductId,
          reviewerName: "Direct Hide Parent",
          rating: 1,
          reviewText: "Testing direct pending to hidden moderation.",
          status: ReviewStatus.PENDING,
        },
      });
      createdReviewIds.push(pReview.id);

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/reviews/${pReview.id}/status`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
        payload: { status: "HIDDEN" },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.data.status === "HIDDEN", "Must update directly to HIDDEN");
    });

    await runTest("51. same-state moderation retry is idempotent", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/reviews/${testLifecycleReview.id}/status`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
        payload: { status: "APPROVED" },
      });
      assert(res.statusCode === 200, "Must return 200 on same-state retry");
      const json = JSON.parse(res.body);
      assert(json.data.updated === false, "updated must be false on idempotent retry");
      assert(json.data.status === "APPROVED", "Status must remain APPROVED");
    });

    await runTest("51a. APPROVED -> PENDING is rejected", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/reviews/${testLifecycleReview.id}/status`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
        payload: { status: "PENDING" },
      });
      assert(res.statusCode === 400, `APPROVED -> PENDING must return 400, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "INVALID_STATUS_TRANSITION",
        `Error code must be INVALID_STATUS_TRANSITION, got ${json.error.code}`
      );
    });

    await runTest("51b. HIDDEN -> PENDING is rejected", async () => {
      // Transition testLifecycleReview to HIDDEN first
      await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/reviews/${testLifecycleReview.id}/status`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
        payload: { status: "HIDDEN" },
      });

      // Now attempt HIDDEN -> PENDING
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/reviews/${testLifecycleReview.id}/status`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
        payload: { status: "PENDING" },
      });
      assert(res.statusCode === 400, `HIDDEN -> PENDING must return 400, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "INVALID_STATUS_TRANSITION",
        `Error code must be INVALID_STATUS_TRANSITION, got ${json.error.code}`
      );

      // Restore back to APPROVED
      await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/reviews/${testLifecycleReview.id}/status`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
        payload: { status: "APPROVED" },
      });
    });

    // ========================================================================
    // Section 6: Delete & Media Cleanup Boundary (Tests 52–57)
    // ========================================================================
    // eslint-disable-next-line no-console
    console.log("\nSection 6: Delete & Media Cleanup Boundary (Tests 52–57)");

    const deleteReviewerName = `Delete Parent ${Date.now()}`;
    const reviewToDelete = await prisma.review.create({
      data: {
        productId: eligibleProductId,
        reviewerName: deleteReviewerName,
        rating: 3,
        reviewText: "This review will be permanently deleted.",
        status: ReviewStatus.APPROVED,
      },
    });

    const delPublicId = `kids-wear/reviews/${crypto.randomUUID()}/del-img`;
    const delMediaAsset = await prisma.mediaAsset.create({
      data: {
        mediaType: MediaType.IMAGE,
        provider: "cloudinary",
        providerPublicId: delPublicId,
        secureUrl: "https://res.cloudinary.com/test/image/upload/del-img.jpg",
      },
    });

    await prisma.reviewMedia.create({
      data: {
        reviewId: reviewToDelete.id,
        mediaAssetId: delMediaAsset.id,
        sortOrder: 0,
      },
    });

    await runTest("52. Admin Delete removes Review", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/reviews/${reviewToDelete.id}`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const dbCheck = await prisma.review.findUnique({
        where: { id: reviewToDelete.id },
      });
      assert(dbCheck === null, "Review must be deleted from DB");
    });

    await runTest("53. associated DB Review media removed", async () => {
      const mediaCheck = await prisma.reviewMedia.findMany({
        where: { reviewId: reviewToDelete.id },
      });
      assert(mediaCheck.length === 0, "Associated ReviewMedia rows must be deleted");
    });

    await runTest("54. deleted Review absent publicly", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      const json = JSON.parse(res.body);
      const found = json.data.reviews.some(
        (r: { reviewerName: string }) => r.reviewerName === deleteReviewerName
      );
      assert(!found, "Deleted review must not appear publicly");
    });

    await runTest("55. Cloudinary deletion attempted for associated media", async () => {
      assert(
        mockCloudinary.deletedResources.includes(delPublicId),
        "Cloudinary deletion must be attempted for associated media publicId"
      );
    });

    await runTest("56. Cloudinary cleanup failure does not resurrect Review", async () => {
      const revFailClean = await prisma.review.create({
        data: {
          productId: eligibleProductId,
          reviewerName: "Fail Cleanup Parent",
          rating: 4,
          reviewText: "Testing Cloudinary cleanup error resilience.",
          status: ReviewStatus.APPROVED,
        },
      });

      const failPublicId = `kids-wear/reviews/${crypto.randomUUID()}/fail-clean`;
      const failAsset = await prisma.mediaAsset.create({
        data: {
          mediaType: MediaType.IMAGE,
          provider: "cloudinary",
          providerPublicId: failPublicId,
          secureUrl: "https://res.cloudinary.com/test/image/upload/fail-clean.jpg",
        },
      });

      await prisma.reviewMedia.create({
        data: {
          reviewId: revFailClean.id,
          mediaAssetId: failAsset.id,
          sortOrder: 0,
        },
      });

      mockCloudinary.failNextCleanup = true;

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/reviews/${revFailClean.id}`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
      });

      assert(res.statusCode === 200, "Admin delete must remain successful despite cleanup failure");
      const dbCheck = await prisma.review.findUnique({
        where: { id: revFailClean.id },
      });
      assert(dbCheck === null, "Review must remain deleted from database");
    });

    await runTest("57. cleanup failure is not exposed as raw Cloudinary error", async () => {
      const revFailClean2 = await prisma.review.create({
        data: {
          productId: eligibleProductId,
          reviewerName: "Fail Cleanup Parent 2",
          rating: 4,
          reviewText: "Testing error response hiding.",
          status: ReviewStatus.APPROVED,
        },
      });

      mockCloudinary.failNextCleanup = true;
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/reviews/${revFailClean2.id}`,
        headers: {
          cookie: adminSessionCookie,
          "x-csrf-token": adminCsrfToken,
        },
      });

      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.success === true, "Must return success");
      assert(
        !res.body.includes("Simulated Cloudinary deletion failure"),
        "Must not leak internal error"
      );
    });

    // ========================================================================
    // Section 7: Public Exposure & Privacy Boundaries (Tests 58–61)
    // ========================================================================
    // eslint-disable-next-line no-console
    console.log("\nSection 7: Public Exposure & Privacy Boundaries (Tests 58–61)");

    const pendingReviewWithImage = await prisma.review.create({
      data: {
        productId: eligibleProductId,
        reviewerName: "Pending With Image Parent",
        rating: 5,
        reviewText: "Pending review with secret image URL.",
        status: ReviewStatus.PENDING,
      },
    });
    createdReviewIds.push(pendingReviewWithImage.id);

    const pendingAsset = await prisma.mediaAsset.create({
      data: {
        mediaType: MediaType.IMAGE,
        provider: "cloudinary",
        providerPublicId: "kids-wear/reviews/secret-sub/pending-img",
        secureUrl: "https://res.cloudinary.com/test/image/upload/pending-secret-image.jpg",
      },
    });
    createdMediaAssetIds.push(pendingAsset.id);

    await prisma.reviewMedia.create({
      data: {
        reviewId: pendingReviewWithImage.id,
        mediaAssetId: pendingAsset.id,
        sortOrder: 0,
      },
    });

    await runTest("58. Pending image URLs never returned publicly", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      assert(
        !res.body.includes("pending-secret-image.jpg"),
        "Pending image URL must not appear publicly"
      );
    });

    await runTest("59. Hidden image URLs never returned publicly", async () => {
      const hiddenReviewWithImage = await prisma.review.create({
        data: {
          productId: eligibleProductId,
          reviewerName: "Hidden With Image Parent",
          rating: 5,
          reviewText: "Hidden review with image.",
          status: ReviewStatus.HIDDEN,
        },
      });
      createdReviewIds.push(hiddenReviewWithImage.id);

      const hiddenAsset = await prisma.mediaAsset.create({
        data: {
          mediaType: MediaType.IMAGE,
          provider: "cloudinary",
          providerPublicId: "kids-wear/reviews/secret-sub/hidden-img",
          secureUrl: "https://res.cloudinary.com/test/image/upload/hidden-secret-image.jpg",
        },
      });
      createdMediaAssetIds.push(hiddenAsset.id);

      await prisma.reviewMedia.create({
        data: {
          reviewId: hiddenReviewWithImage.id,
          mediaAssetId: hiddenAsset.id,
          sortOrder: 0,
        },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      assert(
        !res.body.includes("hidden-secret-image.jpg"),
        "Hidden image URL must not appear publicly"
      );
    });

    await runTest("60. internal Review status not exposed publicly", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      const json = JSON.parse(res.body);
      for (const r of json.data.reviews) {
        assert(!("status" in r), "Public review contract must omit status");
      }
    });

    await runTest("61. Admin IDs not exposed publicly", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      assert(!res.body.includes(admin.id), "Admin IDs must never leak in public reviews");
    });

    // ========================================================================
    // Section 8: Scope Exclusions & Rate Limiting (Tests 62–66)
    // ========================================================================
    // eslint-disable-next-line no-console
    console.log("\nSection 8: Scope Exclusions & Rate Limiting (Tests 62–66)");

    await runTest("62. Review submission route has dedicated rate limiting", async () => {
      const rateLimitIp = "198.51.100.42";
      let hit429 = false;

      for (let i = 0; i < 7; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/reviews",
          remoteAddress: rateLimitIp,
          payload: {
            name: `Rate Tester ${i}`,
            productId: eligibleProductId,
            rating: 5,
            reviewText: "Testing rate limit enforcement on review submissions.",
          },
        });
        if (res.statusCode === 429) {
          hit429 = true;
          break;
        }
      }
      assert(hit429, "Review submission route must enforce rate limiting (max 5 per 15 min)");
    });

    await runTest("63. no Verified Purchase logic", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      assert(!res.body.includes("verifiedPurchase"), "No verified purchase field in contract");
      assert(!res.body.includes("isVerified"), "No verified badge in contract");
    });

    await runTest("64. no Order/customer linking", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        payload: {
          name: "No Order Linking Parent",
          productId: eligibleProductId,
          rating: 5,
          reviewText: "Testing absence of order/customer linking requirements.",
        },
      });
      assert(res.statusCode === 201, "Must succeed without order or customer tokens");
      const rev = await prisma.review.findFirst({
        where: { reviewerName: "No Order Linking Parent" },
      });
      assert(rev?.customerId === null, "customerId must be null");
      createdReviewIds.push(rev!.id);
    });

    await runTest("65. no customer Review-management endpoint", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/reviews",
      });
      assert(res.statusCode === 404, "Customer review management route must not exist");
    });

    await runTest("66. no Review video model/workflow", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews/media/sign",
        payload: {
          reviewSubmissionId: crypto.randomUUID(),
          mediaType: "VIDEO",
        },
      });
      assert(res.statusCode === 400, "Review media sign must reject video parameters");
    });

    // ========================================================================
    // Section 9: Public Product Visibility & Review Coupling (Tests 67–73)
    // ========================================================================
    // eslint-disable-next-line no-console
    console.log("\nSection 9: Public Product Visibility & Review Coupling (Tests 67–73)");

    // 1. Create a dedicated Product with full valid public eligibility
    const visProduct = await prisma.product.create({
      data: {
        storefrontId: miniStorefrontId,
        name: "Visibility Coupled Festive Kurta",
        sku: `SKU-REV-VIS-${Date.now()}`,
        slug: `vis-coupled-kurta-${Date.now()}`,
        description: "Testing review public visibility coupling.",
        regularPrice: "3499.00",
        status: ProductStatus.PUBLISHED,
      },
    });
    createdProductIds.push(visProduct.id);

    const visSize = await prisma.productSize.create({
      data: {
        productId: visProduct.id,
        name: "3-4Y",
        sortOrder: 0,
        isActive: true,
      },
    });

    const visColor = await prisma.productColor.create({
      data: {
        productId: visProduct.id,
        name: "Teal Blue",
        sortOrder: 0,
        isActive: true,
      },
    });

    await prisma.productVariant.create({
      data: {
        productId: visProduct.id,
        productSizeId: visSize.id,
        productColorId: visColor.id,
        isAvailable: true,
      },
    });

    const visMediaAsset = await prisma.mediaAsset.create({
      data: {
        mediaType: MediaType.IMAGE,
        provider: "cloudinary",
        providerPublicId: "kids-wear/products/vis-test-main",
        secureUrl: "https://res.cloudinary.com/test/image/upload/vis-main.jpg",
      },
    });
    createdMediaAssetIds.push(visMediaAsset.id);

    await prisma.productMedia.create({
      data: {
        productId: visProduct.id,
        mediaAssetId: visMediaAsset.id,
        isMain: true,
        isHover: false,
        sortOrder: 0,
      },
    });

    // 2. Create an APPROVED review with an attached image for this product
    const visReview = await prisma.review.create({
      data: {
        productId: visProduct.id,
        reviewerName: "Visibility Test Parent",
        rating: 5,
        reviewText: "Visibility test: lovely festive fabric and fit.",
        status: ReviewStatus.APPROVED,
      },
    });
    createdReviewIds.push(visReview.id);

    const visReviewAsset = await prisma.mediaAsset.create({
      data: {
        mediaType: MediaType.IMAGE,
        provider: "cloudinary",
        providerPublicId: "kids-wear/reviews/vis-test/photo1",
        secureUrl: "https://res.cloudinary.com/test/image/upload/vis-review-photo1.jpg",
      },
    });
    createdMediaAssetIds.push(visReviewAsset.id);

    await prisma.reviewMedia.create({
      data: {
        reviewId: visReview.id,
        mediaAssetId: visReviewAsset.id,
        sortOrder: 0,
      },
    });

    await runTest(
      "67. approved Review for published/public Product is returned publicly",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/reviews?productId=${visProduct.id}`,
        });
        assert(res.statusCode === 200, "Must return 200");
        const json = JSON.parse(res.body);
        assert(json.data.reviews.length === 1, "Must return exactly 1 review");
        assert(
          json.data.reviews[0].reviewerName === "Visibility Test Parent",
          "Must return visibility test parent review"
        );
        assert(json.data.reviews[0].images.length === 1, "Must include attached review image");
        assert(
          json.data.reviews[0].images[0].url ===
            "https://res.cloudinary.com/test/image/upload/vis-review-photo1.jpg",
          "Must return correct review image URL"
        );
      }
    );

    await runTest("68. approved Review disappears after Product becomes DRAFT", async () => {
      // Transition product to DRAFT
      await prisma.product.update({
        where: { id: visProduct.id },
        data: { status: ProductStatus.DRAFT },
      });

      // Query by productId
      const resProductFilter = await app.inject({
        method: "GET",
        url: `/api/v1/reviews?productId=${visProduct.id}`,
      });
      assert(resProductFilter.statusCode === 200, "Must return 200");
      const jsonProductFilter = JSON.parse(resProductFilter.body);
      assert(
        jsonProductFilter.data.reviews.length === 0,
        "Review must disappear when product becomes DRAFT"
      );
      assert(jsonProductFilter.data.pagination.totalReviews === 0, "totalReviews must be 0");

      // Query general list
      const resGeneral = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      assert(resGeneral.statusCode === 200, "Must return 200");
      const jsonGeneral = JSON.parse(resGeneral.body);
      const found = jsonGeneral.data.reviews.some((r: { id: string }) => r.id === visReview.id);
      assert(!found, "Draft product review must not appear in general public reviews");
    });

    await runTest("69. approved Review disappears after Product becomes INACTIVE", async () => {
      // Transition product to INACTIVE
      await prisma.product.update({
        where: { id: visProduct.id },
        data: { status: ProductStatus.INACTIVE },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/reviews?productId=${visProduct.id}`,
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.data.reviews.length === 0, "Review must disappear when product becomes INACTIVE");
    });

    await runTest("70. hidden Product Review images are not exposed publicly", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/reviews",
      });
      assert(res.statusCode === 200, "Must return 200");
      assert(
        !res.body.includes("vis-review-photo1.jpg"),
        "Hidden product review image URL must never leak in public responses"
      );
      assert(
        !res.body.includes("kids-wear/reviews/vis-test/photo1"),
        "Hidden product review image public ID must never leak in public responses"
      );
    });

    await runTest(
      "71. Admin API can still inspect preserved Review after Product becomes non-public",
      async () => {
        // Review remains stored and inspectable in Admin moderation
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/admin/reviews/${visReview.id}`,
          headers: {
            cookie: adminSessionCookie,
          },
        });
        assert(res.statusCode === 200, "Admin must be able to inspect preserved review");
        const json = JSON.parse(res.body);
        assert(json.data.id === visReview.id, "Review ID must match");
        assert(json.data.status === "APPROVED", "Status must remain preserved as APPROVED");
        assert(json.data.images.length === 1, "Admin sees attached media");
        assert(json.data.product.id === visProduct.id, "Admin sees associated product details");
      }
    );

    await runTest(
      "72. republishing an otherwise valid Product makes its approved Review public again",
      async () => {
        // Republish the product
        await prisma.product.update({
          where: { id: visProduct.id },
          data: { status: ProductStatus.PUBLISHED },
        });

        const res = await app.inject({
          method: "GET",
          url: `/api/v1/reviews?productId=${visProduct.id}`,
        });
        assert(res.statusCode === 200, "Must return 200");
        const json = JSON.parse(res.body);
        assert(json.data.reviews.length === 1, "Review must reappear publicly after republishing");
        assert(
          json.data.reviews[0].id === visReview.id,
          "Reappeared review must match the preserved review"
        );
        assert(json.data.reviews[0].images.length === 1, "Review images must reappear publicly");
      }
    );

    await runTest(
      "73. public Review queries contain no archived Product representation",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/reviews?productId=${visProduct.id}`,
        });
        const json = JSON.parse(res.body);
        const r = json.data.reviews[0];
        assert(!("archivedTitle" in r), "Must not introduce archivedTitle column/field");
        assert(!("isArchived" in r.product), "Must not introduce isArchived on public product");
        assert(
          r.product.name === "Visibility Coupled Festive Kurta",
          "Product name must be current active name"
        );
      }
    );
  } finally {
    if (createdProductIds.length > 0) {
      await prisma.reviewMedia.deleteMany({
        where: { review: { productId: { in: createdProductIds } } },
      });
      await prisma.review.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
    }

    if (createdReviewIds.length > 0) {
      await prisma.reviewMedia.deleteMany({
        where: { reviewId: { in: createdReviewIds } },
      });
      await prisma.review.deleteMany({
        where: { id: { in: createdReviewIds } },
      });
    }

    if (createdProductIds.length > 0) {
      await prisma.productMedia.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.productVariant.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.productSize.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.productColor.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: createdProductIds } },
      });
    }

    if (createdMediaAssetIds.length > 0) {
      await prisma.mediaAsset.deleteMany({
        where: { id: { in: createdMediaAssetIds } },
      });
    }

    if (customerSessionId) {
      await prisma.customerSession.delete({ where: { id: customerSessionId } }).catch(() => {});
    }
    if (customerId) {
      await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    }
    if (adminSessionId) {
      await prisma.adminSession.delete({ where: { id: adminSessionId } }).catch(() => {});
    }

    resetCloudinaryService();
    await app.close();
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  // eslint-disable-next-line no-console
  console.log("\n=======================================================");
  // eslint-disable-next-line no-console
  console.log("Kids Wear — Reviews Backend Test Suite Results:");
  // eslint-disable-next-line no-console
  console.log(`Total:  ${results.length}`);
  // eslint-disable-next-line no-console
  console.log(`Passed: ${passed}`);
  // eslint-disable-next-line no-console
  console.log(`Failed: ${failed}`);
  // eslint-disable-next-line no-console
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
