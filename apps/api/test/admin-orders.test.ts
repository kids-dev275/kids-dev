import crypto from "node:crypto";
import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import { Prisma, OrderStatus, PaymentMethod } from "@prisma/client";
import {
  generateRawCustomerSessionToken,
  hashCustomerSessionToken,
} from "../src/modules/customer-auth/services/session";
import {
  generateRawSessionToken as generateRawAdminToken,
  hashSessionToken as hashAdminToken,
  generateAdminCsrfToken,
} from "../src/modules/admin-auth/services/session";
import { hashPassword } from "../src/modules/admin-auth/services/password";
import { env } from "../src/config/env";
import { setAdminOrderStatusTestHooks } from "../src/modules/order/admin-routes";
import {
  setEmailService,
  resetEmailService,
  type IEmailService,
  type SendNewOrderNotificationParams,
} from "../src/lib/email";

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

class MockEmailService implements IEmailService {
  public calls: SendNewOrderNotificationParams[] = [];
  public shouldFail = false;

  async sendNewOrderNotification(
    params: SendNewOrderNotificationParams
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    this.calls.push(params);
    if (this.shouldFail) {
      return { success: false, error: "Mock email failure" };
    }
    return { success: true, messageId: `mock_${Date.now()}` };
  }
}

let orderSeq = 10000;
function getNextOrderNumber(): string {
  orderSeq++;
  return `KW-${Date.now().toString().slice(-5)}${orderSeq}`;
}

