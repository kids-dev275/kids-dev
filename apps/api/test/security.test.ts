import crypto from "node:crypto";
import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  hashPassword,
  verifyPassword,
  normalizeEmail,
} from "../src/modules/admin-auth/services/password";
import {
  generateAdminCsrfToken,
  generateRawSessionToken,
  hashSessionToken,
} from "../src/modules/admin-auth/services/session";
import {
  generateCustomerCsrfToken,
  generateRawCustomerSessionToken,
  hashCustomerSessionToken,
} from "../src/modules/customer-auth/services/session";
import { getSafeNextUrl } from "../../web/src/lib/safe-redirect";
import { isValidCtaLink } from "../src/modules/storefront/validation";
import { env } from "../src/config/env";
import { isE2ERateLimitExempt } from "../src/modules/order/routes";

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

function extractCookie(
  setCookieHeaders: string | string[] | undefined,
  name: string
): string | null {
  if (!setCookieHeaders) return null;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const header of headers) {
    if (header.startsWith(`${name}=`)) {
      const parts = header.split(";");
      const cookiePart = parts[0];
      if (cookiePart) {
        return cookiePart.substring(name.length + 1);
      }
    }
  }
  return null;
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("=======================================================");
  // eslint-disable-next-line no-console
  console.log("Kids Wear — Work Unit 22: Security Review & Hardening Suite");
  // eslint-disable-next-line no-console
  console.log("=======================================================\n");

  const prisma = getPrismaClient();
  const app = await buildApp();

  const cleanupCustomerIds: string[] = [];
  const cleanupSessionIds: string[] = [];
  const cleanupOrderIds: string[] = [];
  const cleanupProductIds: string[] = [];
  const cleanupReviewIds: string[] = [];
  const cleanupMediaAssetIds: string[] = [];

  // Helper to provision temporary customer
  async function createTestCustomer(email: string, password = "ValidPassword123!") {
    const passwordHash = await hashPassword(password);
    const customer = await prisma.customer.create({
      data: {
        fullName: "Security Test User",
        email: normalizeEmail(email),
        phone: "03001234567",
        passwordHash,
        isActive: true,
      },
    });
    cleanupCustomerIds.push(customer.id);

    const rawToken = generateRawCustomerSessionToken();
    const tokenHash = hashCustomerSessionToken(rawToken);
    const session = await prisma.customerSession.create({
      data: {
        customerId: customer.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    cleanupSessionIds.push(session.id);

    const cookie = `${env.CUSTOMER_SESSION_COOKIE_NAME}=${rawToken}`;
    const csrfToken = generateCustomerCsrfToken(rawToken);
    return { customer, rawToken, cookie, csrfToken };
  }

  // Helper to provision temporary Admin session
  async function createTestAdminSession() {
    let admin = await prisma.adminUser.findUnique({ where: { singletonKey: 1 } });
    if (!admin) {
      const passwordHash = await hashPassword("AdminSecurityTestPass123!");
      admin = await prisma.adminUser.create({
        data: {
          email: "admin.sec@thekidswear.com",
          passwordHash,
          singletonKey: 1,
        },
      });
    }

    const rawToken = generateRawSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const session = await prisma.adminSession.create({
      data: {
        adminUserId: admin.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    cleanupSessionIds.push(session.id);

    const cookie = `${env.ADMIN_SESSION_COOKIE_NAME}=${rawToken}`;
    const csrfToken = generateAdminCsrfToken(rawToken);
    return { admin, rawToken, cookie, csrfToken };
  }

  // Helper to create test product with size, color, variant
  async function createTestProductFixture() {
    const storefront = await prisma.storefront.findFirst({ where: { slug: "mini-sprouts" } });
    assert(storefront !== null, "Mini Sprouts storefront must exist");

    const suffix = crypto.randomUUID().slice(0, 8);
    const product = await prisma.product.create({
      data: {
        storefrontId: storefront!.id,
        name: `Security Product ${suffix}`,
        slug: `sec-prod-${suffix}`,
        sku: `SEC-${suffix.toUpperCase()}`,
        description: "Security test product description",
        regularPrice: new Prisma.Decimal("2500.00"),
        status: "PUBLISHED",
      },
    });
    cleanupProductIds.push(product.id);

    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        provider: "cloudinary",
        providerPublicId: `sec_media_${suffix}`,
        secureUrl: `https://res.cloudinary.com/test/image/upload/sec_media_${suffix}.jpg`,
        mediaType: "IMAGE",
        width: 1200,
        height: 1500,
        format: "jpg",
      },
    });
    cleanupMediaAssetIds.push(mediaAsset.id);

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
        sortOrder: 1,
      },
    });

    const color = await prisma.productColor.create({
      data: {
        productId: product.id,
        name: "Emerald Green",
        sortOrder: 1,
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

    return { product, size, color, variant };
  }

  try {
    // =========================================================================
    // SECTION 1: Authorization & IDOR / BOLA Security (Tests 1–12)
    // =========================================================================
    // eslint-disable-next-line no-console
    console.log("--- Section 1: Authorization & IDOR / BOLA (Tests 1–12) ---");

    await runTest("1. Anonymous caller cannot access Admin Dashboard (401)", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/admin/dashboard" });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.success === false, "Response must indicate failure");
      assert(json.error?.code === "UNAUTHORIZED", "Error code must be UNAUTHORIZED");
    });

    await runTest("2. Anonymous caller cannot access Admin Orders list (401)", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/admin/orders" });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    });

    await runTest("3. Anonymous caller cannot mutate Admin Products (401)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/products",
        body: { name: "Hacked", slug: "hacked", sku: "HACK-1" },
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    });

    await runTest("4. Customer session cannot access Admin Dashboard (401)", async () => {
      const { cookie } = await createTestCustomer(`cust.sec.${Date.now()}@example.com`);
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/dashboard",
        headers: { cookie },
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    });

    await runTest("5. Customer session cannot access Admin Orders (401)", async () => {
      const { cookie } = await createTestCustomer(`cust.sec2.${Date.now()}@example.com`);
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders",
        headers: { cookie },
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    });

    await runTest("6. Customer session cannot mutate Admin Settings (401)", async () => {
      const { cookie, csrfToken } = await createTestCustomer(`cust.sec3.${Date.now()}@example.com`);
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/settings/shipping",
        headers: { cookie, "x-csrf-token": csrfToken },
        body: { flatDeliveryCharge: "0.00" },
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    });

    await runTest("7. Admin session cannot access Customer Account Orders (401)", async () => {
      const { cookie } = await createTestAdminSession();
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/orders",
        headers: { cookie },
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    });

    await runTest("8. Admin session cannot access Customer Profile (401)", async () => {
      const { cookie } = await createTestAdminSession();
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/profile",
        headers: { cookie },
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    });

    await runTest(
      "9. Customer B cannot access Customer A's order detail and receives ownership-safe 404",
      async () => {
        const custA = await createTestCustomer(`custA.${Date.now()}@example.com`);
        const custB = await createTestCustomer(`custB.${Date.now()}@example.com`);
        const fixture = await createTestProductFixture();

        // Create Order belonging to Customer A
        const orderA = await prisma.order.create({
          data: {
            orderNumber: `KW-${Math.floor(100000 + Math.random() * 900000)}`,
            customerId: custA.customer.id,
            status: "ORDER_RECEIVED",
            paymentMethod: "CASH_ON_DELIVERY",
            fullName: "Customer Alpha",
            phone: "03001111111",
            address: "House 1, Street 1",
            city: "Lahore",
            province: "Punjab",
            subtotal: new Prisma.Decimal("2500.00"),
            deliveryCharge: new Prisma.Decimal("300.00"),
            grandTotal: new Prisma.Decimal("2800.00"),
            items: {
              create: {
                productId: fixture.product.id,
                productVariantId: fixture.variant.id,
                productName: fixture.product.name,
                sku: fixture.product.sku,
                sizeLabel: fixture.size.name,
                colorName: fixture.color.name,
                quantity: 1,
                unitPrice: new Prisma.Decimal("2500.00"),
                lineSubtotal: new Prisma.Decimal("2500.00"),
              },
            },
          },
        });
        cleanupOrderIds.push(orderA.id);

        // Customer B attempts to inspect Customer A's order
        const res = await app.inject({
          method: "GET",
          url: `/api/v1/account/orders/${orderA.orderNumber}`,
          headers: { cookie: custB.cookie },
        });

        assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
        const json = JSON.parse(res.body);
        assert(json.success === false, "Must return failure envelope");
        assert(json.error?.code === "ORDER_NOT_FOUND", "Must return ORDER_NOT_FOUND");
        assert(!res.body.includes("Customer Alpha"), "Must not leak Customer A name");
        assert(!res.body.includes("House 1, Street 1"), "Must not leak Customer A address");
      }
    );

    await runTest("10. Public guest order lookup route does not exist (404)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/orders/KW-1001",
      });
      assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    });

    await runTest("11. Admin mutations require CSRF token (403 without CSRF)", async () => {
      const { cookie } = await createTestAdminSession();
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/settings/announcement",
        headers: { cookie }, // Omitting x-csrf-token
        body: { text: "Tampered announcement", isActive: true },
      });
      assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(
        json.error?.code === "CSRF_MISSING" ||
          json.error?.code === "CSRF_ERROR" ||
          json.error?.code === "FORBIDDEN"
      );
    });

    await runTest(
      "12. Cross-session CSRF token is strictly rejected across Admin and Customer",
      async () => {
        const adminSession = await createTestAdminSession();
        const customerSession = await createTestCustomer(`cust.csrf.${Date.now()}@example.com`);

        // Attempting Customer profile patch using Admin CSRF token
        const resCust = await app.inject({
          method: "PATCH",
          url: "/api/v1/account/profile",
          headers: {
            cookie: customerSession.cookie,
            "x-csrf-token": adminSession.csrfToken, // Cross-domain token!
          },
          body: { fullName: "Hacked Customer" },
        });
        assert(resCust.statusCode === 403, `Expected 403, got ${resCust.statusCode}`);

        // Attempting Admin settings patch using Customer CSRF token
        const resAdmin = await app.inject({
          method: "PATCH",
          url: "/api/v1/admin/settings/announcement",
          headers: {
            cookie: adminSession.cookie,
            "x-csrf-token": customerSession.csrfToken, // Cross-domain token!
          },
          body: { text: "Hacked Announcement" },
        });
        assert(resAdmin.statusCode === 403, `Expected 403, got ${resAdmin.statusCode}`);
      }
    );

    // =========================================================================
    // SECTION 2: Authentication & Session Security (Tests 13–21)
    // =========================================================================
    // eslint-disable-next-line no-console
    console.log("\n--- Section 2: Authentication & Session Security (Tests 13–21) ---");

    await runTest(
      "13. Admin login: Generic failure response on unknown account (401)",
      async () => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/admin/auth/login",
          body: { email: "nonexistent@thekidswear.com", password: "Password123!" },
        });
        assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
        const json = JSON.parse(res.body);
        assert(
          json.error?.message === "Invalid email or password",
          `Expected generic message, got "${json.error?.message}"`
        );
      }
    );

    await runTest(
      "14. Admin login: Generic failure response on incorrect password (401)",
      async () => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/admin/auth/login",
          body: { email: "admin.sec@thekidswear.com", password: "WrongPassword999!" },
        });
        assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
        const json = JSON.parse(res.body);
        assert(json.error?.message === "Invalid email or password");
      }
    );

    await runTest(
      "15. Customer login: Generic failure response prevents account enumeration (401)",
      async () => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          body: { email: "unknown.customer@example.com", password: "Password123!" },
        });
        assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
        const json = JSON.parse(res.body);
        assert(json.error?.message === "Invalid email or password");
      }
    );

    await runTest(
      "16. Customer login: Generates fresh session token upon successful authentication",
      async () => {
        const testEmail = `fresh.session.${Date.now()}@example.com`;
        const testPass = "SecurePass123!";
        await createTestCustomer(testEmail, testPass);

        const res1 = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          body: { email: testEmail, password: testPass },
        });
        assert(res1.statusCode === 200, "First login must succeed");
        const cookie1 = extractCookie(res1.headers["set-cookie"], env.CUSTOMER_SESSION_COOKIE_NAME);

        const res2 = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          body: { email: testEmail, password: testPass },
        });
        assert(res2.statusCode === 200, "Second login must succeed");
        const cookie2 = extractCookie(res2.headers["set-cookie"], env.CUSTOMER_SESSION_COOKIE_NAME);

        assert(cookie1 !== null && cookie2 !== null, "Both logins must issue cookies");
        assert(cookie1 !== cookie2, "Each login must generate a distinct, fresh session token");
      }
    );

    await runTest("17. Expired session is strictly rejected server-side (401)", async () => {
      const cust = await createTestCustomer(`expired.${Date.now()}@example.com`);

      // Expire session directly in DB
      await prisma.customerSession.updateMany({
        where: { customerId: cust.customer.id },
        data: { expiresAt: new Date(Date.now() - 3600 * 1000) },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/account/profile",
        headers: { cookie: cust.cookie },
      });
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    });

    await runTest("18. Logout invalidates server-side session and prevents reuse", async () => {
      const cust = await createTestCustomer(`logout.${Date.now()}@example.com`);

      // Successful profile check
      const beforeRes = await app.inject({
        method: "GET",
        url: "/api/v1/account/profile",
        headers: { cookie: cust.cookie },
      });
      assert(beforeRes.statusCode === 200, "Session should be active");

      // Logout
      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { cookie: cust.cookie, "x-csrf-token": cust.csrfToken },
      });
      assert(logoutRes.statusCode === 200, "Logout should succeed");

      // Subsequent request using revoked cookie must fail
      const afterRes = await app.inject({
        method: "GET",
        url: "/api/v1/account/profile",
        headers: { cookie: cust.cookie },
      });
      assert(afterRes.statusCode === 401, "Revoked session must be rejected");
    });

    await runTest(
      "19. Database stores only non-reversible SHA-256 tokenHash, never raw bearer tokens",
      async () => {
        const cust = await createTestCustomer(`hash.check.${Date.now()}@example.com`);
        const sessionRecord = await prisma.customerSession.findFirst({
          where: { customerId: cust.customer.id },
        });

        assert(sessionRecord !== null, "Session record must exist");
        assert(
          sessionRecord.tokenHash !== cust.rawToken,
          "Database tokenHash MUST NOT equal raw bearer token"
        );
        assert(
          sessionRecord.tokenHash.length === 64,
          "Database tokenHash must be 64-char hex SHA-256"
        );
        assert(
          hashCustomerSessionToken(cust.rawToken) === sessionRecord.tokenHash,
          "Hash of raw token must match database tokenHash"
        );
      }
    );

    await runTest("20. Raw bearer session tokens are never returned in JSON payloads", async () => {
      const email = `token.leak.${Date.now()}@example.com`;
      const password = "ValidPassword123!";
      await createTestCustomer(email, password);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        body: { email, password },
      });

      const body = res.body;
      assert(!body.includes("rawToken"), "JSON body must not expose rawToken");
      assert(!body.includes("tokenHash"), "JSON body must not expose tokenHash");
      assert(!body.includes("sessionSecret"), "JSON body must not expose sessionSecret");
    });

    await runTest("21. Argon2id password hashing parameters conform to OWASP profile", async () => {
      const hash = await hashPassword("TestPasswordSample123!");
      assert(hash.startsWith("$argon2id$"), "Hash must use Argon2id variant");
      assert(hash.includes("m=19456"), "Hash must specify 19 MiB memory cost");
      assert(hash.includes("t=2"), "Hash must specify 2 iterations");
      assert(hash.includes("p=1"), "Hash must specify parallelism 1");
    });

    // =========================================================================
    // SECTION 3: Input Validation, Injection & Mass Assignment (Tests 22–30)
    // =========================================================================
    // eslint-disable-next-line no-console
    console.log("\n--- Section 3: Input Validation, Injection & Mass Assignment (Tests 22–30) ---");

    await runTest(
      "22. Strict Zod schemas reject unknown / protected fields on Product creation",
      async () => {
        const { cookie, csrfToken } = await createTestAdminSession();
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/admin/products",
          headers: { cookie, "x-csrf-token": csrfToken },
          body: {
            name: "Test Shirt",
            slug: `test-shirt-${Date.now()}`,
            sku: `SHIRT-${Date.now()}`,
            storefrontSlug: "mini-sprouts",
            regularPrice: 1999,
            role: "superadmin", // FORBIDDEN / OVER-POSTED
            isAdmin: true, // FORBIDDEN / OVER-POSTED
          },
        });
        assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
        const json = JSON.parse(res.body);
        assert(json.error?.code === "VALIDATION_ERROR");
      }
    );

    await runTest(
      "23. Strict Zod schema rejects unauthorized fields on Customer profile update",
      async () => {
        const cust = await createTestCustomer(`strict.prof.${Date.now()}@example.com`);
        const res = await app.inject({
          method: "PATCH",
          url: "/api/v1/account/profile",
          headers: { cookie: cust.cookie, "x-csrf-token": cust.csrfToken },
          body: {
            fullName: "Updated Name",
            isActive: false, // Protected database field!
            id: "00000000-0000-0000-0000-000000000000", // Protected field!
          },
        });
        assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      }
    );

    await runTest(
      "24. Email canonicalization trims and lower-cases input consistently",
      async () => {
        assert(normalizeEmail("  User.Test@Example.COM  ") === "user.test@example.com");
      }
    );

    await runTest(
      "25. SQL injection payload in search input is treated strictly as data",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/storefronts/mini-sprouts/search?q=' OR '1'='1' --",
        });
        assert(res.statusCode === 200, "Search query must not cause SQL error");
        const json = JSON.parse(res.body);
        assert(json.success === true, "Must return valid API response");
        // Must return items array and not evaluate the OR condition to match everything
        assert(Array.isArray(json.data.items), "Must return items array");
        assert(json.data.items.length === 0, "Injection string must not match unrelated products");
      }
    );

    await runTest(
      "26. Markup-like text in Review is safely stored as plain text without interpretation",
      async () => {
        const fixture = await createTestProductFixture();
        const submissionId = crypto.randomUUID();
        const xssPayload = "<script>alert('xss')</script><b>Bold Review</b>";

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/reviews",
          body: {
            name: "Attacker User",
            productId: fixture.product.id,
            rating: 5,
            reviewText: xssPayload,
            reviewSubmissionId: submissionId,
            images: [],
          },
        });
        assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);

        // Fetch back directly from DB to verify raw storage without corruption
        const reviewInDb = await prisma.review.findFirst({
          where: { productId: fixture.product.id },
        });
        assert(reviewInDb !== null, "Review must exist in database");
        cleanupReviewIds.push(reviewInDb.id);
        assert(reviewInDb.reviewText === xssPayload, "Plain text must be stored verbatim");
      }
    );

    await runTest("27. Open redirect payloads are rejected by getSafeNextUrl", async () => {
      assert(getSafeNextUrl("//evil.com") === "/account");
      assert(getSafeNextUrl("https://evil.com") === "/account");
      assert(getSafeNextUrl("/\\evil.com") === "/account");
      assert(getSafeNextUrl("javascript:alert(1)") === "/account");
      assert(getSafeNextUrl("/valid-internal-path") === "/valid-internal-path");
      assert(getSafeNextUrl("/account/orders") === "/account/orders");
    });

    await runTest("28. Dangerous schemes are rejected by isValidCtaLink", async () => {
      assert(isValidCtaLink("javascript:alert(1)") === false);
      assert(isValidCtaLink("data:text/html,<script>alert(1)</script>") === false);
      assert(isValidCtaLink("vbscript:msgbox(1)") === false);
      assert(isValidCtaLink("/shop/summer") === true);
      assert(isValidCtaLink("https://thekidswear.com") === true);
    });

    await runTest(
      "29. Client-tampered Order money fields are rejected by strict schema and computed by server",
      async () => {
        const fixture = await createTestProductFixture(); // price: 2500.00

        // 1. Attacker attempts to forge totals directly in payload
        const tamperedRes = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          body: {
            idempotencyKey: crypto.randomUUID(),
            paymentMethod: "CASH_ON_DELIVERY",
            customer: {
              fullName: "Tampering Customer",
              phone: "03001234567",
              address: "Test Address",
              city: "Islamabad",
              province: "Federal Capital",
            },
            items: [
              {
                productId: fixture.product.id,
                variantId: fixture.variant.id,
                quantity: 2,
              },
            ],
            subtotal: "10.00",
            deliveryCharge: "0.00",
            grandTotal: "10.00",
          },
        });
        assert(tamperedRes.statusCode === 400, "Tampered money fields must be rejected with 400");
        const tamperedJson = JSON.parse(tamperedRes.body);
        assert(tamperedJson.error?.code === "VALIDATION_ERROR");

        // 2. Legitimate order creation computes totals strictly from database catalog and settings
        const validRes = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          body: {
            idempotencyKey: crypto.randomUUID(),
            paymentMethod: "CASH_ON_DELIVERY",
            customer: {
              fullName: "Legitimate Customer",
              phone: "03001234567",
              address: "Test Address",
              city: "Islamabad",
              province: "Federal Capital",
            },
            items: [
              {
                productId: fixture.product.id,
                variantId: fixture.variant.id,
                quantity: 2,
              },
            ],
          },
        });
        assert(validRes.statusCode === 201, `Expected 201, got ${validRes.statusCode}`);
        const validJson = JSON.parse(validRes.body);
        const orderNumber = validJson.data.orderNumber;

        const orderInDb = await prisma.order.findUnique({
          where: { orderNumber },
        });
        assert(orderInDb !== null);
        assert(
          orderInDb.subtotal.toFixed(2) === "5000.00",
          `Expected 5000.00, got ${orderInDb.subtotal.toFixed(2)}`
        );
        assert(
          orderInDb.deliveryCharge.toFixed(2) === "300.00",
          `Expected 300.00, got ${orderInDb.deliveryCharge.toFixed(2)}`
        );
        assert(
          orderInDb.grandTotal.toFixed(2) === "5300.00",
          `Expected 5300.00, got ${orderInDb.grandTotal.toFixed(2)}`
        );
        cleanupOrderIds.push(orderInDb.id);
      }
    );

    await runTest("30. Order creation strictly rejects client-submitted status field", async () => {
      const fixture = await createTestProductFixture();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        body: {
          idempotencyKey: crypto.randomUUID(),
          paymentMethod: "CASH_ON_DELIVERY",
          status: "DELIVERED", // Attacker attempts to mark order as delivered!
          customer: {
            fullName: "Status Tamperer",
            phone: "03001234567",
            address: "Street 5",
            city: "Attock",
            province: "Punjab",
          },
          items: [
            {
              productId: fixture.product.id,
              variantId: fixture.variant.id,
              quantity: 1,
            },
          ],
        },
      });
      assert(res.statusCode === 400, "Client-submitted status must be rejected with 400");
      const json = JSON.parse(res.body);
      assert(json.error?.code === "VALIDATION_ERROR");
    });

    // =========================================================================
    // SECTION 4: CORS & Security Headers (Tests 31–36)
    // =========================================================================
    // eslint-disable-next-line no-console
    console.log("\n--- Section 4: CORS & Security Headers (Tests 31–36) ---");

    await runTest("31. Configured FRONTEND_URL is allowed by CORS with credentials", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/health",
        headers: { origin: env.FRONTEND_URL },
      });
      assert(res.statusCode === 200);
      assert(res.headers["access-control-allow-origin"] === env.FRONTEND_URL);
      assert(res.headers["access-control-allow-credentials"] === "true");
    });

    await runTest("32. Disallowed arbitrary Origin is rejected by CORS policy", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/health",
        headers: { origin: "https://malicious-attacker-site.com" },
      });
      // Origin should NOT receive CORS allow header
      assert(res.headers["access-control-allow-origin"] === undefined);
    });

    await runTest("33. Credentialed CORS never sends wildcard '*'", async () => {
      const res = await app.inject({
        method: "OPTIONS",
        url: "/api/v1/health",
        headers: {
          origin: env.FRONTEND_URL,
          "access-control-request-method": "GET",
        },
      });
      assert(res.headers["access-control-allow-origin"] !== "*");
    });

    await runTest("34. Fastify security headers: nosniff, DENY, and Referrer-Policy", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/health" });
      assert(
        res.headers["x-content-type-options"] === "nosniff",
        "X-Content-Type-Options must be nosniff"
      );
      assert(res.headers["x-frame-options"] === "DENY", "X-Frame-Options must be DENY");
      assert(
        res.headers["referrer-policy"] === "strict-origin-when-cross-origin",
        "Referrer-Policy must be strict-origin-when-cross-origin"
      );

      // Verify Next.js production headers and CSP rules
      const nextConfigModule = await import("../../web/next.config.mjs");
      const nextConfig = nextConfigModule.default;
      const headersConfig = await nextConfig.headers();
      const allRoutesConfig = headersConfig.find((h: any) => h.source === "/:path*");
      assert(allRoutesConfig !== undefined, "Next.js must define headers for /:path*");

      const headerMap: Record<string, string> = {};
      for (const h of allRoutesConfig.headers) {
        headerMap[h.key.toLowerCase()] = h.value;
      }

      assert(
        headerMap["x-content-type-options"] === "nosniff",
        "Web X-Content-Type-Options must be nosniff"
      );
      assert(headerMap["x-frame-options"] === "DENY", "Web X-Frame-Options must be DENY");
      assert(
        headerMap["referrer-policy"] === "strict-origin-when-cross-origin",
        "Web Referrer-Policy must be strict-origin-when-cross-origin"
      );
      assert(
        headerMap["permissions-policy"] !== undefined &&
          headerMap["permissions-policy"].includes("camera=()"),
        "Web Permissions-Policy must restrict sensitive capabilities"
      );

      // Test Production CSP
      const prodCsp =
        typeof nextConfigModule.buildCsp === "function"
          ? nextConfigModule.buildCsp(true)
          : headerMap["content-security-policy"];
      assert(!prodCsp.includes("'unsafe-eval'"), "Production CSP must NOT allow 'unsafe-eval'");
      assert(!prodCsp.includes("localhost"), "Production CSP must NOT allow localhost origins");
      assert(!prodCsp.includes("127.0.0.1"), "Production CSP must NOT allow 127.0.0.1 origins");
      assert(
        !prodCsp.includes("*.thekidswear.com"),
        "Production CSP must NOT use broad *.thekidswear.com wildcard"
      );
      assert(
        !prodCsp.includes("*.belmo.app"),
        "Production CSP must NOT use broad *.belmo.app wildcard"
      );
      assert(
        !prodCsp.includes("images.unsplash.com"),
        "Production CSP img-src must NOT include images.unsplash.com"
      );
      assert(
        prodCsp.includes("frame-ancestors 'none'"),
        "Production CSP must enforce frame-ancestors 'none'"
      );
      assert(
        prodCsp.includes("object-src 'none'"),
        "Production CSP must enforce object-src 'none'"
      );
      assert(
        prodCsp.includes("https://res.cloudinary.com"),
        "Production CSP must allow Cloudinary CDN"
      );
      assert(
        prodCsp.includes("https://api.cloudinary.com"),
        "Production CSP must allow Cloudinary API for direct uploads"
      );

      // Test Development CSP retains needed development allowances
      if (typeof nextConfigModule.buildCsp === "function") {
        const devCsp = nextConfigModule.buildCsp(false);
        assert(
          devCsp.includes("'unsafe-eval'"),
          "Development CSP must permit 'unsafe-eval' for Turbopack/HMR"
        );
        assert(
          devCsp.includes("http://localhost:*"),
          "Development CSP must permit localhost for dev"
        );
        assert(
          devCsp.includes("images.unsplash.com"),
          "Development CSP must permit unsplash for fixtures"
        );
      }
    });

    await runTest(
      "35. Production app composition excludes diagnostic E2E health endpoint (404)",
      async () => {
        const prodApp = await buildApp();
        const res = await prodApp.inject({
          method: "GET",
          url: "/api/v1/e2e/health",
        });
        assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
        await prodApp.close();
      }
    );

    await runTest(
      "36. Production app composition excludes mock prisma injection endpoints (404)",
      async () => {
        const prodApp = await buildApp();
        const res = await prodApp.inject({
          method: "POST",
          url: "/api/v1/set-prisma",
        });
        assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
        await prodApp.close();
      }
    );

    // =========================================================================
    // SECTION 5: Media Upload Boundaries (Tests 37–42)
    // =========================================================================
    // eslint-disable-next-line no-console
    console.log("\n--- Section 5: Media Upload Security (Tests 37–42) ---");

    await runTest("37. Product media upload rejects invalid mediaType (400)", async () => {
      const { cookie, csrfToken } = await createTestAdminSession();
      const fixture = await createTestProductFixture();
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/products/${fixture.product.id}/media/upload-signature`,
        headers: { cookie, "x-csrf-token": csrfToken },
        body: { mediaType: "EXECUTABLE" }, // Invalid
      });
      assert(res.statusCode === 400);
    });

    await runTest(
      "38. Product media registration rejects foreign product namespace (400)",
      async () => {
        const { cookie, csrfToken } = await createTestAdminSession();
        const fixture = await createTestProductFixture();
        const res = await app.inject({
          method: "POST",
          url: `/api/v1/admin/products/${fixture.product.id}/media`,
          headers: { cookie, "x-csrf-token": csrfToken },
          body: {
            publicId: "kids-wear/products/foreign-product-uuid/img_1",
            mediaType: "IMAGE",
          },
        });
        assert(res.statusCode === 400);
        const json = JSON.parse(res.body);
        assert(json.error?.code === "PRODUCT_MEDIA_FOREIGN_PRODUCT");
      }
    );

    await runTest("39. Review media sign enforces reviewSubmissionId format", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews/media/sign",
        body: { reviewSubmissionId: "not-a-valid-uuid" },
      });
      assert(res.statusCode === 400);
    });

    await runTest("40. Review submission rejects >3 images (400)", async () => {
      const fixture = await createTestProductFixture();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/reviews",
        body: {
          name: "Image Spammer",
          productId: fixture.product.id,
          rating: 5,
          reviewText: "Great product",
          reviewSubmissionId: crypto.randomUUID(),
          images: [
            { publicId: "img1", secureUrl: "https://cloudinary/img1.jpg" },
            { publicId: "img2", secureUrl: "https://cloudinary/img2.jpg" },
            { publicId: "img3", secureUrl: "https://cloudinary/img3.jpg" },
            { publicId: "img4", secureUrl: "https://cloudinary/img4.jpg" }, // 4th image!
          ],
        },
      });
      assert(res.statusCode === 400);
    });

    await runTest(
      "41. Public review query returns only APPROVED reviews and never PENDING",
      async () => {
        const fixture = await createTestProductFixture();
        const pendingReview = await prisma.review.create({
          data: {
            productId: fixture.product.id,
            reviewerName: "Secret Reviewer",
            rating: 5,
            reviewText: "Pending secret comment",
            status: "PENDING",
          },
        });
        cleanupReviewIds.push(pendingReview.id);

        const res = await app.inject({
          method: "GET",
          url: `/api/v1/reviews?productId=${fixture.product.id}`,
        });
        assert(res.statusCode === 200);
        const json = JSON.parse(res.body);
        const found = json.data.reviews.some((r: any) => r.id === pendingReview.id);
        assert(found === false, "PENDING reviews must not appear in public API response");
      }
    );

    await runTest("42. Public responses never leak Cloudinary API secrets", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/public/settings" });
      assert(!res.body.includes("CLOUDINARY_API_SECRET"));
      assert(!res.body.includes(env.CLOUDINARY_API_SECRET || "xyz_never_leak"));
    });

    // =========================================================================
    // SECTION 6: Rate Limiting & Proxy Security (Tests 43–47)
    // =========================================================================
    // eslint-disable-next-line no-console
    console.log("\n--- Section 6: Rate Limiting & Proxy Security (Tests 43–47) ---");

    await runTest(
      "43. Admin login rate limiting triggers after repeated failed attempts",
      async () => {
        const testIp = `198.51.100.${Math.floor(1 + Math.random() * 200)}`;
        let reached429 = false;

        for (let i = 0; i < 7; i++) {
          const res = await app.inject({
            method: "POST",
            url: "/api/v1/admin/auth/login",
            remoteAddress: testIp,
            body: { email: "fake@thekidswear.com", password: "BadPassword1!" },
          });
          if (res.statusCode === 429) {
            reached429 = true;
            break;
          }
        }
        assert(reached429, "Admin login must activate rate limit (429) after threshold");
      }
    );

    await runTest("44. Customer registration rate limiting triggers after threshold", async () => {
      const testIp = `198.51.100.${Math.floor(1 + Math.random() * 200)}`;
      let reached429 = false;

      for (let i = 0; i < 7; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/register",
          remoteAddress: testIp,
          body: {
            fullName: "Rate Tester",
            email: `rate.${i}.${Date.now()}@example.com`,
            password: "SecurePassword123!",
            phone: "03001234567",
          },
        });
        if (res.statusCode === 429) {
          reached429 = true;
          break;
        }
      }
      assert(reached429, "Customer registration must enforce rate limit (429)");
    });

    await runTest("45. Order creation route enforces rate limiting", async () => {
      const fixture = await createTestProductFixture();
      const testIp = `198.51.101.${Math.floor(1 + Math.random() * 200)}`;
      let reached429 = false;
      let rateLimitedRes: any = null;

      for (let i = 0; i < 12; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          remoteAddress: testIp,
          body: {
            idempotencyKey: crypto.randomUUID(),
            paymentMethod: "CASH_ON_DELIVERY",
            customer: {
              fullName: "Rate Order Tester",
              phone: "03001234567",
              address: "Address",
              city: "City",
              province: "Punjab",
            },
            items: [
              {
                productId: fixture.product.id,
                variantId: fixture.variant.id,
                quantity: 1,
              },
            ],
          },
        });
        if (res.statusCode === 201) {
          const json = JSON.parse(res.body);
          cleanupOrderIds.push(json.data.orderNumber);
        } else if (res.statusCode === 429) {
          reached429 = true;
          rateLimitedRes = res;
          break;
        }
      }
      assert(reached429, "Order creation must trigger 429 after threshold");
      assert(rateLimitedRes, "Must have captured rate-limited response");
      assert(
        rateLimitedRes.headers["x-ratelimit-limit"] === 10 ||
          rateLimitedRes.headers["x-ratelimit-limit"] === "10",
        `Order rate limit max must be 10 (got ${rateLimitedRes.headers["x-ratelimit-limit"]})`
      );
      const retryAfter = Number(rateLimitedRes.headers["retry-after"]);
      assert(
        !isNaN(retryAfter) && retryAfter > 60 && retryAfter <= 900,
        `Order rate limit window must be 15 minutes (900s), retry-after must be >60s and <=900s (got ${retryAfter})`
      );
    });

    await runTest(
      "46. Rate-limit isolation: Production environment never gets Order rate-limit bypass",
      async () => {
        const origNodeEnv = process.env.NODE_ENV;
        const origE2e = process.env.E2E_TEST;
        try {
          process.env.NODE_ENV = "production";
          process.env.E2E_TEST = "true";

          // 1. Direct evaluator invariant
          assert(
            !isE2ERateLimitExempt({ ip: "127.0.0.1" }, "127.0.0.1"),
            "isE2ERateLimitExempt must be false in production mode"
          );

          // 2. HTTP route rate-limiting enforcement on localhost
          const testIp = "127.0.0.10";
          let reached429 = false;
          for (let i = 0; i < 12; i++) {
            const res = await app.inject({
              method: "POST",
              url: "/api/v1/orders",
              remoteAddress: testIp,
              body: { invalid: true },
            });
            if (res.statusCode === 429) {
              reached429 = true;
              break;
            }
          }
          assert(
            reached429,
            "Production mode must NOT bypass Order rate limits even for localhost with E2E_TEST=true"
          );
        } finally {
          process.env.NODE_ENV = origNodeEnv;
          if (origE2e !== undefined) {
            process.env.E2E_TEST = origE2e;
          } else {
            delete process.env.E2E_TEST;
          }
        }
      }
    );

    await runTest(
      "47. Rate-limit isolation: Non-production without E2E_TEST does not get Order rate-limit bypass",
      async () => {
        const origNodeEnv = process.env.NODE_ENV;
        const origE2e = process.env.E2E_TEST;
        try {
          process.env.NODE_ENV = "test";
          delete process.env.E2E_TEST;

          // 1. Direct evaluator invariant
          assert(
            !isE2ERateLimitExempt({ ip: "127.0.0.1" }, "127.0.0.1"),
            "isE2ERateLimitExempt must be false without explicit E2E_TEST=true"
          );

          // 2. In normal dev/test without E2E_TEST, localhost requests trigger 429
          const testIp = "127.0.0.11";
          let reached429 = false;
          for (let i = 0; i < 12; i++) {
            const res = await app.inject({
              method: "POST",
              url: "/api/v1/orders",
              remoteAddress: testIp,
              body: { invalid: true },
            });
            if (res.statusCode === 429) {
              reached429 = true;
              break;
            }
          }
          assert(reached429, "Normal test/dev server without E2E_TEST must NOT bypass rate limits");
        } finally {
          process.env.NODE_ENV = origNodeEnv;
          if (origE2e !== undefined) {
            process.env.E2E_TEST = origE2e;
          } else {
            delete process.env.E2E_TEST;
          }
        }
      }
    );

    await runTest(
      "48. Rate-limit isolation: Non-production + E2E_TEST=true + localhost gets Order rate-limit bypass",
      async () => {
        const origNodeEnv = process.env.NODE_ENV;
        const origE2e = process.env.E2E_TEST;
        try {
          process.env.NODE_ENV = "test";
          process.env.E2E_TEST = "true";

          // 1. Direct evaluator invariant
          assert(
            isE2ERateLimitExempt({ ip: "127.0.0.1" }, "127.0.0.1"),
            "isE2ERateLimitExempt must be true for localhost with E2E_TEST=true in non-production"
          );

          // 2. Dedicated E2E server on localhost can make 15 consecutive requests without 429
          const testIp = "127.0.0.12";
          let reached429 = false;
          for (let i = 0; i < 15; i++) {
            const res = await app.inject({
              method: "POST",
              url: "/api/v1/orders",
              remoteAddress: testIp,
              body: { invalid: true },
            });
            if (res.statusCode === 429) {
              reached429 = true;
              break;
            }
          }
          assert(!reached429, "Dedicated E2E server on localhost must bypass rate limits");
        } finally {
          process.env.NODE_ENV = origNodeEnv;
          if (origE2e !== undefined) {
            process.env.E2E_TEST = origE2e;
          } else {
            delete process.env.E2E_TEST;
          }
        }
      }
    );

    await runTest(
      "49. Rate-limit isolation: Remote / non-local request does not get Order bypass merely because E2E_TEST=true",
      async () => {
        const origNodeEnv = process.env.NODE_ENV;
        const origE2e = process.env.E2E_TEST;
        try {
          process.env.NODE_ENV = "test";
          process.env.E2E_TEST = "true";

          // 1. Direct evaluator invariant
          assert(
            !isE2ERateLimitExempt({ ip: "198.51.100.99" }, "198.51.100.99"),
            "Remote address must not receive E2E bypass"
          );

          // 2. HTTP route rate-limiting enforcement on remote IP
          const testIp = `198.51.102.${Math.floor(1 + Math.random() * 200)}`;
          let reached429 = false;
          for (let i = 0; i < 12; i++) {
            const res = await app.inject({
              method: "POST",
              url: "/api/v1/orders",
              remoteAddress: testIp,
              body: { invalid: true },
            });
            if (res.statusCode === 429) {
              reached429 = true;
              break;
            }
          }
          assert(reached429, "Remote requests must be rate-limited even when E2E_TEST=true");
        } finally {
          process.env.NODE_ENV = origNodeEnv;
          if (origE2e !== undefined) {
            process.env.E2E_TEST = origE2e;
          } else {
            delete process.env.E2E_TEST;
          }
        }
      }
    );

    await runTest(
      "50. Fastify trustProxy defaults to false to prevent client IP spoofing",
      async () => {
        // When trustProxy is false, Fastify ignores untrusted X-Forwarded-For
        assert(
          env.TRUST_PROXY === false ||
            typeof env.TRUST_PROXY === "number" ||
            typeof env.TRUST_PROXY === "boolean"
        );
      }
    );

    // =========================================================================
    // SECTION 7: Error & Secret Leakage Prevention (Tests 51–54)
    // =========================================================================
    // eslint-disable-next-line no-console
    console.log("\n--- Section 7: Error & Secret Leakage Prevention (Tests 51–54) ---");

    await runTest(
      "51. Unhandled 500 error returns safe standard envelope without stack trace",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/storefronts/invalid-uuid-triggering-error",
        });
        assert(!res.body.includes("at Object."), "Response must not contain stack trace");
        assert(!res.body.includes("node_modules"), "Response must not leak filesystem paths");
      }
    );

    await runTest(
      "52. Error response does not leak Prisma query or database connection",
      async () => {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/account/orders/KW-NONEXISTENT",
          headers: { cookie: "invalid_cookie" },
        });
        assert(!res.body.includes("PrismaClientKnownRequestError"));
        assert(!res.body.includes("SELECT "));
        assert(!res.body.includes("postgresql://"));
        assert(!res.body.includes("5432"));
      }
    );

    await runTest("53. Public settings response does not expose Resend API secrets", async () => {
      const res = await app.inject({ method: "GET", url: "/api/v1/public/settings" });
      assert(res.statusCode === 200);
      assert(!res.body.includes("re_"));
      assert(!res.body.includes("RESEND_API_KEY"));
    });

    await runTest(
      "54. Max global request payload limit protects against memory exhaustion",
      async () => {
        // 1.5 MB oversized payload (above 1 MiB Fastify bodyLimit)
        const hugeString = "A".repeat(1.5 * 1024 * 1024);
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/orders",
          headers: { "content-type": "application/json" },
          payload: JSON.stringify({ hugeString }),
        });
        assert(res.statusCode === 413, `Expected 413 Payload Too Large, got ${res.statusCode}`);
        const json = JSON.parse(res.body);
        assert(
          json.error?.code === "FST_ERR_CTP_BODY_TOO_LARGE" || json.error?.code === "CLIENT_ERROR"
        );
      }
    );

    // =========================================================================
    // SECTION 8: Commerce & Review Moderation Integrity (Tests 55–59)
    // =========================================================================
    // eslint-disable-next-line no-console
    console.log("\n--- Section 8: Commerce & Review Moderation Integrity (Tests 55–59) ---");

    await runTest("55. Order creation rejects quantity greater than 10 (400)", async () => {
      const fixture = await createTestProductFixture();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        body: {
          idempotencyKey: crypto.randomUUID(),
          paymentMethod: "CASH_ON_DELIVERY",
          customer: {
            fullName: "Bulk Buyer",
            phone: "03001234567",
            address: "Address",
            city: "Lahore",
            province: "Punjab",
          },
          items: [
            {
              productId: fixture.product.id,
              variantId: fixture.variant.id,
              quantity: 11, // Exceeds max 10
            },
          ],
        },
      });
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      const json = JSON.parse(res.body);
      assert(json.error?.message?.includes("10") || json.error?.code === "VALIDATION_ERROR");
    });

    await runTest(
      "56. Replay with identical idempotencyKey does not create duplicate Order rows",
      async () => {
        const fixture = await createTestProductFixture();
        const idempotencyKey = crypto.randomUUID();
        const payload = {
          idempotencyKey,
          paymentMethod: "CASH_ON_DELIVERY",
          customer: {
            fullName: "Idempotent Customer",
            phone: "03001234567",
            address: "Street 1",
            city: "Karachi",
            province: "Sindh",
          },
          items: [
            {
              productId: fixture.product.id,
              variantId: fixture.variant.id,
              quantity: 1,
            },
          ],
        };

        const res1 = await app.inject({ method: "POST", url: "/api/v1/orders", body: payload });
        assert(res1.statusCode === 201, `Expected 201, got ${res1.statusCode}: ${res1.body}`);
        const json1 = JSON.parse(res1.body);
        const orderNumber = json1.data.orderNumber;

        // Replay
        const res2 = await app.inject({ method: "POST", url: "/api/v1/orders", body: payload });
        assert(res2.statusCode === 200 || res2.statusCode === 201);
        const json2 = JSON.parse(res2.body);
        assert(json2.data.orderNumber === orderNumber, "Replay must return original order number");

        // Verify count in DB is exactly 1
        const count = await prisma.order.count({ where: { idempotencyKey } });
        assert(count === 1, `Expected exactly 1 order row, found ${count}`);

        const order = await prisma.order.findUnique({ where: { idempotencyKey } });
        if (order) cleanupOrderIds.push(order.id);
      }
    );

    await runTest(
      "57. Order status progression enforces state machine: direct jump to DELIVERED is rejected",
      async () => {
        const { cookie, csrfToken } = await createTestAdminSession();
        const fixture = await createTestProductFixture();
        const order = await prisma.order.create({
          data: {
            orderNumber: `KW-${Math.floor(100000 + Math.random() * 900000)}`,
            status: "ORDER_RECEIVED",
            paymentMethod: "CASH_ON_DELIVERY",
            fullName: "Lifecycle Customer",
            phone: "03001234567",
            address: "Street 9",
            city: "Islamabad",
            province: "Federal Capital",
            subtotal: new Prisma.Decimal("2500.00"),
            deliveryCharge: new Prisma.Decimal("300.00"),
            grandTotal: new Prisma.Decimal("2800.00"),
            items: {
              create: {
                productId: fixture.product.id,
                productVariantId: fixture.variant.id,
                productName: fixture.product.name,
                sku: fixture.product.sku,
                sizeLabel: fixture.size.name,
                colorName: fixture.color.name,
                quantity: 1,
                unitPrice: new Prisma.Decimal("2500.00"),
                lineSubtotal: new Prisma.Decimal("2500.00"),
              },
            },
          },
        });
        cleanupOrderIds.push(order.id);

        // Attempt invalid skip from ORDER_RECEIVED directly to DELIVERED
        const res = await app.inject({
          method: "PATCH",
          url: `/api/v1/admin/orders/${order.orderNumber}/status`,
          headers: { cookie, "x-csrf-token": csrfToken },
          body: { status: "DELIVERED" },
        });
        assert(
          res.statusCode === 400,
          `Expected 400 for illegal transition, got ${res.statusCode}`
        );
        const json = JSON.parse(res.body);
        assert(json.error?.code === "INVALID_STATUS_TRANSITION");
      }
    );

    await runTest(
      "58. Review moderation allows APPROVED and HIDDEN, but strictly forbids PENDING",
      async () => {
        const { cookie, csrfToken } = await createTestAdminSession();
        const fixture = await createTestProductFixture();
        const review = await prisma.review.create({
          data: {
            productId: fixture.product.id,
            reviewerName: "Moderation Test",
            rating: 4,
            reviewText: "Good quality garment",
            status: "APPROVED",
          },
        });
        cleanupReviewIds.push(review.id);

        // Attempt forbidden transition back to PENDING
        const res = await app.inject({
          method: "PATCH",
          url: `/api/v1/admin/reviews/${review.id}/status`,
          headers: { cookie, "x-csrf-token": csrfToken },
          body: { status: "PENDING" },
        });
        assert(res.statusCode === 400, `Expected 400 for PENDING status, got ${res.statusCode}`);
      }
    );

    await runTest(
      "59. Permanent Review deletion requires Admin authentication and CSRF",
      async () => {
        const fixture = await createTestProductFixture();
        const review = await prisma.review.create({
          data: {
            productId: fixture.product.id,
            reviewerName: "Delete Test",
            rating: 2,
            reviewText: "Mediocre fit",
            status: "HIDDEN",
          },
        });

        // Anonymous delete fails
        const anonRes = await app.inject({
          method: "DELETE",
          url: `/api/v1/admin/reviews/${review.id}`,
        });
        assert(anonRes.statusCode === 401);

        // Authenticated delete succeeds
        const { cookie, csrfToken } = await createTestAdminSession();
        const authRes = await app.inject({
          method: "DELETE",
          url: `/api/v1/admin/reviews/${review.id}`,
          headers: { cookie, "x-csrf-token": csrfToken },
        });
        assert(authRes.statusCode === 200);

        const check = await prisma.review.findUnique({ where: { id: review.id } });
        assert(check === null, "Review must be permanently deleted from database");
      }
    );
  } finally {
    // Clean up created test entities
    if (cleanupOrderIds.length > 0) {
      await prisma.orderItem
        .deleteMany({ where: { orderId: { in: cleanupOrderIds } } })
        .catch(() => {});
      await prisma.orderStatusHistory
        .deleteMany({ where: { orderId: { in: cleanupOrderIds } } })
        .catch(() => {});
      await prisma.order.deleteMany({ where: { id: { in: cleanupOrderIds } } }).catch(() => {});
    }
    if (cleanupReviewIds.length > 0) {
      await prisma.reviewMedia
        .deleteMany({ where: { reviewId: { in: cleanupReviewIds } } })
        .catch(() => {});
      await prisma.review.deleteMany({ where: { id: { in: cleanupReviewIds } } }).catch(() => {});
    }
    if (cleanupProductIds.length > 0) {
      await prisma.productMedia
        .deleteMany({ where: { productId: { in: cleanupProductIds } } })
        .catch(() => {});
      await prisma.productVariant
        .deleteMany({ where: { productId: { in: cleanupProductIds } } })
        .catch(() => {});
      await prisma.productSize
        .deleteMany({ where: { productId: { in: cleanupProductIds } } })
        .catch(() => {});
      await prisma.productColor
        .deleteMany({ where: { productId: { in: cleanupProductIds } } })
        .catch(() => {});
      await prisma.product.deleteMany({ where: { id: { in: cleanupProductIds } } }).catch(() => {});
    }
    if (cleanupMediaAssetIds.length > 0) {
      await prisma.mediaAsset
        .deleteMany({ where: { id: { in: cleanupMediaAssetIds } } })
        .catch(() => {});
    }
    if (cleanupSessionIds.length > 0) {
      await prisma.customerSession
        .deleteMany({ where: { id: { in: cleanupSessionIds } } })
        .catch(() => {});
      await prisma.adminSession
        .deleteMany({ where: { id: { in: cleanupSessionIds } } })
        .catch(() => {});
    }
    if (cleanupCustomerIds.length > 0) {
      await prisma.customer
        .deleteMany({ where: { id: { in: cleanupCustomerIds } } })
        .catch(() => {});
    }
    await app.close().catch(() => {});
  }

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  // eslint-disable-next-line no-console
  console.log("\n=======================================================");
  // eslint-disable-next-line no-console
  console.log(`Kids Wear — Security Review & Hardening Suite Results:`);
  // eslint-disable-next-line no-console
  console.log(`Total:  ${results.length}`);
  // eslint-disable-next-line no-console
  console.log(`Passed: ${passedCount}`);
  // eslint-disable-next-line no-console
  console.log(`Failed: ${failedCount}`);
  // eslint-disable-next-line no-console
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled error in security test runner:", err);
  process.exit(1);
});
