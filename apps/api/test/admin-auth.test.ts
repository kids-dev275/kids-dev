import crypto from "node:crypto";
import { buildApp } from "../src/app";
import { getPrismaClient } from "../src/lib/prisma";
import { hashPassword, normalizeEmail } from "../src/modules/admin-auth/services/password";
import {
  generateAdminCsrfToken,
  generateRawSessionToken,
  hashSessionToken,
} from "../src/modules/admin-auth/services/session";
import { env } from "../src/config/env";

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

// Helper to extract cookie value from set-cookie header
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
  console.log("🧪 Running Admin Authentication & Session Security Tests...\n");

  const app = await buildApp();
  const prisma = getPrismaClient();

  // Ensure test admin exists
  let admin = await prisma.adminUser.findUnique({
    where: { email: TEST_ADMIN_EMAIL },
  });

  if (!admin) {
    const passwordHash = await hashPassword(TEST_ADMIN_PASSWORD);
    admin = await prisma.adminUser.create({
      data: {
        email: normalizeEmail(TEST_ADMIN_EMAIL),
        passwordHash,
        singletonKey: 1,
      },
    });
  } else {
    const passwordHash = await hashPassword(TEST_ADMIN_PASSWORD);
    admin = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash },
    });
  }

  // 1. Admin provisioning succeeds when no Admin exists (tested via existence check)
  await runTest("Admin provisioning succeeds when no Admin exists", async () => {
    const count = await prisma.adminUser.count();
    assert(count === 1, `Expected exactly 1 AdminUser, found ${count}`);
    assert(admin !== null && admin.email === TEST_ADMIN_EMAIL, "Admin email mismatch");
  });

  // 2. Second Admin provisioning rejected
  await runTest("Second Admin provisioning rejected", async () => {
    let errorThrown = false;
    try {
      await prisma.adminUser.create({
        data: {
          email: "second.admin@example.com",
          passwordHash: await hashPassword("AnotherPassword123!"),
          singletonKey: 2, // Violates CHECK constraint singletonKey = 1
        },
      });
    } catch {
      errorThrown = true;
    }
    assert(errorThrown, "Database failed to reject second Admin account creation");
  });

  // 3. Correct password login succeeds
  let authCookie: string | null = null;
  await runTest("Correct password login succeeds", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/login",
      payload: {
        email: TEST_ADMIN_EMAIL,
        password: TEST_ADMIN_PASSWORD,
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert(json.success === true, "Response success was false");
    assert(json.data.admin.email === TEST_ADMIN_EMAIL, "Returned email does not match");
    assert(json.data.admin.passwordHash === undefined, "passwordHash must not be exposed");

    authCookie = extractCookie(res.headers["set-cookie"], env.ADMIN_SESSION_COOKIE_NAME);
    assert(authCookie !== null && authCookie.length > 0, "Auth cookie not set in response");
  });

  // 4. Wrong password rejected
  await runTest("Wrong password rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/login",
      payload: {
        email: TEST_ADMIN_EMAIL,
        password: "IncorrectPassword999!",
      },
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.success === false, "Response success was not false");
    assert(
      json.error.code === "INVALID_CREDENTIALS",
      `Expected INVALID_CREDENTIALS, got ${json.error.code}`
    );
    assert(json.error.message === "Invalid email or password", "Mismatch in error message");
  });

  // 5. Unknown email rejected with same generic error
  await runTest("Unknown email rejected with same generic error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/login",
      payload: {
        email: "unknown.account@example.com",
        password: "AnyPassword123!",
      },
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.success === false, "Response success was not false");
    assert(
      json.error.code === "INVALID_CREDENTIALS",
      `Expected INVALID_CREDENTIALS, got ${json.error.code}`
    );
    assert(
      json.error.message === "Invalid email or password",
      "Message reveals account non-existence"
    );
  });

  // 6. Malformed email rejected
  await runTest("Malformed email rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/login",
      payload: {
        email: "not-an-email",
        password: "ValidPassword123!",
      },
    });

    assert(
      res.statusCode === 400 || res.statusCode === 401,
      `Expected 400 or 401, got ${res.statusCode}`
    );
    const json = JSON.parse(res.body);
    assert(json.success === false, "Response should indicate error");
  });

  // 7. Session DB row stores hash, not raw cookie token
  await runTest("Session DB row stores hash, not raw cookie token", async () => {
    assert(authCookie !== null, "Auth cookie is required for this check");
    const rawToken = authCookie;
    const computedHash = hashSessionToken(rawToken);

    // Verify database row exists by tokenHash
    const sessionInDb = await prisma.adminSession.findUnique({
      where: { tokenHash: computedHash },
    });
    assert(sessionInDb !== null, "Session not found in DB by tokenHash");

    // Verify raw token is NOT stored anywhere in the database
    const rawInDb = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "AdminSession" WHERE "tokenHash" = ${rawToken};
    `;
    assert(rawInDb.length === 0, "Security violation: raw session token was stored in database!");
  });

  // 8. Auth cookie set correctly
  await runTest("Auth cookie set correctly", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/login",
      payload: {
        email: TEST_ADMIN_EMAIL,
        password: TEST_ADMIN_PASSWORD,
      },
    });

    const setCookie = res.headers["set-cookie"];
    assert(setCookie !== undefined, "set-cookie header missing");
    const headerStr = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;

    assert(headerStr.includes(env.ADMIN_SESSION_COOKIE_NAME), "Cookie name missing");
    assert(headerStr.includes("HttpOnly"), "HttpOnly flag missing");
    assert(headerStr.includes("Path=/"), "Path=/ missing");
    assert(headerStr.toLowerCase().includes("samesite=lax"), "SameSite=Lax missing");
  });

  // 9. GET /admin/auth/me succeeds with valid session
  await runTest("GET /admin/auth/me succeeds with valid session", async () => {
    assert(authCookie !== null, "Auth cookie missing");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${authCookie}`,
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const json = JSON.parse(res.body);
    assert(json.success === true, "Success was false");
    assert(json.data.admin.id === admin!.id, "Admin ID mismatch");
    assert(json.data.admin.email === TEST_ADMIN_EMAIL, "Admin email mismatch");
    assert(json.data.admin.passwordHash === undefined, "passwordHash leaked in me endpoint");
    assert(json.data.admin.singletonKey === undefined, "singletonKey leaked in me endpoint");
  });

  // 10. GET /admin/auth/me returns 401 without session
  await runTest("GET /admin/auth/me returns 401 without session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.success === false, "Success was true");
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 11. Expired session rejected
  await runTest("Expired session rejected", async () => {
    const expiredRawToken = generateRawSessionToken();
    const expiredHash = hashSessionToken(expiredRawToken);

    // Insert session that expired 1 hour ago
    const expiredSession = await prisma.adminSession.create({
      data: {
        adminUserId: admin!.id,
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 3600 * 1000),
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${expiredRawToken}`,
      },
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      json.error.code === "SESSION_EXPIRED",
      `Expected SESSION_EXPIRED, got ${json.error.code}`
    );

    // Verify expired session was cleaned up
    const exists = await prisma.adminSession.findUnique({
      where: { id: expiredSession.id },
    });
    assert(exists === null, "Expired session was not purged upon rejection");
  });

  // 12. Tampered/unknown session token rejected
  await runTest("Tampered/unknown session token rejected", async () => {
    const fakeToken = crypto.randomBytes(32).toString("hex");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${fakeToken}`,
      },
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${json.error.code}`);
  });

  // 13. CSRF endpoint requires authentication
  await runTest("CSRF endpoint requires authentication", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/csrf",
    });

    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  // 14. Valid CSRF token accepted
  let validCsrfToken = "";
  await runTest("Valid CSRF token accepted", async () => {
    assert(authCookie !== null, "Auth cookie missing");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/csrf",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${authCookie}`,
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(
      typeof json.data.csrfToken === "string" && json.data.csrfToken.length > 0,
      "Invalid CSRF token returned"
    );
    validCsrfToken = json.data.csrfToken;

    // Verify CSRF token matches HMAC of the session
    const expected = generateAdminCsrfToken(authCookie);
    assert(validCsrfToken === expected, "Returned CSRF token does not match HMAC derivation");
  });

  // 15. Missing CSRF token rejected on logout
  await runTest("Missing CSRF token rejected on logout", async () => {
    assert(authCookie !== null, "Auth cookie missing");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/logout",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${authCookie}`,
      },
    });

    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_MISSING", `Expected CSRF_MISSING, got ${json.error.code}`);
  });

  // 16. Invalid CSRF token rejected
  await runTest("Invalid CSRF token rejected", async () => {
    assert(authCookie !== null, "Auth cookie missing");
    const fakeCsrf = crypto.randomBytes(32).toString("hex");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/logout",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${authCookie}`,
        "x-csrf-token": fakeCsrf,
      },
    });

    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    const json = JSON.parse(res.body);
    assert(json.error.code === "CSRF_INVALID", `Expected CSRF_INVALID, got ${json.error.code}`);
  });

  // 17. Logout removes current session
  let logoutResponse: Awaited<ReturnType<typeof app.inject>> | null = null;
  let session2Id = "";
  let device2Token = "";

  await runTest("Logout removes current session", async () => {
    assert(authCookie !== null, "Auth cookie missing");
    const session1Hash = hashSessionToken(authCookie);

    // Create a second session (simulating Admin logged in on a second device)
    device2Token = generateRawSessionToken();
    const device2Hash = hashSessionToken(device2Token);
    const session2 = await prisma.adminSession.create({
      data: {
        adminUserId: admin!.id,
        tokenHash: device2Hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    session2Id = session2.id;

    // Logout session 1 with valid CSRF
    logoutResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/logout",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${authCookie}`,
        "x-csrf-token": validCsrfToken,
      },
    });

    assert(
      logoutResponse.statusCode === 200,
      `Expected 200 on logout, got ${logoutResponse.statusCode}`
    );

    // Verify session 1 is deleted from DB
    const session1Check = await prisma.adminSession.findUnique({
      where: { tokenHash: session1Hash },
    });
    assert(session1Check === null, "Current session was not removed from database");
  });

  // 18. Logout clears cookie
  await runTest("Logout clears cookie", async () => {
    assert(logoutResponse !== null, "Logout response missing");
    const setCookie = logoutResponse.headers["set-cookie"];
    assert(setCookie !== undefined, "Logout must set clearing cookie");
    const headerStr = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    assert(
      headerStr.includes(`${env.ADMIN_SESSION_COOKIE_NAME}=;`) ||
        headerStr.includes("Max-Age=0") ||
        headerStr.includes("Expires="),
      "Cookie not cleared properly"
    );
  });

  // 19. Other Admin sessions survive logout
  await runTest("Other Admin sessions survive logout", async () => {
    assert(session2Id !== "", "Secondary session was not initialized");
    const session2Check = await prisma.adminSession.findUnique({
      where: { id: session2Id },
    });
    assert(session2Check !== null, "Second device session was erroneously deleted");

    const meCheckDevice2 = await app.inject({
      method: "GET",
      url: "/api/v1/admin/auth/me",
      headers: {
        cookie: `${env.ADMIN_SESSION_COOKIE_NAME}=${device2Token}`,
      },
    });
    assert(meCheckDevice2.statusCode === 200, "Second device session failed to authenticate");

    // Cleanup session 2
    await prisma.adminSession.delete({ where: { id: session2Id } });
  });

  // 20. Login rate limiting activates
  await runTest("Login rate limiting activates after 5 requests", async () => {
    const testIp = "192.0.2.99"; // Dedicated IP to avoid polluting other tests
    let hitRateLimit = false;

    // Send 7 successive login requests from the same IP
    for (let i = 1; i <= 7; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/login",
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

    assert(hitRateLimit, "Login endpoint failed to enforce 429 rate limit");
  });

  // Summary
  // eslint-disable-next-line no-console
  console.log("\n==================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  // eslint-disable-next-line no-console
  console.log(`Summary: ${passed}/${total} Admin Authentication Tests Passed.`);
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
