import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import { Prisma } from "@prisma/client";
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
  console.log("Starting Kids Wear — Checkout Validation Backend Test Suite...\n");

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

  // Helper to create test product with size, color, variant, and main media
  async function createFixtureProduct(options: {
    name: string;
    slug: string;
    sku: string;
    storefrontId: string;
    regularPrice: string;
    status?: "DRAFT" | "PUBLISHED" | "INACTIVE";
    isVariantAvailable?: boolean;
    isSizeActive?: boolean;
    isColorActive?: boolean;
    hasMainImage?: boolean;
  }) {
    const product = await prisma.product.create({
      data: {
        name: options.name,
        slug: options.slug,
        sku: options.sku,
        description: "Editorial test product description",
        storefrontId: options.storefrontId,
        regularPrice: new Prisma.Decimal(options.regularPrice),
        status: options.status || "PUBLISHED",
      },
    });
    createdProductIds.push(product.id);

    const size = await prisma.productSize.create({
      data: {
        productId: product.id,
        name: "3-4Y",
        isActive: options.isSizeActive !== undefined ? options.isSizeActive : true,
      },
    });

    const color = await prisma.productColor.create({
      data: {
        productId: product.id,
        name: "Ocean Blue",
        isActive: options.isColorActive !== undefined ? options.isColorActive : true,
      },
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        productSizeId: size.id,
        productColorId: color.id,
        isAvailable: options.isVariantAvailable !== undefined ? options.isVariantAvailable : true,
      },
    });

    if (options.hasMainImage !== false) {
      const mediaAsset = await createTestMediaAsset(`checkout-test-${options.slug}`);
      await prisma.productMedia.create({
        data: {
          productId: product.id,
          mediaAssetId: mediaAsset.id,
          isMain: true,
          sortOrder: 0,
        },
      });
    }

    return { product, size, color, variant };
  }

  // Snapshot original CommerceSettings
  const originalSettings = await prisma.commerceSettings.findUnique({
    where: { singletonKey: 1 },
  });

  // Base customer payload
  const validCustomer = {
    fullName: "Ayesha Khan",
    phone: "03001234567",
    email: "ayesha.khan@example.com",
    address: "House 42, Street 7, Block B, DHA Phase 5",
    city: "Lahore",
    province: "Punjab",
    postalCode: "54000",
    orderNotes: "Please deliver before evening.",
  };

  try {
    // Standard test products
    const prod1 = await createFixtureProduct({
      name: "Chiffon Eid Kurta",
      slug: "chiffon-eid-kurta",
      sku: "CHK-EID-01",
      storefrontId: miniSprouts.id,
      regularPrice: "3499.00",
    });

    const prod2 = await createFixtureProduct({
      name: "Tailored Waistcoat",
      slug: "tailored-waistcoat",
      sku: "CHK-WST-02",
      storefrontId: teenStudio.id,
      regularPrice: "2199.00",
    });

    // =========================================================================
    // 1. CHECKOUT CONFIG (Tests 1–8)
    // =========================================================================

    await runTest("1. Checkout config is public without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/checkout/config",
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.success === true, "Response must be success");
      assert(body.data.paymentMethods !== undefined, "paymentMethods must exist");
    });

    await runTest("2. COD is available", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/checkout/config",
      });
      const body = JSON.parse(res.body);
      assert(body.data.paymentMethods.cashOnDelivery.available === true, "COD must be available");
    });

    await runTest(
      "3. Bank Transfer available when all four required fields are configured",
      async () => {
        // Configure bank transfer details including instructions
        await prisma.commerceSettings.update({
          where: { singletonKey: 1 },
          data: {
            bankName: "Meezan Bank Limited",
            accountTitle: "Kids Wear Private Limited",
            accountOrIban: "PK42MEZN0001234567890123",
            instructions: "Transfer total amount and keep receipt handy.",
          },
        });

        const res = await app.inject({
          method: "GET",
          url: "/api/v1/checkout/config",
        });
        const body = JSON.parse(res.body);
        assert(
          body.data.paymentMethods.bankTransfer.available === true,
          "Configured bank transfer must be available"
        );
      }
    );

    await runTest(
      "4. configured Bank Transfer returns customer-facing configured fields",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/checkout/config",
        });
        const body = JSON.parse(res.body);
        const bt = body.data.paymentMethods.bankTransfer;
        assert(bt.bankName === "Meezan Bank Limited", "Bank name matches");
        assert(bt.accountTitle === "Kids Wear Private Limited", "Account title matches");
        assert(bt.accountOrIban === "PK42MEZN0001234567890123", "IBAN matches");
        assert(
          bt.instructions === "Transfer total amount and keep receipt handy.",
          "Instructions match"
        );
      }
    );

    await runTest("5. missing bankName disables Bank Transfer", async () => {
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          bankName: null,
          accountTitle: "Kids Wear Private Limited",
          accountOrIban: "PK42MEZN0001234567890123",
          instructions: "Transfer total amount.",
        },
      });
      const res = await app.inject({ method: "GET", url: "/api/v1/checkout/config" });
      const body = JSON.parse(res.body);
      assert(
        body.data.paymentMethods.bankTransfer.available === false,
        "Missing bankName must disable BT"
      );
      assert(body.data.paymentMethods.bankTransfer.bankName === null, "bankName must be null");
    });

    await runTest("6. missing accountTitle disables Bank Transfer", async () => {
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          bankName: "Meezan Bank Limited",
          accountTitle: null,
          accountOrIban: "PK42MEZN0001234567890123",
          instructions: "Transfer total amount.",
        },
      });
      const res = await app.inject({ method: "GET", url: "/api/v1/checkout/config" });
      const body = JSON.parse(res.body);
      assert(
        body.data.paymentMethods.bankTransfer.available === false,
        "Missing accountTitle must disable BT"
      );
    });

    await runTest("7. missing accountOrIban disables Bank Transfer", async () => {
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          bankName: "Meezan Bank Limited",
          accountTitle: "Kids Wear Private Limited",
          accountOrIban: null,
          instructions: "Transfer total amount.",
        },
      });
      const res = await app.inject({ method: "GET", url: "/api/v1/checkout/config" });
      const body = JSON.parse(res.body);
      assert(
        body.data.paymentMethods.bankTransfer.available === false,
        "Missing accountOrIban must disable BT"
      );
    });

    await runTest("8. missing instructions disables Bank Transfer", async () => {
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          bankName: "Meezan Bank Limited",
          accountTitle: "Kids Wear Private Limited",
          accountOrIban: "PK42MEZN0001234567890123",
          instructions: null,
        },
      });
      const res = await app.inject({ method: "GET", url: "/api/v1/checkout/config" });
      const body = JSON.parse(res.body);
      assert(
        body.data.paymentMethods.bankTransfer.available === false,
        "Missing instructions must disable BT"
      );
      assert(
        body.data.paymentMethods.bankTransfer.instructions === null,
        "instructions must be null"
      );
    });

    await runTest("9. whitespace-only instructions disables Bank Transfer", async () => {
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          bankName: "Meezan Bank Limited",
          accountTitle: "Kids Wear Private Limited",
          accountOrIban: "PK42MEZN0001234567890123",
          instructions: "     ",
        },
      });
      const res = await app.inject({ method: "GET", url: "/api/v1/checkout/config" });
      const body = JSON.parse(res.body);
      assert(
        body.data.paymentMethods.bankTransfer.available === false,
        "Whitespace instructions must disable BT"
      );
    });

    await runTest("10. optional branch fields do not control availability", async () => {
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          bankName: "Meezan Bank Limited",
          accountTitle: "Kids Wear Private Limited",
          accountOrIban: "PK42MEZN0001234567890123",
          instructions: "Transfer total amount.",
          branchCode: null,
          branchLocation: null,
        },
      });
      const res = await app.inject({ method: "GET", url: "/api/v1/checkout/config" });
      const body = JSON.parse(res.body);
      const bt = body.data.paymentMethods.bankTransfer;
      assert(
        bt.available === true,
        "BT must remain available when optional branch fields are null"
      );
      assert(bt.branchCode === null, "branchCode null");
      assert(bt.branchLocation === null, "branchLocation null");
    });

    await runTest("11. no notification recipient exposed", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/checkout/config",
      });
      assert(!res.body.includes("newOrderRecipientEmail"), "Recipient email must not be exposed");
      assert(!res.body.includes("sk.fabrica@gmail.com"), "Default recipient must not be exposed");
    });

    await runTest("12. no notification toggle exposed", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/checkout/config",
      });
      assert(!res.body.includes("newOrderEmailEnabled"), "Notification toggle must not be exposed");
    });

    await runTest("13. no settings/internal IDs exposed", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/checkout/config",
      });
      assert(!res.body.includes("singletonKey"), "singletonKey must not be exposed");
      assert(!res.body.includes("createdAt"), "createdAt must not be exposed");
      assert(!res.body.includes("updatedAt"), "updatedAt must not be exposed");
    });

    // Restore full bank configuration for subsequent tests
    await prisma.commerceSettings.update({
      where: { singletonKey: 1 },
      data: {
        bankName: "Meezan Bank Limited",
        accountTitle: "Kids Wear Private Limited",
        accountOrIban: "PK42MEZN0001234567890123",
        instructions: "Transfer total amount and keep receipt handy.",
      },
    });

    // =========================================================================
    // 2. REQUEST VALIDATION (Tests 14–36)
    // =========================================================================

    await runTest("14. valid guest customer payload accepted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 2 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
      const body = JSON.parse(res.body);
      assert(body.success === true, "Validation must succeed");
      assert(body.data.customer.fullName === "Ayesha Khan", "Customer name matches");
    });

    await runTest("15. required Full Name whitespace is rejected", async () => {
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, fullName: "" },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res1.statusCode === 400, "Empty Full Name must be 400");

      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, fullName: "    " }, // whitespace only
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res2.statusCode === 400, "Whitespace Full Name must be 400");

      const res3 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, fullName: "A" }, // < 2 chars
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res3.statusCode === 400, "Short Full Name must be 400");
    });

    await runTest("16. required Phone whitespace is rejected", async () => {
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, phone: "       " }, // whitespace only
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res1.statusCode === 400, "Whitespace Phone must be 400");

      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, phone: "123" }, // < 7 chars
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res2.statusCode === 400, "Short Phone must be 400");
    });

    await runTest("17. required Address whitespace is rejected", async () => {
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, address: "     " }, // whitespace only
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res1.statusCode === 400, "Whitespace Address must be 400");

      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, address: "Abc" }, // < 5 chars
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res2.statusCode === 400, "Short Address must be 400");
    });

    await runTest("18. required City whitespace is rejected", async () => {
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, city: "   " }, // whitespace only
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res1.statusCode === 400, "Whitespace City must be 400");

      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, city: "L" }, // < 2 chars
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res2.statusCode === 400, "Short City must be 400");
    });

    await runTest("19. required Province whitespace is rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, province: "   " }, // whitespace only
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Whitespace Province must be 400");
    });

    await runTest("20. optional Email null accepted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, email: null },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Email null must succeed");
      const body = JSON.parse(res.body);
      assert(body.data.customer.email === null, "Email must be normalized to null");
    });

    await runTest("21. optional Email empty string normalizes to null", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, email: "" },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Empty email must be 200");
      const body = JSON.parse(res.body);
      assert(body.data.customer.email === null, "Empty email must normalize to null");
    });

    await runTest("22. optional Email whitespace normalizes to null", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, email: "     " },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Whitespace email must be 200");
      const body = JSON.parse(res.body);
      assert(body.data.customer.email === null, "Whitespace email must normalize to null");
    });

    await runTest("23. valid Email is trimmed and preserved", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, email: "  ayesha.khan@example.com  " },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Valid email must be 200");
      const body = JSON.parse(res.body);
      assert(
        body.data.customer.email === "ayesha.khan@example.com",
        "Email must be trimmed and preserved"
      );
    });

    await runTest("24. invalid non-empty Email rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, email: "invalid-email-string" },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Invalid email format must be 400");
    });

    await runTest("25. optional Postal Code null accepted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, postalCode: null },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Postal code null must succeed");
      const body = JSON.parse(res.body);
      assert(body.data.customer.postalCode === null, "Postal code must be null");
    });

    await runTest("26. Postal Code empty/whitespace normalizes to null", async () => {
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, postalCode: "" },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res1.statusCode === 200, "Empty postal code must be 200");
      assert(
        JSON.parse(res1.body).data.customer.postalCode === null,
        "Empty postal code must normalize to null"
      );

      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, postalCode: "    " },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res2.statusCode === 200, "Whitespace postal code must be 200");
      assert(
        JSON.parse(res2.body).data.customer.postalCode === null,
        "Whitespace postal code must normalize to null"
      );
    });

    await runTest("27. valid Postal Code is trimmed and preserved", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, postalCode: "  54000  " },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Valid postal code must be 200");
      assert(
        JSON.parse(res.body).data.customer.postalCode === "54000",
        "Postal code must be trimmed and preserved"
      );
    });

    await runTest("28. optional Notes null accepted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, orderNotes: null },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Null notes must succeed");
      const body = JSON.parse(res.body);
      assert(body.data.customer.orderNotes === null, "Null notes must be null");
    });

    await runTest("29. Order Notes empty/whitespace normalizes to null", async () => {
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, orderNotes: "" },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res1.statusCode === 200, "Empty notes must be 200");
      assert(
        JSON.parse(res1.body).data.customer.orderNotes === null,
        "Empty notes must normalize to null"
      );

      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, orderNotes: "    " },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res2.statusCode === 200, "Whitespace notes must be 200");
      assert(
        JSON.parse(res2.body).data.customer.orderNotes === null,
        "Whitespace notes must normalize to null"
      );
    });

    await runTest("30. valid Notes is trimmed and preserved", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, orderNotes: "  Please call before arrival  " },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Valid notes must be 200");
      assert(
        JSON.parse(res.body).data.customer.orderNotes === "Please call before arrival",
        "Notes must be trimmed and preserved"
      );
    });

    await runTest("31. excessive Notes rejected", async () => {
      const longNotes = "A".repeat(1001);
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, orderNotes: longNotes },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Notes > 1000 chars must be 400");
    });

    await runTest("32. unknown/overposted fields rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: { ...validCustomer, companyName: "Unapproved Corp" },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Overposted customer field must be 400");
    });

    await runTest("33. malformed Cart UUID rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: "not-a-valid-uuid", quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Malformed variantId must be 400");
    });

    await runTest("34. quantity 0 rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 0 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Quantity 0 must be 400");
    });

    await runTest("35. quantity >10 rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 11 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Quantity 11 must be 400");
    });

    await runTest("36. unsupported payment method rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "STRIPE",
        },
      });
      assert(res.statusCode === 400, "Unsupported payment method must be 400");
    });

    // =========================================================================
    // 3. AUTHORITATIVE CART (Tests 37–49)
    // =========================================================================

    await runTest("37. published available Variant succeeds", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Published available variant must succeed");
      const body = JSON.parse(res.body);
      assert(body.data.items.length === 1, "Must return 1 validated item");
    });

    await runTest("38. Draft Product rejected", async () => {
      const draftProd = await createFixtureProduct({
        name: "Draft Kurta",
        slug: "draft-kurta",
        sku: "CHK-DFT-01",
        storefrontId: miniSprouts.id,
        regularPrice: "1999.00",
        status: "DRAFT",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [
            { productId: draftProd.product.id, variantId: draftProd.variant.id, quantity: 1 },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Draft product must be 400");
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Error code must be CART_INVALID");
    });

    await runTest("39. Inactive Product rejected", async () => {
      const inactiveProd = await createFixtureProduct({
        name: "Inactive Kurta",
        slug: "inactive-kurta",
        sku: "CHK-INA-01",
        storefrontId: miniSprouts.id,
        regularPrice: "1999.00",
        status: "INACTIVE",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [
            { productId: inactiveProd.product.id, variantId: inactiveProd.variant.id, quantity: 1 },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Inactive product must be 400");
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Error code must be CART_INVALID");
    });

    await runTest("40. unavailable Variant rejected", async () => {
      const unavailProd = await createFixtureProduct({
        name: "Unavailable Variant Kurta",
        slug: "unavail-kurta",
        sku: "CHK-UNA-01",
        storefrontId: miniSprouts.id,
        regularPrice: "1999.00",
        isVariantAvailable: false,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [
            { productId: unavailProd.product.id, variantId: unavailProd.variant.id, quantity: 1 },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Unavailable variant must be 400");
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Error code must be CART_INVALID");
    });

    await runTest("41. inactive Size rejected", async () => {
      const inactiveSizeProd = await createFixtureProduct({
        name: "Inactive Size Kurta",
        slug: "inactive-size-kurta",
        sku: "CHK-ISZ-01",
        storefrontId: miniSprouts.id,
        regularPrice: "1999.00",
        isSizeActive: false,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [
            {
              productId: inactiveSizeProd.product.id,
              variantId: inactiveSizeProd.variant.id,
              quantity: 1,
            },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Inactive size must be 400");
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Error code must be CART_INVALID");
    });

    await runTest("42. inactive Color rejected", async () => {
      const inactiveColorProd = await createFixtureProduct({
        name: "Inactive Color Kurta",
        slug: "inactive-color-kurta",
        sku: "CHK-ICL-01",
        storefrontId: miniSprouts.id,
        regularPrice: "1999.00",
        isColorActive: false,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [
            {
              productId: inactiveColorProd.product.id,
              variantId: inactiveColorProd.variant.id,
              quantity: 1,
            },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Inactive color must be 400");
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Error code must be CART_INVALID");
    });

    await runTest("43. Product/Variant mismatch rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          // prod1.product with prod2.variant
          items: [{ productId: prod1.product.id, variantId: prod2.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Product mismatch must be 400");
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Error code must be CART_INVALID");
    });

    await runTest("44. price is current server price", async () => {
      // Modify price of prod1 to 3999.00
      await prisma.product.update({
        where: { id: prod1.product.id },
        data: { regularPrice: new Prisma.Decimal("3999.00") },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Status must be 200");
      const body = JSON.parse(res.body);
      assert(body.data.items[0].unitPrice === "3999.00", "Price must reflect current server value");

      // Restore price
      await prisma.product.update({
        where: { id: prod1.product.id },
        data: { regularPrice: new Prisma.Decimal("3499.00") },
      });
    });

    await runTest("45. shipping is current CommerceSettings value", async () => {
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: { flatDeliveryCharge: new Prisma.Decimal("450.00") },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Status must be 200");
      const body = JSON.parse(res.body);
      assert(
        body.data.deliveryCharge === "450.00",
        "Delivery charge must reflect updated settings"
      );

      // Restore delivery charge
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: { flatDeliveryCharge: new Prisma.Decimal("300.00") },
      });
    });

    await runTest("46. shipping applied once", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [
            { productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 },
            { productId: prod2.product.id, variantId: prod2.variant.id, quantity: 2 },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "Status must be 200");
      const body = JSON.parse(res.body);
      // prod1: 3499 * 1 = 3499.00; prod2: 2199 * 2 = 4398.00; subtotal = 7897.00
      assert(
        body.data.subtotal === "7897.00",
        `Expected subtotal 7897.00, got ${body.data.subtotal}`
      );
      assert(body.data.deliveryCharge === "300.00", "Flat delivery charge must be applied once");
      // 7897.00 + 300.00 = 8197.00
      assert(body.data.total === "8197.00", `Expected total 8197.00, got ${body.data.total}`);
    });

    await runTest("47. totals use Decimal-safe values", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 3 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      const body = JSON.parse(res.body);
      // 3499 * 3 = 10497.00; delivery = 300.00; total = 10797.00
      assert(body.data.subtotal === "10497.00", "Decimal subtotal exact");
      assert(body.data.deliveryCharge === "300.00", "Decimal delivery exact");
      assert(body.data.total === "10797.00", "Decimal total exact");
    });

    await runTest("48. empty Cart rejected for Checkout", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Empty items array must be 400");
    });

    await runTest("49. mixed invalid Cart cannot validate successfully", async () => {
      const unavailProd = await createFixtureProduct({
        name: "Unavailable Item",
        slug: "unavail-item",
        sku: "CHK-MIX-01",
        storefrontId: miniSprouts.id,
        regularPrice: "1000.00",
        isVariantAvailable: false,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [
            { productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 },
            { productId: unavailProd.product.id, variantId: unavailProd.variant.id, quantity: 1 },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, "Mixed invalid cart must be 400");
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Error must be CART_INVALID");
    });

    // =========================================================================
    // 4. PAYMENT (Tests 50–54)
    // =========================================================================

    await runTest("50. COD validates successfully", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, "COD must be 200");
      const body = JSON.parse(res.body);
      assert(body.data.paymentMethod === "CASH_ON_DELIVERY", "Payment method returned is COD");
    });

    await runTest("51. configured Bank Transfer validates", async () => {
      // Ensure bank transfer is configured with all 4 required fields
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          bankName: "Meezan Bank Limited",
          accountTitle: "Kids Wear Private Limited",
          accountOrIban: "PK42MEZN0001234567890123",
          instructions: "Transfer total amount and keep receipt handy.",
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "BANK_TRANSFER",
        },
      });
      assert(res.statusCode === 200, "Configured bank transfer must be 200");
      const body = JSON.parse(res.body);
      assert(
        body.data.paymentMethod === "BANK_TRANSFER",
        "Payment method returned is BANK_TRANSFER"
      );
    });

    await runTest(
      "52. incomplete Bank Transfer configuration returns payment unavailable",
      async () => {
        // Clear bank details in DB
        await prisma.commerceSettings.update({
          where: { singletonKey: 1 },
          data: {
            bankName: null,
            accountTitle: null,
            accountOrIban: null,
            instructions: null,
          },
        });

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/checkout/validate",
          payload: {
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "BANK_TRANSFER",
          },
        });
        assert(res.statusCode === 400, "Incomplete bank config must be 400");
        const body = JSON.parse(res.body);
        assert(
          body.error.code === "PAYMENT_METHOD_UNAVAILABLE",
          `Expected PAYMENT_METHOD_UNAVAILABLE, got ${body.error.code}`
        );

        // Restore bank config
        await prisma.commerceSettings.update({
          where: { singletonKey: 1 },
          data: {
            bankName: "Meezan Bank Limited",
            accountTitle: "Kids Wear Private Limited",
            accountOrIban: "PK42MEZN0001234567890123",
            instructions: "Transfer total amount and keep receipt handy.",
          },
        });
      }
    );

    await runTest(
      "53. Checkout prevalidation rejects Bank Transfer after configuration becomes incomplete",
      async () => {
        // First verify it succeeds when fully configured
        await prisma.commerceSettings.update({
          where: { singletonKey: 1 },
          data: {
            bankName: "Meezan Bank Limited",
            accountTitle: "Kids Wear Private Limited",
            accountOrIban: "PK42MEZN0001234567890123",
            instructions: "Transfer total amount.",
          },
        });

        const resValid = await app.inject({
          method: "POST",
          url: "/api/v1/checkout/validate",
          payload: {
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "BANK_TRANSFER",
          },
        });
        assert(resValid.statusCode === 200, "Should validate when fully configured");

        // Now dynamically change configuration to whitespace instructions
        await prisma.commerceSettings.update({
          where: { singletonKey: 1 },
          data: {
            instructions: "     ",
          },
        });

        // Live re-check must immediately fail without cached/stale bypass
        const resInvalid = await app.inject({
          method: "POST",
          url: "/api/v1/checkout/validate",
          payload: {
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "BANK_TRANSFER",
          },
        });
        assert(resInvalid.statusCode === 400, "Should reject when instructions become whitespace");
        const body = JSON.parse(resInvalid.body);
        assert(
          body.error.code === "PAYMENT_METHOD_UNAVAILABLE",
          `Expected PAYMENT_METHOD_UNAVAILABLE, got ${body.error.code}`
        );

        // Restore bank config
        await prisma.commerceSettings.update({
          where: { singletonKey: 1 },
          data: {
            bankName: "Meezan Bank Limited",
            accountTitle: "Kids Wear Private Limited",
            accountOrIban: "PK42MEZN0001234567890123",
            instructions: "Transfer total amount and keep receipt handy.",
          },
        });
      }
    );

    await runTest("54. Checkout never silently changes selected payment method", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "BANK_TRANSFER",
        },
      });
      assert(res.statusCode === 200, "Status must be 200");
      const body = JSON.parse(res.body);
      assert(
        body.data.paymentMethod === "BANK_TRANSFER",
        "Must remain BANK_TRANSFER; cannot silently switch to COD"
      );
    });

    // =========================================================================
    // 5. STATE BOUNDARY (Tests 55–58)
    // =========================================================================

    await runTest("55. validation creates no Order", async () => {
      const orderCountBefore = await prisma.order.count();

      await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });

      const orderCountAfter = await prisma.order.count();
      assert(
        orderCountBefore === orderCountAfter,
        `Order count must not change: before=${orderCountBefore}, after=${orderCountAfter}`
      );
    });

    await runTest("56. validation creates no OrderItem", async () => {
      const itemCountBefore = await prisma.orderItem.count();

      await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 2 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });

      const itemCountAfter = await prisma.orderItem.count();
      assert(
        itemCountBefore === itemCountAfter,
        `OrderItem count must not change: before=${itemCountBefore}, after=${itemCountAfter}`
      );
    });

    await runTest("57. validation creates no OrderStatusHistory", async () => {
      const historyCountBefore = await prisma.orderStatusHistory.count();

      await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });

      const historyCountAfter = await prisma.orderStatusHistory.count();
      assert(
        historyCountBefore === historyCountAfter,
        `OrderStatusHistory count must not change: before=${historyCountBefore}, after=${historyCountAfter}`
      );
    });

    await runTest("58. validation changes no Product/Variant state", async () => {
      const variantBefore = await prisma.productVariant.findUnique({
        where: { id: prod1.variant.id },
      });

      await app.inject({
        method: "POST",
        url: "/api/v1/checkout/validate",
        payload: {
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });

      const variantAfter = await prisma.productVariant.findUnique({
        where: { id: prod1.variant.id },
      });
      assert(
        variantBefore?.isAvailable === variantAfter?.isAvailable,
        "Variant availability must not change"
      );
      assert(
        variantBefore?.updatedAt.getTime() === variantAfter?.updatedAt.getTime(),
        "Variant updatedAt must not change"
      );
    });
  } finally {
    // Restore original settings
    if (originalSettings) {
      await prisma.commerceSettings
        .update({
          where: { singletonKey: 1 },
          data: {
            bankName: originalSettings.bankName,
            accountTitle: originalSettings.accountTitle,
            accountOrIban: originalSettings.accountOrIban,
            branchCode: originalSettings.branchCode,
            branchLocation: originalSettings.branchLocation,
            instructions: originalSettings.instructions,
            flatDeliveryCharge: originalSettings.flatDeliveryCharge,
          },
        })
        .catch(() => {});
    }

    // Clean up created fixtures
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
    `Checkout Validation Test Summary: ${passed} passed, ${failed} failed, total ${results.length}`
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
