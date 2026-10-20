import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { getPrismaClient } from "../../lib/prisma";
import { BadRequestError, ConflictError, UnauthorizedError } from "../../lib/errors";
import {
  hashPassword,
  normalizeEmail,
  performDummyPasswordVerification,
  verifyPassword,
} from "../admin-auth/services/password";
import {
  clearCustomerSessionCookie,
  generateCustomerCsrfToken,
  generateRawCustomerSessionToken,
  hashCustomerSessionToken,
  setCustomerSessionCookie,
} from "./services/session";
import { requireCustomer, requireCustomerCsrf } from "./guards";
import "./types";

const registerBodySchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required").max(100, "Full name is too long"),
    email: z.string().trim().email("Invalid email format"),
    phone: z
      .string()
      .trim()
      .min(7, "Phone number is too short")
      .max(20, "Phone number is too long")
      .optional()
      .nullable(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(128, "Password must not exceed 128 characters"),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.confirmPassword !== undefined && data.confirmPassword !== data.password) {
        return false;
      }
      return true;
    },
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }
  );

const loginBodySchema = z.object({
  email: z.string().trim().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const customerAuthRoutes: FastifyPluginAsync = async (
  app: FastifyInstance
): Promise<void> => {
  const prisma = getPrismaClient();

  // POST /api/v1/auth/register
  app.post(
    "/register",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
          allowList:
            env.NODE_ENV !== "production" && process.env.E2E_TEST === "true"
              ? ["127.0.0.1", "localhost"]
              : undefined,
        },
      },
    },
    async (request, reply) => {
      const parseResult = registerBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstError = parseResult.error.errors[0]?.message || "Invalid registration data";
        throw new BadRequestError(firstError, "VALIDATION_ERROR");
      }

      const { fullName, email, phone, password } = parseResult.data;
      const normalizedEmail = normalizeEmail(email);

      // Check for duplicate normalized email
      const existing = await prisma.customer.findUnique({
        where: { email: normalizedEmail },
      });

      if (existing) {
        throw new ConflictError("An account with this email already exists", "EMAIL_EXISTS");
      }

      // Hash password using Argon2id
      const passwordHash = await hashPassword(password);

      // Create new active Customer record
      const customer = await prisma.customer.create({
        data: {
          fullName: fullName.trim(),
          email: normalizedEmail,
          phone: phone ? phone.trim() : null,
          passwordHash,
          isActive: true,
        },
      });

      // Generate 256-bit cryptographically random session token
      const rawToken = generateRawCustomerSessionToken();
      const tokenHash = hashCustomerSessionToken(rawToken);
      const expiresAt = new Date(Date.now() + env.CUSTOMER_SESSION_TTL_HOURS * 3600 * 1000);

      // Create CustomerSession in database
      await prisma.customerSession.create({
        data: {
          customerId: customer.id,
          tokenHash,
          expiresAt,
        },
      });

      // Issue HttpOnly customer session cookie
      setCustomerSessionCookie(reply, rawToken);

      request.log.info("Customer registered successfully");

      return reply.status(201).send({
        success: true,
        data: {
          customer: {
            id: customer.id,
            fullName: customer.fullName,
            email: customer.email,
            phone: customer.phone,
          },
        },
      });
    }
  );

  // POST /api/v1/auth/login
  app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
          allowList:
            env.NODE_ENV !== "production" && process.env.E2E_TEST === "true"
              ? ["127.0.0.1", "localhost"]
              : undefined,
        },
      },
    },
    async (request, reply) => {
      const parseResult = loginBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new BadRequestError("Malformed login request", "INVALID_CREDENTIALS");
      }

      const { email, password } = parseResult.data;
      const normalizedEmail = normalizeEmail(email);

      const customer = await prisma.customer.findUnique({
        where: { email: normalizedEmail },
      });

      // Reject non-existent accounts or inactive customers using timing-safe dummy verification
      if (!customer || !customer.isActive) {
        await performDummyPasswordVerification(password);
        request.log.warn("Customer login failed: unknown or inactive account");
        throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
      }

      const isValidPassword = await verifyPassword(customer.passwordHash, password);
      if (!isValidPassword) {
        request.log.warn("Customer login failed: invalid password");
        throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
      }

      // Generate and store session
      const rawToken = generateRawCustomerSessionToken();
      const tokenHash = hashCustomerSessionToken(rawToken);
      const expiresAt = new Date(Date.now() + env.CUSTOMER_SESSION_TTL_HOURS * 3600 * 1000);

      await prisma.customerSession.create({
        data: {
          customerId: customer.id,
          tokenHash,
          expiresAt,
        },
      });

      setCustomerSessionCookie(reply, rawToken);

      request.log.info("Customer login successful");

      return reply.status(200).send({
        success: true,
        data: {
          customer: {
            id: customer.id,
            fullName: customer.fullName,
            email: customer.email,
            phone: customer.phone,
          },
        },
      });
    }
  );

  // GET /api/v1/auth/me
  app.get(
    "/me",
    {
      preHandler: [requireCustomer],
    },
    async (request, reply) => {
      return reply.status(200).send({
        success: true,
        data: {
          customer: {
            id: request.customer!.id,
            fullName: request.customer!.fullName,
            email: request.customer!.email,
            phone: request.customer!.phone,
          },
        },
      });
    }
  );

  // GET /api/v1/auth/csrf
  app.get(
    "/csrf",
    {
      preHandler: [requireCustomer],
    },
    async (request, reply) => {
      const csrfToken = generateCustomerCsrfToken(request.customerSession!.rawToken);
      return reply.status(200).send({
        success: true,
        data: {
          csrfToken,
        },
      });
    }
  );

  // POST /api/v1/auth/logout
  app.post(
    "/logout",
    {
      preHandler: [requireCustomer, requireCustomerCsrf],
    },
    async (request, reply) => {
      const sessionId = request.customerSession!.id;

      // Delete current customer session from database
      await prisma.customerSession.delete({
        where: { id: sessionId },
      });

      // Clear the customer session cookie
      clearCustomerSessionCookie(reply);

      request.log.info("Customer logged out successfully");

      return reply.status(200).send({
        success: true,
        data: {
          message: "Logged out successfully",
        },
      });
    }
  );
};
