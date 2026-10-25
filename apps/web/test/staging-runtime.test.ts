import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  fetchPublicSettings,
  fetchStorefront,
  fetchStorefrontProducts,
  getApiBaseUrl,
} from "../src/lib/api";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  INTERNAL_API_URL: process.env.INTERNAL_API_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function main(): Promise<void> {
  let passed = 0;
  const check = async (name: string, run: () => void | Promise<void>) => {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  };

  try {
    await check("deployed server prefers INTERNAL_API_URL", () => {
      Reflect.set(process.env, "NODE_ENV", "production");
      process.env.INTERNAL_API_URL = "https://api.example.test/api/v1";
      process.env.NEXT_PUBLIC_API_URL = "https://public.example.test/api/v1";
      assert.equal(getApiBaseUrl(), "https://api.example.test/api/v1");
    });

    await check("staging never falls back to localhost", () => {
      Reflect.set(process.env, "NODE_ENV", "development");
      process.env.NEXT_PUBLIC_APP_ENV = "staging";
      delete process.env.INTERNAL_API_URL;
      delete process.env.NEXT_PUBLIC_API_URL;
      const originalError = console.error;
      console.error = () => {};
      try {
        assert.throws(() => getApiBaseUrl(), /not configured for the deployed environment/);
        process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000/api/v1";
        assert.throws(() => getApiBaseUrl(), /Invalid backend API base URL configuration/);
      } finally {
        console.error = originalError;
      }
    });

    await check("server logs safe endpoint, status and failure category", async () => {
      Reflect.set(process.env, "NODE_ENV", "production");
      process.env.INTERNAL_API_URL = "https://api.example.test/api/v1";
      const originalFetch = globalThis.fetch;
      const originalError = console.error;
      const requests: string[] = [];
      const logs: string[] = [];
      globalThis.fetch = async (input) => {
        const url = String(input);
        requests.push(url);
        return new Response(JSON.stringify({ success: false }), {
          status: url.endsWith("/public/settings") ? 500 : 404,
          headers: { "content-type": "application/json" },
        });
      };
      console.error = (message) => { logs.push(String(message)); };
      try {
        assert.equal(await fetchPublicSettings(), null);
        assert.equal(await fetchStorefront("mini-sprouts"), null);
        assert.equal(await fetchStorefrontProducts("mini-sprouts", { limit: 8 }), null);
        assert.equal(requests.length, 3);
        assert(logs.some((line) => line.includes("endpoint=/api/v1/public/settings status=500 category=http")));
        assert(logs.some((line) => line.includes("endpoint=/api/v1/storefronts/mini-sprouts status=404 category=http")));
        assert(logs.every((line) => !line.includes("api.example.test")));
      } finally {
        globalThis.fetch = originalFetch;
        console.error = originalError;
      }
    });

    await check("error state retains retry and themed Gateway action", () => {
      const source = fs.readFileSync(path.join(__dirname, "../src/app/[storefront]/error.tsx"), "utf8");
      assert(source.includes("onRetry={reset}"));
      assert(source.includes("data-storefront={storefront}"));
      assert(source.includes("Return to Gateway"));
      assert(source.includes('href="/"'));
      assert(!source.includes("Return to Root Gateway"));
    });

    await check("favicon derives from approved logo and is a padded square PNG", () => {
      const icon = fs.readFileSync(path.join(__dirname, "../src/app/icon.png"));
      assert.equal(icon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      assert.equal(icon.readUInt32BE(16), 256);
      assert.equal(icon.readUInt32BE(20), 256);
      assert(fs.existsSync(path.join(__dirname, "../public/brand/kids-wear-logo.webp")));
    });

    await check("foundation seed preserves existing settings", () => {
      const source = fs.readFileSync(path.join(__dirname, "../../api/prisma/seed.ts"), "utf8");
      assert.match(source, /announcementBar\.upsert\(\{[\s\S]*?update: \{\}/);
      assert.match(source, /commerceSettings\.upsert\(\{[\s\S]*?update: \{\}/);
    });

    console.log(`${passed} passed, 0 failed`);
  } finally {
    restoreEnv();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
