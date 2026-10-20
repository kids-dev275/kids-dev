import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  createE2ePrismaClient,
  getE2eDatabaseUrls,
  setupE2eDatabase,
  assertSafeE2eDatabaseUrl,
} from "../../apps/api/src/scripts/e2e-db-setup";

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

let e2ePrismaInstance: PrismaClient | null = null;

export function getE2ePrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    loadEnvFile(path.resolve(process.cwd(), "apps/api/.env"));
  }

  if (!e2ePrismaInstance) {
    const { databaseUrl } = getE2eDatabaseUrls();
    assertSafeE2eDatabaseUrl(databaseUrl);
    e2ePrismaInstance = createE2ePrismaClient(databaseUrl);
  }
  return e2ePrismaInstance;
}

export async function resetE2eDb(): Promise<void> {
  await setupE2eDatabase();
}

export async function disconnectE2eDb(): Promise<void> {
  if (e2ePrismaInstance) {
    await e2ePrismaInstance.$disconnect();
    e2ePrismaInstance = null;
  }
}
