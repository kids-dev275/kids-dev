import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env";
import { getPrismaClient } from "../../lib/prisma";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors";
import { hashSessionToken, verifyAdminCsrfToken } from "./services/session";
import "./types";

/**
 * Reusable Fastify preHandler guard ensuring a valid, unexpired Admin session exists.
 * Verifies session against the database via SHA-256 token hash and attaches safe admin identity.
 */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const rawToken = request.cookies[env.ADMIN_SESSION_COOKIE_NAME];
  if (!rawToken) {
    throw new UnauthorizedError("Authentication required", "UNAUTHORIZED");
  }

  const tokenHash = hashSessionToken(rawToken);
  const prisma = getPrismaClient();

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash },
    include: { adminUser: true },
  });

  if (!session) {
    throw new UnauthorizedError("Invalid or expired session", "UNAUTHORIZED");
  }

  // Check expiration
  if (session.expiresAt <= new Date()) {
    // Delete expired session asynchronously
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    throw new UnauthorizedError("Session has expired", "SESSION_EXPIRED");
  }

  if (!session.adminUser) {
    throw new UnauthorizedError("Admin account not found", "UNAUTHORIZED");
  }

  // Update lastUsedAt if not updated recently (throttled to avoid heavy writes)
  const now = new Date();
  if (!session.lastUsedAt || now.getTime() - session.lastUsedAt.getTime() > 60_000) {
    await prisma.adminSession
      .update({
        where: { id: session.id },
        data: { lastUsedAt: now },
      })
      .catch(() => {});
  }

  request.admin = {
    id: session.adminUser.id,
    email: session.adminUser.email,
  };

  request.adminSession = {
    id: session.id,
    rawToken,
  };
}

/**
 * Reusable Fastify preHandler guard verifying session-bound CSRF token on state-changing requests.
 * Safe methods (GET, HEAD, OPTIONS) bypass CSRF checks automatically.
 */
export async function requireAdminCsrf(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(request.method.toUpperCase())) {
    return;
  }

  if (!request.adminSession?.rawToken) {
    throw new UnauthorizedError("Authentication required for CSRF validation", "UNAUTHORIZED");
  }

  const csrfHeader = request.headers["x-csrf-token"];
  const csrfToken = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;

  if (!csrfToken || typeof csrfToken !== "string" || csrfToken.trim() === "") {
    throw new ForbiddenError("CSRF token is required", "CSRF_MISSING");
  }

  const isValid = verifyAdminCsrfToken(request.adminSession.rawToken, csrfToken.trim());
  if (!isValid) {
    throw new ForbiddenError("Invalid CSRF token", "CSRF_INVALID");
  }
}
