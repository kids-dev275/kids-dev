import type { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { env } from "../config/env";

/**
 * Register core security middleware and headers.
 */
export async function registerSecurityPlugins(app: FastifyInstance): Promise<void> {
  // Secure HTTP Headers
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });

  // CORS configuration-driven by FRONTEND_URL (never wildcard in production)
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) {
        cb(null, true);
        return;
      }

      // Check against configured FRONTEND_URL
      const allowedOrigins = [env.FRONTEND_URL];
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }

      // Allow local development URLs when in development
      if (env.NODE_ENV === "development" && /^http:\/\/localhost:\d+$/.test(origin)) {
        cb(null, true);
        return;
      }

      let rejectedOrigin = "[invalid origin]";
      try {
        rejectedOrigin = new URL(origin).origin;
      } catch {
        // Keep unparseable Origin values out of logs.
      }
      app.log.warn({ event: "cors_origin_rejected", origin: rejectedOrigin }, "CORS origin rejected");
      cb(new Error("CORS policy violation: Origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID"],
  });

  // Rate Limiting (localhost exempt in non-production to allow local test suites to execute without throttling)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    allowList: env.NODE_ENV !== "production" ? ["127.0.0.1", "localhost"] : undefined,
  });

  // Cookie support (prepared for session and CSRF handling in authentication work units)
  await app.register(cookie, {
    secret: env.SESSION_SECRET,
    hook: "onRequest",
  });
}
