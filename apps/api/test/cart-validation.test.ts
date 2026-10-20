import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import {
  setCloudinaryService,
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

  async getResourceMetadata(_publicId: string): Promise<CloudinaryResourceMetadata | null> {
    return null;
  }
}

async function main() {
  console.log("Starting Kids Wear — Cart Validation Backend Integration Test Suite...\n");

  const prisma = getPrismaClient();
  const app = await buildApp();
  const mockCloudinary = new MockCloudinaryService();
  setCloudinaryService(mockCloudinary);

  const miniSprouts = await prisma.storefront.findUnique({ where: { slug: "mini-sprouts" } });
  const teenStudio = await prisma.storefront.findUnique({ where: { slug: "teen-studio" } });
  assert(miniSprouts !== null && teenStudio !== null, "Storefronts must exist");

  const createdProductIds: string[] = [];
  const createdMediaAssetIds: string[] = [];

  // Helper to create test media asset
  async function createTestMediaAsset(publicId: string) {
    const asset = await prisma.mediaAsset.create({
      data: {
        provider: "cloudinary",
        providerPublicId: publicId,
        secureUrl: `https://res.cloudinary.com/test/image/upload/${publicId}.jpg`,
        mediaType: "IMAGE",
        width: 800,
        height: 1000,
        format: "jpg",
        bytes: 102400,
      },
    });
    createdMediaAssetIds.push(asset.id);
    return asset;
  }

  // Helper to create published product with size, color, variant, and main media
  async function createFixtureProduct(options: {
    name: string;
    slug: string;
    sku: string;
    storefrontId: string;
    regularPrice: string;
    status?: "DRAFT" | "PUBLISHED";
    isVariantAvailable?: boolean;
    isSizeActive?: boolean;
    isColorActive?: boolean;
    hasMainImage?: boolean;
  }) {
    const product = await prisma.product.create({
      data: {
        storefrontId: options.storefrontId,
        name: options.name,
        slug: options.slug,
        sku: options.sku,
        description: "Editorial test product description",
        regularPrice: options.regularPrice,
        status: options.status ?? "PUBLISHED",
      },
    });
    createdProductIds.push(product.id);

    const size = await prisma.productSize.create({
      data: {
        productId: product.id,
        name: "Standard Size",
        sortOrder: 0,
        isActive: options.isSizeActive ?? true,
      },
    });

    const color = await prisma.productColor.create({
      data: {
        productId: product.id,
        name: "Classic Navy",
        sortOrder: 0,
        isActive: options.isColorActive ?? true,
      },
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        productSizeId: size.id,
        productColorId: color.id,
        isAvailable: options.isVariantAvailable ?? true,
      },
    });

    if (options.hasMainImage ?? true) {
      const asset = await createTestMediaAsset(`cart_test_${product.id}`);
      await prisma.productMedia.create({
        data: {
          productId: product.id,
          mediaAssetId: asset.id,
          isMain: true,
          sortOrder: 0,
          altText: `${options.name} Main View`,
        },
      });
    }

    return { product, size, color, variant };
  }

  try {
    // 1. Public route requires no authentication
    await runTest("Cart Validation: public route requires no authentication", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/cart/validate",
        payload: { items: [] },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.success === true, "Must return success: true");
      assert(Array.isArray(json.data.items), "data.items must be an array");
      assert(json.data.subtotal === "0.00", "Empty cart subtotal must be 0.00");
      assert(json.data.deliveryCharge === "0.00", "Empty cart deliveryCharge must be 0.00");
      assert(json.data.total === "0.00", "Empty cart total must be 0.00");
    });

    // 2. Malformed UUID rejected
    await runTest("Cart Validation: malformed UUID rejected with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/cart/validate",
        payload: {
          items: [{ productId: "not-a-uuid", variantId: "123", quantity: 1 }],
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.success === false, "Must fail");
      assert(json.error.code === "VALIDATION_ERROR", "Error code must be VALIDATION_ERROR");
    });

    // 3. Quantity > 10 rejected
    await runTest("Cart Validation: quantity > 10 rejected with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/cart/validate",
        payload: {
          items: [
            {
              productId: "00000000-0000-0000-0000-000000000001",
              variantId: "00000000-0000-0000-0000-000000000002",
              quantity: 11,
            },
          ],
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.success === false, "Must fail");
    });

    // 4. Quantity < 1 rejected
    await runTest("Cart Validation: quantity < 1 rejected with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/cart/validate",
        payload: {
          items: [
            {
              productId: "00000000-0000-0000-0000-000000000001",
              variantId: "00000000-0000-0000-0000-000000000002",
              quantity: 0,
            },
          ],
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    // 5. Duplicate variant entries in payload rejected
    await runTest("Cart Validation: duplicate variant entries rejected with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/cart/validate",
        payload: {
          items: [
            {
              productId: "00000000-0000-0000-0000-000000000001",
              variantId: "00000000-0000-0000-0000-000000000002",
              quantity: 2,
            },
            {
              productId: "00000000-0000-0000-0000-000000000001",
              variantId: "00000000-0000-0000-0000-000000000002",
              quantity: 3,
            },
          ],
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "DUPLICATE_VARIANT_ENTRY",
        "Expected DUPLICATE_VARIANT_ENTRY code"
      );
    });

    // 6. Valid Cart validates with authoritative data and single flat shipping charge
    const fixture1 = await createFixtureProduct({
      name: "Embroidered Kurta",
      slug: "embroidered-kurta-cart",
      sku: "KW-CART-001",
      storefrontId: miniSprouts.id,
      regularPrice: "2499.50",
    });

    const fixture2 = await createFixtureProduct({
      name: "Tailored Linen Shirt",
      slug: "tailored-linen-shirt-cart",
      sku: "KW-CART-002",
      storefrontId: teenStudio.id,
      regularPrice: "3199.00",
    });

    await runTest(
      "Cart Validation: valid mixed-storefront Cart validates with Decimal arithmetic and flat delivery",
      async () => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/cart/validate",
          payload: {
            items: [
              {
                productId: fixture1.product.id,
                variantId: fixture1.variant.id,
                quantity: 2,
              },
              {
                productId: fixture2.product.id,
                variantId: fixture2.variant.id,
                quantity: 1,
              },
            ],
          },
        });

        assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
        const json = JSON.parse(res.body);
        assert(json.success === true, "Must succeed");
        const { items, subtotal, deliveryCharge, total, invalidItems } = json.data;

        assert(invalidItems.length === 0, "No invalid items expected");
        assert(items.length === 2, "Expected 2 validated items");

        // First item checks
        const item1 = items.find((i: any) => i.variantId === fixture1.variant.id);
        assert(item1 !== undefined, "Item 1 must be present");
        assert(item1.product.name === "Embroidered Kurta", "Product name must match");
        assert(item1.product.slug === "embroidered-kurta-cart", "Product slug must match");
        assert(item1.product.storefrontSlug === "mini-sprouts", "Storefront slug must match");
        assert(
          item1.product.mainImage?.url.includes("cloudinary"),
          "Main image url must be present"
        );
        assert(item1.variant.size === "Standard Size", "Size must match");
        assert(item1.variant.color === "Classic Navy", "Color must match");
        assert(item1.variant.isAvailable === true, "isAvailable must be true");
        assert(item1.unitPrice === "2499.50", "Unit price must match exactly");
        assert(item1.lineSubtotal === "4999.00", "2 * 2499.50 = 4999.00");

        // Second item checks
        const item2 = items.find((i: any) => i.variantId === fixture2.variant.id);
        assert(item2 !== undefined, "Item 2 must be present");
        assert(item2.product.storefrontSlug === "teen-studio", "Must support mixed storefront");
        assert(item2.unitPrice === "3199.00", "Item 2 unit price must match");
        assert(item2.lineSubtotal === "3199.00", "Item 2 line subtotal must match");

        // Authoritative Totals
        // Subtotal: 4999.00 + 3199.00 = 8198.00
        assert(subtotal === "8198.00", `Expected subtotal 8198.00, got ${subtotal}`);
        // Flat delivery charge: 300.00 (once for entire cart, NOT multiplied)
        assert(
          deliveryCharge === "300.00",
          `Expected deliveryCharge 300.00, got ${deliveryCharge}`
        );
        // Grand total: 8198.00 + 300.00 = 8498.00
        assert(total === "8498.00", `Expected total 8498.00, got ${total}`);

        // Defensive checks: No numeric inventory or SKU leaked
        assert(item1.sku === undefined, "SKU must not be exposed on item");
        assert(item1.product.sku === undefined, "SKU must not be exposed on product");
        assert(item1.stock === undefined, "Numeric stock must not be exposed");
        assert(item1.inventory === undefined, "Numeric inventory must not be exposed");
      }
    );

    // 7. Product/Variant mismatch rejected
    await runTest(
      "Cart Validation: Product/Variant mismatch identified in invalidItems",
      async () => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/cart/validate",
          payload: {
            items: [
              {
                productId: fixture1.product.id,
                variantId: fixture2.variant.id, // fixture2 variant belongs to fixture2 product
                quantity: 1,
              },
            ],
          },
        });
        assert(res.statusCode === 200, "Must return 200 with invalidItems list");
        const json = JSON.parse(res.body);
        assert(json.data.items.length === 0, "Valid items must be 0");
        assert(json.data.invalidItems.length === 1, "Must have 1 invalid item");
        assert(
          json.data.invalidItems[0].reason === "PRODUCT_MISMATCH",
          "Reason must be PRODUCT_MISMATCH"
        );
      }
    );

    // 8. Draft Product not exposed / identified as invalid
    const draftFixture = await createFixtureProduct({
      name: "Secret Draft Product",
      slug: "secret-draft-cart",
      sku: "KW-CART-DRAFT",
      storefrontId: miniSprouts.id,
      regularPrice: "1500.00",
      status: "DRAFT",
    });

    await runTest("Cart Validation: Draft Product not exposed and marked invalid", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/cart/validate",
        payload: {
          items: [
            {
              productId: draftFixture.product.id,
              variantId: draftFixture.variant.id,
              quantity: 1,
            },
          ],
        },
      });
      assert(res.statusCode === 200, "Must return 200 with invalidItems");
      const json = JSON.parse(res.body);
      assert(json.data.items.length === 0, "Must have 0 valid items");
      assert(json.data.invalidItems.length === 1, "Must identify invalid item");
      const invalid = json.data.invalidItems[0];
      assert(invalid.reason === "PRODUCT_UNPUBLISHED", "Reason must be PRODUCT_UNPUBLISHED");
      // Ensure NO draft product details leaked
      assert(invalid.name === undefined, "Draft name must not be leaked");
      assert(invalid.description === undefined, "Draft description must not be leaked");
      assert(invalid.regularPrice === undefined, "Draft price must not be leaked");
      assert(invalid.media === undefined, "Draft media must not be leaked");
    });

    // 9. Unavailable Variant identified as invalid
    const unavailableFixture = await createFixtureProduct({
      name: "Unavailable Variant Item",
      slug: "unavailable-variant-cart",
      sku: "KW-CART-UNAVAIL",
      storefrontId: miniSprouts.id,
      regularPrice: "2100.00",
      isVariantAvailable: false,
    });

    await runTest("Cart Validation: unavailable Variant identified as invalid", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/cart/validate",
        payload: {
          items: [
            {
              productId: unavailableFixture.product.id,
              variantId: unavailableFixture.variant.id,
              quantity: 1,
            },
          ],
        },
      });
      assert(res.statusCode === 200, "Must return 200 with invalidItems");
      const json = JSON.parse(res.body);
      assert(json.data.items.length === 0, "Must have 0 valid items");
      assert(json.data.invalidItems.length === 1, "Must have 1 invalid item");
      assert(
        json.data.invalidItems[0].reason === "VARIANT_UNAVAILABLE",
        "Reason must be VARIANT_UNAVAILABLE"
      );
    });

    // 10. Inactive Size identified as invalid
    const inactiveSizeFixture = await createFixtureProduct({
      name: "Inactive Size Item",
      slug: "inactive-size-cart",
      sku: "KW-CART-INACT-SIZE",
      storefrontId: miniSprouts.id,
      regularPrice: "2100.00",
      isSizeActive: false,
    });

    await runTest("Cart Validation: inactive Size identified as invalid", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/cart/validate",
        payload: {
          items: [
            {
              productId: inactiveSizeFixture.product.id,
              variantId: inactiveSizeFixture.variant.id,
              quantity: 1,
            },
          ],
        },
      });
      assert(res.statusCode === 200, "Must return 200 with invalidItems");
      const json = JSON.parse(res.body);
      assert(json.data.invalidItems[0].reason === "SIZE_INACTIVE", "Reason must be SIZE_INACTIVE");
    });

    // 11. Inactive Color identified as invalid
    const inactiveColorFixture = await createFixtureProduct({
      name: "Inactive Color Item",
      slug: "inactive-color-cart",
      sku: "KW-CART-INACT-COLOR",
      storefrontId: miniSprouts.id,
      regularPrice: "2100.00",
      isColorActive: false,
    });

    await runTest("Cart Validation: inactive Color identified as invalid", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/cart/validate",
        payload: {
          items: [
            {
              productId: inactiveColorFixture.product.id,
              variantId: inactiveColorFixture.variant.id,
              quantity: 1,
            },
          ],
        },
      });
      assert(res.statusCode === 200, "Must return 200 with invalidItems");
      const json = JSON.parse(res.body);
      assert(
        json.data.invalidItems[0].reason === "COLOR_INACTIVE",
        "Reason must be COLOR_INACTIVE"
      );
    });

    // 12. Product without Main Image identified as invalid
    const noImageFixture = await createFixtureProduct({
      name: "No Image Item",
      slug: "no-image-cart",
      sku: "KW-CART-NO-IMG",
      storefrontId: miniSprouts.id,
      regularPrice: "1900.00",
      hasMainImage: false,
    });

    await runTest("Cart Validation: product without Main Image marked invalid", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/cart/validate",
        payload: {
          items: [
            {
              productId: noImageFixture.product.id,
              variantId: noImageFixture.variant.id,
              quantity: 1,
            },
          ],
        },
      });
      assert(res.statusCode === 200, "Must return 200 with invalidItems");
      const json = JSON.parse(res.body);
      assert(
        json.data.invalidItems[0].reason === "PRODUCT_UNAVAILABLE",
        "Reason must be PRODUCT_UNAVAILABLE"
      );
    });

    // 13. Non-existent Product UUID identified as invalid
    await runTest("Cart Validation: non-existent product UUID identified as invalid", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/cart/validate",
        payload: {
          items: [
            {
              productId: "e0000000-0000-0000-0000-000000000099",
              variantId: "e0000000-0000-0000-0000-000000000098",
              quantity: 1,
            },
          ],
        },
      });
      assert(res.statusCode === 200, "Must return 200 with invalidItems");
      const json = JSON.parse(res.body);
      assert(
        json.data.invalidItems[0].reason === "PRODUCT_NOT_FOUND",
        "Reason must be PRODUCT_NOT_FOUND"
      );
    });

    // 14. Partial valid and partial invalid cart handling
    await runTest(
      "Cart Validation: mixed valid and invalid lines partition accurately",
      async () => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/cart/validate",
          payload: {
            items: [
              {
                productId: fixture1.product.id,
                variantId: fixture1.variant.id,
                quantity: 1,
              },
              {
                productId: unavailableFixture.product.id,
                variantId: unavailableFixture.variant.id,
                quantity: 2,
              },
            ],
          },
        });
        assert(res.statusCode === 200, "Must return 200");
        const json = JSON.parse(res.body);
        assert(json.data.items.length === 1, "Must have exactly 1 valid item");
        assert(json.data.invalidItems.length === 1, "Must have exactly 1 invalid item");
        // Subtotal should only include valid item: 1 * 2499.50 = 2499.50
        assert(
          json.data.subtotal === "2499.50",
          `Expected subtotal 2499.50, got ${json.data.subtotal}`
        );
        assert(json.data.deliveryCharge === "300.00", "Delivery charge must be 300.00");
        assert(json.data.total === "2799.50", `Expected total 2799.50, got ${json.data.total}`);
      }
    );

    // 15. All-invalid Cart produces zero subtotal, zero delivery charge, zero total
    await runTest(
      "Cart Validation: all-invalid Cart returns zero subtotal, delivery, and total",
      async () => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/cart/validate",
          payload: {
            items: [
              {
                productId: unavailableFixture.product.id,
                variantId: unavailableFixture.variant.id,
                quantity: 2,
              },
              {
                productId: "e0000000-0000-0000-0000-000000000099",
                variantId: "e0000000-0000-0000-0000-000000000098",
                quantity: 1,
              },
            ],
          },
        });
        assert(res.statusCode === 200, "Must return 200");
        const json = JSON.parse(res.body);
        assert(json.data.validItems.length === 0, "Must have 0 valid items");
        assert(json.data.invalidItems.length === 2, "Must have 2 invalid items");
        assert(json.data.subtotal === "0.00", "Subtotal must be 0.00");
        assert(json.data.deliveryCharge === "0.00", "Delivery charge must be 0.00");
        assert(json.data.total === "0.00", "Total must be 0.00");
      }
    );

    // 16. Empty Cart returns zero subtotal, delivery, and total
    await runTest(
      "Cart Validation: empty Cart returns zero delivery charge and total",
      async () => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/cart/validate",
          payload: {
            items: [],
          },
        });
        assert(res.statusCode === 200, "Must return 200");
        const json = JSON.parse(res.body);
        assert(json.data.validItems.length === 0, "Must have 0 valid items");
        assert(json.data.invalidItems.length === 0, "Must have 0 invalid items");
        assert(json.data.subtotal === "0.00", "Subtotal must be 0.00");
        assert(json.data.deliveryCharge === "0.00", "Delivery charge must be 0.00");
        assert(json.data.total === "0.00", "Total must be 0.00");
      }
    );

    // 17. Invalid Cart lines never leak unpublished Product details or SKU
    await runTest(
      "Cart Validation: invalid Cart lines never expose hidden Product details",
      async () => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/cart/validate",
          payload: {
            items: [
              {
                productId: draftFixture.product.id,
                variantId: draftFixture.variant.id,
                quantity: 1,
              },
            ],
          },
        });
        assert(res.statusCode === 200, "Must return 200");
        const json = JSON.parse(res.body);
        assert(json.data.invalidItems.length === 1, "Must be marked invalid");
        const invalidItem = json.data.invalidItems[0];
        assert(invalidItem.reason === "PRODUCT_UNPUBLISHED", "Reason must be PRODUCT_UNPUBLISHED");
        // Must not expose internal draft fields
        assert((invalidItem as any).name === undefined, "Must not leak draft product name");
        assert((invalidItem as any).price === undefined, "Must not leak draft product price");
        assert((invalidItem as any).sku === undefined, "Must not leak draft product SKU");
        assert((invalidItem as any).mainImage === undefined, "Must not leak draft media");
      }
    );
  } finally {
    // Clean up test fixtures
    console.log("\nCleaning up test fixtures...");
    for (const pid of createdProductIds) {
      await prisma.productMedia.deleteMany({ where: { productId: pid } }).catch(() => {});
      await prisma.productVariant.deleteMany({ where: { productId: pid } }).catch(() => {});
      await prisma.productSize.deleteMany({ where: { productId: pid } }).catch(() => {});
      await prisma.productColor.deleteMany({ where: { productId: pid } }).catch(() => {});
      await prisma.product.deleteMany({ where: { id: pid } }).catch(() => {});
    }
    for (const mid of createdMediaAssetIds) {
      await prisma.mediaAsset.deleteMany({ where: { id: mid } }).catch(() => {});
    }
  }

  // Summary
  console.log("\n========================================================");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `Cart Validation Test Summary: ${passed} passed, ${failed} failed, total ${results.length}`
  );
  console.log("========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled test suite error:", err);
  process.exit(1);
});
