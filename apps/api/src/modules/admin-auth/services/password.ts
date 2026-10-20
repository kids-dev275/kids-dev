import { hash, verify, Algorithm } from "@node-rs/argon2";

// Pre-computed valid Argon2id hash for timing mitigation against non-existent accounts
const DUMMY_ARGON2_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$sTcjf8zMTy508IhhS2EQMg$WuIWbe9E37qlAbeAgYEa7OhaRU61QrZQmxVrBCKdsrk";

/**
 * Normalizes email address to lower-case, trimmed format.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Hashes a plaintext password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(hashString: string, password: string): Promise<boolean> {
  try {
    return await verify(hashString, password);
  } catch {
    return false;
  }
}

/**
 * Performs a dummy Argon2id verification to mitigate timing attacks when an email is unknown.
 */
export async function performDummyPasswordVerification(password: string): Promise<boolean> {
  try {
    await verify(DUMMY_ARGON2_HASH, password);
  } catch {
    // Intentionally ignored — dummy verification should always fail safely
  }
  return false;
}
