import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.FRONTEND_URL = "https://kids-wear-staging.vercel.app";

async function run(): Promise<void> {
  const [{ buildApp }, { AppError, BadRequestError, ConflictError, ForbiddenError }] = await Promise.all([
    import("../src/app"),
    import("../src/lib/errors"),
  ]);
  const app = await buildApp();
  const origin = process.env.FRONTEND_URL!;
  app.get("/__diagnostics/400", async () => { throw new BadRequestError(); });
  app.get("/__diagnostics/403", async () => { throw new ForbiddenError(); });
  app.get("/__diagnostics/409", async () => { throw new ConflictError(); });
  app.get("/__diagnostics/500", async () => { throw new Error("test failure"); });
  app.get("/__diagnostics/503", async () => { throw new AppError(503, "SERVICE_UNAVAILABLE", "Unavailable"); });
  app.get("/__diagnostics/201", async (_request, reply) => { reply.status(201).send({ success: true, data: {} }); });
  app.get("/__diagnostics/429", { config: { rateLimit: { max: 1, timeWindow: "1 minute" } } }, async () => ({ success: true }));

  try {
    const suppliedId = randomUUID();
    const success = await app.inject({ method: "GET", url: "/api/v1/health", headers: { origin, "x-request-id": suppliedId } });
    assert.equal(success.statusCode, 200);
    assert.equal(success.headers["x-request-id"], suppliedId);
    assert.equal(success.headers["access-control-allow-origin"], origin);
    assert.equal(success.headers["access-control-allow-credentials"], "true");
    assert.match(String(success.headers["access-control-expose-headers"]), /X-Request-ID/i);
    console.log("PASS: canonical origin and client request ID on success");

    const preflight = await app.inject({ method: "OPTIONS", url: "/api/v1/admin/auth/login", headers: {
      origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,x-csrf-token,x-request-id",
    } });
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], origin);
    assert.match(String(preflight.headers["access-control-allow-headers"]), /X-Request-ID/i);
    assert.match(String(preflight.headers["x-request-id"]), /^[0-9a-f-]{36}$/i);
    console.log("PASS: login preflight permits content, CSRF, and request ID headers");

    const rejected = await app.inject({ method: "GET", url: "/api/v1/health", headers: { origin: "https://attacker.example" } });
    assert.equal(rejected.headers["access-control-allow-origin"], undefined);
    console.log("PASS: unauthorized origin is rejected");

    const statuses = [
      [201, "/__diagnostics/201"],
      [400, "/__diagnostics/400"],
      [401, "/api/v1/admin/auth/me"],
      [403, "/__diagnostics/403"],
      [404, "/__diagnostics/missing"],
      [409, "/__diagnostics/409"],
      [500, "/__diagnostics/500"],
      [503, "/__diagnostics/503"],
    ] as const;
    for (const [status, url] of statuses) {
      const response = await app.inject({ method: "GET", url, headers: { origin, "x-request-id": "invalid-id" } });
      assert.equal(response.statusCode, status, url);
      assert.equal(response.headers["access-control-allow-origin"], origin, url);
      assert.equal(response.headers["access-control-allow-credentials"], "true", url);
      assert.match(String(response.headers["x-request-id"]), /^[0-9a-f-]{36}$/i, url);
      assert.notEqual(response.headers["x-request-id"], "invalid-id", url);
    }
    console.log("PASS: CORS and generated request ID on 201/400/401/403/404/409/500/503");

    await app.inject({ method: "GET", url: "/__diagnostics/429", remoteAddress: "203.0.113.10", headers: { origin } });
    const limited = await app.inject({ method: "GET", url: "/__diagnostics/429", remoteAddress: "203.0.113.10", headers: { origin } });
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers["access-control-allow-origin"], origin);
    assert.match(String(limited.headers["x-request-id"]), /^[0-9a-f-]{36}$/i);
    console.log("PASS: rate limit response retains CORS and request ID");

    const loginError = await app.inject({ method: "POST", url: "/api/v1/admin/auth/login", headers: { origin, "content-type": "application/json" }, payload: {} });
    assert.equal(loginError.statusCode, 400);
    assert.equal(loginError.headers["access-control-allow-origin"], origin);
    assert.equal(loginError.json().success, false);
    console.log("PASS: Admin login validation error remains readable");
  } finally {
    await app.close();
  }
}

void run().catch((error) => { console.error(error); process.exitCode = 1; });
