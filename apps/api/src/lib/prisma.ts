import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "../config/env";

/**
 * Prisma 7 Driver-Adapter Client Architecture
 *
 * Architecture:
 * - Runtime application queries use pooled connection (DATABASE_URL) via @prisma/adapter-pg and pg.Pool.
 * - Migrations and Prisma CLI operations use direct connection (DIRECT_URL) configured in prisma.config.ts.
 */
let prismaInstance: PrismaClient | null = null;

export function setPrismaClient(client: PrismaClient | null): void {
  prismaInstance = client;
}

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    const dbUrl = process.env.DATABASE_URL || env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error(
        "DATABASE_URL is not set. Database operations are unavailable in this environment."
      );
    }

    const pool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 5000,
    });

    const adapter = new PrismaPg(pool);
    prismaInstance = new PrismaClient({ adapter });
  }

  return prismaInstance;
}
