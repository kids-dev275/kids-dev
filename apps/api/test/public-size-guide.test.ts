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
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

class MockCloudinaryService implements ICloudinaryService {
  public mockResources = new Map<string, CloudinaryResourceMetadata>();

  async generateUploadSignature(params: UploadSignatureParams): Promise<UploadSignatureResult> {
    return {
      signature: "mock-signature",
      timestamp: params.timestamp,
      apiKey: "mock-api-key",
      cloudName: "mock-cloud",
      folder: params.folder,
      publicId: params.publicId,
    };
  }

  async getResourceMetadata(publicId: string): Promise<CloudinaryResourceMetadata | null> {
    return this.mockResources.get(publicId) || null;
  }
}

async function main() {
  console.log("Starting Kids Wear — Public Size Guide Backend Test Suite...\n");

  const prisma = getPrismaClient();
  const app = await buildApp();
  const mockCloudinary = new MockCloudinaryService();
  setCloudinaryService(mockCloudinary);

  const miniSprouts = await prisma.storefront.findUnique({ where: { slug: "mini-sprouts" } });
  const teenStudio = await prisma.storefront.findUnique({ where: { slug: "teen-studio" } });
  assert(miniSprouts !== null && teenStudio !== null, "Storefronts must exist");

  const createdProductIds: string[] = [];

  // Helper to create published product with image and available variant
  async function createPublishedProduct(options: {
    name: string;
    slug: string;
    storefrontId: string;
  }) {
    const product = await prisma.product.create({
      data: {
        storefrontId: options.storefrontId,
        name: options.name,
        slug: options.slug,
        sku: `SKU-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        description: "Test product with size guide",
        regularPrice: "2499.00",
        status: "PUBLISHED",
      },
    });
    createdProductIds.push(product.id);

    // Create media
    const publicId = `test-sg-${product.id}`;
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        providerPublicId: publicId,
        secureUrl: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
        mediaType: "IMAGE",
        width: 1200,
        height: 1500,
        format: "jpg",
        bytes: 100000,
      },
    });

    await prisma.productMedia.create({
      data: {
        productId: product.id,
        mediaAssetId: mediaAsset.id,
        isMain: true,
        sortOrder: 0,
      },
    });

    // Create active size & color & variant
    const size = await prisma.productSize.create({
      data: { productId: product.id, name: "3-4 Years", isActive: true, sortOrder: 1 },
    });
    const color = await prisma.productColor.create({
      data: { productId: product.id, name: "Ivory", isActive: true, sortOrder: 1 },
    });

    await prisma.productVariant.create({
      data: {
        productId: product.id,
        productSizeId: size.id,
        productColorId: color.id,
        isAvailable: true,
      },
    });

    return product;
  }

  try {
    // 1. Published product without SizeGuide returns sizeGuide: null
    await runTest("1. Published product without SizeGuide returns sizeGuide: null", async () => {
      const prod = await createPublishedProduct({
        name: "Product Without Size Guide",
        slug: "prod-without-size-guide",
        storefrontId: miniSprouts.id,
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products/${prod.slug}`,
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.success === true, "Must be success");
      assert(body.data.sizeGuide === null, "sizeGuide must be null when not configured");
    });

    // 2. Published product with SizeGuide returns columns and rows
    await runTest("2. Published product with SizeGuide returns columns and rows", async () => {
      const prod = await createPublishedProduct({
        name: "Product With Size Guide",
        slug: "prod-with-size-guide",
        storefrontId: miniSprouts.id,
      });

      const sg = await prisma.sizeGuide.create({
        data: {
          productId: prod.id,
          columns: [
            { key: "age", label: "Age" },
            { key: "chest", label: "Chest (in)" },
            { key: "length", label: "Length (in)" },
          ],
          rows: {
            create: [
              {
                label: "3-4Y",
                values: { age: "3-4 Years", chest: "24", length: "26" },
                sortOrder: 1,
              },
              {
                label: "5-6Y",
                values: { age: "5-6 Years", chest: "26", length: "29" },
                sortOrder: 2,
              },
            ],
          },
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products/${prod.slug}`,
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.data.sizeGuide !== null, "sizeGuide must not be null");
      assert(Array.isArray(body.data.sizeGuide.columns), "columns must be an array");
      assert(body.data.sizeGuide.columns.length === 3, "must have 3 columns");
      assert(body.data.sizeGuide.rows.length === 2, "must have 2 rows");
      assert(body.data.sizeGuide.rows[0].label === "3-4Y", "first row label correct");
      assert(body.data.sizeGuide.rows[0].values.chest === "24", "row values correct");
    });

    // 3. Rows are ordered deterministically by sortOrder
    await runTest("3. SizeGuide rows are ordered deterministically by sortOrder", async () => {
      const prod = await createPublishedProduct({
        name: "Product Sort Order Test",
        slug: "prod-sort-order-test",
        storefrontId: miniSprouts.id,
      });

      await prisma.sizeGuide.create({
        data: {
          productId: prod.id,
          columns: [{ key: "size", label: "Size" }],
          rows: {
            create: [
              { label: "Large", values: { size: "L" }, sortOrder: 30 },
              { label: "Small", values: { size: "S" }, sortOrder: 10 },
              { label: "Medium", values: { size: "M" }, sortOrder: 20 },
            ],
          },
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products/${prod.slug}`,
      });
      const body = JSON.parse(res.body);
      const rows = body.data.sizeGuide.rows;
      assert(rows[0].label === "Small", "Row 0 must be Small");
      assert(rows[1].label === "Medium", "Row 1 must be Medium");
      assert(rows[2].label === "Large", "Row 2 must be Large");
    });

    // 4. Draft product with SizeGuide is not accessible publicly (returns 404)
    await runTest("4. Draft product with SizeGuide returns 404", async () => {
      const prod = await prisma.product.create({
        data: {
          storefrontId: miniSprouts.id,
          name: "Draft Size Guide Test",
          slug: "draft-size-guide-test",
          sku: `SKU-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
          description: "Draft test",
          regularPrice: "1999.00",
          status: "DRAFT",
        },
      });
      createdProductIds.push(prod.id);

      await prisma.sizeGuide.create({
        data: {
          productId: prod.id,
          columns: [{ key: "age", label: "Age" }],
          rows: {
            create: [{ label: "1-2Y", values: { age: "1-2" }, sortOrder: 1 }],
          },
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products/${prod.slug}`,
      });
      assert(res.statusCode === 404, "Draft product PDP must return 404");
    });

    // 5. Inactive product with SizeGuide is not accessible publicly (returns 404)
    await runTest("5. Inactive product with SizeGuide returns 404", async () => {
      const prod = await prisma.product.create({
        data: {
          storefrontId: miniSprouts.id,
          name: "Inactive Size Guide Test",
          slug: "inactive-size-guide-test",
          sku: `SKU-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
          description: "Inactive test",
          regularPrice: "1999.00",
          status: "INACTIVE",
        },
      });
      createdProductIds.push(prod.id);

      await prisma.sizeGuide.create({
        data: {
          productId: prod.id,
          columns: [{ key: "age", label: "Age" }],
          rows: {
            create: [{ label: "1-2Y", values: { age: "1-2" }, sortOrder: 1 }],
          },
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products/${prod.slug}`,
      });
      assert(res.statusCode === 404, "Inactive product PDP must return 404");
    });

    // 6. SizeGuide is strictly scoped to storefront
    await runTest(
      "6. SizeGuide is strictly scoped to storefront (cross-storefront returns 404)",
      async () => {
        const prod = await createPublishedProduct({
          name: "Storefront Scoped SG Test",
          slug: "storefront-scoped-sg-test",
          storefrontId: miniSprouts.id,
        });

        await prisma.sizeGuide.create({
          data: {
            productId: prod.id,
            columns: [{ key: "size", label: "Size" }],
            rows: {
              create: [{ label: "3-4Y", values: { size: "3-4Y" }, sortOrder: 1 }],
            },
          },
        });

        // Requesting from teen-studio must return 404
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/storefronts/teen-studio/products/${prod.slug}`,
        });
        assert(res.statusCode === 404, "Cross-storefront query must return 404");
      }
    );

    // 7. Public access requires no authentication
    await runTest("7. Public access requires no authentication or CSRF tokens", async () => {
      const prod = await createPublishedProduct({
        name: "No Auth SG Test",
        slug: "no-auth-sg-test",
        storefrontId: miniSprouts.id,
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/storefronts/mini-sprouts/products/${prod.slug}`,
      });
      assert(res.statusCode === 200, "Must be accessible without auth");
    });

    // 8. Defensive visibility suppression: when last variant unavailable, returns 404
    await runTest(
      "8. Defensive visibility: 0 available variants returns 404 even with SizeGuide",
      async () => {
        const prod = await createPublishedProduct({
          name: "Defensive SG Test",
          slug: "defensive-sg-test",
          storefrontId: miniSprouts.id,
        });

        await prisma.sizeGuide.create({
          data: {
            productId: prod.id,
            columns: [{ key: "size", label: "Size" }],
            rows: {
              create: [{ label: "3-4Y", values: { size: "3-4Y" }, sortOrder: 1 }],
            },
          },
        });

        // Deactivate all variants
        await prisma.productVariant.updateMany({
          where: { productId: prod.id },
          data: { isAvailable: false },
        });

        const res = await app.inject({
          method: "GET",
          url: `/api/v1/storefronts/mini-sprouts/products/${prod.slug}`,
        });
        assert(res.statusCode === 404, "PDP must return 404 when 0 available variants");
      }
    );
  } finally {
    // Cleanup
    for (const id of createdProductIds) {
      await prisma.productVariant.deleteMany({ where: { productId: id } }).catch(() => {});
      await prisma.productSize.deleteMany({ where: { productId: id } }).catch(() => {});
      await prisma.productColor.deleteMany({ where: { productId: id } }).catch(() => {});
      await prisma.sizeGuideRow
        .deleteMany({ where: { sizeGuide: { productId: id } } })
        .catch(() => {});
      await prisma.sizeGuide.deleteMany({ where: { productId: id } }).catch(() => {});
      const media = await prisma.productMedia.findMany({ where: { productId: id } });
      await prisma.productMedia.deleteMany({ where: { productId: id } }).catch(() => {});
      for (const m of media) {
        await prisma.mediaAsset.delete({ where: { id: m.mediaAssetId } }).catch(() => {});
      }
      await prisma.product.delete({ where: { id } }).catch(() => {});
    }

    resetCloudinaryService();
    await app.close();
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n==================================================`);
  console.log(`Summary: ${passed}/${total} Public Size Guide Backend Tests Passed.`);
  console.log(`==================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
