import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env";
import { getPrismaClient } from "../../lib/prisma";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors";
import { hashCustomerSessionToken, verifyCustomerCsrfToken } from "./services/session";
import "./types";

/**
 * Reusable Fastify preHandler guard ensuring a valid, unexpired Customer session exists.
 * Verifies session against the database via SHA-256 token hash and attaches safe customer identity.
 * Completely isolated from Admin authentication.
 */
export async function requireCustomer(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const rawToken = request.cookies[env.CUSTOMER_SESSION_COOKIE_NAME];
  if (!rawToken) {
    throw new UnauthorizedError("Authentication required", "UNAUTHORIZED");
  }

  const tokenHash = hashCustomerSessionToken(rawToken);
  const prisma = getPrismaClient();

  const session = await prisma.customerSession.findUnique({
    where: { tokenHash },
    include: { customer: true },
  });

  if (!session) {
    throw new UnauthorizedError("Invalid or expired session", "UNAUTHORIZED");
  }

  // Check session expiration
  if (session.expiresAt <= new Date()) {
    await prisma.customerSession.delete({ where: { id: session.id } }).catch(() => {});
    throw new UnauthorizedError("Session has expired", "SESSION_EXPIRED");
  }

  // Check customer existence and active status
  if (!session.customer || !session.customer.isActive) {
    await prisma.customerSession.delete({ where: { id: session.id } }).catch(() => {});
    throw new UnauthorizedError("Customer account is inactive or not found", "UNAUTHORIZED");
  }

  // Throttle updating lastUsedAt to avoid excessive writes
  const now = new Date();
  if (!session.lastUsedAt || now.getTime() - session.lastUsedAt.getTime() > 60_000) {
    await prisma.customerSession
      .update({
        where: { id: session.id },
        data: { lastUsedAt: now },
      })
      .catch(() => {});
  }

  request.customer = {
    id: session.customer.id,
    fullName: session.customer.fullName,
    email: session.customer.email,
    phone: session.customer.phone,
  };

  request.customerSession = {
    id: session.id,
    rawToken,
  };
}

/**
 * Reusable Fastify preHandler guard verifying customer session-bound CSRF token on state-changing requests.
 * Safe methods (GET, HEAD, OPTIONS) bypass CSRF checks automatically.
 */
export async function requireCustomerCsrf(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(request.method.toUpperCase())) {
    return;
  }

  if (!request.customerSession?.rawToken) {
    throw new UnauthorizedError("Authentication required for CSRF validation", "UNAUTHORIZED");
  }

  const csrfHeader = request.headers["x-csrf-token"];
  const csrfToken = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;

  if (!csrfToken || typeof csrfToken !== "string" || csrfToken.trim() === "") {
    throw new ForbiddenError("CSRF token is required", "CSRF_MISSING");
  }

  const isValid = verifyCustomerCsrfToken(request.customerSession.rawToken, csrfToken.trim());
  if (!isValid) {
    throw new ForbiddenError("Invalid CSRF token", "CSRF_INVALID");
  }
}