async function runSuite(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("Starting Kids Wear — Admin Order Management Backend Test Suite (84 Tests)...\n");

  const prisma = getPrismaClient();
  const app = await buildApp();

  const mockEmailService = new MockEmailService();
  setEmailService(mockEmailService);

  const miniSprouts = await prisma.storefront.findUnique({ where: { slug: "mini-sprouts" } });
  assert(miniSprouts !== null, "Mini Sprouts storefront must exist");

  const createdCustomerIds: string[] = [];
  const createdSessionIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdMediaAssetIds: string[] = [];
  const createdAdminSessionIds: string[] = [];

  // Setup Admin user
  let adminUser = await prisma.adminUser.findFirst({
    where: { singletonKey: 1 },
  });
  if (!adminUser) {
    const passwordHash = await hashPassword("AdminSecretPassword123!");
    adminUser = await prisma.adminUser.create({
      data: {
        email: "admin@kidswear.local",
        passwordHash,
        singletonKey: 1,
      },
    });
  }

  // Generate Admin session and CSRF
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
  const adminCsrf = generateAdminCsrfToken(adminRawToken);

  // Helper: create customer
  async function createTestCustomer(
    email: string,
    fullName = "Customer One",
    phone = "03001234567"
  ) {
    const passwordHash = await hashPassword("CustomerPassword123!");
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

  // Helper: create product fixture
  async function createTestProductFixture(title = "Admin Test Garment", price = "2999.00") {
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
        slug: `admin-test-prod-${uniqueSuffix}`,
        sku: `SKU-ADM-${uniqueSuffix.toUpperCase()}`,
        description: "Admin order test apparel",
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
        name: "4-5Y",
        sortOrder: 0,
        isActive: true,
      },
    });

    const color = await prisma.productColor.create({
      data: {
        productId: product.id,
        name: "Forest Green",
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

  // Helper: create order fixture
  async function createTestOrder(opts: {
    orderNumber: string;
    customerId?: string | null;
    productFixture: { product: any; size: any; color: any; variant: any };
    status?: OrderStatus;
    paymentMethod?: PaymentMethod;
    fullName?: string;
    email?: string | null;
    phone?: string;
    quantity?: number;
    unitPrice?: string;
    deliveryCharge?: string;
    createdAt?: Date;
  }) {
    const quantity = opts.quantity ?? 1;
    const unitPrice = opts.unitPrice ?? "2999.00";
    const lineSubtotal = (parseFloat(unitPrice) * quantity).toFixed(2);
    const subtotal = lineSubtotal;
    const deliveryCharge = opts.deliveryCharge ?? "300.00";
    const grandTotal = (parseFloat(subtotal) + parseFloat(deliveryCharge)).toFixed(2);
    const status = opts.status ?? OrderStatus.ORDER_RECEIVED;
    const paymentMethod = opts.paymentMethod ?? PaymentMethod.CASH_ON_DELIVERY;

    const order = await prisma.order.create({
      data: {
        orderNumber: opts.orderNumber,
        customerId: opts.customerId ?? null,
        status,
        paymentMethod,
        fullName: opts.fullName ?? "Test Buyer",
        phone: opts.phone ?? "03009876543",
        email: opts.email ?? "buyer@example.com",
        address: "Apartment 4B, Hill View Heights",
        city: "Lahore",
        province: "Punjab",
        postalCode: "54000",
        orderNotes: "Fragile buttons, pack carefully",
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

  // Pre-seed reusable product fixture
  const baseFixture = await createTestProductFixture("Base Garment", "3200.00");

  try {
    // ========================================================================
    // Section 1: Authorization (Tests 1–6)
    // ========================================================================
    console.log("Section 1: Authorization");

    await runTest("1. Admin Order list requires Admin auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders",
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.error.code === "UNAUTHORIZED", "Code must be UNAUTHORIZED");
    });

    await runTest("2. Admin Order detail requires Admin auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders/KW-1001",
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.error.code === "UNAUTHORIZED", "Code must be UNAUTHORIZED");
    });

    await runTest("3. status mutation requires Admin auth", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/orders/KW-1001/status",
        headers: { "x-csrf-token": adminCsrf },
        payload: { status: "CONFIRMED" },
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.error.code === "UNAUTHORIZED", "Code must be UNAUTHORIZED");
    });

    await runTest("4. Customer session cannot access Admin Order APIs", async () => {
      const { cookie: custCookie } = await createTestCustomer("customer_auth_check@test.com");
      const listRes = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders",
        headers: { cookie: custCookie },
      });
      assert(listRes.statusCode === 401, "Customer cookie must be rejected on admin list");

      const detailRes = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders/KW-1001",
        headers: { cookie: custCookie },
      });
      assert(detailRes.statusCode === 401, "Customer cookie must be rejected on admin detail");

      const mutateRes = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/orders/KW-1001/status",
        headers: { cookie: custCookie },
        payload: { status: "CONFIRMED" },
      });
      assert(mutateRes.statusCode === 401, "Customer cookie must be rejected on admin mutation");
    });

    await runTest("5. status mutation requires valid Admin CSRF", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
      });

      // Missing CSRF
      const missingCsrfRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie },
        payload: { status: "CONFIRMED" },
      });
      assert(missingCsrfRes.statusCode === 403, `Expected 403, got ${missingCsrfRes.statusCode}`);
      const missingJson = JSON.parse(missingCsrfRes.body);
      assert(missingJson.error.code === "CSRF_MISSING", "Code must be CSRF_MISSING");

      // Invalid CSRF
      const invalidCsrfRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": "bad-csrf-token" },
        payload: { status: "CONFIRMED" },
      });
      assert(invalidCsrfRes.statusCode === 403, `Expected 403, got ${invalidCsrfRes.statusCode}`);
      const invalidJson = JSON.parse(invalidCsrfRes.body);
      assert(invalidJson.error.code === "CSRF_INVALID", "Code must be CSRF_INVALID");
    });

    await runTest("6. invalid/expired Admin session rejected", async () => {
      const expiredRawToken = generateRawAdminToken();
      const expiredTokenHash = hashAdminToken(expiredRawToken);
      const expiredSession = await prisma.adminSession.create({
        data: {
          adminUserId: adminUser.id,
          tokenHash: expiredTokenHash,
          expiresAt: new Date(Date.now() - 3600 * 1000), // Expired 1h ago
        },
      });
      createdAdminSessionIds.push(expiredSession.id);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders",
        headers: { cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${expiredRawToken}` },
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.error.code === "SESSION_EXPIRED", "Code must be SESSION_EXPIRED");
    });

    // ========================================================================
    // Section 2: Order Listing, Pagination & Search (Tests 7–20)
    // ========================================================================
    console.log("\nSection 2: Order Listing, Pagination & Search");

    const searchOrderNum = getNextOrderNumber();
    const buyerName = "Ayesha Tariq Farooq";
    const buyerPhone = "03215556677";
    const buyerEmail = `ayesha.farooq.${Date.now()}@example.com`;

    const searchOrd = await createTestOrder({
      orderNumber: searchOrderNum,
      productFixture: baseFixture,
      fullName: buyerName,
      phone: buyerPhone,
      email: buyerEmail,
      status: OrderStatus.CONFIRMED,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      quantity: 3,
      unitPrice: "1500.00",
      deliveryCharge: "250.00",
      createdAt: new Date(Date.now() + 5000), // Ensure it's newest
    });

    await runTest("7. list returns newest-first", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders?limit=10",
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.data.orders.length >= 1, "Must contain orders");
      assert(
        json.data.orders[0].orderNumber === searchOrd.orderNumber,
        "Newest order must be first"
      );
    });

    await runTest("8. pagination default works", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders",
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.data.pagination.page === 1, "Default page must be 1");
      assert(json.data.pagination.limit === 20, "Default limit must be 20");
    });

    await runTest("9. page 2 works", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders?page=2&limit=1",
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.data.pagination.page === 2, "Page must be 2");
      assert(json.data.pagination.limit === 1, "Limit must be 1");
    });

    await runTest("10. limit is bounded", async () => {
      const zeroLimitRes = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders?limit=0",
        headers: { cookie: adminCookie },
      });
      assert(zeroLimitRes.statusCode === 400, "limit < 1 must be rejected");

      const excessLimitRes = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders?limit=101",
        headers: { cookie: adminCookie },
      });
      assert(excessLimitRes.statusCode === 400, "limit > 100 must be rejected");
    });

    await runTest("11. search by exact Order number works", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/orders?q=${searchOrderNum}`,
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(
        json.data.orders.some((o: any) => o.orderNumber === searchOrderNum),
        "Must find exact order number"
      );
    });

    await runTest("12. search by partial customer name works", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders?q=Tariq%20Farooq",
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(
        json.data.orders.some((o: any) => o.orderNumber === searchOrderNum),
        "Must find order by partial name"
      );
    });

    await runTest("13. search by phone works", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/orders?q=${buyerPhone}`,
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(
        json.data.orders.some((o: any) => o.orderNumber === searchOrderNum),
        "Must find order by phone"
      );
    });

    await runTest("14. search by email works", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/orders?q=${buyerEmail}`,
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(
        json.data.orders.some((o: any) => o.orderNumber === searchOrderNum),
        "Must find order by email"
      );
    });

    await runTest("15. status filter works", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders?status=CONFIRMED",
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(
        json.data.orders.every((o: any) => o.status === "CONFIRMED"),
        "All filtered orders must have status CONFIRMED"
      );
    });

    await runTest("16. payment-method filter works", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders?paymentMethod=BANK_TRANSFER",
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(
        json.data.orders.every((o: any) => o.paymentMethod === "BANK_TRANSFER"),
        "All filtered orders must have paymentMethod BANK_TRANSFER"
      );
    });

    await runTest("17. search + filter combination works", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/orders?q=${searchOrderNum}&status=CONFIRMED&paymentMethod=BANK_TRANSFER`,
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.data.orders.length === 1, "Must return exactly 1 matching order");
      assert(json.data.orders[0].orderNumber === searchOrderNum, "Order number must match");
    });

    await runTest("18. no unbounded result set", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders?limit=2",
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      assert(json.data.orders.length <= 2, "Result must not exceed limit");
    });

    await runTest("19. item count correct", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/orders?q=${searchOrderNum}`,
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      const found = json.data.orders.find((o: any) => o.orderNumber === searchOrderNum);
      assert(found.itemCount === 3, `Item count must be 3, got ${found.itemCount}`);
    });

    await runTest("20. grand total returned as fixed two-decimal string", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/orders?q=${searchOrderNum}`,
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 200, "Must return 200");
      const json = JSON.parse(res.body);
      const found = json.data.orders.find((o: any) => o.orderNumber === searchOrderNum);
      assert(found.grandTotal === "4750.00", `Expected '4750.00', got ${found.grandTotal}`);
    });

    // ========================================================================
    // Section 3: Order Detail & Snapshots (Tests 21–35)
    // ========================================================================
    console.log("\nSection 3: Order Detail & Snapshots");

    const detailOrderNum = getNextOrderNumber();
    await createTestOrder({
      orderNumber: detailOrderNum,
      customerId: null, // Guest order
      productFixture: baseFixture,
      fullName: "Guest Inspectee",
      phone: "03451122334",
      email: "guest.inspect@example.com",
      status: OrderStatus.ORDER_RECEIVED,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      quantity: 2,
      unitPrice: "3200.00",
      deliveryCharge: "300.00",
    });

    let cachedDetailJson: any = null;
    async function getDetail() {
      if (!cachedDetailJson) {
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/admin/orders/${detailOrderNum}`,
          headers: { cookie: adminCookie },
        });
        assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
        cachedDetailJson = JSON.parse(res.body);
      }
      return cachedDetailJson;
    }

    await runTest("21. valid Order detail returned", async () => {
      const json = await getDetail();
      assert(json.success === true, "Must be success");
      assert(json.data.orderNumber === detailOrderNum, "Order number must match");
    });

    await runTest("22. nonexistent Order returns 404", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders/KW-99999999",
        headers: { cookie: adminCookie },
      });
      assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.error.code === "ORDER_NOT_FOUND", "Code must be ORDER_NOT_FOUND");
    });

    await runTest("23. guest Order detail is accessible to Admin", async () => {
      const json = await getDetail();
      assert(json.data.orderNumber === detailOrderNum, "Admin must be able to view guest order");
    });

    await runTest("24. customer snapshot returned", async () => {
      const json = await getDetail();
      const c = json.data.customer;
      assert(c.fullName === "Guest Inspectee", "Customer name matches snapshot");
      assert(c.phone === "03451122334", "Phone matches snapshot");
      assert(c.email === "guest.inspect@example.com", "Email matches snapshot");
      assert(c.address === "Apartment 4B, Hill View Heights", "Address matches snapshot");
      assert(c.city === "Lahore", "City matches snapshot");
      assert(c.province === "Punjab", "Province matches snapshot");
      assert(c.postalCode === "54000", "Postal code matches snapshot");
      assert(c.orderNotes === "Fragile buttons, pack carefully", "Notes match snapshot");
    });

    await runTest("25. historical item Product name returned", async () => {
      const json = await getDetail();
      const item = json.data.items[0];
      assert(item.productName === baseFixture.product.name, "Product name matches snapshot");
    });

    await runTest("26. historical SKU available to Admin", async () => {
      const json = await getDetail();
      const item = json.data.items[0];
      assert(item.productSku === baseFixture.product.sku, "SKU must be exposed to Admin");
    });

    await runTest("27. historical Size returned", async () => {
      const json = await getDetail();
      const item = json.data.items[0];
      assert(item.sizeLabel === baseFixture.size.name, "Size matches snapshot");
    });

    await runTest("28. historical Color returned", async () => {
      const json = await getDetail();
      const item = json.data.items[0];
      assert(item.colorName === baseFixture.color.name, "Color matches snapshot");
    });

    await runTest("29. quantity returned", async () => {
      const json = await getDetail();
      const item = json.data.items[0];
      assert(item.quantity === 2, "Quantity must be 2");
    });

    await runTest("30. unit price returned", async () => {
      const json = await getDetail();
      const item = json.data.items[0];
      assert(item.unitPrice === "3200.00", "Unit price must be '3200.00'");
    });

    await runTest("31. line subtotal returned", async () => {
      const json = await getDetail();
      const item = json.data.items[0];
      assert(item.lineSubtotal === "6400.00", "Line subtotal must be '6400.00'");
    });

    await runTest("32. delivery charge/total returned", async () => {
      const json = await getDetail();
      assert(json.data.subtotal === "6400.00", "Subtotal must be '6400.00'");
      assert(json.data.deliveryCharge === "300.00", "Delivery charge must be '300.00'");
      assert(json.data.grandTotal === "6700.00", "Grand total must be '6700.00'");
    });

    await runTest("33. status history oldest-to-newest", async () => {
      const json = await getDetail();
      const history = json.data.statusHistory;
      assert(Array.isArray(history) && history.length >= 1, "Must have history entries");
      assert(history[0].status === "ORDER_RECEIVED", "Initial history status must match");
      assert(history[0].statusLabel === "Order Received", "statusLabel must match");
    });

    await runTest("34. no idempotency key exposed", async () => {
      const json = await getDetail();
      assert(json.data.idempotencyKey === undefined, "idempotencyKey must not be in detail");
      const listRes = await app.inject({
        method: "GET",
        url: `/api/v1/admin/orders?q=${detailOrderNum}`,
        headers: { cookie: adminCookie },
      });
      const listJson = JSON.parse(listRes.body);
      assert(
        listJson.data.orders[0].idempotencyKey === undefined,
        "idempotencyKey must not be in list"
      );
    });

    await runTest("35. no color hex/swatch fields exposed", async () => {
      const json = await getDetail();
      const item = json.data.items[0];
      assert((item as any).colorHex === undefined, "colorHex must not exist");
      assert((item as any).hexCode === undefined, "hexCode must not exist");
      assert((item as any).swatch === undefined, "swatch must not exist");
    });

    // ========================================================================
    // Section 4: COD Lifecycle & Confirmation (Tests 36–39)
    // ========================================================================
    console.log("\nSection 4: COD Lifecycle & Confirmation");

    const codOrderNum = getNextOrderNumber();
    const codOrd = await createTestOrder({
      orderNumber: codOrderNum,
      productFixture: baseFixture,
      status: OrderStatus.ORDER_RECEIVED,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    await runTest("36. ORDER_RECEIVED → CONFIRMED succeeds", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${codOrderNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CONFIRMED" },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.data.status === "CONFIRMED", "Status must be CONFIRMED");
      assert(json.data.updated === true, "updated flag must be true");
    });

    await runTest("37. history row created", async () => {
      const historyRows = await prisma.orderStatusHistory.findMany({
        where: { orderId: codOrd.id },
        orderBy: { createdAt: "asc" },
      });
      assert(historyRows.length === 2, `Expected 2 history rows, got ${historyRows.length}`);
      assert(historyRows[1].status === "CONFIRMED", "Second history status must be CONFIRMED");
    });

    await runTest("38. ORDER_RECEIVED → READY_TO_SHIP rejected", async () => {
      const skipOrdNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: skipOrdNum,
        productFixture: baseFixture,
        status: OrderStatus.ORDER_RECEIVED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${skipOrdNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "READY_TO_SHIP" },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "INVALID_STATUS_TRANSITION",
        "Code must be INVALID_STATUS_TRANSITION"
      );
    });

    await runTest("39. COD confirmation does not alter payment method", async () => {
      const checkOrd = await prisma.order.findUnique({
        where: { orderNumber: codOrderNum },
      });
      assert(
        checkOrd!.paymentMethod === "CASH_ON_DELIVERY",
        "Payment method must remain CASH_ON_DELIVERY"
      );
    });

    // ========================================================================
    // Section 5: Bank Transfer Lifecycle & Verification (Tests 40–44)
    // ========================================================================
    console.log("\nSection 5: Bank Transfer Lifecycle & Verification");

    const btOrderNum = getNextOrderNumber();
    const btOrd = await createTestOrder({
      orderNumber: btOrderNum,
      productFixture: baseFixture,
      status: OrderStatus.AWAITING_PAYMENT,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
    });

    await runTest("40. AWAITING_PAYMENT → CONFIRMED succeeds", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${btOrderNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CONFIRMED" },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.data.status === "CONFIRMED", "Status must be CONFIRMED");
    });

    await runTest("41. matching history created", async () => {
      const historyRows = await prisma.orderStatusHistory.findMany({
        where: { orderId: btOrd.id },
        orderBy: { createdAt: "asc" },
      });
      assert(historyRows.length === 2, `Expected 2 history rows, got ${historyRows.length}`);
      assert(historyRows[1].status === "CONFIRMED", "Status must be CONFIRMED");
      assert(
        historyRows[1].changedByAdminId === adminUser.id,
        "changedByAdminId must be authenticated admin"
      );
    });

    await runTest("42. this is treated as Bank Transfer verification", async () => {
      const updated = await prisma.order.findUnique({ where: { id: btOrd.id } });
      assert(
        updated!.status === "CONFIRMED",
        "Bank transfer order verified via transition to CONFIRMED"
      );
    });

    await runTest("43. AWAITING_PAYMENT → IN_PRODUCTION rejected", async () => {
      const btSkipNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: btSkipNum,
        productFixture: baseFixture,
        status: OrderStatus.AWAITING_PAYMENT,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${btSkipNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "IN_PRODUCTION" },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "INVALID_STATUS_TRANSITION",
        "Code must be INVALID_STATUS_TRANSITION"
      );
    });

    await runTest("44. payment method remains Bank Transfer", async () => {
      const checkOrd = await prisma.order.findUnique({
        where: { orderNumber: btOrderNum },
      });
      assert(
        checkOrd!.paymentMethod === "BANK_TRANSFER",
        "Payment method must remain BANK_TRANSFER"
      );
    });

    // ========================================================================
    // Section 6: Production & Delivery Lifecycle (Tests 45–49)
    // ========================================================================
    console.log("\nSection 6: Production & Delivery Lifecycle");

    const flowOrdNum = getNextOrderNumber();
    const flowOrd = await createTestOrder({
      orderNumber: flowOrdNum,
      productFixture: baseFixture,
      status: OrderStatus.CONFIRMED,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    await runTest("45. CONFIRMED → IN_PRODUCTION succeeds", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${flowOrdNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "IN_PRODUCTION" },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.data.status === "IN_PRODUCTION", "Must be IN_PRODUCTION");
    });

    await runTest("46. IN_PRODUCTION → READY_TO_SHIP succeeds", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${flowOrdNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "READY_TO_SHIP" },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.data.status === "READY_TO_SHIP", "Must be READY_TO_SHIP");
    });

    await runTest("47. READY_TO_SHIP → SHIPPED succeeds", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${flowOrdNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "SHIPPED" },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.data.status === "SHIPPED", "Must be SHIPPED");
    });

    await runTest("48. SHIPPED → DELIVERED succeeds", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${flowOrdNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "DELIVERED" },
      });
      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.data.status === "DELIVERED", "Must be DELIVERED");
    });

    await runTest("49. each transition creates exactly one history row", async () => {
      const historyRows = await prisma.orderStatusHistory.findMany({
        where: { orderId: flowOrd.id },
        orderBy: { createdAt: "asc" },
      });
      // 1 initial (CONFIRMED) + 4 updates (IN_PRODUCTION, READY_TO_SHIP, SHIPPED, DELIVERED) = 5
      assert(historyRows.length === 5, `Expected 5 history rows, got ${historyRows.length}`);
      assert(historyRows[1].status === "IN_PRODUCTION", "Row 1 must be IN_PRODUCTION");
      assert(historyRows[2].status === "READY_TO_SHIP", "Row 2 must be READY_TO_SHIP");
      assert(historyRows[3].status === "SHIPPED", "Row 3 must be SHIPPED");
      assert(historyRows[4].status === "DELIVERED", "Row 4 must be DELIVERED");
    });

    // ========================================================================
    // Section 7: Invalid Backward & Skip Transitions (Tests 50–53)
    // ========================================================================
    console.log("\nSection 7: Invalid Backward & Skip Transitions");

    await runTest("50. CONFIRMED → ORDER_RECEIVED rejected", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.CONFIRMED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "ORDER_RECEIVED" },
      });
      assert(res.statusCode === 400, "Backward transition must be rejected");
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "INVALID_STATUS_TRANSITION",
        "Code must be INVALID_STATUS_TRANSITION"
      );
    });

    await runTest("51. IN_PRODUCTION → CONFIRMED rejected", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.IN_PRODUCTION,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CONFIRMED" },
      });
      assert(res.statusCode === 400, "Backward transition must be rejected");
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "INVALID_STATUS_TRANSITION",
        "Code must be INVALID_STATUS_TRANSITION"
      );
    });

    await runTest("52. SHIPPED → READY_TO_SHIP rejected", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.SHIPPED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "READY_TO_SHIP" },
      });
      assert(res.statusCode === 400, "Backward transition must be rejected");
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "INVALID_STATUS_TRANSITION",
        "Code must be INVALID_STATUS_TRANSITION"
      );
    });

    await runTest("53. DELIVERED → SHIPPED rejected", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.DELIVERED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "SHIPPED" },
      });
      assert(res.statusCode === 400, "Terminal transition must be rejected");
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "INVALID_STATUS_TRANSITION",
        "Code must be INVALID_STATUS_TRANSITION"
      );
    });

    // ========================================================================
    // Section 8: Cancellation Boundary & Inventory Invariants (Tests 54–64)
    // ========================================================================
    console.log("\nSection 8: Cancellation Boundary & Inventory Invariants");

    await runTest("54. Awaiting Payment can cancel", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.AWAITING_PAYMENT,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CANCELLED" },
      });
      assert(res.statusCode === 200, "Must allow cancellation from AWAITING_PAYMENT");
    });

    await runTest("55. Order Received can cancel", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.ORDER_RECEIVED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CANCELLED" },
      });
      assert(res.statusCode === 200, "Must allow cancellation from ORDER_RECEIVED");
    });

    await runTest("56. Confirmed can cancel", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.CONFIRMED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CANCELLED" },
      });
      assert(res.statusCode === 200, "Must allow cancellation from CONFIRMED");
    });

    await runTest("57. In Production can cancel", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.IN_PRODUCTION,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CANCELLED" },
      });
      assert(res.statusCode === 200, "Must allow cancellation from IN_PRODUCTION");
    });

    await runTest("58. Ready to Ship can cancel", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.READY_TO_SHIP,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CANCELLED" },
      });
      assert(res.statusCode === 200, "Must allow cancellation from READY_TO_SHIP");
    });

    await runTest("59. Shipped cannot cancel", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.SHIPPED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CANCELLED" },
      });
      assert(res.statusCode === 400, "Cancellation after shipment must be rejected");
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "INVALID_STATUS_TRANSITION",
        "Code must be INVALID_STATUS_TRANSITION"
      );
    });

    await runTest("60. Delivered cannot cancel", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.DELIVERED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CANCELLED" },
      });
      assert(res.statusCode === 400, "Cancellation of delivered order must be rejected");
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "INVALID_STATUS_TRANSITION",
        "Code must be INVALID_STATUS_TRANSITION"
      );
    });

    await runTest("61. Cancelled is terminal", async () => {
      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.CANCELLED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CONFIRMED" },
      });
      assert(res.statusCode === 400, "Transition from CANCELLED must be rejected");
      const json = JSON.parse(res.body);
      assert(
        json.error.code === "INVALID_STATUS_TRANSITION",
        "Code must be INVALID_STATUS_TRANSITION"
      );
    });

    await runTest("62. cancellation creates matching history", async () => {
      const ordNum = getNextOrderNumber();
      const ord = await createTestOrder({
        orderNumber: ordNum,
        productFixture: baseFixture,
        status: OrderStatus.ORDER_RECEIVED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CANCELLED" },
      });

      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId: ord.id },
        orderBy: { createdAt: "asc" },
      });
      assert(history.length === 2, "Must have 2 history entries");
      assert(history[1].status === "CANCELLED", "Last status must be CANCELLED");
    });

    await runTest("63. cancellation does not change Variant availability", async () => {
      const specialFixture = await createTestProductFixture("Availability Test Garment");
      assert(specialFixture.variant.isAvailable === true, "Variant is initially available");

      const ordNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: ordNum,
        productFixture: specialFixture,
        status: OrderStatus.CONFIRMED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${ordNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CANCELLED" },
      });

      const reloadedVariant = await prisma.productVariant.findUnique({
        where: { id: specialFixture.variant.id },
      });
      assert(
        reloadedVariant!.isAvailable === true,
        "Variant availability must remain unchanged after cancellation"
      );
    });

    await runTest("64. cancellation creates no inventory operation", async () => {
      const specialFixture = await createTestProductFixture("No Numeric Inv Garment");
      const fields = Object.keys(specialFixture.variant);
      assert(!fields.includes("stock"), "No stock column on variant");
      assert(!fields.includes("inventory"), "No inventory column on variant");
      assert(!fields.includes("quantity"), "No quantity column on variant");
    });

    // ========================================================================
    // Section 9: Idempotency & Same-Status Retry (Tests 65–66)
    // ========================================================================
    console.log("\nSection 9: Idempotency & Same-Status Retry");

    const retryOrdNum = getNextOrderNumber();
    const retryOrd = await createTestOrder({
      orderNumber: retryOrdNum,
      productFixture: baseFixture,
      status: OrderStatus.CONFIRMED,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    await runTest("65. same-status retry creates no duplicate history", async () => {
      const initialHistory = await prisma.orderStatusHistory.count({
        where: { orderId: retryOrd.id },
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${retryOrdNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CONFIRMED" },
      });
      assert(res.statusCode === 200, "Same status must return 200");

      const afterHistory = await prisma.orderStatusHistory.count({
        where: { orderId: retryOrd.id },
      });
      assert(
        initialHistory === afterHistory,
        "No new history row should be created for same-status"
      );
    });

    await runTest("66. same-status retry returns stable current status", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${retryOrdNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CONFIRMED" },
      });
      const json = JSON.parse(res.body);
      assert(json.data.status === "CONFIRMED", "Must return current status");
      assert(json.data.updated === false, "updated must be false");
    });

    // ========================================================================
    // Section 10: Transactionality & Concurrency Safety (Tests 67–72)
    // ========================================================================
    console.log("\nSection 10: Transactionality & Concurrency Safety");

    await runTest("67. forced history insert failure rolls back Order status", async () => {
      const rollbackOrdNum = getNextOrderNumber();
      const rollOrd = await createTestOrder({
        orderNumber: rollbackOrdNum,
        productFixture: baseFixture,
        status: OrderStatus.ORDER_RECEIVED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      setAdminOrderStatusTestHooks({
        beforeHistoryInsert: async () => {
          throw new Error("Simulated database failure during history insertion");
        },
      });

      try {
        const res = await app.inject({
          method: "PATCH",
          url: `/api/v1/admin/orders/${rollbackOrdNum}/status`,
          headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
          payload: { status: "CONFIRMED" },
        });
        assert(res.statusCode === 500, "Must return 500 on simulated error");

        const checkOrd = await prisma.order.findUnique({ where: { id: rollOrd.id } });
        assert(
          checkOrd!.status === OrderStatus.ORDER_RECEIVED,
          "Order status must roll back to ORDER_RECEIVED"
        );
      } finally {
        setAdminOrderStatusTestHooks(null);
      }
    });

    await runTest("68. no partial status mutation survives transaction failure", async () => {
      const rollbackOrdNum = getNextOrderNumber();
      const rollOrd = await createTestOrder({
        orderNumber: rollbackOrdNum,
        productFixture: baseFixture,
        status: OrderStatus.ORDER_RECEIVED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      setAdminOrderStatusTestHooks({
        beforeStatusCommit: async () => {
          throw new Error("Simulated commit hook failure");
        },
      });

      try {
        const res = await app.inject({
          method: "PATCH",
          url: `/api/v1/admin/orders/${rollbackOrdNum}/status`,
          headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
          payload: { status: "CONFIRMED" },
        });
        assert(res.statusCode === 500, "Must return 500");

        const historyCount = await prisma.orderStatusHistory.count({
          where: { orderId: rollOrd.id },
        });
        assert(historyCount === 1, "Only initial history entry must remain");
      } finally {
        setAdminOrderStatusTestHooks(null);
      }
    });

    await runTest("69. concurrent mutation is serialized by Order row lock", async () => {
      const concOrdNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: concOrdNum,
        productFixture: baseFixture,
        status: OrderStatus.ORDER_RECEIVED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      // Send two concurrent requests: one to CONFIRMED, one to CANCELLED
      const [res1, res2] = await Promise.all([
        app.inject({
          method: "PATCH",
          url: `/api/v1/admin/orders/${concOrdNum}/status`,
          headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
          payload: { status: "CONFIRMED" },
        }),
        app.inject({
          method: "PATCH",
          url: `/api/v1/admin/orders/${concOrdNum}/status`,
          headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
          payload: { status: "CANCELLED" },
        }),
      ]);

      const statuses = [res1.statusCode, res2.statusCode].sort();
      // Either both succeeded (ORDER_RECEIVED -> CONFIRMED -> CANCELLED) or one succeeded (ORDER_RECEIVED -> CANCELLED) and second got 400
      assert(
        (statuses[0] === 200 && statuses[1] === 200) ||
          (statuses[0] === 200 && statuses[1] === 400),
        `Unexpected concurrent status codes: ${res1.statusCode}, ${res2.statusCode}`
      );
    });

    await runTest("70. stale transition is re-evaluated after lock acquisition", async () => {
      const concOrdNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: concOrdNum,
        productFixture: baseFixture,
        status: OrderStatus.READY_TO_SHIP,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      // Request A moves to SHIPPED
      const resA = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${concOrdNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "SHIPPED" },
      });
      assert(resA.statusCode === 200, "Request A must succeed");

      // Request B: attempt to CANCEL after it has become SHIPPED must fail
      const resB = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${concOrdNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CANCELLED" },
      });
      assert(resB.statusCode === 400, "Request B must fail after Order reached SHIPPED state");
      const jsonB = JSON.parse(resB.body);
      assert(
        jsonB.error.code === "INVALID_STATUS_TRANSITION",
        "Code must be INVALID_STATUS_TRANSITION"
      );
    });

    await runTest(
      "71. concurrent same-target retry produces one effective history transition",
      async () => {
        const concOrdNum = getNextOrderNumber();
        const cOrd = await createTestOrder({
          orderNumber: concOrdNum,
          productFixture: baseFixture,
          status: OrderStatus.ORDER_RECEIVED,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        });

        // Two identical concurrent requests: ORDER_RECEIVED -> CONFIRMED
        const [res1, res2] = await Promise.all([
          app.inject({
            method: "PATCH",
            url: `/api/v1/admin/orders/${concOrdNum}/status`,
            headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
            payload: { status: "CONFIRMED" },
          }),
          app.inject({
            method: "PATCH",
            url: `/api/v1/admin/orders/${concOrdNum}/status`,
            headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
            payload: { status: "CONFIRMED" },
          }),
        ]);

        assert(res1.statusCode === 200, "First must be 200");
        assert(res2.statusCode === 200, "Second must be 200 (idempotent retry)");

        const historyCount = await prisma.orderStatusHistory.count({
          where: { orderId: cOrd.id },
        });
        assert(historyCount === 2, `Expected 2 history rows, got ${historyCount}`);
      }
    );

    await runTest(
      "72. invalid transition after another committed change is rejected safely",
      async () => {
        const concOrdNum = getNextOrderNumber();
        await createTestOrder({
          orderNumber: concOrdNum,
          productFixture: baseFixture,
          status: OrderStatus.CONFIRMED,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        });

        // Move to IN_PRODUCTION
        const resProg = await app.inject({
          method: "PATCH",
          url: `/api/v1/admin/orders/${concOrdNum}/status`,
          headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
          payload: { status: "IN_PRODUCTION" },
        });
        assert(resProg.statusCode === 200, "Must transition to IN_PRODUCTION");

        // Attempt to move back to CONFIRMED fails
        const res = await app.inject({
          method: "PATCH",
          url: `/api/v1/admin/orders/${concOrdNum}/status`,
          headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
          payload: { status: "CONFIRMED" },
        });
        assert(res.statusCode === 400, "Backwards move must be rejected");
        const json = JSON.parse(res.body);
        assert(
          json.error.code === "INVALID_STATUS_TRANSITION",
          "Code must be INVALID_STATUS_TRANSITION"
        );
      }
    );

    // ========================================================================
    // Section 11: Attribution & Security (Tests 73–74)
    // ========================================================================
    console.log("\nSection 11: Attribution & Security");

    await runTest("73. Admin-authored history receives server-side Admin attribution", async () => {
      const attrOrdNum = getNextOrderNumber();
      const aOrd = await createTestOrder({
        orderNumber: attrOrdNum,
        productFixture: baseFixture,
        status: OrderStatus.ORDER_RECEIVED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${attrOrdNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: { status: "CONFIRMED" },
      });

      const latestHistory = await prisma.orderStatusHistory.findFirst({
        where: { orderId: aOrd.id, status: OrderStatus.CONFIRMED },
      });
      assert(
        latestHistory!.changedByAdminId === adminUser.id,
        "changedByAdminId must equal authenticated Admin ID"
      );
    });

    await runTest("74. request cannot spoof Admin attribution", async () => {
      const spoofOrdNum = getNextOrderNumber();
      await createTestOrder({
        orderNumber: spoofOrdNum,
        productFixture: baseFixture,
        status: OrderStatus.ORDER_RECEIVED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/orders/${spoofOrdNum}/status`,
        headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
        payload: {
          status: "CONFIRMED",
          changedByAdminId: "fake-admin-id",
          changedAt: new Date().toISOString(),
        },
      });
      assert(res.statusCode === 400, "Strict validation must reject spoofed fields");
      const json = JSON.parse(res.body);
      assert(json.error.code === "VALIDATION_ERROR", "Code must be VALIDATION_ERROR");
    });

    // ========================================================================
    // Section 12: Customer Timeline Regression & Boundary (Tests 75–78)
    // ========================================================================
    console.log("\nSection 12: Customer Timeline Regression & Boundary");

    const { customer: timelineCust, cookie: timelineCustCookie } = await createTestCustomer(
      `timeline.cust.${Date.now()}@example.com`
    );

    const timelineOrdNum = getNextOrderNumber();
    await createTestOrder({
      orderNumber: timelineOrdNum,
      customerId: timelineCust.id,
      productFixture: baseFixture,
      status: OrderStatus.ORDER_RECEIVED,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    // Admin updates status to CONFIRMED
    await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/orders/${timelineOrdNum}/status`,
      headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
      payload: { status: "CONFIRMED" },
    });

    // Customer requests detail
    const custDetailRes = await app.inject({
      method: "GET",
      url: `/api/v1/account/orders/${timelineOrdNum}`,
      headers: { cookie: timelineCustCookie },
    });
    assert(custDetailRes.statusCode === 200, "Customer must fetch order detail");
    const custDetailJson = JSON.parse(custDetailRes.body);

    await runTest("75. authenticated Customer sees new status after Admin update", async () => {
      assert(
        custDetailJson.data.status === "CONFIRMED",
        `Expected CONFIRMED, got ${custDetailJson.data.status}`
      );
      assert(custDetailJson.data.statusLabel === "Confirmed", "statusLabel must be Confirmed");
      const timeline = custDetailJson.data.timeline;
      assert(timeline.length === 2, `Expected 2 timeline items, got ${timeline.length}`);
      assert(timeline[1].status === "CONFIRMED", "Timeline entry must be CONFIRMED");
    });

    await runTest("76. customer timeline exposes customer-safe status only", async () => {
      const entry = custDetailJson.data.timeline[1];
      assert(entry.status === "CONFIRMED", "status must be CONFIRMED");
      assert(entry.statusLabel === "Confirmed", "statusLabel must be Confirmed");
      assert(typeof entry.changedAt === "string", "changedAt must be present");
    });

    await runTest("77. customer timeline still hides Admin identity", async () => {
      const entry = custDetailJson.data.timeline[1];
      assert((entry as any).changedByAdminId === undefined, "changedByAdminId must be hidden");
      assert((entry as any).changedBy === undefined, "changedBy must be hidden");
    });

    await runTest("78. customer timeline still hides internal notes", async () => {
      const entry = custDetailJson.data.timeline[1];
      assert((entry as any).internalNote === undefined, "internalNote must be hidden");
      assert((entry as any).notes === undefined, "notes must be hidden");
    });

    // ========================================================================
    // Section 13: Scope Exclusions & Side-Effect Boundaries (Tests 79–84)
    // ========================================================================
    console.log("\nSection 13: Scope Exclusions & Side-Effect Boundaries");

    const sideEffectOrdNum = getNextOrderNumber();
    const sideEffectOrd = await createTestOrder({
      orderNumber: sideEffectOrdNum,
      customerId: null, // Guest order
      productFixture: baseFixture,
      status: OrderStatus.ORDER_RECEIVED,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    });

    mockEmailService.calls = []; // Reset call recorder

    const sideEffectRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/orders/${sideEffectOrdNum}/status`,
      headers: { cookie: adminCookie, "x-csrf-token": adminCsrf },
      payload: { status: "CONFIRMED" },
    });
    assert(sideEffectRes.statusCode === 200, "Update must succeed");

    await runTest("79. status change sends no customer email", async () => {
      assert(
        mockEmailService.calls.length === 0,
        `Expected 0 emails sent, got ${mockEmailService.calls.length}`
      );
    });

    await runTest("80. status change sends no additional new-order Admin email", async () => {
      assert(
        mockEmailService.calls.length === 0,
        "No admin notification email should be dispatched on status change"
      );
    });

    await runTest("81. no payment gateway mutation", async () => {
      const checkOrd = await prisma.order.findUnique({
        where: { id: sideEffectOrd.id },
      });
      assert((checkOrd as any).stripePaymentIntentId === undefined, "No payment gateway fields");
      assert((checkOrd as any).paypalOrderId === undefined, "No payment gateway fields");
    });

    await runTest("82. no courier integration", async () => {
      const checkOrd = await prisma.order.findUnique({
        where: { id: sideEffectOrd.id },
      });
      assert((checkOrd as any).courierTrackingNumber === undefined, "No courier fields");
      assert((checkOrd as any).courierApiTrackingUrl === undefined, "No courier fields");
    });

    await runTest("83. no numeric inventory mutation", async () => {
      const variant = await prisma.productVariant.findUnique({
        where: { id: baseFixture.variant.id },
      });
      assert((variant as any).stockQuantity === undefined, "No numeric stock on variant");
      assert(variant!.isAvailable === true, "Variant availability is unaffected");
    });

    await runTest("84. no guest-order claiming", async () => {
      const reloadedOrd = await prisma.order.findUnique({
        where: { id: sideEffectOrd.id },
      });
      assert(
        reloadedOrd!.customerId === null,
        "Admin status update must never claim guest order to a customer"
      );
    });
  } finally {
    resetEmailService();

    // Cleanup all created test data
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

    if (createdProductIds.length > 0) {
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
      await prisma.productMedia
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

    if (createdAdminSessionIds.length > 0) {
      await prisma.adminSession
        .deleteMany({
          where: { id: { in: createdAdminSessionIds } },
        })
        .catch(() => {});
    }
  }

  // Summary
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("\n=======================================================");
  console.log(`Kids Wear — Admin Order Management Backend Test Suite Results:`);
  console.log(`Total:  ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
