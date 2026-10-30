import Fastify, { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { API_V1_PREFIX } from "@kids-wear/shared";
import { env } from "./config/env";
import { registerSecurityPlugins } from "./plugins/security";
import { errorHandler, notFoundHandler } from "./lib/errors";
import { healthRoutes } from "./routes/health";
import { adminAuthRoutes } from "./modules/admin-auth/routes";
import { customerAuthRoutes } from "./modules/customer-auth/routes";
import { customerAccountRoutes } from "./modules/customer-account/routes";
import { publicStorefrontRoutes } from "./modules/storefront/routes";
import { adminStorefrontRoutes } from "./modules/storefront/admin-routes";
import { publicSettingsRoutes } from "./modules/settings/routes";
import { adminSettingsRoutes } from "./modules/settings/admin-routes";
import { adminProductRoutes } from "./modules/product/admin-routes";
import { adminProductOptionRoutes } from "./modules/product/admin-option-routes";
import { adminProductMediaRoutes } from "./modules/product/admin-media-routes";
import { publicCatalogRoutes } from "./modules/product/public-catalog-routes";
import { cartRoutes } from "./modules/cart/routes";
import { checkoutRoutes } from "./modules/checkout/routes";
import { orderRoutes } from "./modules/order/routes";
import { adminOrderRoutes } from "./modules/order/admin-routes";
import { reviewRoutes } from "./modules/review/routes";
import { adminReviewRoutes } from "./modules/review/admin-routes";
import { adminDashboardRoutes } from "./modules/admin-dashboard/routes";

function safeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return "[invalid origin]";
  }
}

/**
 * Builds and configures the Fastify application instance.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 1048576, // 1 MiB global limit for JSON payload protection
    trustProxy: env.TRUST_PROXY,
    requestIdHeader: false,
    genReqId: (request) => {
      const supplied = request.headers["x-request-id"];
      return typeof supplied === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supplied)
        ? supplied
        : randomUUID();
    },
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.headers['x-api-key']",
          "req.headers['x-csrf-token']",
          "*.password",
          "*.passwordHash",
          "*.rawToken",
          "*.tokenHash",
          "*.sessionSecret",
          "*.databaseUrl",
          "*.directUrl",
          "*.cloudinaryApiKey",
          "*.cloudinaryApiSecret",
          "*.api_secret",
          "*.apiSecret",
          "*.api_key",
          "*.apiKey",
          "*.resendApiKey",
          "*.phone",
          "*.address",
        ],
        censor: "[REDACTED]",
      },
    },
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-ID", request.id);
  });
  app.addHook("onResponse", async (request, reply) => {
    request.log.info({
      event: "api_response",
      requestId: request.id,
      method: request.method,
      path: request.url.split("?")[0],
      origin: safeOrigin(request.headers.origin),
      status: reply.statusCode,
      errorCategory: reply.statusCode >= 500 ? "server" : reply.statusCode >= 400 ? "client" : null,
      durationMs: Math.round(reply.elapsedTime),
    }, "API response sent");
  });
  app.addHook("onRequestAbort", async (request) => {
    request.log.warn({
      event: "api_request_aborted",
      requestId: request.id,
      method: request.method,
      path: request.url.split("?")[0],
    }, "API request aborted");
  });
  app.addHook("onTimeout", async (request) => {
    request.log.warn({
      event: "api_request_timeout",
      requestId: request.id,
      method: request.method,
      path: request.url.split("?")[0],
    }, "API request timed out");
  });

  // Centralized Error and Not Found Handlers
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // Security Plugins
  await registerSecurityPlugins(app);

  // API Routes
  await app.register(healthRoutes, { prefix: API_V1_PREFIX });
  await app.register(adminAuthRoutes, { prefix: `${API_V1_PREFIX}/admin/auth` });
  await app.register(customerAuthRoutes, { prefix: `${API_V1_PREFIX}/auth` });
  await app.register(customerAccountRoutes, { prefix: `${API_V1_PREFIX}/account` });
  await app.register(publicStorefrontRoutes, { prefix: `${API_V1_PREFIX}/storefronts` });
  await app.register(adminStorefrontRoutes, { prefix: `${API_V1_PREFIX}/admin/storefronts` });
  await app.register(publicSettingsRoutes, { prefix: `${API_V1_PREFIX}/public/settings` });
  await app.register(adminSettingsRoutes, { prefix: `${API_V1_PREFIX}/admin/settings` });
  await app.register(adminProductRoutes, { prefix: `${API_V1_PREFIX}/admin/products` });
  await app.register(adminProductOptionRoutes, { prefix: `${API_V1_PREFIX}/admin/products` });
  await app.register(adminProductMediaRoutes, { prefix: `${API_V1_PREFIX}/admin/products` });
  await app.register(publicCatalogRoutes, { prefix: `${API_V1_PREFIX}/storefronts` });
  await app.register(cartRoutes, { prefix: `${API_V1_PREFIX}/cart` });
  await app.register(checkoutRoutes, { prefix: `${API_V1_PREFIX}/checkout` });
  await app.register(orderRoutes, { prefix: `${API_V1_PREFIX}/orders` });
  await app.register(adminOrderRoutes, { prefix: `${API_V1_PREFIX}/admin/orders` });
  await app.register(reviewRoutes, { prefix: `${API_V1_PREFIX}/reviews` });
  await app.register(adminReviewRoutes, { prefix: `${API_V1_PREFIX}/admin/reviews` });
  await app.register(adminDashboardRoutes, { prefix: `${API_V1_PREFIX}/admin/dashboard` });

  return app;
}
