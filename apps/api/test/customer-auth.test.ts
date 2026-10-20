import crypto from "node:crypto";
import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import { hashPassword, normalizeEmail } from "../src/modules/admin-auth/services/password";
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

async function runSuite(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("🧪 Running Customer Authentication & Profile Tests...\n");

  const app = await buildApp();
  const prisma = getPrismaClient();

  const testCustomerEmail = "test.customer@example.com";
  const testCustomerPassword = "CustomerSecurePassword123!";
  let testCustomerId = "";
  let customerCookie: string | null = null;
  let customerCsrfToken = "";

  // Clean up any existing test customers from prior aborted runs
  const existingTestCustomers = await prisma.customer.findMany({
    where: {
      email: {
        in: [
          testCustomerEmail,
          "other.customer@example.com",
          "inactive.customer@example.com",
          "new.email@example.com",
        ],
      },
    },
  });
  for (const c of existingTestCustomers) {
    await prisma.customerSession.deleteMany({ where: { customerId: c.id } });
    await prisma.customer.delete({ where: { id: c.id } });
  }

  // 1. registration succeeds
  await runTest("registration succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        fullName: "Test Customer",
        email: testCustomerEmail,
        phone: "+923001234567",
        password: testCustomerPassword,
        confirmPassword: testCustomerPassword,
      },
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert(json.success === true, "Response was not successful");
    assert(json.data.customer.email === testCustomerEmail, "Customer email mismatch");
    assert(json.data.customer.fullName === "Test Customer", "Customer name mismatch");
    assert(json.data.customer.phone === "+923001234567", "Customer phone mismatch");
    assert(json.data.customer.passwordHash === undefined, "passwordHash must not be exposed");

    testCustomerId = json.data.customer.id;
    customerCookie = extractCookie(res.headers["set-cookie"], env.CUSTOMER_SESSION_COOKIE_NAME);
  });

  // 2. registered password stored as Argon2id hash
  await runTest("registered password stored as Argon2id hash", async () => {
    const customer = await prisma.customer.findUnique({
      where: { id: testCustomerId },
    });
    assert(customer !== null, "Customer not found in DB");
    assert(customer.passwordHash.startsWith("$argon2id$"), "Password not hashed with Argon2id");
    assert(!customer.passwordHash.includes(testCustomerPassword), "Plaintext password detected");
  });

  // 3. registration creates CustomerSession
  await runTest("registration creates CustomerSession", async () => {
    assert(customerCookie !== null, "Customer cookie was not issued");
    const tokenHash = hashCustomerSessionToken(customerCookie);
    const session = await prisma.customerSession.findUnique({
      where: { tokenHash },
    });
    assert(session !== null, "CustomerSession was not found in DB");
    assert(session.customerId === testCustomerId, "Session customerId mismatch");
  });

  // 4. registration sets customer HttpOnly cookie
  await runTest("registration sets customer HttpOnly cookie", async () => {
    assert(customerCookie !== null, "Customer cookie not set");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testCustomerEmail,
        password: testCustomerPassword,
      },
    });
    const setCookie = res.headers["set-cookie"];
    const headerStr = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie);
    assert(headerStr.includes(env.CUSTOMER_SESSION_COOKIE_NAME), "Missing customer cookie name");
    assert(headerStr.includes("HttpOnly"), "Missing HttpOnly");
    assert(headerStr.includes("Path=/"), "Missing Path=/");
  });

  // 5. duplicate normalized email rejected
  await runTest("duplicate normalized email rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        fullName: "Duplicate User",
        email: `  ${testCustomerEmail.toUpperCase()}  `,
        password: "AnotherPassword123!",
      },
    });

    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "EMAIL_EXISTS", `Expected EMAIL_EXISTS, got ${json.error.code}`);
  });

  // 6. customer login succeeds
  await runTest("customer login succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testCustomerEmail,
        password: testCustomerPassword,
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.customer.email === testCustomerEmail, "Email mismatch");
    customerCookie = extractCookie(res.headers["set-cookie"], env.CUSTOMER_SESSION_COOKIE_NAME);
    assert(customerCookie !== null, "Login failed to return session cookie");
  });

  // 7. wrong password rejected
  await runTest("wrong password rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testCustomerEmail,
        password: "WrongPassword999!",
      },
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "INVALID_CREDENTIALS",
      `Expected INVALID_CREDENTIALS, got ${json.error.code}`
    );
  });

  // 8. unknown email returns same generic login error
  await runTest("unknown email returns same generic login error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "nonexistent.customer@example.com",
        password: "AnyPassword123!",
      },
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "INVALID_CREDENTIALS",
      `Expected INVALID_CREDENTIALS, got ${json.error.code}`
    );
    assert(json.error.message === "Invalid email or password", "Mismatch in error message");
  });

  // 9. inactive customer cannot login
  await runTest("inactive customer cannot login", async () => {
    const inactivePasswordHash = await hashPassword("InactivePassword123!");
    const inactiveCustomer = await prisma.customer.create({
      data: {
        fullName: "Inactive User",
        email: "inactive.customer@example.com",
        passwordHash: inactivePasswordHash,
        isActive: false,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "inactive.customer@example.com",
        password: "InactivePassword123!",
      },
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "INVALID_CREDENTIALS",
      `Expected INVALID_CREDENTIALS, got ${json.error.code}`
    );

    await prisma.customer.delete({ where: { id: inactiveCustomer.id } });
  });

  // 10. malformed registration rejected
  await runTest("malformed registration rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        fullName: "",
        email: "invalid-email",
        password: "short",
      },
    });

    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
  });

  // 11. /auth/me succeeds with valid Customer session
  await runTest("/auth/me succeeds with valid Customer session", async () => {
    assert(customerCookie !== null, "Customer cookie missing");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${customerCookie}`,
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.customer.id === testCustomerId, "Customer ID mismatch");
    assert(json.data.customer.email === testCustomerEmail, "Customer email mismatch");
  });

  // 12. /auth/me returns 401 without session
  await runTest("/auth/me returns 401 without session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  // 13. expired Customer session rejected/purged
  await runTest("expired Customer session rejected/purged", async () => {
    const expiredRawToken = generateRawCustomerSessionToken();
    const expiredHash = hashCustomerSessionToken(expiredRawToken);

    const expiredSession = await prisma.customerSession.create({
      data: {
        customerId: testCustomerId,
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 3600 * 1000),
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${expiredRawToken}`,
      },
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "SESSION_EXPIRED",
      `Expected SESSION_EXPIRED, got ${json.error.code}`
    );

    const inDb = await prisma.customerSession.findUnique({
      where: { id: expiredSession.id },
    });
    assert(inDb === null, "Expired session was not purged from DB");
  });

  // 14. tampered token rejected
  await runTest("tampered token rejected", async () => {
    const fakeToken = crypto.randomBytes(32).toString("hex");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${fakeToken}`,
      },
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  // 15. CSRF endpoint requires auth
  await runTest("CSRF endpoint requires auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf",
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  // 16. valid Customer CSRF accepted
  await runTest("valid Customer CSRF accepted", async () => {
    assert(customerCookie !== null, "Customer cookie missing");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${customerCookie}`,
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    customerCsrfToken = json.data.csrfToken;
    assert(
      typeof customerCsrfToken === "string" && customerCsrfToken.length > 0,
      "CSRF token empty"
    );

    const expected = generateCustomerCsrfToken(customerCookie);
    assert(customerCsrfToken === expected, "Derived CSRF token does not match customer HMAC");
  });

  // 17. missing CSRF rejected on profile PATCH
  await runTest("missing CSRF rejected on profile PATCH", async () => {
    assert(customerCookie !== null, "Customer cookie missing");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/account/profile",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${customerCookie}`,
      },
      payload: {
        fullName: "Should Fail",
      },
    });

    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_MISSING", `Expected CSRF_MISSING, got ${json.error.code}`);
  });

  // 18. invalid CSRF rejected
  await runTest("invalid CSRF rejected", async () => {
    assert(customerCookie !== null, "Customer cookie missing");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/account/profile",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${customerCookie}`,
        "x-csrf-token": crypto.randomBytes(32).toString("hex"),
      },
      payload: {
        fullName: "Should Fail",
      },
    });

    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_INVALID", `Expected CSRF_INVALID, got ${json.error.code}`);
  });

  // 19. profile GET succeeds
  await runTest("profile GET succeeds", async () => {
    assert(customerCookie !== null, "Customer cookie missing");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/account/profile",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${customerCookie}`,
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.customer.email === testCustomerEmail, "Email mismatch in profile");
  });

  // 20. fullName profile update succeeds
  await runTest("fullName profile update succeeds", async () => {
    assert(customerCookie !== null, "Customer cookie missing");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/account/profile",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${customerCookie}`,
        "x-csrf-token": customerCsrfToken,
      },
      payload: {
        fullName: "Updated Full Name",
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.customer.fullName === "Updated Full Name", "Full name was not updated");

    const inDb = await prisma.customer.findUnique({ where: { id: testCustomerId } });
    assert(inDb?.fullName === "Updated Full Name", "Database does not reflect name update");
  });

  // 21. phone profile update succeeds
  await runTest("phone profile update succeeds", async () => {
    assert(customerCookie !== null, "Customer cookie missing");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/account/profile",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${customerCookie}`,
        "x-csrf-token": customerCsrfToken,
      },
      payload: {
        phone: "+923339998877",
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.customer.phone === "+923339998877", "Phone was not updated");
  });

  // 22. email update succeeds
  const updatedEmail = "new.email@example.com";
  await runTest("email update succeeds", async () => {
    assert(customerCookie !== null, "Customer cookie missing");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/account/profile",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${customerCookie}`,
        "x-csrf-token": customerCsrfToken,
      },
      payload: {
        email: updatedEmail,
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.data.customer.email === updatedEmail, "Email was not updated");
  });

  // 23. duplicate email update rejected
  await runTest("duplicate email update rejected", async () => {
    assert(customerCookie !== null, "Customer cookie missing");
    // Create another customer
    const otherCustomer = await prisma.customer.create({
      data: {
        fullName: "Other Customer",
        email: "other.customer@example.com",
        passwordHash: await hashPassword("OtherPassword123!"),
      },
    });

    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/account/profile",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${customerCookie}`,
        "x-csrf-token": customerCsrfToken,
      },
      payload: {
        email: "other.customer@example.com",
      },
    });

    assert(res.statusCode === 409, `Expected 409, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "EMAIL_EXISTS", `Expected EMAIL_EXISTS, got ${json.error.code}`);

    await prisma.customer.delete({ where: { id: otherCustomer.id } });
  });

  // 24. protected fields cannot be modified
  await runTest("protected fields cannot be modified", async () => {
    assert(customerCookie !== null, "Customer cookie missing");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/account/profile",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${customerCookie}`,
        "x-csrf-token": customerCsrfToken,
      },
      payload: {
        id: "malicious-id",
        passwordHash: "malicious-hash",
        isActive: false,
      },
    });

    // Zod strict validation rejects unknown fields with 400
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    const inDb = await prisma.customer.findUnique({ where: { id: testCustomerId } });
    assert(inDb?.id === testCustomerId, "Customer ID was corrupted");
    assert(inDb?.isActive === true, "Customer active status was modified");
  });

  // 25. logout removes current Customer session
  let secondSessionToken = "";
  let secondSessionId = "";
  await runTest("logout removes current Customer session", async () => {
    assert(customerCookie !== null, "Customer cookie missing");
    const session1Hash = hashCustomerSessionToken(customerCookie);

    // Create a second session (simulating second device)
    secondSessionToken = generateRawCustomerSessionToken();
    const secondSessionHash = hashCustomerSessionToken(secondSessionToken);
    const session2 = await prisma.customerSession.create({
      data: {
        customerId: testCustomerId,
        tokenHash: secondSessionHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
    secondSessionId = session2.id;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${customerCookie}`,
        "x-csrf-token": customerCsrfToken,
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);

    const inDb = await prisma.customerSession.findUnique({
      where: { tokenHash: session1Hash },
    });
    assert(inDb === null, "Session 1 was not removed from DB");
  });

  // 26. logout clears Customer cookie
  await runTest("logout clears Customer cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${secondSessionToken}`,
        "x-csrf-token": generateCustomerCsrfToken(secondSessionToken),
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const setCookie = res.headers["set-cookie"];
    const headerStr = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie);
    assert(
      headerStr.includes(`${env.CUSTOMER_SESSION_COOKIE_NAME}=;`) ||
        headerStr.includes("Max-Age=0") ||
        headerStr.includes("Expires="),
      "Customer cookie was not cleared"
    );
  });

  // 27. other Customer sessions survive logout
  await runTest("other Customer sessions survive logout", async () => {
    // Recreate 2 sessions
    const tokenA = generateRawCustomerSessionToken();
    const tokenB = generateRawCustomerSessionToken();

    const sessA = await prisma.customerSession.create({
      data: {
        customerId: testCustomerId,
        tokenHash: hashCustomerSessionToken(tokenA),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    const sessB = await prisma.customerSession.create({
      data: {
        customerId: testCustomerId,
        tokenHash: hashCustomerSessionToken(tokenB),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    // Logout session A
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${tokenA}`,
        "x-csrf-token": generateCustomerCsrfToken(tokenA),
      },
    });

    // Verify session A deleted
    const checkA = await prisma.customerSession.findUnique({ where: { id: sessA.id } });
    assert(checkA === null, "Session A should be deleted");

    // Verify session B still exists and can authenticate
    const checkB = await prisma.customerSession.findUnique({ where: { id: sessB.id } });
    assert(checkB !== null, "Session B should survive");

    const meB = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${tokenB}`,
      },
    });
    assert(meB.statusCode === 200, "Session B failed to authenticate");

    await prisma.customerSession.delete({ where: { id: sessB.id } });
  });

  // 28. customer login rate limit activates
  await runTest("customer login rate limit activates", async () => {
    const testIp = "192.0.2.111";
    let hitRateLimit = false;

    for (let i = 1; i <= 7; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: testIp,
        payload: {
          email: "rate.limit.test@example.com",
          password: "SomePassword123!",
        },
      });

      if (res.statusCode === 429) {
        hitRateLimit = true;
        const json = JSON.parse(res.body);
        assert(
          json.error.code === "RATE_LIMIT_EXCEEDED",
          `Expected RATE_LIMIT_EXCEEDED, got ${json.error.code}`
        );
        break;
      }
    }

    assert(hitRateLimit, "Customer login endpoint failed to enforce 429 rate limit");
  });

  // 29. registration rate limit activates
  await runTest("registration rate limit activates", async () => {
    const testIp = "192.0.2.112";
    let hitRateLimit = false;

    for (let i = 1; i <= 7; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        remoteAddress: testIp,
        payload: {
          fullName: "Rate Tester",
          email: `rate.reg.${i}@example.com`,
          password: "Password123!",
        },
      });

      if (res.statusCode === 429) {
        hitRateLimit = true;
        const json = JSON.parse(res.body);
        assert(
          json.error.code === "RATE_LIMIT_EXCEEDED",
          `Expected RATE_LIMIT_EXCEEDED, got ${json.error.code}`
        );
        break;
      }
    }

    assert(hitRateLimit, "Registration endpoint failed to enforce 429 rate limit");
  });

  // Setup Admin and Customer sessions for boundary isolation tests
  const adminUser = await prisma.adminUser.findFirstOrThrow();
  const adminRawToken = generateAdminRawToken();
  const adminSession = await prisma.adminSession.create({
    data: {
      adminUserId: adminUser.id,
      tokenHash: hashAdminToken(adminRawToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  const custRawToken = generateRawCustomerSessionToken();
  const custSession = await prisma.customerSession.create({
    data: {
      customerId: testCustomerId,
      tokenHash: hashCustomerSessionToken(custRawToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  // 30. customer cookie cannot authenticate Admin
  await runTest("customer cookie cannot authenticate Admin", async () => {
    // Attempt accessing Admin /me using customer cookie
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${custRawToken}`,
      },
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);

    // Attempt accessing Admin /me passing customer token in kw_admin_session
    const res2 = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${custRawToken}`,
      },
    });
    assert(res2.statusCode === 401, `Expected 401, got ${res2.statusCode}`);
  });

  // 31. Admin cookie cannot authenticate Customer
  await runTest("Admin cookie cannot authenticate Customer", async () => {
    // Attempt accessing Customer /me using Admin cookie
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${adminRawToken}`,
      },
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);

    // Attempt accessing Customer /me passing admin token in kw_customer_session
    const res2 = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${adminRawToken}`,
      },
    });
    assert(res2.statusCode === 401, `Expected 401, got ${res2.statusCode}`);
  });

  // 32. Customer and Admin sessions may coexist
  await runTest("Customer and Admin sessions may coexist", async () => {
    const dualCookieHeader = `${env.ADMIN_SESSION_COOKIE_NAME}=${adminRawToken}; ${env.CUSTOMER_SESSION_COOKIE_NAME}=${custRawToken}`;

    // Admin endpoint recognizes admin
    const adminRes = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
      headers: { cookie: dualCookieHeader },
    });
    assert(adminRes.statusCode === 200, `Admin check failed: ${adminRes.statusCode}`);
    const adminJson = JSON.parse(adminRes.body);
    assert(adminJson.data.admin.id === adminUser.id, "Admin ID mismatch");

    // Customer endpoint recognizes customer
    const custRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: dualCookieHeader },
    });
    assert(custRes.statusCode === 200, `Customer check failed: ${custRes.statusCode}`);
    const custJson = JSON.parse(custRes.body);
    assert(custJson.data.customer.id === testCustomerId, "Customer ID mismatch");
  });

  // 33. Customer CSRF rejected on Admin route
  await runTest("Customer CSRF rejected on Admin route", async () => {
    const adminCsrfToken = generateAdminCsrfToken(adminRawToken);
    const customerCsrf = generateCustomerCsrfToken(custRawToken);
    assert(adminCsrfToken !== customerCsrf, "CSRF tokens should be domain-separated");

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/logout",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${adminRawToken}`,
        "x-csrf-token": customerCsrf,
      },
    });

    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_INVALID", `Expected CSRF_INVALID, got ${json.error.code}`);
  });

  // 34. Admin CSRF rejected on Customer route
  await runTest("Admin CSRF rejected on Customer route", async () => {
    const adminCsrfToken = generateAdminCsrfToken(adminRawToken);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${custRawToken}`,
        "x-csrf-token": adminCsrfToken,
      },
    });

    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_INVALID", `Expected CSRF_INVALID, got ${json.error.code}`);
  });

  // 35. Admin logout preserves Customer session
  await runTest("Admin logout preserves Customer session", async () => {
    // 1. Authenticate Admin
    const preAdmin = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
      headers: { cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${adminRawToken}` },
    });
    assert(preAdmin.statusCode === 200, "Pre-check Admin authentication failed");

    // 2. Authenticate Customer
    const preCust = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${custRawToken}` },
    });
    assert(preCust.statusCode === 200, "Pre-check Customer authentication failed");

    // 3. Logout Admin correctly
    const adminLogoutRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/logout",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${adminRawToken}`,
        "x-csrf-token": generateAdminCsrfToken(adminRawToken),
      },
    });
    assert(adminLogoutRes.statusCode === 200, "Admin logout failed");

    // 4. Verify Admin session is removed
    const postAdmin = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
      headers: { cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${adminRawToken}` },
    });
    assert(postAdmin.statusCode === 401, "Admin session should be rejected after logout");

    // 5. Verify Customer session is STILL valid
    const postCust = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${custRawToken}` },
    });
    assert(postCust.statusCode === 200, "Customer session failed after Admin logout");
    const custProfile = await app.inject({
      method: "GET",
      url: "/api/v1/account/profile",
      headers: { cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${custRawToken}` },
    });
    assert(custProfile.statusCode === 200, "Customer profile failed after Admin logout");
  });

  // 36. customer logout leaves Admin session intact
  await runTest("customer logout leaves Admin session intact", async () => {
    // Re-create a fresh Admin session for this test
    const freshAdminToken = generateAdminRawToken();
    const freshAdminSession = await prisma.adminSession.create({
      data: {
        adminUserId: adminUser.id,
        tokenHash: hashAdminToken(freshAdminToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    // Customer logs out
    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${custRawToken}`,
        "x-csrf-token": generateCustomerCsrfToken(custRawToken),
      },
    });
    assert(logoutRes.statusCode === 200, `Customer logout failed: ${logoutRes.statusCode}`);

    // Verify Customer session was deleted
    const custSessionCheck = await prisma.customerSession.findUnique({
      where: { id: custSession.id },
    });
    assert(custSessionCheck === null, "Customer session should be deleted");

    // Verify Admin session STILL EXISTS and still authenticates successfully
    const adminSessionCheck = await prisma.adminSession.findUnique({
      where: { id: freshAdminSession.id },
    });
    assert(adminSessionCheck !== null, "Admin session was erroneously deleted on customer logout");

    const adminMe = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${freshAdminToken}`,
      },
    });
    assert(adminMe.statusCode === 200, "Admin session failed after customer logout");

    // Clean up fresh admin session
    await prisma.adminSession.delete({ where: { id: freshAdminSession.id } });
  });

  // 37. Deactivated Customer existing session rejected
  await runTest("Deactivated Customer existing session rejected", async () => {
    // 1. Create a fresh active customer with an active session
    const deactEmail = "deact.test@example.com";
    const deactCustomer = await prisma.customer.create({
      data: {
        fullName: "Deactivation Tester",
        email: deactEmail,
        passwordHash: await hashPassword("Password123!"),
        isActive: true,
      },
    });

    const deactRawToken = generateRawCustomerSessionToken();
    const deactTokenHash = hashCustomerSessionToken(deactRawToken);
    const deactSession = await prisma.customerSession.create({
      data: {
        customerId: deactCustomer.id,
        tokenHash: deactTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    // 2. Confirm valid session works
    const preCheck = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${deactRawToken}` },
    });
    assert(preCheck.statusCode === 200, "Active customer pre-check failed");

    // 3. Set Customer.isActive = false directly through database setup
    await prisma.customer.update({
      where: { id: deactCustomer.id },
      data: { isActive: false },
    });

    // 4. Reuse previously valid Customer cookie
    const postCheck = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: `${env.CUSTOMER_SESSION_COOKIE_NAME}=${deactRawToken}` },
    });
    assert(
      postCheck.statusCode === 401,
      `Expected 401 for deactivated customer, got ${postCheck.statusCode}`
    );

    // Verify session was revoked/purged from database
    const sessionInDb = await prisma.customerSession.findUnique({
      where: { id: deactSession.id },
    });
    assert(sessionInDb === null, "Session of deactivated customer was not revoked from database");

    // Cleanup
    await prisma.customer.delete({ where: { id: deactCustomer.id } });
  });

  // Final Cleanup
  await prisma.customerSession.deleteMany({ where: { customerId: testCustomerId } });
  await prisma.customer.deleteMany({ where: { id: testCustomerId } });

  // Summary
  // eslint-disable-next-line no-console
  console.log("\n==================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  // eslint-disable-next-line no-console
  console.log(`Summary: ${passed}/${total} Customer Authentication & Profile Tests Passed.`);
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
