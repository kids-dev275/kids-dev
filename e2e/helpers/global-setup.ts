import fs from "fs";
import path from "path";
import { setupE2eDatabase } from "../../apps/api/src/scripts/e2e-db-setup";

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

export default async function globalSetup(): Promise<void> {
  // Ensure apps/api/.env is loaded into process.env for the test runner process
  const apiEnvPath = path.resolve(process.cwd(), "apps/api/.env");
  loadEnvFile(apiEnvPath);

  console.log("\n=======================================================");
  console.log("🚀 Starting Playwright Global Setup: Initializing E2E DB");
  console.log("=======================================================\n");

  await setupE2eDatabase();

  console.log("\n=======================================================");
  console.log("✅ Playwright Global Setup Completed");
  console.log("=======================================================\n");
}
