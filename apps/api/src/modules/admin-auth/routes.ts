import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { getPrismaClient } from "../../lib/prisma";
import { BadRequestError, UnauthorizedError } from "../../lib/errors";
import {
  normalizeEmail,
  performDummyPasswordVerification,
  verifyPassword,
} from "./services/password";
import {
  clearAdminSessionCookie,
  generateAdminCsrfToken,
  generateRawSessionToken,
  hashSessionToken,
  setAdminSessionCookie,
} from "./services/session";
import { requireAdmin, requireAdminCsrf } from "./guards";
import "./types";

const loginBodySchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const adminAuthRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  const prisma = getPrismaClient();

  // POST /api/v1/admin/auth/login
  app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
          // Strictly enforce login rate limiting without non-production exemptions (except hermetic E2E test runs)
          allowList:
            env.NODE_ENV !== "production" && process.env.E2E_TEST === "true"
              ? ["127.0.0.1", "localhost"]
              : undefined,
        },
      },
    },
    async (request, reply) => {
      // Validate request payload
      const parseResult = loginBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new BadRequestError("Malformed login request", "INVALID_CREDENTIALS");
      }

      const { email, password } = parseResult.data;
      const normalizedEmail = normalizeEmail(email);

      // Query AdminUser
      const admin = await prisma.adminUser.findUnique({
        where: { email: normalizedEmail },
      });

      if (!admin) {
        // Execute dummy verification to prevent timing attack on non-existent accounts
        await performDummyPasswordVerification(password);
        request.log.warn("Admin login failed: unknown account");
        throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
      }

      // Verify Argon2id password hash
      const isValidPassword = await verifyPassword(admin.passwordHash, password);
      if (!isValidPassword) {
        request.log.warn("Admin login failed: invalid password");
        throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
      }

      // Generate cryptographically secure session token (256-bit entropy)
      const rawToken = generateRawSessionToken();
      const tokenHash = hashSessionToken(rawToken);
      const expiresAt = new Date(Date.now() + env.ADMIN_SESSION_TTL_HOURS * 3600 * 1000);

      // Create new session (existing sessions on other devices remain valid)
      await prisma.adminSession.create({
        data: {
          adminUserId: admin.id,
          tokenHash,
          expiresAt,
        },
      });

      // Set HttpOnly, Secure, SameSite-configured session cookie
      setAdminSessionCookie(reply, rawToken);

      request.log.info("Admin login successful");

      return reply.status(200).send({
        success: true,
        data: {
          admin: {
            id: admin.id,
            email: admin.email,
          },
        },
      });
    }
  );

  // GET /api/v1/admin/auth/me
  app.get(
    "/me",
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      return reply.status(200).send({
        success: true,
        data: {
          admin: {
            id: request.admin!.id,
            email: request.admin!.email,
          },
        },
      });
    }
  );

  // GET /api/v1/admin/auth/csrf
  app.get(
    "/csrf",
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      const csrfToken = generateAdminCsrfToken(request.adminSession!.rawToken);
      return reply.status(200).send({
        success: true,
        data: {
          csrfToken,
        },
      });
    }
  );

  // POST /api/v1/admin/auth/logout
  app.post(
    "/logout",
    {
      preHandler: [requireAdmin, requireAdminCsrf],
    },
    async (request, reply) => {
      const sessionId = request.adminSession!.id;

      // Delete the current session from database
      await prisma.adminSession.delete({
        where: { id: sessionId },
      });

      // Clear the session cookie
      clearAdminSessionCookie(reply);

      request.log.info("Admin logged out successfully");

      return reply.status(200).send({
        success: true,
        data: {
          message: "Logged out successfully",
        },
      });
    }
  );
};
