import crypto from "node:crypto";
import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import { Prisma } from "@prisma/client";
import { setOrderCreationTestHooks } from "../src/modules/order/routes";
import {
  setEmailService,
  getEmailService,
  resetEmailService,
  IEmailService,
  SendNewOrderNotificationParams,
} from "../src/lib/email";
import {
  generateRawCustomerSessionToken,
  hashCustomerSessionToken,
} from "../src/modules/customer-auth/services/session";
import { env } from "../src/config/env";

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

class MockEmailService implements IEmailService {
  public calls: SendNewOrderNotificationParams[] = [];
  public shouldFail = false;

  async sendNewOrderNotification(
    params: SendNewOrderNotificationParams
  ): Promise<{ success: boolean; error?: string }> {
    this.calls.push(params);
    if (this.shouldFail) {
      return { success: false, error: "Simulated email delivery error" };
    }
    return { success: true };
  }

  clear() {
    this.calls = [];
    this.shouldFail = false;
  }
}

async function main() {
  console.log("Starting Kids Wear — Order Creation API Test Suite (90 Tests)...\n");

  const prisma = getPrismaClient();
  const app = await buildApp();
  const mockEmail = new MockEmailService();
  setEmailService(mockEmail);

  // Isolate simulated client IP per test request so the strict server-side rate-limiter
  // (10 req/min, no localhost bypass) is exercised without false exhaustion in unit tests.
  let ipCounter = 1;
  const originalInject = app.inject.bind(app);
  // @ts-expect-error wrapping inject for test isolation
  app.inject = function (opts: any) {
    if (typeof opts === "object" && opts !== null && !opts.remoteAddress) {
      opts.remoteAddress = `198.51.100.${(ipCounter++ % 250) + 1}`;
    }
    return originalInject(opts);
  };

  const miniSprouts = await prisma.storefront.findUnique({ where: { slug: "mini-sprouts" } });
  const teenStudio = await prisma.storefront.findUnique({ where: { slug: "teen-studio" } });
  assert(miniSprouts !== null && teenStudio !== null, "Storefronts must exist");

  const createdOrderIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdMediaAssetIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdSessionIds: string[] = [];

  // Hermetic pre-cleanup of leftover records from prior interrupted runs
  const staleOrders = await prisma.order.findMany({
    where: {
      OR: [{ email: "fatima.noor@example.com" }, { email: { contains: "order-test" } }],
    },
    select: { id: true },
  });
  if (staleOrders.length > 0) {
    const staleOrderIds = staleOrders.map((o) => o.id);
    await prisma.orderStatusHistory
      .deleteMany({ where: { orderId: { in: staleOrderIds } } })
      .catch(() => {});
    await prisma.orderItem
      .deleteMany({ where: { orderId: { in: staleOrderIds } } })
      .catch(() => {});
    await prisma.order.deleteMany({ where: { id: { in: staleOrderIds } } }).catch(() => {});
  }
  const staleProducts = await prisma.product.findMany({
    where: {
      OR: [
        { sku: { startsWith: "ORD-" } },
        { sku: { startsWith: "SKU-LOCK-" } },
        { slug: { startsWith: "ord-" } },
        { slug: { startsWith: "lock-var-" } },
      ],
    },
    select: { id: true },
  });
  if (staleProducts.length > 0) {
    const staleProdIds = staleProducts.map((p) => p.id);
    await prisma.orderItem
      .deleteMany({ where: { productId: { in: staleProdIds } } })
      .catch(() => {});
    await prisma.productMedia
      .deleteMany({ where: { productId: { in: staleProdIds } } })
      .catch(() => {});
    await prisma.productVariant
      .deleteMany({ where: { productId: { in: staleProdIds } } })
      .catch(() => {});
    await prisma.productSize
      .deleteMany({ where: { productId: { in: staleProdIds } } })
      .catch(() => {});
    await prisma.productColor
      .deleteMany({ where: { productId: { in: staleProdIds } } })
      .catch(() => {});
    await prisma.product.deleteMany({ where: { id: { in: staleProdIds } } }).catch(() => {});
  }
  await prisma.mediaAsset
    .deleteMany({
      where: { providerPublicId: { startsWith: "order-test-" } },
    })
    .catch(() => {});

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

  // Helper to create test fixture products
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
        description: "Editorial order test product",
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
      const mediaAsset = await createTestMediaAsset(`order-test-${options.slug}`);
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

  // Save original CommerceSettings to restore after tests
  const originalSettings = await prisma.commerceSettings.findUnique({
    where: { singletonKey: 1 },
  });

  // Base customer payload
  const validCustomer = {
    fullName: "Fatima Noor",
    phone: "03001234567",
    email: "fatima.noor@example.com",
    address: "House 12, Street 4, Sector F-8/2",
    city: "Islamabad",
    province: "Federal Capital",
    postalCode: "44000",
    orderNotes: "Leave at front gate if not home.",
  };

  try {
    // Standard test fixtures
    const prod1 = await createFixtureProduct({
      name: "Embroidered Cotton Kurta",
      slug: "ord-emb-kurta",
      sku: "ORD-EMB-01",
      storefrontId: miniSprouts.id,
      regularPrice: "3499.00",
    });

    const prod2 = await createFixtureProduct({
      name: "Lawn Tunic Set",
      slug: "ord-lawn-tunic",
      sku: "ORD-LWN-02",
      storefrontId: teenStudio.id,
      regularPrice: "4250.00",
    });

    // Ensure CommerceSettings has valid Bank Transfer config
    await prisma.commerceSettings.update({
      where: { singletonKey: 1 },
      data: {
        flatDeliveryCharge: new Prisma.Decimal("300.00"),
        bankName: "Meezan Bank",
        accountTitle: "Kids Wear Private Limited",
        accountOrIban: "PK36MEZN0001234567890102",
        instructions: "Please mention order reference.",
        newOrderEmailEnabled: true,
        newOrderNotificationRecipient: "admin.notifications@kidswear.local",
      },
    });

    // =========================================================================
    // Section 1: Request Security (Tests 1–13)
    // =========================================================================
    console.log("\n--- Section 1: Request Security (Tests 1–13) ---");

    await runTest("1. public guest Order endpoint works without login", async () => {
      const idempotencyKey = crypto.randomUUID();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey,
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });

      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.success === true, "Expected success true");
      assert(
        /^KW-\d+$/.test(body.data.orderNumber),
        `Expected KW-<seq> format, got ${body.data.orderNumber}`
      );
      assert(body.data.paymentMethod === "CASH_ON_DELIVERY", "Expected CASH_ON_DELIVERY");

      const created = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(created !== null, "Order should exist in DB");
      if (created) createdOrderIds.push(created.id);
    });

    await runTest("2. empty Cart rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    await runTest("3. malformed UUID rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: "not-a-uuid",
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    await runTest("4. quantity 0 rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 0 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    await runTest("5. quantity >10 rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 11 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    await runTest("6. duplicate Variant lines rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [
            { productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 },
            { productId: prod1.product.id, variantId: prod1.variant.id, quantity: 2 },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    await runTest("7. unknown fields rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
          maliciousField: "injection",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    await runTest("8. client subtotal rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
          subtotal: "10.00",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    await runTest("9. client delivery charge rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
          deliveryCharge: "0.00",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    await runTest("10. client total rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
          grandTotal: "100.00",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    await runTest("11. client status rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
          status: "DELIVERED",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    await runTest("12. client order number rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
          orderNumber: "KW-9999",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    await runTest("13. client customerId rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
          customerId: crypto.randomUUID(),
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    });

    // =========================================================================
    // Section 2: Final Commerce Validation (Tests 14–25)
    // =========================================================================
    console.log("\n--- Section 2: Final Commerce Validation (Tests 14–25) ---");

    await runTest("14. published available Variant creates Order", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 2 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const created = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (created) createdOrderIds.push(created.id);
    });

    await runTest("15. Draft Product rejected", async () => {
      const draftProd = await createFixtureProduct({
        name: "Draft Silk Shirt",
        slug: "ord-draft-silk",
        sku: "ORD-DRF-01",
        storefrontId: miniSprouts.id,
        regularPrice: "2999.00",
        status: "DRAFT",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [
            { productId: draftProd.product.id, variantId: draftProd.variant.id, quantity: 1 },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Expected CART_INVALID");
    });

    await runTest("16. Inactive Product rejected", async () => {
      const inactiveProd = await createFixtureProduct({
        name: "Inactive Linen Vest",
        slug: "ord-inact-vest",
        sku: "ORD-INA-01",
        storefrontId: teenStudio.id,
        regularPrice: "1999.00",
        status: "INACTIVE",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [
            { productId: inactiveProd.product.id, variantId: inactiveProd.variant.id, quantity: 1 },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Expected CART_INVALID");
    });

    await runTest("17. unavailable Variant rejected", async () => {
      const unavailProd = await createFixtureProduct({
        name: "Out of Stock Romper",
        slug: "ord-unavail-romper",
        sku: "ORD-UNA-01",
        storefrontId: miniSprouts.id,
        regularPrice: "2499.00",
        isVariantAvailable: false,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [
            { productId: unavailProd.product.id, variantId: unavailProd.variant.id, quantity: 1 },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Expected CART_INVALID");
    });

    await runTest("18. inactive Size rejected", async () => {
      const inactSizeProd = await createFixtureProduct({
        name: "Inactive Size Trousers",
        slug: "ord-inact-size",
        sku: "ORD-ISZ-01",
        storefrontId: teenStudio.id,
        regularPrice: "2750.00",
        isSizeActive: false,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [
            {
              productId: inactSizeProd.product.id,
              variantId: inactSizeProd.variant.id,
              quantity: 1,
            },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Expected CART_INVALID");
    });

    await runTest("19. inactive Color rejected", async () => {
      const inactColorProd = await createFixtureProduct({
        name: "Inactive Color Waistcoat",
        slug: "ord-inact-color",
        sku: "ORD-ICL-01",
        storefrontId: miniSprouts.id,
        regularPrice: "3100.00",
        isColorActive: false,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [
            {
              productId: inactColorProd.product.id,
              variantId: inactColorProd.variant.id,
              quantity: 1,
            },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Expected CART_INVALID");
    });

    await runTest("20. Product/Variant mismatch rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod2.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.error.code === "CART_INVALID", "Expected CART_INVALID");
    });

    await runTest("21. current server Product price used", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 2 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
        include: { items: true },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        // prod1 regularPrice is 3499.00; 2 * 3499 = 6998.00
        assert(
          order.subtotal.toFixed(2) === "6998.00",
          `Expected subtotal 6998.00, got ${order.subtotal}`
        );
      }
    });

    await runTest("22. current delivery setting used", async () => {
      // Temporarily set delivery charge to 450.00
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: { flatDeliveryCharge: new Prisma.Decimal("450.00") },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        assert(
          order.deliveryCharge.toFixed(2) === "450.00",
          `Expected 450.00, got ${order.deliveryCharge}`
        );
      }

      // Revert delivery charge to 300.00
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: { flatDeliveryCharge: new Prisma.Decimal("300.00") },
      });
    });

    await runTest("23. flat delivery charge applied once", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [
            { productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 },
            { productId: prod2.product.id, variantId: prod2.variant.id, quantity: 1 },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        // subtotal: 3499 + 4250 = 7749.00; deliveryCharge: 300.00; grandTotal: 8049.00
        assert(
          order.deliveryCharge.toFixed(2) === "300.00",
          "Delivery charge must be applied once"
        );
        assert(
          order.grandTotal.toFixed(2) === "8049.00",
          `Expected 8049.00, got ${order.grandTotal}`
        );
      }
    });

    await runTest("24. quantity and line subtotal correct", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 3 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
        include: { items: true },
      });
      assert(order !== null && order.items.length === 1, "Order item should exist");
      if (order) {
        createdOrderIds.push(order.id);
        const item = order.items[0];
        assert(item.quantity === 3, "Quantity should be 3");
        assert(item.unitPrice.toFixed(2) === "3499.00", "Unit price should be 3499.00");
        assert(
          item.lineSubtotal.toFixed(2) === "10497.00",
          `Expected 10497.00, got ${item.lineSubtotal}`
        );
      }
    });

    await runTest("25. Decimal-safe grand total correct", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 3 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        // subtotal 10497.00 + 300.00 = 10797.00
        assert(
          order.grandTotal.toFixed(2) === "10797.00",
          `Expected 10797.00, got ${order.grandTotal}`
        );
      }
    });

    // =========================================================================
    // Section 3: Customer Snapshot (Tests 26–31)
    // =========================================================================
    console.log("\n--- Section 3: Customer Snapshot (Tests 26–31) ---");

    await runTest("26. required customer snapshot persisted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        assert(order.fullName === validCustomer.fullName, "fullName should match");
        assert(order.phone === validCustomer.phone, "phone should match");
        assert(order.address === validCustomer.address, "address should match");
        assert(order.city === validCustomer.city, "city should match");
        assert(order.province === validCustomer.province, "province should match");
      }
    });

    await runTest("27. blank optional values persisted null", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: {
            ...validCustomer,
            email: "   ",
            postalCode: "",
            orderNotes: "   ",
          },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        assert(order.email === null, "email should be null");
        assert(order.postalCode === null, "postalCode should be null");
        assert(order.orderNotes === null, "orderNotes should be null");
      }
    });

    await runTest("28. authenticated Customer session links customerId", async () => {
      // Create a test customer and session
      const customer = await prisma.customer.create({
        data: {
          email: "logged_in_customer@example.com",
          fullName: "Logged In Customer",
          phone: "03009876543",
          passwordHash: "argon2_test_hash",
        },
      });
      createdCustomerIds.push(customer.id);

      const rawToken = generateRawCustomerSessionToken();
      const tokenHash = hashCustomerSessionToken(rawToken);
      const session = await prisma.customerSession.create({
        data: {
          customerId: customer.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        },
      });
      createdSessionIds.push(session.id);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: {
          cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${rawToken}`,
        },
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        assert(order.customerId === customer.id, "order.customerId must equal customer.id");
      }
    });

    await runTest("29. guest Order customerId null", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        assert(order.customerId === null, "guest order.customerId must be null");
      }
    });

    await runTest("30. registered-email guest Order remains customerId null", async () => {
      // Create registered customer without session
      const registeredCust = await prisma.customer.create({
        data: {
          email: "unauthenticated_registered@example.com",
          fullName: "Registered Customer",
          phone: "03008888888",
          passwordHash: "argon2_test_hash",
        },
      });
      createdCustomerIds.push(registeredCust.id);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: {
            ...validCustomer,
            email: "unauthenticated_registered@example.com",
          },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        assert(
          order.customerId === null,
          "Order must NOT associate customer based solely on email"
        );
      }
    });

    await runTest("31. Order creation does not mutate Customer profile", async () => {
      const customer = await prisma.customer.create({
        data: {
          email: "profile_safety_customer@example.com",
          fullName: "Original Profile Name",
          phone: "03001111222",
          passwordHash: "argon2_test_hash",
        },
      });
      createdCustomerIds.push(customer.id);

      const rawToken = generateRawCustomerSessionToken();
      const tokenHash = hashCustomerSessionToken(rawToken);
      const session = await prisma.customerSession.create({
        data: {
          customerId: customer.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        },
      });
      createdSessionIds.push(session.id);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: {
          cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${rawToken}`,
        },
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: {
            ...validCustomer,
            fullName: "Different Checkout Name",
            phone: "03009999999",
          },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      const refreshedCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
      assert(refreshedCustomer !== null, "Customer must exist");
      if (refreshedCustomer) {
        assert(
          refreshedCustomer.fullName === "Original Profile Name",
          "Customer profile name must not be mutated"
        );
        assert(
          refreshedCustomer.phone === "03001111222",
          "Customer profile phone must not be mutated"
        );
      }
    });

    // =========================================================================
    // Section 4: Payment / Status (Tests 32–37)
    // =========================================================================
    console.log("\n--- Section 4: Payment / Status (Tests 32–37) ---");

    await runTest("32. COD creates Order Received", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        assert(order.status === "ORDER_RECEIVED", `Expected ORDER_RECEIVED, got ${order.status}`);
      }
    });

    await runTest("33. COD creates matching history", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
        include: { statusHistory: true },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        assert(order.statusHistory.length === 1, "Expected 1 history event");
        assert(
          order.statusHistory[0].status === "ORDER_RECEIVED",
          "History status should be ORDER_RECEIVED"
        );
        assert(order.statusHistory[0].changedByAdminId === null, "changedByAdminId should be null");
      }
    });

    await runTest("34. Bank Transfer creates Awaiting Payment", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "BANK_TRANSFER",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        assert(
          order.status === "AWAITING_PAYMENT",
          `Expected AWAITING_PAYMENT, got ${order.status}`
        );
      }
    });

    await runTest("35. Bank Transfer creates matching history", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "BANK_TRANSFER",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
        include: { statusHistory: true },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        createdOrderIds.push(order.id);
        assert(order.statusHistory.length === 1, "Expected 1 history event");
        assert(
          order.statusHistory[0].status === "AWAITING_PAYMENT",
          "History status should be AWAITING_PAYMENT"
        );
      }
    });

    await runTest("36. incomplete Bank Transfer config rejects creation", async () => {
      // Temporarily blank out instructions
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: { instructions: null },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "BANK_TRANSFER",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(
        body.error.code === "PAYMENT_METHOD_UNAVAILABLE",
        "Expected PAYMENT_METHOD_UNAVAILABLE"
      );

      // Restore instructions
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: { instructions: "Please mention order reference." },
      });
    });

    await runTest("37. Bank Transfer is never silently converted to COD", async () => {
      // Temporarily blank out account title
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: { accountTitle: "" },
      });

      const ordersBefore = await prisma.order.count();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "BANK_TRANSFER",
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const ordersAfter = await prisma.order.count();
      assert(ordersBefore === ordersAfter, "No order should be created when payment is rejected");

      // Restore account title
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: { accountTitle: "Kids Wear Private Limited" },
      });
    });

    // =========================================================================
    // Section 5: Historical Snapshot (Tests 38–45)
    // =========================================================================
    console.log("\n--- Section 5: Historical Snapshot (Tests 38–45) ---");

    let snapshotOrderId = "";
    let snapshotOrderNumber = "";

    await runTest("38. Product name snapshot persisted", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      snapshotOrderNumber = body.data.orderNumber;
      const order = await prisma.order.findUnique({
        where: { orderNumber: snapshotOrderNumber },
        include: { items: true },
      });
      assert(order !== null && order.items.length === 1, "Order item should exist");
      if (order) {
        snapshotOrderId = order.id;
        createdOrderIds.push(order.id);
        assert(
          order.items[0].productName === prod1.product.name,
          "Product name snapshot must match original"
        );
      }
    });

    await runTest("39. Size snapshot persisted", async () => {
      const order = await prisma.order.findUnique({
        where: { id: snapshotOrderId },
        include: { items: true },
      });
      assert(
        order !== null && order.items[0].sizeLabel === "3-4Y",
        "Size snapshot must match 3-4Y"
      );
    });

    await runTest("40. Color snapshot persisted", async () => {
      const order = await prisma.order.findUnique({
        where: { id: snapshotOrderId },
        include: { items: true },
      });
      assert(
        order !== null && order.items[0].colorName === "Ocean Blue",
        "Color snapshot must match Ocean Blue"
      );
    });

    await runTest("41. unit price snapshot persisted", async () => {
      const order = await prisma.order.findUnique({
        where: { id: snapshotOrderId },
        include: { items: true },
      });
      assert(
        order !== null && order.items[0].unitPrice.toFixed(2) === "3499.00",
        "Unit price snapshot must match 3499.00"
      );
    });

    await runTest("42. later Product rename does not alter snapshot", async () => {
      // Rename the original product in database
      await prisma.product.update({
        where: { id: prod1.product.id },
        data: { name: "Renamed Future Festive Kurta" },
      });

      const order = await prisma.order.findUnique({
        where: { id: snapshotOrderId },
        include: { items: true },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        assert(
          order.items[0].productName === "Embroidered Cotton Kurta",
          "Historical product name snapshot must remain immutable"
        );
      }
    });

    await runTest("43. later Size/Color rename does not alter snapshot", async () => {
      // Rename original size and color in database
      await prisma.productSize.update({
        where: { id: prod1.size.id },
        data: { name: "7-8Y Altered" },
      });
      await prisma.productColor.update({
        where: { id: prod1.color.id },
        data: { name: "Altered Burgundy" },
      });

      const order = await prisma.order.findUnique({
        where: { id: snapshotOrderId },
        include: { items: true },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        assert(
          order.items[0].sizeLabel === "3-4Y",
          "Historical size snapshot must remain immutable"
        );
        assert(
          order.items[0].colorName === "Ocean Blue",
          "Historical color snapshot must remain immutable"
        );
      }
    });

    await runTest("44. later Product price change does not alter historical price", async () => {
      // Change regularPrice on original product
      await prisma.product.update({
        where: { id: prod1.product.id },
        data: { regularPrice: new Prisma.Decimal("9999.00") },
      });

      const order = await prisma.order.findUnique({
        where: { id: snapshotOrderId },
        include: { items: true },
      });
      assert(order !== null, "Order should exist");
      if (order) {
        assert(
          order.items[0].unitPrice.toFixed(2) === "3499.00",
          "Historical unit price snapshot must remain 3499.00"
        );
        assert(order.subtotal.toFixed(2) === "3499.00", "Historical subtotal must remain 3499.00");
      }

      // Revert product name and price
      await prisma.product.update({
        where: { id: prod1.product.id },
        data: {
          name: "Embroidered Cotton Kurta",
          regularPrice: new Prisma.Decimal("3499.00"),
        },
      });
      await prisma.productSize.update({
        where: { id: prod1.size.id },
        data: { name: "3-4Y" },
      });
      await prisma.productColor.update({
        where: { id: prod1.color.id },
        data: { name: "Ocean Blue" },
      });
    });

    await runTest(
      "45. later shipping setting change does not alter historical delivery/total",
      async () => {
        // Change shipping setting in CommerceSettings
        await prisma.commerceSettings.update({
          where: { singletonKey: 1 },
          data: { flatDeliveryCharge: new Prisma.Decimal("1500.00") },
        });

        const order = await prisma.order.findUnique({ where: { id: snapshotOrderId } });
        assert(order !== null, "Order should exist");
        if (order) {
          assert(
            order.deliveryCharge.toFixed(2) === "300.00",
            "Historical deliveryCharge must remain 300.00"
          );
          assert(
            order.grandTotal.toFixed(2) === "3799.00",
            "Historical grandTotal must remain 3799.00"
          );
        }

        // Revert shipping setting
        await prisma.commerceSettings.update({
          where: { singletonKey: 1 },
          data: { flatDeliveryCharge: new Prisma.Decimal("300.00") },
        });
      }
    );

    // =========================================================================
    // Section 6: Transactionality (Tests 46–49)
    // =========================================================================
    console.log("\n--- Section 6: Transactionality (Tests 46–49) ---");

    await runTest("46. all OrderItems created atomically", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [
            { productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 },
            { productId: prod2.product.id, variantId: prod2.variant.id, quantity: 2 },
          ],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
        include: { items: true },
      });
      assert(
        order !== null && order.items.length === 2,
        "Both order items must be created atomically"
      );
      if (order) createdOrderIds.push(order.id);
    });

    await runTest("47. forced OrderItem failure rolls back Order", async () => {
      const ordersBefore = await prisma.order.count();
      const testKey = crypto.randomUUID();

      setOrderCreationTestHooks({
        beforeItemCreate: () => {
          throw new Error("Simulated OrderItem creation failure for transaction rollback test");
        },
      });

      try {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: testKey,
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });
        assert(
          res.statusCode === 500,
          `Expected 500 on transaction rollback, got ${res.statusCode}`
        );

        const ordersAfter = await prisma.order.count();
        assert(ordersBefore === ordersAfter, "Order row must be rolled back on item failure");

        const order = await prisma.order.findUnique({ where: { idempotencyKey: testKey } });
        assert(order === null, "Rolled-back order must not exist in DB");
      } finally {
        setOrderCreationTestHooks(null);
      }
    });

    await runTest("48. forced history failure rolls back Order", async () => {
      const ordersBefore = await prisma.order.count();
      const testKey = crypto.randomUUID();

      setOrderCreationTestHooks({
        beforeHistoryCreate: () => {
          throw new Error(
            "Simulated OrderStatusHistory creation failure for transaction rollback test"
          );
        },
      });

      try {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: testKey,
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });
        assert(
          res.statusCode === 500,
          `Expected 500 on transaction rollback, got ${res.statusCode}`
        );

        const ordersAfter = await prisma.order.count();
        assert(ordersBefore === ordersAfter, "Order row must be rolled back on history failure");

        const order = await prisma.order.findUnique({ where: { idempotencyKey: testKey } });
        assert(order === null, "Rolled-back order must not exist in DB");
      } finally {
        setOrderCreationTestHooks(null);
      }
    });

    await runTest("49. no partial Order survives failed transaction", async () => {
      const itemsBefore = await prisma.orderItem.count();
      const historyBefore = await prisma.orderStatusHistory.count();

      setOrderCreationTestHooks({
        beforeCommit: () => {
          throw new Error("Simulated pre-commit failure for atomicity test");
        },
      });

      try {
        await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });

        const itemsAfter = await prisma.orderItem.count();
        const historyAfter = await prisma.orderStatusHistory.count();
        assert(itemsBefore === itemsAfter, "No orphaned OrderItems may survive failed transaction");
        assert(
          historyBefore === historyAfter,
          "No orphaned OrderStatusHistory may survive failed transaction"
        );
      } finally {
        setOrderCreationTestHooks(null);
      }
    });

    // =========================================================================
    // Section 7: Order Number (Tests 50–52)
    // =========================================================================
    console.log("\n--- Section 7: Order Number (Tests 50–52) ---");

    await runTest("50. number format matches KW-<sequence>", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(
        /^KW-\d+$/.test(body.data.orderNumber),
        `Order number must match KW-<digits>: ${body.data.orderNumber}`
      );
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);
    });

    await runTest("51. numbers are unique", async () => {
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });

      const body1 = JSON.parse(res1.body);
      const body2 = JSON.parse(res2.body);
      assert(
        body1.data.orderNumber !== body2.data.orderNumber,
        "Sequential order numbers must be unique"
      );

      const o1 = await prisma.order.findUnique({ where: { orderNumber: body1.data.orderNumber } });
      const o2 = await prisma.order.findUnique({ where: { orderNumber: body2.data.orderNumber } });
      if (o1) createdOrderIds.push(o1.id);
      if (o2) createdOrderIds.push(o2.id);
    });

    await runTest("52. sequence allocation is concurrency-safe", async () => {
      const requests = Array.from({ length: 3 }, () =>
        app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        })
      );

      const responses = await Promise.all(requests);
      const numbers = new Set<string>();

      for (const res of responses) {
        assert(res.statusCode === 201, `Concurrent order must return 201, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        numbers.add(body.data.orderNumber);
        const order = await prisma.order.findUnique({
          where: { orderNumber: body.data.orderNumber },
        });
        if (order) createdOrderIds.push(order.id);
      }

      assert(
        numbers.size === 3,
        "All 3 concurrent orders must receive distinct sequential order numbers"
      );
    });

    // =========================================================================
    // Section 8: Idempotency (Tests 53–57)
    // =========================================================================
    console.log("\n--- Section 8: Idempotency (Tests 53–57) ---");

    const sharedIdempotencyKey = crypto.randomUUID();
    let originalOrderNumber = "";

    await runTest("53. first unique idempotency key creates Order", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: sharedIdempotencyKey,
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      originalOrderNumber = body.data.orderNumber;
      const order = await prisma.order.findUnique({ where: { orderNumber: originalOrderNumber } });
      if (order) createdOrderIds.push(order.id);
    });

    await runTest("54. identical retry does not create second Order", async () => {
      const ordersBefore = await prisma.order.count();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: sharedIdempotencyKey,
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, `Expected 200 idempotent replay, got ${res.statusCode}`);
      const ordersAfter = await prisma.order.count();
      assert(ordersBefore === ordersAfter, "Identical retry must not insert a new Order");
    });

    await runTest("55. identical retry returns same Order number", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: sharedIdempotencyKey,
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(
        body.data.orderNumber === originalOrderNumber,
        `Expected ${originalOrderNumber}, got ${body.data.orderNumber}`
      );
    });

    await runTest("56. same key + different request rejected", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: sharedIdempotencyKey,
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: {
            ...validCustomer,
            fullName: "Completely Different Customer",
          },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(
        res.statusCode === 409,
        `Expected 409 conflict on reused key with different intent, got ${res.statusCode}`
      );
      const body = JSON.parse(res.body);
      assert(body.error.code === "IDEMPOTENCY_CONFLICT", "Expected IDEMPOTENCY_CONFLICT code");
    });

    await runTest("57. concurrent same-key attempts create at most one Order", async () => {
      const concurrentKey = crypto.randomUUID();
      const ordersBefore = await prisma.order.count();

      const [resA, resB] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: concurrentKey,
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        }),
        app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: concurrentKey,
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        }),
      ]);

      // Both should succeed (one creates 201, other returns 200 or 201)
      assert(resA.statusCode === 201 || resA.statusCode === 200, `resA status: ${resA.statusCode}`);
      assert(resB.statusCode === 201 || resB.statusCode === 200, `resB status: ${resB.statusCode}`);

      const bodyA = JSON.parse(resA.body);
      const bodyB = JSON.parse(resB.body);
      assert(
        bodyA.data.orderNumber === bodyB.data.orderNumber,
        "Both requests must receive same orderNumber"
      );

      const ordersAfter = await prisma.order.count();
      assert(ordersAfter === ordersBefore + 1, "Exactly 1 order row must be created in DB");

      const order = await prisma.order.findUnique({ where: { idempotencyKey: concurrentKey } });
      if (order) createdOrderIds.push(order.id);
    });

    // =========================================================================
    // Section 9: Admin Notification (Tests 58–65)
    // =========================================================================
    console.log("\n--- Section 9: Admin Notification (Tests 58–65) ---");

    await runTest("58. notification disabled -> no Resend call", async () => {
      mockEmail.clear();
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: { newOrderEmailEnabled: false },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      assert(
        mockEmail.calls.length === 0,
        "No email should be dispatched when notification is disabled"
      );

      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: { newOrderEmailEnabled: true },
      });
    });

    await runTest(
      "59. notification enabled -> service called after successful commit",
      async () => {
        mockEmail.clear();

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });
        assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        const order = await prisma.order.findUnique({
          where: { orderNumber: body.data.orderNumber },
        });
        if (order) createdOrderIds.push(order.id);

        assert(
          mockEmail.calls.length === 1,
          "Email service should be called once after successful commit"
        );
      }
    );

    await runTest("60. recipient comes from CommerceSettings", async () => {
      mockEmail.clear();
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: { newOrderNotificationRecipient: "custom.director@kidswear.local" },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      assert(mockEmail.calls.length === 1, "Email service should be called");
      assert(
        mockEmail.calls[0].recipientEmail === "custom.director@kidswear.local",
        `Expected recipient from settings, got ${mockEmail.calls[0].recipientEmail}`
      );
    });

    await runTest("61. notification contains Order number", async () => {
      mockEmail.clear();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      assert(mockEmail.calls.length === 1, "Email service called");
      assert(
        mockEmail.calls[0].orderNumber === body.data.orderNumber,
        "Notification must contain exact orderNumber"
      );
    });

    await runTest("62. notification failure does not roll back Order", async () => {
      mockEmail.clear();
      mockEmail.shouldFail = true;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      assert(order !== null, "Order must persist even if notification dispatch fails");
      if (order) createdOrderIds.push(order.id);

      mockEmail.shouldFail = false;
    });

    await runTest("63. notification failure still returns successful Order response", async () => {
      mockEmail.clear();
      mockEmail.shouldFail = true;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201 despite email error, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.success === true, "Response must remain success: true");
      assert(/^KW-\d+$/.test(body.data.orderNumber), "Response must return valid orderNumber");

      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      mockEmail.shouldFail = false;
    });

    await runTest("64. failed transaction never sends notification", async () => {
      mockEmail.clear();

      setOrderCreationTestHooks({
        beforeCommit: () => {
          throw new Error("Failed before commit");
        },
      });

      try {
        await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });

        assert(
          mockEmail.calls.length === 0,
          "No notification may ever be dispatched for a failed transaction"
        );
      } finally {
        setOrderCreationTestHooks(null);
      }
    });

    await runTest("65. no customer confirmation email is sent", async () => {
      mockEmail.clear();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: {
            ...validCustomer,
            email: "customer.recipient@example.com",
          },
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      // Verify that no email was sent to customer.recipient@example.com
      const customerEmails = mockEmail.calls.filter(
        (c) => c.recipientEmail === "customer.recipient@example.com"
      );
      assert(
        customerEmails.length === 0,
        "Kids Wear V1 strictly does NOT send customer confirmation emails"
      );
    });

    // =========================================================================
    // Section 10: Data Exposure (Tests 66–69)
    // =========================================================================
    console.log("\n--- Section 10: Data Exposure (Tests 66–69) ---");

    await runTest("66. success response excludes internal Customer ID", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      assert(body.data.customerId === undefined, "customerId must be excluded from response");
      assert(
        body.data.customer === undefined,
        "customer snapshot object must be excluded from response"
      );
    });

    await runTest("67. success response excludes notification recipient", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      assert(body.data.recipientEmail === undefined, "notification recipient must be excluded");
      assert(body.data.notification === undefined, "notification details must be excluded");
    });

    await runTest("68. success response excludes internal history IDs", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      assert(body.data.statusHistory === undefined, "statusHistory must be excluded");
      assert(body.data.historyId === undefined, "history IDs must be excluded");
      assert(body.data.id === undefined, "internal Order UUID id must be excluded");
    });

    await runTest("69. no SKU/numeric inventory added to customer response", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      assert(body.data.items === undefined, "items array must be excluded from customer response");
      assert(body.data.sku === undefined, "SKU must not be in customer response");
      assert(body.data.stock === undefined, "stock units must not be in customer response");
      assert(
        body.data.inventoryCount === undefined,
        "inventory count must not be in customer response"
      );
    });

    // =========================================================================
    // Section 11: Color Model Audit (Test 70)
    // =========================================================================
    console.log("\n--- Section 11: Color Model Audit (Test 70) ---");

    await runTest(
      "70. OrderItem snapshot uses only colorName and contains no colorHex/hexCode/swatch",
      async () => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });
        assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        const order = await prisma.order.findUnique({
          where: { orderNumber: body.data.orderNumber },
          include: { items: true },
        });
        if (order) createdOrderIds.push(order.id);

        assert(order !== null && order.items.length === 1, "Order and items must exist");
        const orderItem = order.items[0];

        // Verify colorName is populated
        assert(
          orderItem.colorName === "Ocean Blue",
          `Expected colorName 'Ocean Blue', got ${orderItem.colorName}`
        );

        // Verify no color-hex properties exist on the OrderItem model
        assert((orderItem as any).colorHex === undefined, "colorHex must not exist on OrderItem");
        assert((orderItem as any).hexCode === undefined, "hexCode must not exist on OrderItem");
        assert((orderItem as any).swatch === undefined, "swatch must not exist on OrderItem");
        assert(
          (orderItem as any).colorFamily === undefined,
          "colorFamily must not exist on OrderItem"
        );

        // Verify at database column level via information_schema
        const hexColumns = await prisma.$queryRaw<{ column_name: string }[]>(
          Prisma.sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'OrderItem' 
            AND (column_name ILIKE '%hex%' OR column_name ILIKE '%swatch%' OR column_name ILIKE '%rgb%')
        `
        );
        assert(
          hexColumns.length === 0,
          `No hex/swatch/rgb columns may exist on OrderItem, found: ${hexColumns.map((c) => c.column_name).join(", ")}`
        );
      }
    );

    // =========================================================================
    // Section 12: Notification Settings Verification (Tests 71–74)
    // =========================================================================
    console.log("\n--- Section 12: Notification Settings Verification (Tests 71–74) ---");

    await runTest("71. disabled toggle skips send", async () => {
      mockEmail.clear();
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          newOrderEmailEnabled: false,
          newOrderNotificationRecipient: "admin.recipient@example.local",
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      assert(mockEmail.calls.length === 0, "Disabled toggle must skip send");
    });

    await runTest("72. enabled toggle uses newOrderNotificationRecipient", async () => {
      mockEmail.clear();
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          newOrderEmailEnabled: true,
          newOrderNotificationRecipient: "specific.admin@kidswear.local",
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: crypto.randomUUID(),
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      assert(mockEmail.calls.length === 1, "Email must be dispatched");
      assert(
        mockEmail.calls[0].recipientEmail === "specific.admin@kidswear.local",
        `Expected recipient 'specific.admin@kidswear.local', got ${mockEmail.calls[0].recipientEmail}`
      );
    });

    await runTest(
      "73. changing recipient in CommerceSettings changes destination without code changes",
      async () => {
        mockEmail.clear();
        await prisma.commerceSettings.update({
          where: { singletonKey: 1 },
          data: {
            newOrderEmailEnabled: true,
            newOrderNotificationRecipient: "new.destination@kidswear.local",
          },
        });

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });
        assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        const order = await prisma.order.findUnique({
          where: { orderNumber: body.data.orderNumber },
        });
        if (order) createdOrderIds.push(order.id);

        assert(mockEmail.calls.length === 1, "Email must be dispatched");
        assert(
          mockEmail.calls[0].recipientEmail === "new.destination@kidswear.local",
          `Expected recipient 'new.destination@kidswear.local', got ${mockEmail.calls[0].recipientEmail}`
        );

        // Verify empty recipient skips send without hardcoding sk.fabrica@gmail.com
        mockEmail.clear();
        await prisma.commerceSettings.update({
          where: { singletonKey: 1 },
          data: {
            newOrderEmailEnabled: true,
            newOrderNotificationRecipient: null,
          },
        });

        const emptyRes = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });
        assert(emptyRes.statusCode === 201, `Expected 201, got ${emptyRes.statusCode}`);
        const emptyBody = JSON.parse(emptyRes.body);
        const emptyOrder = await prisma.order.findUnique({
          where: { orderNumber: emptyBody.data.orderNumber },
        });
        if (emptyOrder) createdOrderIds.push(emptyOrder.id);

        assert(
          mockEmail.calls.length === 0,
          "Empty recipient must skip send (no hardcoded fallback)"
        );
      }
    );

    await runTest(
      "74. no parallel notification-recipient field exists in CommerceSettings",
      async () => {
        const parallelColumns = await prisma.$queryRaw<{ column_name: string }[]>(
          Prisma.sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'CommerceSettings' 
            AND column_name IN ('orderNotificationEmail', 'notificationEmail', 'adminOrderEmail')
        `
        );
        assert(
          parallelColumns.length === 0,
          `Forbidden parallel columns found: ${parallelColumns.map((c) => c.column_name).join(", ")}`
        );
      }
    );

    // =========================================================================
    // Section 13: Concurrency & Transaction Locking (Tests 75–78)
    // =========================================================================
    console.log("\n--- Section 13: Concurrency & Transaction Locking (Tests 75–78) ---");

    await runTest(
      "75. availability cannot change between protected validation and Order persistence without waiting/failing",
      async () => {
        const testProd = await createFixtureProduct({
          storefrontId: miniSprouts.id,
          name: "Lock Variant Test",
          slug: `lock-var-${crypto.randomUUID().slice(0, 8)}`,
          sku: `SKU-LOCK-VAR-${crypto.randomUUID().slice(0, 6)}`,
          regularPrice: "1200.00",
        });

        let lockAttemptError: any = null;
        let hookExecuted = false;

        setOrderCreationTestHooks({
          beforeOrderCreate: async () => {
            hookExecuted = true;
            try {
              await prisma.$executeRawUnsafe(
                `SET LOCAL lock_timeout = '100ms'; UPDATE "ProductVariant" SET "isAvailable" = false WHERE id = '${testProd.variant.id}'`
              );
            } catch (err: any) {
              lockAttemptError = err;
            }
          },
        });

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [
              {
                productId: testProd.product.id,
                variantId: testProd.variant.id,
                quantity: 1,
              },
            ],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });

        setOrderCreationTestHooks(null);

        assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        const order = await prisma.order.findUnique({
          where: { orderNumber: body.data.orderNumber },
        });
        if (order) createdOrderIds.push(order.id);

        assert(hookExecuted, "beforeOrderCreate hook should have executed");
        assert(
          lockAttemptError !== null,
          "Concurrent update to ProductVariant should have failed or blocked due to FOR UPDATE lock"
        );
        assert(
          lockAttemptError.message.includes("lock timeout") ||
            lockAttemptError.message.includes("55P03"),
          `Expected lock timeout error, got: ${lockAttemptError.message}`
        );
      }
    );

    await runTest(
      "76. Product publication change cannot produce a stale successful Order",
      async () => {
        const testProd = await createFixtureProduct({
          storefrontId: miniSprouts.id,
          name: "Lock Product Publication Test",
          slug: `lock-pub-${crypto.randomUUID().slice(0, 8)}`,
          sku: `SKU-LOCK-PUB-${crypto.randomUUID().slice(0, 6)}`,
          regularPrice: "1500.00",
        });

        let lockAttemptError: any = null;
        let hookExecuted = false;

        setOrderCreationTestHooks({
          beforeOrderCreate: async () => {
            hookExecuted = true;
            try {
              await prisma.$executeRawUnsafe(
                `SET LOCAL lock_timeout = '100ms'; UPDATE "Product" SET "status" = 'INACTIVE' WHERE id = '${testProd.product.id}'`
              );
            } catch (err: any) {
              lockAttemptError = err;
            }
          },
        });

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [
              {
                productId: testProd.product.id,
                variantId: testProd.variant.id,
                quantity: 1,
              },
            ],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });

        setOrderCreationTestHooks(null);

        assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        const order = await prisma.order.findUnique({
          where: { orderNumber: body.data.orderNumber },
        });
        if (order) createdOrderIds.push(order.id);

        assert(hookExecuted, "beforeOrderCreate hook should have executed");
        assert(
          lockAttemptError !== null,
          "Concurrent update to Product should have failed or blocked due to FOR UPDATE lock"
        );
        assert(
          lockAttemptError.message.includes("lock timeout") ||
            lockAttemptError.message.includes("55P03"),
          `Expected lock timeout error, got: ${lockAttemptError.message}`
        );

        // Now test second direction: if product is made INACTIVE first, order creation fails
        await prisma.product.update({
          where: { id: testProd.product.id },
          data: { status: "INACTIVE" },
        });

        const rejectRes = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [
              {
                productId: testProd.product.id,
                variantId: testProd.variant.id,
                quantity: 1,
              },
            ],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });

        assert(
          rejectRes.statusCode === 400,
          `Expected 400 when product is inactive, got ${rejectRes.statusCode}`
        );
        const rejectBody = JSON.parse(rejectRes.body);
        assert(
          rejectBody.error.code === "CART_INVALID",
          `Expected CART_INVALID, got ${rejectBody.error.code}`
        );
      }
    );

    await runTest(
      "77. concurrent price/settings change cannot silently create an Order using an unprotected stale financial snapshot",
      async () => {
        let lockAttemptError: any = null;
        let hookExecuted = false;

        setOrderCreationTestHooks({
          beforeOrderCreate: async () => {
            hookExecuted = true;
            try {
              await prisma.$executeRawUnsafe(
                `SET LOCAL lock_timeout = '100ms'; UPDATE "CommerceSettings" SET "flatDeliveryCharge" = 999.00 WHERE "singletonKey" = 1`
              );
            } catch (err: any) {
              lockAttemptError = err;
            }
          },
        });

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });

        setOrderCreationTestHooks(null);

        assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        const order = await prisma.order.findUnique({
          where: { orderNumber: body.data.orderNumber },
        });
        if (order) createdOrderIds.push(order.id);

        assert(hookExecuted, "beforeOrderCreate hook should have executed");
        assert(
          lockAttemptError !== null,
          "Concurrent update to CommerceSettings should have failed or blocked due to FOR UPDATE lock"
        );
        assert(
          lockAttemptError.message.includes("lock timeout") ||
            lockAttemptError.message.includes("55P03"),
          `Expected lock timeout error, got: ${lockAttemptError.message}`
        );
        assert(
          order?.deliveryCharge.toFixed(2) === "300.00",
          `Order deliveryCharge should match locked snapshot, got ${order?.deliveryCharge.toFixed(2)}`
        );
      }
    );

    await runTest("78. no partial Order survives a transaction conflict", async () => {
      const conflictKey = crypto.randomUUID();

      setOrderCreationTestHooks({
        beforeItemCreate: async () => {
          throw new Error("Simulated unrecoverable failure during item insertion");
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: conflictKey,
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });

      setOrderCreationTestHooks(null);

      assert(res.statusCode === 500, `Expected 500, got ${res.statusCode}`);

      const survivingOrder = await prisma.order.findUnique({
        where: { idempotencyKey: conflictKey },
      });
      assert(survivingOrder === null, "Order record must not exist after transaction rollback");

      const survivingItems = await prisma.orderItem.findMany({
        where: { order: { idempotencyKey: conflictKey } },
      });
      assert(survivingItems.length === 0, "No OrderItem records should survive rollback");

      const survivingLogs = await prisma.orderStatusHistory.findMany({
        where: { order: { idempotencyKey: conflictKey } },
      });
      assert(survivingLogs.length === 0, "No OrderStatusHistory records should survive rollback");
    });

    // =========================================================================
    // Section 14: Idempotent Notification Suppression (Tests 79–83)
    // =========================================================================
    console.log("\n--- Section 14: Idempotent Notification Suppression (Tests 79–83) ---");

    const idempKey1 = crypto.randomUUID();

    await runTest("79. first request sends one notification when enabled", async () => {
      mockEmail.clear();
      await prisma.commerceSettings.update({
        where: { singletonKey: 1 },
        data: {
          newOrderEmailEnabled: true,
          newOrderNotificationRecipient: "admin.notifications@kidswear.local",
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: idempKey1,
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const order = await prisma.order.findUnique({
        where: { orderNumber: body.data.orderNumber },
      });
      if (order) createdOrderIds.push(order.id);

      assert(mockEmail.calls.length === 1, "First request must send exactly 1 notification");
    });

    await runTest("80. sequential identical retry sends no second notification", async () => {
      mockEmail.clear();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          idempotencyKey: idempKey1,
          items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
          customer: validCustomer,
          paymentMethod: "CASH_ON_DELIVERY",
        },
      });
      assert(res.statusCode === 200, `Expected 200 for idempotent replay, got ${res.statusCode}`);
      assert(
        mockEmail.calls.length === 0,
        "Sequential identical retry must NOT trigger a second notification"
      );
    });

    const concurrentKey = crypto.randomUUID();

    await runTest("81. concurrent same-key requests create exactly one Order", async () => {
      const [res1, res2] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: concurrentKey,
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        }),
        app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: concurrentKey,
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        }),
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode].sort();
      assert(
        statusCodes[0] === 200 && statusCodes[1] === 201,
        `Expected one 201 and one 200, got ${statusCodes.join(", ")}`
      );

      const matchingOrders = await prisma.order.findMany({
        where: { idempotencyKey: concurrentKey },
      });
      assert(matchingOrders.length === 1, "Exactly one Order should exist in database");
      createdOrderIds.push(matchingOrders[0].id);
    });

    await runTest(
      "82. concurrent same-key requests cause at most one notification attempt",
      async () => {
        const keyForEmailTest = crypto.randomUUID();
        mockEmail.clear();

        const [res1, res2] = await Promise.all([
          app.inject({
            method: "POST",
            url: "/api/v1/orders",
            payload: {
              idempotencyKey: keyForEmailTest,
              items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
              customer: validCustomer,
              paymentMethod: "CASH_ON_DELIVERY",
            },
          }),
          app.inject({
            method: "POST",
            url: "/api/v1/orders",
            payload: {
              idempotencyKey: keyForEmailTest,
              items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
              customer: validCustomer,
              paymentMethod: "CASH_ON_DELIVERY",
            },
          }),
        ]);

        const body1 = JSON.parse(res1.body);
        const order = await prisma.order.findUnique({
          where: { orderNumber: body1.data.orderNumber },
        });
        if (order) createdOrderIds.push(order.id);

        assert(
          mockEmail.calls.length === 1,
          `Concurrent same-key requests must cause at most 1 notification attempt, got ${mockEmail.calls.length}`
        );
      }
    );

    await runTest(
      "83. conflicting same-key request returns idempotency conflict and sends nothing",
      async () => {
        mockEmail.clear();

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: idempKey1,
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: {
              ...validCustomer,
              phone: "+923009999999", // Different phone
            },
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });

        assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        assert(
          body.error.code === "IDEMPOTENCY_CONFLICT",
          `Expected IDEMPOTENCY_CONFLICT, got ${body.error.code}`
        );
        assert(
          mockEmail.calls.length === 0,
          "Conflicting key attempt must send zero notifications"
        );
      }
    );

    // =========================================================================
    // Section 15: Resend Configuration Boundary & Adapter Tests (Tests 84–90)
    // =========================================================================
    console.log(
      "\n--- Section 15: Resend Configuration Boundary & Adapter Tests (Tests 84–90) ---"
    );

    await runTest(
      "84. configured API key + sender + enabled setting sends notification",
      async () => {
        const originalApiKey = process.env.RESEND_API_KEY;
        const originalFromEmail = process.env.RESEND_FROM_EMAIL;

        try {
          process.env.RESEND_API_KEY = "re_test_dummy_key_12345";
          process.env.RESEND_FROM_EMAIL = "Kids Wear Operations <test-sender@example.com>";

          const { ResendEmailService } = await import("../src/lib/email");
          const service = new ResendEmailService();
          assert(
            typeof service.sendNewOrderNotification === "function",
            "sendNewOrderNotification must be a callable method on ResendEmailService"
          );
        } finally {
          process.env.RESEND_API_KEY = originalApiKey;
          process.env.RESEND_FROM_EMAIL = originalFromEmail;
        }
      }
    );

    await runTest(
      "85. missing RESEND_FROM_EMAIL does not substitute a source-code fallback",
      async () => {
        const originalApiKey = process.env.RESEND_API_KEY;
        const originalFromEmail = process.env.RESEND_FROM_EMAIL;

        try {
          process.env.RESEND_API_KEY = "re_test_dummy_key_12345";
          delete process.env.RESEND_FROM_EMAIL;

          const { ResendEmailService } = await import("../src/lib/email");
          const service = new ResendEmailService();
          const result = await service.sendNewOrderNotification({
            orderNumber: "KW-9999",
            recipientEmail: "admin@kidswear.local",
            customerName: "Test User",
            customerPhone: "+923001234567",
            customerEmail: null,
            customerAddress: "Test Address",
            customerCity: "Lahore",
            customerProvince: "Punjab",
            customerPostalCode: null,
            customerOrderNotes: null,
            paymentMethod: "CASH_ON_DELIVERY",
            subtotal: "1000.00",
            deliveryCharge: "300.00",
            grandTotal: "1300.00",
            items: [],
          });

          assert(result.success === false, "Must return failure when RESEND_FROM_EMAIL is missing");
          assert(
            result.error === "RESEND_FROM_EMAIL is not configured",
            `Expected explicit RESEND_FROM_EMAIL error, got ${result.error}`
          );
        } finally {
          process.env.RESEND_API_KEY = originalApiKey;
          process.env.RESEND_FROM_EMAIL = originalFromEmail;
        }
      }
    );

    await runTest("86. missing RESEND_FROM_EMAIL does not roll back the Order", async () => {
      const originalApiKey = process.env.RESEND_API_KEY;
      const originalFromEmail = process.env.RESEND_FROM_EMAIL;

      try {
        process.env.RESEND_API_KEY = "re_test_dummy_key_12345";
        delete process.env.RESEND_FROM_EMAIL;

        const { ResendEmailService } = await import("../src/lib/email");
        setEmailService(new ResendEmailService());

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });

        assert(
          res.statusCode === 201,
          `Order creation must succeed with 201 even if email config is missing, got ${res.statusCode}`
        );
        const body = JSON.parse(res.body);
        const order = await prisma.order.findUnique({
          where: { orderNumber: body.data.orderNumber },
        });
        assert(order !== null, "Order must be committed in database");
        if (order) createdOrderIds.push(order.id);
      } finally {
        process.env.RESEND_API_KEY = originalApiKey;
        process.env.RESEND_FROM_EMAIL = originalFromEmail;
        setEmailService(mockEmail);
      }
    });

    await runTest("87. missing RESEND_API_KEY does not roll back the Order", async () => {
      const originalApiKey = process.env.RESEND_API_KEY;
      const originalFromEmail = process.env.RESEND_FROM_EMAIL;

      try {
        delete process.env.RESEND_API_KEY;
        delete process.env.RESEND_FROM_EMAIL;

        const { ResendEmailService } = await import("../src/lib/email");
        setEmailService(new ResendEmailService());

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          payload: {
            idempotencyKey: crypto.randomUUID(),
            items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
            customer: validCustomer,
            paymentMethod: "CASH_ON_DELIVERY",
          },
        });

        assert(
          res.statusCode === 201,
          `Order creation must succeed with 201 even if API key is missing, got ${res.statusCode}`
        );
        const body = JSON.parse(res.body);
        const order = await prisma.order.findUnique({
          where: { orderNumber: body.data.orderNumber },
        });
        assert(order !== null, "Order must be committed in database");
        if (order) createdOrderIds.push(order.id);
      } finally {
        process.env.RESEND_API_KEY = originalApiKey;
        process.env.RESEND_FROM_EMAIL = originalFromEmail;
        setEmailService(mockEmail);
      }
    });

    await runTest(
      "88. disabled notification does not require Resend environment configuration",
      async () => {
        const originalApiKey = process.env.RESEND_API_KEY;
        const originalFromEmail = process.env.RESEND_FROM_EMAIL;

        try {
          delete process.env.RESEND_API_KEY;
          delete process.env.RESEND_FROM_EMAIL;

          await prisma.commerceSettings.update({
            where: { singletonKey: 1 },
            data: { newOrderEmailEnabled: false },
          });

          setEmailService({
            sendNewOrderNotification: async () => {
              throw new Error("sendNewOrderNotification should NOT have been called");
            },
          });

          const res = await app.inject({
            method: "POST",
            url: "/api/v1/orders",
            payload: {
              idempotencyKey: crypto.randomUUID(),
              items: [{ productId: prod1.product.id, variantId: prod1.variant.id, quantity: 1 }],
              customer: validCustomer,
              paymentMethod: "CASH_ON_DELIVERY",
            },
          });

          assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
          const body = JSON.parse(res.body);
          const order = await prisma.order.findUnique({
            where: { orderNumber: body.data.orderNumber },
          });
          if (order) createdOrderIds.push(order.id);
        } finally {
          process.env.RESEND_API_KEY = originalApiKey;
          process.env.RESEND_FROM_EMAIL = originalFromEmail;
          await prisma.commerceSettings.update({
            where: { singletonKey: 1 },
            data: { newOrderEmailEnabled: true },
          });
          setEmailService(mockEmail);
        }
      }
    );

    await runTest(
      "89. no source file contains the hardcoded fallback orders@kidswear.pk or orders@kidswear.local as sender",
      async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");

        const filesToInspect = [
          path.resolve(__dirname, "../src/lib/email.ts"),
          path.resolve(__dirname, "../src/modules/order/routes.ts"),
          path.resolve(__dirname, "../src/config/env.ts"),
        ];

        for (const filePath of filesToInspect) {
          const content = fs.readFileSync(filePath, "utf-8");
          assert(
            !content.includes("orders@kidswear.pk"),
            `Forbidden hardcoded address orders@kidswear.pk found in ${path.basename(filePath)}`
          );
          assert(
            !content.includes("orders@kidswear.local"),
            `Forbidden hardcoded address orders@kidswear.local found in ${path.basename(filePath)}`
          );
          assert(
            !content.includes("noreply@kidswear.pk"),
            `Forbidden hardcoded address noreply@kidswear.pk found in ${path.basename(filePath)}`
          );
          assert(
            !content.includes("info@thekidswear.com"),
            `Forbidden hardcoded address info@thekidswear.com found in ${path.basename(filePath)}`
          );
        }
      }
    );

    await runTest(
      "90. automated tests use MockEmailService and make zero live Resend requests",
      async () => {
        const currentService = getEmailService();
        assert(
          currentService instanceof MockEmailService,
          "Active email service during automated tests must be MockEmailService"
        );
        assert(Array.isArray(mockEmail.calls), "mockEmail must record in-memory calls");
      }
    );
  } finally {
    // Teardown and hermetic cleanup
    setOrderCreationTestHooks(null);
    resetEmailService();

    // Clean up created orders, items, and status logs
    if (createdOrderIds.length > 0) {
      await prisma.orderStatusHistory
        .deleteMany({
          where: { orderId: { in: createdOrderIds } },
        })
        .catch(() => {});
      await prisma.orderItem
        .deleteMany({
          where: { orderId: { in: createdOrderIds } },
        })
        .catch(() => {});
      await prisma.order
        .deleteMany({
          where: { id: { in: createdOrderIds } },
        })
        .catch(() => {});
    }

    // Clean up customer sessions and customers
    if (createdSessionIds.length > 0) {
      await prisma.customerSession
        .deleteMany({
          where: { id: { in: createdSessionIds } },
        })
        .catch(() => {});
    }
    if (createdCustomerIds.length > 0) {
      await prisma.customer
        .deleteMany({
          where: { id: { in: createdCustomerIds } },
        })
        .catch(() => {});
    }

    // Clean up products, variants, media, sizes, colors
    if (createdProductIds.length > 0) {
      await prisma.productMedia
        .deleteMany({
          where: { productId: { in: createdProductIds } },
        })
        .catch(() => {});
      await prisma.productVariant
        .deleteMany({
          where: { productId: { in: createdProductIds } },
        })
        .catch(() => {});
      await prisma.productSize
        .deleteMany({
          where: { productId: { in: createdProductIds } },
        })
        .catch(() => {});
      await prisma.productColor
        .deleteMany({
          where: { productId: { in: createdProductIds } },
        })
        .catch(() => {});
      await prisma.product
        .deleteMany({
          where: { id: { in: createdProductIds } },
        })
        .catch(() => {});
    }

    if (createdMediaAssetIds.length > 0) {
      await prisma.mediaAsset
        .deleteMany({
          where: { id: { in: createdMediaAssetIds } },
        })
        .catch(() => {});
    }

    // Restore original CommerceSettings
    if (originalSettings) {
      await prisma.commerceSettings
        .update({
          where: { singletonKey: 1 },
          data: {
            flatDeliveryCharge: originalSettings.flatDeliveryCharge,
            bankName: originalSettings.bankName,
            accountTitle: originalSettings.accountTitle,
            accountOrIban: originalSettings.accountOrIban,
            branchCode: originalSettings.branchCode,
            branchLocation: originalSettings.branchLocation,
            instructions: originalSettings.instructions,
            newOrderEmailEnabled: originalSettings.newOrderEmailEnabled,
            newOrderNotificationRecipient: originalSettings.newOrderNotificationRecipient,
          },
        })
        .catch(() => {});
    }
  }

  // Summary
  console.log("\n========================================================");
  console.log("Order Creation Backend Test Suite Results:");
  console.log(`Total: ${results.length}`);
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test suite runner error:", err);
  process.exit(1);
});
