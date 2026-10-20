import crypto from "node:crypto";
import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import { Prisma, OrderStatus, PaymentMethod } from "@prisma/client";
import {
  generateRawSessionToken as generateRawAdminToken,
  hashSessionToken as hashAdminToken,
} from "../src/modules/admin-auth/services/session";
import { hashPassword } from "../src/modules/admin-auth/services/password";
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
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: errorMsg });
    // eslint-disable-next-line no-console
    console.error(`  ❌ ${name}: ${errorMsg}`);
  }
}

async function runDashboardTestSuite(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("\n=======================================================");
  // eslint-disable-next-line no-console
  console.log("Kids Wear — Admin Dashboard Backend Test Suite");
  // eslint-disable-next-line no-console
  console.log("=======================================================\n");

  const app = await buildApp();
  const prisma = getPrismaClient();

  const createdOrderIds: string[] = [];
  const createdAdminSessionIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdStorefrontIds: string[] = [];

  try {
    // 1. Setup Admin User
    let adminUser = await prisma.adminUser.findFirst({
      where: { singletonKey: 1 },
    });
    if (!adminUser) {
      const passwordHash = await hashPassword("AdminSecurePassword123!");
      adminUser = await prisma.adminUser.create({
        data: {
          email: "admin-dash@kidswear.local",
          passwordHash,
          singletonKey: 1,
        },
      });
    }

    // Generate valid Admin session
    const adminRawToken = generateRawAdminToken();
    const adminTokenHash = hashAdminToken(adminRawToken);
    const adminSession = await prisma.adminSession.create({
      data: {
        adminUserId: adminUser.id,
        tokenHash: adminTokenHash,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    createdAdminSessionIds.push(adminSession.id);
    const adminCookie = `${env.ADMIN_SESSION_COOKIE_NAME}=${adminRawToken}`;

    // Setup Storefront & Test Products
    const storefront = await prisma.storefront.upsert({
      where: { slug: "mini-sprouts" },
      update: {},
      create: {
        name: "Mini Sprouts",
        slug: "mini-sprouts",
        ageLabel: "0-3 Years",
      },
    });
    createdStorefrontIds.push(storefront.id);

    const testProduct = await prisma.product.create({
      data: {
        name: "Dashboard Test Romper",
        sku: `DASH-SKU-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        slug: `dash-romper-${crypto.randomBytes(4).toString("hex")}`,
        description: "Dashboard test romper description",
        storefrontId: storefront.id,
        regularPrice: new Prisma.Decimal("1500.00"),
        status: "PUBLISHED",
      },
    });
    createdProductIds.push(testProduct.id);

    const size = await prisma.productSize.create({
      data: {
        productId: testProduct.id,
        name: "0-3M",
        sortOrder: 1,
      },
    });

    const color = await prisma.productColor.create({
      data: {
        productId: testProduct.id,
        name: "Sky Blue",
        sortOrder: 1,
      },
    });

    // Create 1 available variant and 2 unavailable variants
    await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        productSizeId: size.id,
        productColorId: color.id,
        isAvailable: true,
      },
    });

    const color2 = await prisma.productColor.create({
      data: {
        productId: testProduct.id,
        name: "Assorted",
        sortOrder: 2,
      },
    });

    await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        productSizeId: size.id,
        productColorId: color2.id,
        isAvailable: false,
      },
    });

    const size2 = await prisma.productSize.create({
      data: {
        productId: testProduct.id,
        name: "3-6M",
        sortOrder: 2,
      },
    });

    await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        productSizeId: size2.id,
        productColorId: color.id,
        isAvailable: false,
      },
    });

    // Helper to create test orders with specific status
    async function createTestOrder(
      orderNumber: string,
      status: OrderStatus,
      paymentMethod: PaymentMethod = PaymentMethod.CASH_ON_DELIVERY
    ) {
      const order = await prisma.order.create({
        data: {
          orderNumber,
          fullName: "Dash Customer",
          phone: "03001234567",
          email: "dash@example.com",
          address: "123 Street",
          city: "Lahore",
          province: "Punjab",
          paymentMethod,
          status,
          subtotal: new Prisma.Decimal("1500.00"),
          deliveryCharge: new Prisma.Decimal("200.00"),
          grandTotal: new Prisma.Decimal("1700.00"),
          idempotencyKey: crypto.randomUUID(),
          items: {
            create: {
              productId: testProduct.id,
              productName: "Dashboard Test Romper",
              sku: testProduct.sku,
              sizeLabel: "0-3M",
              colorName: "Sky Blue",
              quantity: 1,
              unitPrice: new Prisma.Decimal("1500.00"),
              lineSubtotal: new Prisma.Decimal("1500.00"),
            },
          },
          statusHistory: {
            create: {
              status,
            },
          },
        },
      });
      createdOrderIds.push(order.id);
      return order;
    }

    // Create a set of distinct test orders
    const prefix = `KW-DASH-${Date.now().toString().slice(-4)}`;
    await createTestOrder(`${prefix}-01`, OrderStatus.ORDER_RECEIVED);
    await createTestOrder(
      `${prefix}-02`,
      OrderStatus.AWAITING_PAYMENT,
      PaymentMethod.BANK_TRANSFER
    );
    await createTestOrder(`${prefix}-03`, OrderStatus.CONFIRMED);
    await createTestOrder(`${prefix}-04`, OrderStatus.IN_PRODUCTION);
    await createTestOrder(`${prefix}-05`, OrderStatus.READY_TO_SHIP);
    await createTestOrder(`${prefix}-06`, OrderStatus.SHIPPED);
    await createTestOrder(`${prefix}-07`, OrderStatus.DELIVERED);
    await createTestOrder(`${prefix}-08`, OrderStatus.CANCELLED);

    // =========================================================================
    // Test 1: Authentication Guard
    // =========================================================================
    await runTest("1. unauthenticated request is rejected with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/dashboard",
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
      const json = res.json();
      assert(json.success === false, "Expected success: false");
      assert(json.error.code === "UNAUTHORIZED", "Expected UNAUTHORIZED");
    });

    // =========================================================================
    // Test 2: Invalid Session Token
    // =========================================================================
    await runTest("2. invalid session token is rejected with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/dashboard",
        headers: {
          cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=invalid_token_12345`,
        },
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
      const json = res.json();
      assert(json.success === false, "Expected success: false");
      assert(json.error.code === "UNAUTHORIZED", "Expected UNAUTHORIZED");
    });

    // =========================================================================
    // Test 3: Valid Session Access
    // =========================================================================
    await runTest("3. authenticated request succeeds with 200 and envelope", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/dashboard",
        headers: {
          cookie: adminCookie,
        },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const json = res.json();
      assert(json.success === true, "Expected success: true");
      assert(typeof json.data === "object", "Expected data object");
    });

    // =========================================================================
    // Test 4: Total Products Counter
    // =========================================================================
    await runTest("4. totalProducts matches actual database product count", async () => {
      const actualCount = await prisma.product.count();
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/dashboard",
        headers: { cookie: adminCookie },
      });
      const json = res.json();
      assert(
        json.data.totalProducts === actualCount,
        `Expected ${actualCount}, got ${json.data.totalProducts}`
      );
    });

    // =========================================================================
    // Test 5: Total Orders Counter
    // =========================================================================
    await runTest("5. totalOrders matches actual database order count", async () => {
      const actualCount = await prisma.order.count();
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/dashboard",
        headers: { cookie: adminCookie },
      });
      const json = res.json();
      assert(
        json.data.totalOrders === actualCount,
        `Expected ${actualCount}, got ${json.data.totalOrders}`
      );
    });

    // =========================================================================
    // Test 6: Active Orders Counter Excludes DELIVERED and CANCELLED
    // =========================================================================
    await runTest(
      "6. activeOrders strictly excludes DELIVERED and CANCELLED terminal statuses",
      async () => {
        const expectedActive = await prisma.order.count({
          where: {
            status: {
              notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
            },
          },
        });
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/admin/dashboard",
          headers: { cookie: adminCookie },
        });
        const json = res.json();
        assert(
          json.data.activeOrders === expectedActive,
          `Expected ${expectedActive}, got ${json.data.activeOrders}`
        );
      }
    );

    // =========================================================================
    // Test 7: Unavailable Variants Counter
    // =========================================================================
    await runTest(
      "7. unavailableVariants strictly counts ProductVariant rows with isAvailable = false",
      async () => {
        const expectedUnavailable = await prisma.productVariant.count({
          where: { isAvailable: false },
        });
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/admin/dashboard",
          headers: { cookie: adminCookie },
        });
        const json = res.json();
        assert(
          json.data.unavailableVariants === expectedUnavailable,
          `Expected ${expectedUnavailable}, got ${json.data.unavailableVariants}`
        );
        assert(json.data.unavailableVariants >= 2, "Expected at least 2 unavailable variants");
      }
    );

    // =========================================================================
    // Test 8: Recent Orders Ordering and Limit
    // =========================================================================
    await runTest(
      "8. recentOrders returns newest orders with maximum limit of 5 records",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/admin/dashboard",
          headers: { cookie: adminCookie },
        });
        const json = res.json();
        assert(Array.isArray(json.data.recentOrders), "Expected recentOrders array");
        assert(
          json.data.recentOrders.length <= 5,
          `Expected max 5 orders, got ${json.data.recentOrders.length}`
        );

        // Verify descending order
        for (let i = 0; i < json.data.recentOrders.length - 1; i++) {
          const current = new Date(json.data.recentOrders[i].createdAt).getTime();
          const next = new Date(json.data.recentOrders[i + 1].createdAt).getTime();
          assert(current >= next, "Expected descending order by createdAt");
        }
      }
    );

    // =========================================================================
    // Test 9: Safe Response Contract
    // =========================================================================
    await runTest(
      "9. recentOrders entries contain only safe, approved snapshot fields",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/admin/dashboard",
          headers: { cookie: adminCookie },
        });
        const json = res.json();
        const first = json.data.recentOrders[0];
        assert(first !== undefined, "Expected at least one recent order");

        assert(typeof first.orderNumber === "string", "Expected orderNumber string");
        assert(typeof first.customerName === "string", "Expected customerName string");
        assert(typeof first.status === "string", "Expected status string");
        assert(typeof first.statusLabel === "string", "Expected statusLabel string");
        assert(typeof first.paymentMethod === "string", "Expected paymentMethod string");
        assert(typeof first.grandTotal === "string", "Expected grandTotal string");
        assert(typeof first.createdAt === "string", "Expected createdAt ISO string");

        // Verify no sensitive internal fields leak
        const rawJsonString = JSON.stringify(first);
        assert(!rawJsonString.includes("password"), "Must not leak password");
        assert(!rawJsonString.includes("tokenHash"), "Must not leak tokenHash");
        assert(!rawJsonString.includes("idempotencyKey"), "Must not leak idempotencyKey");
      }
    );

    // =========================================================================
    // Test 10: Forbidden Concepts Absence in Response Payload
    // =========================================================================
    await runTest(
      "10. response payload never contains forbidden V1 numeric inventory or featured fields",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/admin/dashboard",
          headers: { cookie: adminCookie },
        });
        const json = res.json();
        const payloadString = JSON.stringify(json);

        assert(!payloadString.includes("lowStock"), "Must not contain lowStock");
        assert(!payloadString.includes("unitsRemaining"), "Must not contain unitsRemaining");
        assert(!payloadString.includes("stockValue"), "Must not contain stockValue");
        assert(!payloadString.includes("inventoryQuantity"), "Must not contain inventoryQuantity");
        assert(!payloadString.includes("isFeatured"), "Must not contain isFeatured");
      }
    );
  } finally {
    // Cleanup fixtures
    if (createdOrderIds.length > 0) {
      await prisma.orderStatusHistory.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }

    if (createdProductIds.length > 0) {
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

    if (createdAdminSessionIds.length > 0) {
      await prisma.adminSession.deleteMany({
        where: { id: { in: createdAdminSessionIds } },
      });
    }

    await app.close();
  }

  // Print summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  // eslint-disable-next-line no-console
  console.log("\n=======================================================");
  // eslint-disable-next-line no-console
  console.log(
    `Admin Dashboard Test Summary: ${passed} passed, ${failed} failed, total ${results.length}`
  );
  // eslint-disable-next-line no-console
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

void runDashboardTestSuite();
