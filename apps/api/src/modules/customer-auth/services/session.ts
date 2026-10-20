import crypto from "node:crypto";
import type { FastifyReply } from "fastify";
import { env } from "../../../config/env";

/**
 * Generates a cryptographically secure random Customer session token (256-bit entropy).
 */
export function generateRawCustomerSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes the SHA-256 hash of a raw customer session token for database lookup and storage.
 * The raw token is NEVER persisted in the database.
 */
export function hashCustomerSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Derives a customer-specific HMAC-SHA256 CSRF token using the "customer-csrf:" domain prefix.
 * This guarantees complete cryptographic domain separation from Admin CSRF tokens.
 */
export function generateCustomerCsrfToken(rawToken: string): string {
  return crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(`customer-csrf:${rawToken}`)
    .digest("hex");
}

/**
 * Verifies a provided Customer CSRF token using timing-safe comparison.
 */
export function verifyCustomerCsrfToken(rawToken: string, providedCsrfToken: string): boolean {
  if (!rawToken || !providedCsrfToken) {
    return false;
  }

  const expectedToken = generateCustomerCsrfToken(rawToken);
  const expectedBuffer = Buffer.from(expectedToken, "hex");
  const providedBuffer = Buffer.from(providedCsrfToken, "hex");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Returns standardized cookie options for the Customer session cookie.
 */
export function getCustomerCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/",
    maxAge: env.CUSTOMER_SESSION_TTL_HOURS * 3600, // In seconds for @fastify/cookie
  };
}

/**
 * Sets the Customer session cookie on the FastifyReply.
 */
export function setCustomerSessionCookie(reply: FastifyReply, rawToken: string): void {
  reply.setCookie(env.CUSTOMER_SESSION_COOKIE_NAME, rawToken, getCustomerCookieOptions());
}

/**
 * Clears the Customer session cookie on the FastifyReply.
 */
export function clearCustomerSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(env.CUSTOMER_SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: "/",
  });
}
