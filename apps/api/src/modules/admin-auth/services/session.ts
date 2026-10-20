import crypto from "node:crypto";
import type { FastifyReply } from "fastify";
import { env } from "../../../config/env";

/**
 * Generates a cryptographically secure random session token (256-bit entropy).
 */
export function generateRawSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes the SHA-256 hash of a raw session token for database lookup and storage.
 * The raw token is NEVER persisted in the database.
 */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Derives a session-bound HMAC-SHA256 CSRF token from the session secret and raw token.
 * This ensures the CSRF token is cryptographically tied to the active Admin session.
 */
export function generateAdminCsrfToken(rawToken: string): string {
  return crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(`admin-csrf:${rawToken}`)
    .digest("hex");
}

/**
 * Verifies a provided CSRF token using timing-safe comparison.
 */
export function verifyAdminCsrfToken(rawToken: string, providedCsrfToken: string): boolean {
  if (!rawToken || !providedCsrfToken) {
    return false;
  }

  const expectedToken = generateAdminCsrfToken(rawToken);
  const expectedBuffer = Buffer.from(expectedToken, "hex");
  const providedBuffer = Buffer.from(providedCsrfToken, "hex");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Returns standardized cookie options for the Admin session cookie.
 */
export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/",
    maxAge: env.ADMIN_SESSION_TTL_HOURS * 3600, // In seconds for @fastify/cookie
  };
}

/**
 * Sets the Admin session cookie on the FastifyReply.
 */
export function setAdminSessionCookie(reply: FastifyReply, rawToken: string): void {
  reply.setCookie(env.ADMIN_SESSION_COOKIE_NAME, rawToken, getAdminCookieOptions());
}

/**
 * Clears the Admin session cookie on the FastifyReply.
 */
export function clearAdminSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(env.ADMIN_SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/",
  });
}
