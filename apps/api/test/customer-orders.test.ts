import crypto from "node:crypto";
import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  generateRawCustomerSessionToken,
  hashCustomerSessionToken,
} from "../src/modules/customer-auth/services/session";
import {
  generateRawSessionToken as generateRawAdminToken,
  hashSessionToken as hashAdminToken,
} from "../src/modules/admin-auth/services/session";
import { hashPassword } from "../src/modules/admin-auth/services/password";
import { env } from "../src/config/env";
import { ORDER_STATUS_LABELS, OrderStatusType } from "@kids-wear/shared";

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

async function main() {
  // eslint-disable-next-line no-console
  console.log("Starting Kids Wear — Customer Orders & History Backend Test Suite (40 Tests)...\n");

  const prisma = getPrismaClient();
  const app = await buildApp();

  const miniSprouts = await prisma.storefront.findUnique({ where: { slug: "mini-sprouts" } });
  assert(miniSprouts !== null, "Mini Sprouts storefront must exist");

  const createdCustomerIds: string[] = [];
  const createdSessionIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdMediaAssetIds: string[] = [];
  const createdAdminUserIds: string[] = [];
  const createdAdminSessionIds: string[] = [];

  // Helper to create test customer
  async function createTestCustomer(
    email: string,
    fullName = "Test Customer",
    phone = "03001234567"
  ) {
    const passwordHash = await hashPassword("ValidPassword123!");
    const customer = await prisma.customer.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash,
        isActive: true,
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

    return { customer, rawToken, cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${rawToken}` };
  }

  // Helper to create test product with size, color, variant, and main media
  async function createTestProductFixture(title = "Historical Product", price = "2499.00") {
    const uniqueSuffix = crypto.randomUUID().slice(0, 8);
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        provider: "cloudinary",
        providerPublicId: `prod_media_${uniqueSuffix}`,
        secureUrl: `https://res.cloudinary.com/test/image/upload/prod_media_${uniqueSuffix}.jpg`,
        mediaType: "IMAGE",
        width: 1200,
        height: 1500,
        format: "jpg",
      },
    });
    createdMediaAssetIds.push(mediaAsset.id);

    const product = await prisma.product.create({
      data: {
        storefrontId: miniSprouts!.id,
        name: title,
        slug: `test-prod-${uniqueSuffix}`,
        sku: `SKU-${uniqueSuffix.toUpperCase()}`,
        description: "High quality kids apparel item",
        regularPrice: new Prisma.Decimal(price),
        status: "PUBLISHED",
      },
    });
    createdProductIds.push(product.id);

    await prisma.productMedia.create({
      data: {
        productId: product.id,
        mediaAssetId: mediaAsset.id,
        isMain: true,
        sortOrder: 0,
      },
    });

    const size = await prisma.productSize.create({
      data: {
        productId: product.id,
        name: "3-4Y",
        sortOrder: 0,
        isActive: true,
      },
    });

    const color = await prisma.productColor.create({
      data: {
        productId: product.id,
        name: "Sky Blue",
        sortOrder: 0,
        isActive: true,
      },
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        productSizeId: size.id,
        productColorId: color.id,
        isAvailable: true,
      },
    });

    return { product, size, color, variant, mediaAsset };
  }

  // Helper to create order with snapshots
  async function createTestOrder(opts: {
    customerId: string | null;
    orderNumber: string;
    productFixture: { product: any; size: any; color: any; variant: any };
    status?: any;
    paymentMethod?: any;
    email?: string | null;
    phone?: string;
    quantity?: number;
    unitPrice?: string;
    deliveryCharge?: string;
    createdAt?: Date;
  }) {
    const quantity = opts.quantity ?? 1;
    const unitPrice = opts.unitPrice ?? "2499.00";
    const lineSubtotal = (parseFloat(unitPrice) * quantity).toFixed(2);
    const subtotal = lineSubtotal;
    const deliveryCharge = opts.deliveryCharge ?? "300.00";
    const grandTotal = (parseFloat(subtotal) + parseFloat(deliveryCharge)).toFixed(2);
    const status = opts.status ?? "ORDER_RECEIVED";
    const paymentMethod = opts.paymentMethod ?? "CASH_ON_DELIVERY";

    const order = await prisma.order.create({
      data: {
        orderNumber: opts.orderNumber,
        customerId: opts.customerId,
        status,
        paymentMethod,
        fullName: "Order Recipient",
        phone: opts.phone ?? "03001234567",
        email: opts.email ?? "recipient@example.com",
        address: "House 12, Street 3, Sector F-8/2",
        city: "Islamabad",
        province: "Islamabad Capital Territory",
        postalCode: "44000",
        orderNotes: "Leave at front gate",
        subtotal: new Prisma.Decimal(subtotal),
        deliveryCharge: new Prisma.Decimal(deliveryCharge),
        grandTotal: new Prisma.Decimal(grandTotal),
        createdAt: opts.createdAt ?? new Date(),
        items: {
          create: {
            productId: opts.productFixture.product.id,
            productVariantId: opts.productFixture.variant.id,
            productName: opts.productFixture.product.name,
            sku: opts.productFixture.product.sku,
            sizeLabel: opts.productFixture.size.name,
            colorName: opts.productFixture.color.name,
            quantity,
            unitPrice: new Prisma.Decimal(unitPrice),
            lineSubtotal: new Prisma.Decimal(lineSubtotal),
          },
        },
        statusHistory: {
          create: {
            status,
            createdAt: opts.createdAt ?? new Date(),
          },
        },
      },
    });
    createdOrderIds.push(order.id);
    return order;
  }

  try {
    // eslint-disable-next-line no-console
    console.log("--- Section 1: Authentication & Session Guards (Tests 1–4) ---");

    await runTest(
      "1. Order list requires Customer authentication (401 without cookie)",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/account/orders",
        });
        assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        assert(body.success === false, "Expected success: false");
      }
    );

    await runTest(
      "2. Order detail requires Customer authentication (401 without cookie)",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/account/orders/KW-1001",
        });
        assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        assert(body.success === false, "Expected success: false");
      }
    );

    await runTest("3. Admin session does not substitute for Customer session (401)", async () => {
      // Create admin session
      const rawAdminToken = generateRawAdminToken();
      const tokenHash = hashAdminToken(rawAdminToken);
      const adminUser = await prisma.adminUser.findFirst();
      assert(adminUser !== null, "Admin user must exist");

      const adminSession = await prisma.adminSession.create({
        data: {
          adminUserId: adminUser!.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        },
      });
      createdAdminSessionIds.push(adminSession.id);

      const adminCookie = `${env.ADMIN_SESSION_COOKIE_NAME}=${rawAdminToken}`;

      const resList = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders",
        headers: { cookie: adminCookie },
      });
      assert(resList.statusCode === 401, `Expected 401, got ${resList.statusCode}`);

      const resDetail = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders/KW-1001",
        headers: { cookie: adminCookie },
      });
      assert(resDetail.statusCode === 401, `Expected 401, got ${resDetail.statusCode}`);
    });

    await runTest("4. expired or invalid Customer session rejected (401)", async () => {
      const invalidCookie = `${env.CUSTOMER_SESSION_COOKIE_NAME}=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`;
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders",
        headers: { cookie: invalidCookie },
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    });

    // eslint-disable-next-line no-console
    console.log(
      "\n--- Section 2: Strict Ownership & Guest Order Non-Claim Invariant (Tests 5–13) ---"
    );

    const custA = await createTestCustomer(
      "customer.a@example.com",
      "Customer Alpha",
      "03001111111"
    );
    const custB = await createTestCustomer(
      "customer.b@example.com",
      "Customer Beta",
      "03002222222"
    );
    const fixture1 = await createTestProductFixture("Festive Kurta", "3500.00");

    const orderNumA1 = `KW-${Date.now().toString().slice(-6)}1`;
    const orderNumA2 = `KW-${Date.now().toString().slice(-6)}2`;
    const orderNumB = `KW-${Date.now().toString().slice(-6)}3`;
    const guestOrderNum1 = `KW-${Date.now().toString().slice(-6)}4`;
    const guestOrderNum2 = `KW-${Date.now().toString().slice(-6)}5`;

    await createTestOrder({
      customerId: custA.customer.id,
      orderNumber: orderNumA1,
      productFixture: fixture1,
      createdAt: new Date(Date.now() - 5000),
    });

    await createTestOrder({
      customerId: custA.customer.id,
      orderNumber: orderNumA2,
      productFixture: fixture1,
      createdAt: new Date(Date.now() - 1000),
    });

    await createTestOrder({
      customerId: custB.customer.id,
      orderNumber: orderNumB,
      productFixture: fixture1,
      createdAt: new Date(),
    });

    // Guest orders with exact same email as Customer A
    await createTestOrder({
      customerId: null,
      orderNumber: guestOrderNum1,
      productFixture: fixture1,
      email: custA.customer.email,
      phone: custA.customer.phone!,
    });

    // Guest order with exact same phone as Customer A
    await createTestOrder({
      customerId: null,
      orderNumber: guestOrderNum2,
      productFixture: fixture1,
      email: "different.guest@example.com",
      phone: custA.customer.phone!,
    });

    await runTest("5. Customer A sees Customer A linked Orders in list", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders",
        headers: { cookie: custA.cookie },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.success === true, "Expected success: true");
      const orderNumbers = body.data.orders.map((o: any) => o.orderNumber);
      assert(orderNumbers.includes(orderNumA1), "Must include orderNumA1");
      assert(orderNumbers.includes(orderNumA2), "Must include orderNumA2");
    });

    await runTest("6. Customer A cannot see Customer B Order in list", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders",
        headers: { cookie: custA.cookie },
      });
      const body = JSON.parse(res.body);
      const orderNumbers = body.data.orders.map((o: any) => o.orderNumber);
      assert(
        !orderNumbers.includes(orderNumB),
        "Customer A must never see Customer B order in list"
      );
    });

    await runTest("7. Customer A cannot fetch Customer B Order detail (returns 404)", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${orderNumB}`,
        headers: { cookie: custA.cookie },
      });
      assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.success === false, "Expected success: false");
      assert(
        body.error.code === "ORDER_NOT_FOUND",
        `Expected ORDER_NOT_FOUND, got ${body.error.code}`
      );
    });

    await runTest(
      "8. foreign Order returns exact same 404 ORDER_NOT_FOUND as nonexistent Order",
      async () => {
        const resNonExistent = await app.inject({
          method: "GET",
          url: "/api/v1/account/orders/KW-99999999",
          headers: { cookie: custA.cookie },
        });
        assert(resNonExistent.statusCode === 404, `Expected 404, got ${resNonExistent.statusCode}`);
        const bodyNonExistent = JSON.parse(resNonExistent.body);

        const resForeign = await app.inject({
          method: "GET",
          url: `/api/v1/account/orders/${orderNumB}`,
          headers: { cookie: custA.cookie },
        });
        const bodyForeign = JSON.parse(resForeign.body);

        assert(
          bodyNonExistent.error.code === bodyForeign.error.code,
          "Error code must match exactly between non-existent and foreign order"
        );
        assert(
          bodyNonExistent.error.message === bodyForeign.error.message,
          "Error message must match exactly between non-existent and foreign order"
        );
      }
    );

    await runTest(
      "9. guest Order (customerId: null) does not appear in list for authenticated Customer",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/account/orders",
          headers: { cookie: custA.cookie },
        });
        const body = JSON.parse(res.body);
        const orderNumbers = body.data.orders.map((o: any) => o.orderNumber);
        assert(!orderNumbers.includes(guestOrderNum1), "Guest order must not appear in list");
        assert(!orderNumbers.includes(guestOrderNum2), "Guest order must not appear in list");
      }
    );

    await runTest(
      "10. guest Order with matching email does not appear in list for authenticated Customer",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/account/orders",
          headers: { cookie: custA.cookie },
        });
        const body = JSON.parse(res.body);
        const orderNumbers = body.data.orders.map((o: any) => o.orderNumber);
        assert(
          !orderNumbers.includes(guestOrderNum1),
          "Guest order with matching email must never be claimed into customer orders list"
        );
      }
    );

    await runTest("11. registration after guest Order does not claim it", async () => {
      // Simulate: guest placed order earlier with email "late.customer@example.com"
      const lateEmail = `late.customer.${Date.now()}@example.com`;
      const lateGuestOrderNum = `KW-${Date.now().toString().slice(-6)}8`;
      await createTestOrder({
        customerId: null,
        orderNumber: lateGuestOrderNum,
        productFixture: fixture1,
        email: lateEmail,
      });

      // Later: customer registers with that email
      const lateCust = await createTestCustomer(lateEmail, "Late Customer");

      // Verify customer's order list does not include the earlier guest order
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders",
        headers: { cookie: lateCust.cookie },
      });
      const body = JSON.parse(res.body);
      const orderNumbers = body.data.orders.map((o: any) => o.orderNumber);
      assert(
        !orderNumbers.includes(lateGuestOrderNum),
        "Registration after guest order must not claim or attach the guest order"
      );

      // Verify DB record still has customerId === null
      const checkDb = await prisma.order.findUnique({
        where: { orderNumber: lateGuestOrderNum },
      });
      assert(checkDb?.customerId === null, "DB order customerId must remain null");
    });

    await runTest("12. phone match does not claim guest Order", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders",
        headers: { cookie: custA.cookie },
      });
      const body = JSON.parse(res.body);
      const orderNumbers = body.data.orders.map((o: any) => o.orderNumber);
      assert(
        !orderNumbers.includes(guestOrderNum2),
        "Phone match must never claim or attach guest order"
      );
    });

    await runTest(
      "13. guest Order cannot be fetched via /api/v1/account/orders/:orderNumber (returns 404)",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/account/orders/${guestOrderNum1}`,
          headers: { cookie: custA.cookie },
        });
        assert(
          res.statusCode === 404,
          `Expected 404 for guest order detail, got ${res.statusCode}`
        );
        const body = JSON.parse(res.body);
        assert(body.error.code === "ORDER_NOT_FOUND", "Expected code ORDER_NOT_FOUND");
      }
    );

    // eslint-disable-next-line no-console
    console.log("\n--- Section 3: History Ordering & Pagination (Tests 14–20) ---");

    await runTest(
      "14. Order list uses deterministic newest-first ordering (createdAt DESC, id DESC)",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/account/orders",
          headers: { cookie: custA.cookie },
        });
        assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        const orders = body.data.orders;
        assert(orders.length >= 2, "Expected at least 2 orders for Customer A");
        // orderNumA2 was created after orderNumA1, so it must be first
        const idxA2 = orders.findIndex((o: any) => o.orderNumber === orderNumA2);
        const idxA1 = orders.findIndex((o: any) => o.orderNumber === orderNumA1);
        assert(idxA2 < idxA1, "orderNumA2 must appear before orderNumA1 in newest-first ordering");
      }
    );

    await runTest("15. pagination page works (page 2 returns next page of orders)", async () => {
      const resPage1 = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders?page=1&limit=1",
        headers: { cookie: custA.cookie },
      });
      assert(resPage1.statusCode === 200, `Expected 200, got ${resPage1.statusCode}`);
      const body1 = JSON.parse(resPage1.body);
      assert(body1.data.orders.length === 1, "Page 1 limit 1 must return 1 order");
      assert(body1.data.orders[0].orderNumber === orderNumA2, "Page 1 must return newest order");
      assert(body1.data.pagination.page === 1, "Expected page 1");
      assert(body1.data.pagination.hasNextPage === true, "Expected hasNextPage: true");

      const resPage2 = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders?page=2&limit=1",
        headers: { cookie: custA.cookie },
      });
      assert(resPage2.statusCode === 200, `Expected 200, got ${resPage2.statusCode}`);
      const body2 = JSON.parse(resPage2.body);
      assert(body2.data.orders.length === 1, "Page 2 limit 1 must return 1 order");
      assert(body2.data.orders[0].orderNumber === orderNumA1, "Page 2 must return second order");
      assert(body2.data.pagination.page === 2, "Expected page 2");
      assert(body2.data.pagination.hasPrevPage === true, "Expected hasPrevPage: true");
    });

    await runTest("16. pagination limit bounded (limit > 50 rejected with 400)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders?limit=51",
        headers: { cookie: custA.cookie },
      });
      assert(res.statusCode === 400, `Expected 400 for limit=51, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.error.code === "VALIDATION_ERROR", "Expected VALIDATION_ERROR");
    });

    await runTest(
      "17. pagination metadata includes totalOrders, totalPages, hasNextPage, hasPrevPage",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/account/orders?page=1&limit=10",
          headers: { cookie: custA.cookie },
        });
        const body = JSON.parse(res.body);
        const pagination = body.data.pagination;
        assert(typeof pagination.totalOrders === "number", "totalOrders must be a number");
        assert(typeof pagination.totalPages === "number", "totalPages must be a number");
        assert(typeof pagination.hasNextPage === "boolean", "hasNextPage must be boolean");
        assert(typeof pagination.hasPrevPage === "boolean", "hasPrevPage must be boolean");
      }
    );

    await runTest("18. itemCount is accurately summed across line item quantities", async () => {
      // Create multi-item order for Customer A
      const multiOrderNum = `KW-${Date.now().toString().slice(-6)}9`;
      const fixture2 = await createTestProductFixture("Multi Item Product", "1000.00");
      const order = await prisma.order.create({
        data: {
          orderNumber: multiOrderNum,
          customerId: custA.customer.id,
          status: "ORDER_RECEIVED",
          paymentMethod: "CASH_ON_DELIVERY",
          fullName: "Customer A",
          phone: "03001111111",
          address: "123 Street",
          city: "Lahore",
          province: "Punjab",
          subtotal: new Prisma.Decimal("5000.00"),
          deliveryCharge: new Prisma.Decimal("300.00"),
          grandTotal: new Prisma.Decimal("5300.00"),
          items: {
            create: [
              {
                productName: "Item 1",
                sku: "SKU-ITEM1",
                sizeLabel: "4Y",
                colorName: "Red",
                quantity: 2,
                unitPrice: new Prisma.Decimal("1000.00"),
                lineSubtotal: new Prisma.Decimal("2000.00"),
              },
              {
                productName: "Item 2",
                sku: "SKU-ITEM2",
                sizeLabel: "6Y",
                colorName: "Blue",
                quantity: 3,
                unitPrice: new Prisma.Decimal("1000.00"),
                lineSubtotal: new Prisma.Decimal("3000.00"),
              },
            ],
          },
        },
      });
      createdOrderIds.push(order.id);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders?limit=1",
        headers: { cookie: custA.cookie },
      });
      const body = JSON.parse(res.body);
      const latestOrder = body.data.orders[0];
      assert(
        latestOrder.orderNumber === multiOrderNum,
        "Expected newest order to be multiOrderNum"
      );
      assert(
        latestOrder.itemCount === 5,
        `Expected itemCount 5 (2 + 3), got ${latestOrder.itemCount}`
      );
    });

    await runTest(
      "19. financial strings retain fixed two decimals (subtotal, deliveryCharge, grandTotal)",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/account/orders",
          headers: { cookie: custA.cookie },
        });
        const body = JSON.parse(res.body);
        for (const order of body.data.orders) {
          assert(
            /^\d+\.\d{2}$/.test(order.subtotal),
            `Subtotal must have 2 decimals: ${order.subtotal}`
          );
          assert(
            /^\d+\.\d{2}$/.test(order.deliveryCharge),
            `Delivery must have 2 decimals: ${order.deliveryCharge}`
          );
          assert(
            /^\d+\.\d{2}$/.test(order.grandTotal),
            `Total must have 2 decimals: ${order.grandTotal}`
          );
        }
      }
    );

    await runTest("20. empty order history returns empty list with valid pagination", async () => {
      const emptyCust = await createTestCustomer("empty.orders@example.com", "Empty Orders Cust");
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders",
        headers: { cookie: emptyCust.cookie },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(
        Array.isArray(body.data.orders) && body.data.orders.length === 0,
        "Orders must be empty array"
      );
      assert(body.data.pagination.totalOrders === 0, "totalOrders must be 0");
      assert(body.data.pagination.totalPages === 1, "totalPages must be 1");
      assert(body.data.pagination.hasNextPage === false, "hasNextPage must be false");
      assert(body.data.pagination.hasPrevPage === false, "hasPrevPage must be false");
    });

    // eslint-disable-next-line no-console
    console.log("\n--- Section 4: Detail Snapshots & Historical Preservation (Tests 21–29) ---");

    const snapFixture = await createTestProductFixture("Original Product Name", "4500.00");
    const snapshotOrderNum = `KW-${Date.now().toString().slice(-6)}7`;
    await createTestOrder({
      customerId: custA.customer.id,
      orderNumber: snapshotOrderNum,
      productFixture: snapFixture,
      quantity: 2,
      unitPrice: "4500.00",
      deliveryCharge: "300.00",
    });

    await runTest(
      "21. correct historical Product name returned from OrderItem snapshot",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/account/orders/${snapshotOrderNum}`,
          headers: { cookie: custA.cookie },
        });
        assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
        const body = JSON.parse(res.body);
        assert(
          body.data.items[0].productName === "Original Product Name",
          "Expected original product name"
        );
      }
    );

    await runTest("22. correct historical Size returned from OrderItem snapshot", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${snapshotOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const body = JSON.parse(res.body);
      assert(body.data.items[0].sizeLabel === "3-4Y", "Expected size 3-4Y");
    });

    await runTest(
      "23. correct historical Color returned from OrderItem snapshot (display-name only, no hex)",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/account/orders/${snapshotOrderNum}`,
          headers: { cookie: custA.cookie },
        });
        const body = JSON.parse(res.body);
        assert(body.data.items[0].colorName === "Sky Blue", "Expected color Sky Blue");
        assert(body.data.items[0].colorHex === undefined, "colorHex must not exist");
        assert(body.data.items[0].hexCode === undefined, "hexCode must not exist");
      }
    );

    await runTest(
      "24. historical unit price and line subtotal returned from snapshot",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/account/orders/${snapshotOrderNum}`,
          headers: { cookie: custA.cookie },
        });
        const body = JSON.parse(res.body);
        assert(body.data.items[0].unitPrice === "4500.00", "Expected unitPrice 4500.00");
        assert(body.data.items[0].lineSubtotal === "9000.00", "Expected lineSubtotal 9000.00");
      }
    );

    await runTest("25. historical delivery charge and grand total returned", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${snapshotOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const body = JSON.parse(res.body);
      assert(body.data.subtotal === "9000.00", "Expected subtotal 9000.00");
      assert(body.data.deliveryCharge === "300.00", "Expected deliveryCharge 300.00");
      assert(body.data.grandTotal === "9300.00", "Expected grandTotal 9300.00");
    });

    await runTest("26. later Product rename does not change Order response", async () => {
      // Mutate Product name in database
      await prisma.product.update({
        where: { id: snapFixture.product.id },
        data: { name: "MODIFIED NEW PRODUCT NAME 2026" },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${snapshotOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const body = JSON.parse(res.body);
      assert(
        body.data.items[0].productName === "Original Product Name",
        "Product rename must not alter immutable historical OrderItem snapshot"
      );
    });

    await runTest("27. later Product price change does not change Order response", async () => {
      // Mutate Product price in database
      await prisma.product.update({
        where: { id: snapFixture.product.id },
        data: { regularPrice: new Prisma.Decimal("9999.00") },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${snapshotOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const body = JSON.parse(res.body);
      assert(
        body.data.items[0].unitPrice === "4500.00",
        "Product price change must not alter immutable historical unitPrice"
      );
      assert(
        body.data.items[0].lineSubtotal === "9000.00",
        "Product price change must not alter immutable historical lineSubtotal"
      );
    });

    await runTest("28. later Size or Color rename does not change Order response", async () => {
      // Mutate Size and Color names in database
      await prisma.productSize.update({
        where: { id: snapFixture.size.id },
        data: { name: "NEW-SIZE-10Y" },
      });
      await prisma.productColor.update({
        where: { id: snapFixture.color.id },
        data: { name: "NEW-COLOR-PURPLE" },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${snapshotOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const body = JSON.parse(res.body);
      assert(
        body.data.items[0].sizeLabel === "3-4Y",
        "Size rename must not alter historical OrderItem snapshot sizeLabel"
      );
      assert(
        body.data.items[0].colorName === "Sky Blue",
        "Color rename must not alter historical OrderItem snapshot colorName"
      );
    });

    await runTest("29. malformed order number parameter rejected with 400", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders/not-a-valid-order-number",
        headers: { cookie: custA.cookie },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.error.code === "VALIDATION_ERROR", "Expected code VALIDATION_ERROR");
    });

    // eslint-disable-next-line no-console
    console.log("\n--- Section 5: Data Exposure Minimization (Tests 30–35) ---");

    await runTest("30. customerId not exposed in list or detail", async () => {
      const resList = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders",
        headers: { cookie: custA.cookie },
      });
      const bodyList = JSON.parse(resList.body);
      for (const o of bodyList.data.orders) {
        assert(o.customerId === undefined, "customerId must not be present in order list");
      }

      const resDetail = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${snapshotOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const bodyDetail = JSON.parse(resDetail.body);
      assert(
        bodyDetail.data.customerId === undefined,
        "customerId must not be present in order detail"
      );
      assert(
        bodyDetail.data.customer.customerId === undefined,
        "customerId must not be present in customer detail"
      );
    });

    await runTest("31. idempotencyKey not exposed in list or detail", async () => {
      const resList = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders",
        headers: { cookie: custA.cookie },
      });
      const bodyList = JSON.parse(resList.body);
      for (const o of bodyList.data.orders) {
        assert(o.idempotencyKey === undefined, "idempotencyKey must not be present in order list");
      }

      const resDetail = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${snapshotOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const bodyDetail = JSON.parse(resDetail.body);
      assert(
        bodyDetail.data.idempotencyKey === undefined,
        "idempotencyKey must not be present in order detail"
      );
    });

    await runTest("32. admin notification state and recipient not exposed", async () => {
      const resDetail = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${snapshotOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const bodyDetail = JSON.parse(resDetail.body);
      assert(
        bodyDetail.data.newOrderNotificationRecipient === undefined,
        "notification recipient must not be exposed"
      );
      assert(
        bodyDetail.data.notificationSent === undefined,
        "notification state must not be exposed"
      );
    });

    await runTest("33. SKU not exposed in list or detail", async () => {
      const resDetail = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${snapshotOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const bodyDetail = JSON.parse(resDetail.body);
      for (const item of bodyDetail.data.items) {
        assert(item.sku === undefined, "SKU must not be exposed to customer");
      }
    });

    await runTest(
      "34. internal Order, OrderItem, and OrderStatusHistory database IDs not exposed",
      async () => {
        const resList = await app.inject({
          method: "GET",
          url: "/api/v1/account/orders",
          headers: { cookie: custA.cookie },
        });
        const bodyList = JSON.parse(resList.body);
        for (const o of bodyList.data.orders) {
          assert(o.id === undefined, "Internal order id must not be in list");
        }

        const resDetail = await app.inject({
          method: "GET",
          url: `/api/v1/account/orders/${snapshotOrderNum}`,
          headers: { cookie: custA.cookie },
        });
        const bodyDetail = JSON.parse(resDetail.body);
        assert(bodyDetail.data.id === undefined, "Internal order id must not be in detail");
        for (const item of bodyDetail.data.items) {
          assert(item.id === undefined, "Internal item id must not be in detail");
          assert(item.orderId === undefined, "Internal orderId must not be in detail");
          assert(item.productId === undefined, "Internal productId must not be in detail");
          assert(
            item.productVariantId === undefined,
            "Internal productVariantId must not be in detail"
          );
        }
        for (const step of bodyDetail.data.timeline) {
          assert(step.id === undefined, "Internal history id must not be in timeline");
          assert(step.orderId === undefined, "Internal orderId must not be in timeline");
        }
      }
    );

    await runTest("35. changedByAdminId and internal admin identities not exposed", async () => {
      const resDetail = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${snapshotOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const bodyDetail = JSON.parse(resDetail.body);
      for (const step of bodyDetail.data.timeline) {
        assert(step.changedByAdminId === undefined, "changedByAdminId must not be exposed");
        assert(step.changedBy === undefined, "changedBy must not be exposed");
        assert(step.admin === undefined, "admin object must not be exposed");
      }
    });

    // eslint-disable-next-line no-console
    console.log("\n--- Section 6: Status Timeline (Tests 36–40) ---");

    const timelineOrderNum = `KW-${Date.now().toString().slice(-6)}6`;
    const t0 = new Date(Date.now() - 30000);
    const t1 = new Date(Date.now() - 20000);
    const t2 = new Date(Date.now() - 10000);

    const timelineOrder = await prisma.order.create({
      data: {
        orderNumber: timelineOrderNum,
        customerId: custA.customer.id,
        status: "IN_PRODUCTION",
        paymentMethod: "CASH_ON_DELIVERY",
        fullName: "Timeline Customer",
        phone: "03001234567",
        address: "Street 5",
        city: "Karachi",
        province: "Sindh",
        subtotal: new Prisma.Decimal("2000.00"),
        deliveryCharge: new Prisma.Decimal("300.00"),
        grandTotal: new Prisma.Decimal("2300.00"),
        createdAt: t0,
        items: {
          create: {
            productName: "Kurta",
            sku: "SKU-TL",
            sizeLabel: "4Y",
            colorName: "Red",
            quantity: 1,
            unitPrice: new Prisma.Decimal("2000.00"),
            lineSubtotal: new Prisma.Decimal("2000.00"),
          },
        },
        statusHistory: {
          create: [
            { status: "ORDER_RECEIVED", createdAt: t0 },
            { status: "CONFIRMED", createdAt: t1 },
            { status: "IN_PRODUCTION", createdAt: t2 },
          ],
        },
      },
    });
    createdOrderIds.push(timelineOrder.id);

    await runTest("36. timeline returns customer-safe statuses and labels", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${timelineOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const body = JSON.parse(res.body);
      const timeline = body.data.timeline;
      assert(timeline.length === 3, `Expected 3 timeline steps, got ${timeline.length}`);
      assert(timeline[0].status === "ORDER_RECEIVED", "Step 0 status");
      assert(timeline[0].statusLabel === "Order Received", "Step 0 label");
      assert(timeline[1].status === "CONFIRMED", "Step 1 status");
      assert(timeline[1].statusLabel === "Confirmed", "Step 1 label");
      assert(timeline[2].status === "IN_PRODUCTION", "Step 2 status");
      assert(timeline[2].statusLabel === "Stitching / In Production", "Step 2 label");
    });

    await runTest("37. timeline ordered oldest-to-newest", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${timelineOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const body = JSON.parse(res.body);
      const timeline = body.data.timeline;
      const t0Parsed = new Date(timeline[0].changedAt).getTime();
      const t1Parsed = new Date(timeline[1].changedAt).getTime();
      const t2Parsed = new Date(timeline[2].changedAt).getTime();
      assert(
        t0Parsed <= t1Parsed && t1Parsed <= t2Parsed,
        "Timeline must be ordered oldest to newest"
      );
    });

    await runTest("38. current status matches persisted Order status", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${timelineOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const body = JSON.parse(res.body);
      assert(body.data.status === "IN_PRODUCTION", "Expected status IN_PRODUCTION");
      assert(
        body.data.statusLabel === "Stitching / In Production",
        "Expected statusLabel Stitching / In Production"
      );
    });

    await runTest(
      "39. all approved status enum values map correctly to display labels",
      async () => {
        const approvedStatuses: OrderStatusType[] = [
          "AWAITING_PAYMENT",
          "ORDER_RECEIVED",
          "CONFIRMED",
          "IN_PRODUCTION",
          "READY_TO_SHIP",
          "SHIPPED",
          "DELIVERED",
          "CANCELLED",
        ];

        for (const st of approvedStatuses) {
          const label = ORDER_STATUS_LABELS[st];
          assert(typeof label === "string" && label.length > 0, `Missing label mapping for ${st}`);
        }
      }
    );

    await runTest("40. timeline excludes internal admin notes and identifiers", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/account/orders/${timelineOrderNum}`,
        headers: { cookie: custA.cookie },
      });
      const body = JSON.parse(res.body);
      for (const step of body.data.timeline) {
        assert(step.notes === undefined, "notes must not be present in timeline");
        assert(step.id === undefined, "id must not be present in timeline");
        assert(step.adminUserId === undefined, "adminUserId must not be present in timeline");
      }
    });
  } finally {
    // Hermetic Cleanup
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

    if (createdAdminSessionIds.length > 0) {
      await prisma.adminSession
        .deleteMany({
          where: { id: { in: createdAdminSessionIds } },
        })
        .catch(() => {});
    }

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
  }

  // Summary
  // eslint-disable-next-line no-console
  console.log("\n========================================================");
  // eslint-disable-next-line no-console
  console.log("Customer Orders Backend Test Suite Results:");
  // eslint-disable-next-line no-console
  console.log(`Total: ${results.length}`);
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  // eslint-disable-next-line no-console
  console.log(`Passed: ${passedCount}`);
  // eslint-disable-next-line no-console
  console.log(`Failed: ${failedCount}`);
  // eslint-disable-next-line no-console
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
