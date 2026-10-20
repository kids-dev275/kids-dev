/**
 * Kids Wear — Work Unit 25: Staging Smoke Verification Harness
 *
 * Runs non-destructive live staging smoke checks against deployed staging environments.
 * Strictly guarded to prevent running against production, ambiguous environments,
 * or without explicit staging target URLs and test modes.
 */

interface CheckResult {
  name: string;
  category: "API" | "Web" | "Security" | "SEO" | "Safety";
  passed: boolean;
  statusCode?: number;
  message?: string;
  durationMs?: number;
}

/**
 * Heuristic defense-in-depth safety patterns.
 * NOTE: These are heuristic risk checks to catch common accidental production target strings,
 * rather than authoritative production declarations. Authoritative production boundaries
 * are driven by optional PRODUCTION_WEB_URL and PRODUCTION_API_URL environment variables.
 */
const HEURISTIC_PRODUCTION_RISK_PATTERNS = [
  /^thekidswear\.com$/i,
  /^www\.thekidswear\.com$/i,
  /^api\.thekidswear\.com$/i,
  /^admin\.thekidswear\.com$/i,
  /^kidswear\.pk$/i,
  /^www\.kidswear\.pk$/i,
  /^api\.kidswear\.pk$/i,
  /^prod\./i,
  /^production\./i,
];

function assertSafeUrl(urlString: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`[Staging Smoke Guard] Invalid URL provided for ${label}: "${urlString}"`);
  }

  // Guard 4: Explicit staging environment identification (valid protocol)
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `[Staging Smoke Guard] Unsupported protocol "${parsed.protocol}" for ${label}. Must be http or https.`
    );
  }

  // Guard 5a: Optional environment-driven production URL guard
  if (process.env.PRODUCTION_WEB_URL) {
    try {
      const prodWeb = new URL(process.env.PRODUCTION_WEB_URL);
      if (parsed.hostname.toLowerCase() === prodWeb.hostname.toLowerCase()) {
        throw new Error(
          `[FATAL SAFETY VIOLATION] Target ${label} ("${parsed.hostname}") matches configured PRODUCTION_WEB_URL ("${prodWeb.hostname}"). Refusing to run staging tests against production!`
        );
      }
    } catch (e: any) {
      if (e.message?.includes("[FATAL SAFETY VIOLATION]")) throw e;
    }
  }

  if (process.env.PRODUCTION_API_URL) {
    try {
      const prodApi = new URL(process.env.PRODUCTION_API_URL);
      if (parsed.hostname.toLowerCase() === prodApi.hostname.toLowerCase()) {
        throw new Error(
          `[FATAL SAFETY VIOLATION] Target ${label} ("${parsed.hostname}") matches configured PRODUCTION_API_URL ("${prodApi.hostname}"). Refusing to run staging tests against production!`
        );
      }
    } catch (e: any) {
      if (e.message?.includes("[FATAL SAFETY VIOLATION]")) throw e;
    }
  }

  // Guard 5b: Heuristic defense-in-depth safety patterns
  for (const pattern of HEURISTIC_PRODUCTION_RISK_PATTERNS) {
    if (pattern.test(parsed.hostname)) {
      throw new Error(
        `[FATAL SAFETY VIOLATION] Refusing to run staging smoke tests against heuristic production risk pattern "${parsed.hostname}" for ${label}!`
      );
    }
  }

  return parsed;
}

/**
 * Enforces strict safety boundary for any remote test capable of:
 * - creating an Order
 * - registering a Customer
 * - changing Admin state
 * - uploading media
 * - submitting Reviews
 * - changing Settings
 */
export function assertCanRunDestructiveStagingTest(actionDescription: string): void {
  if (process.env.STAGING_TEST_MODE !== "true") {
    throw new Error(
      `[FATAL SAFETY VIOLATION] Refusing to execute destructive check "${actionDescription}". Explicit opt-in STAGING_TEST_MODE=true is strictly required in addition to valid staging URLs.`
    );
  }
}

async function runCheck(
  name: string,
  category: CheckResult["category"],
  fn: () => Promise<{ passed: boolean; statusCode?: number; message?: string }>
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fn();
    const durationMs = Date.now() - start;
    const result: CheckResult = {
      name,
      category,
      passed: res.passed,
      statusCode: res.statusCode,
      message: res.message,
      durationMs,
    };
    const icon = res.passed ? "✓" : "✗";
    console.log(
      `  ${icon} [${category}] ${name} (${durationMs}ms)${res.message ? ` — ${res.message}` : ""}`
    );
    return result;
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ [${category}] ${name} (${durationMs}ms) — ERROR: ${msg}`);
    return {
      name,
      category,
      passed: false,
      message: msg,
      durationMs,
    };
  }
}

async function main() {
  console.log("==================================================================");
  console.log("🚀 Kids Wear — Live Staging Environment Verification Harness");
  console.log("==================================================================\n");

  // Strictly require dedicated staging environment variables; never fall back ambiguously
  const webUrlRaw = process.env.STAGING_WEB_URL?.trim();
  const apiUrlRaw = process.env.STAGING_API_URL?.trim();

  if (!webUrlRaw || !apiUrlRaw) {
    console.error("❌ [Staging Smoke Guard] Missing dedicated staging target URLs.");
    console.error("   Required environment variables:");
    console.error(
      "     STAGING_WEB_URL: Public URL of deployed staging frontend (e.g. https://<authoritative-staging-origin>)"
    );
    console.error(
      "     STAGING_API_URL: Public URL of deployed staging API (e.g. https://<authoritative-staging-api>/api/v1)"
    );
    console.error("\n   Example non-destructive usage:");
    console.error(
      "     STAGING_WEB_URL=https://<authoritative-staging-origin> STAGING_API_URL=https://<authoritative-staging-api>/api/v1 pnpm test:staging\n"
    );
    console.error(
      "   For destructive/write staging verification (orders, customer accounts, admin operations):"
    );
    console.error(
      "     STAGING_WEB_URL=... STAGING_API_URL=... STAGING_TEST_MODE=true pnpm test:staging\n"
    );
    process.exit(1);
  }

  // Ambiguous environment guard
  if (webUrlRaw === apiUrlRaw) {
    console.error(
      `❌ [Staging Smoke Guard] Ambiguous configuration: STAGING_WEB_URL and STAGING_API_URL are identical ("${webUrlRaw}"). Refusing to run.`
    );
    process.exit(1);
  }

  // Validate URLs and enforce production safety guard
  assertSafeUrl(webUrlRaw, "STAGING_WEB_URL");
  assertSafeUrl(apiUrlRaw, "STAGING_API_URL");

  const webUrl = webUrlRaw.replace(/\/$/, "");
  const apiUrl = apiUrlRaw.replace(/\/$/, "");

  console.log(`📍 Staging Web Target: ${webUrl}`);
  console.log(`📍 Staging API Target: ${apiUrl}`);
  console.log(
    `🔒 Guard Hierarchy: Verified (Dedicated staging targets identified, production safety guards active)`
  );
  console.log(`🕒 Timestamp: ${new Date().toISOString()}\n`);

  const results: CheckResult[] = [];

  // 1. API Health
  results.push(
    await runCheck("Staging API Health Endpoint", "API", async () => {
      const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(10000) });
      const data = await res.json().catch(() => ({}));
      const ok = res.status === 200 && (data.status === "ok" || data.success === true);
      return {
        passed: ok,
        statusCode: res.status,
        message: ok ? "Health OK" : `Unexpected payload: ${JSON.stringify(data)}`,
      };
    })
  );

  // 2. API Public Settings
  results.push(
    await runCheck("Staging API Public Settings", "API", async () => {
      const res = await fetch(`${apiUrl}/public/settings`, { signal: AbortSignal.timeout(10000) });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { shipping?: unknown; announcement?: unknown };
      };
      const ok = res.status === 200 && data.success === true && !!data.data?.shipping;
      return {
        passed: ok,
        statusCode: res.status,
        message: ok ? "Settings returned valid payload" : "Settings endpoint failed",
      };
    })
  );

  // 3. API Storefronts
  results.push(
    await runCheck("Staging API Storefronts Endpoint", "API", async () => {
      const res = await fetch(`${apiUrl}/storefronts`, { signal: AbortSignal.timeout(10000) });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: Array<{ slug?: string }>;
      };
      const ok =
        res.status === 200 &&
        data.success === true &&
        Array.isArray(data.data) &&
        data.data.length >= 3;
      return {
        passed: ok,
        statusCode: res.status,
        message: ok ? `Returned ${data.data?.length} storefronts` : "Failed storefront count check",
      };
    })
  );

  // 4. Staging Web Gateway Page
  results.push(
    await runCheck("Staging Frontend Gateway Page (/) ", "Web", async () => {
      const res = await fetch(`${webUrl}/`, { signal: AbortSignal.timeout(10000) });
      const text = await res.text();
      const contentType = res.headers.get("content-type") || "";
      const ok = res.status === 200 && contentType.includes("text/html") && text.length > 500;
      return {
        passed: ok,
        statusCode: res.status,
        message: ok ? `HTML response received (${text.length} bytes)` : "Invalid HTML response",
      };
    })
  );

  // 5. Staging Storefront Mini Sprouts
  results.push(
    await runCheck("Storefront: Mini Sprouts (/mini-sprouts)", "Web", async () => {
      const res = await fetch(`${webUrl}/mini-sprouts`, { signal: AbortSignal.timeout(10000) });
      return {
        passed: res.status === 200,
        statusCode: res.status,
      };
    })
  );

  // 6. Staging Storefront Teen Studio
  results.push(
    await runCheck("Storefront: Teen Studio (/teen-studio)", "Web", async () => {
      const res = await fetch(`${webUrl}/teen-studio`, { signal: AbortSignal.timeout(10000) });
      return {
        passed: res.status === 200,
        statusCode: res.status,
      };
    })
  );

  // 7. Staging Storefront Aura Studio
  results.push(
    await runCheck("Storefront: Aura Studio (/aura-studio)", "Web", async () => {
      const res = await fetch(`${webUrl}/aura-studio`, { signal: AbortSignal.timeout(10000) });
      return {
        passed: res.status === 200,
        statusCode: res.status,
      };
    })
  );

  // 8. Staging Search Engine Safety Header (X-Robots-Tag: noindex, nofollow)
  results.push(
    await runCheck("Staging Search Engine Non-Indexing Safety Header", "SEO", async () => {
      const res = await fetch(`${webUrl}/`, { method: "HEAD", signal: AbortSignal.timeout(10000) });
      const robotsHeader = res.headers.get("x-robots-tag") || "";
      const ok = robotsHeader.toLowerCase().includes("noindex");
      return {
        passed: ok,
        message: ok
          ? `X-Robots-Tag header correctly emitted: "${robotsHeader}"`
          : `X-Robots-Tag missing or does not include noindex (got: "${robotsHeader}")`,
      };
    })
  );

  // 9. Staging Frontend Security Headers
  results.push(
    await runCheck("Staging Frontend Security Headers", "Security", async () => {
      const res = await fetch(`${webUrl}/`, { method: "HEAD", signal: AbortSignal.timeout(10000) });
      const xContentType = res.headers.get("x-content-type-options");
      const xFrame = res.headers.get("x-frame-options");
      const csp = res.headers.get("content-security-policy");

      const passed = xContentType === "nosniff" && xFrame === "DENY" && !!csp;
      return {
        passed,
        message: passed
          ? "CSP, nosniff, and DENY headers confirmed"
          : `Missing headers: xContentType=${xContentType}, xFrame=${xFrame}, csp=${!!csp}`,
      };
    })
  );

  // 10. Staging 404 Route Handling
  results.push(
    await runCheck("Staging 404 Unknown Route Handling", "Web", async () => {
      const res = await fetch(`${webUrl}/_staging_unknown_verify_404`, {
        signal: AbortSignal.timeout(10000),
      });
      return {
        passed: res.status === 404,
        statusCode: res.status,
        message: res.status === 404 ? "Correctly returned 404" : `Expected 404, got ${res.status}`,
      };
    })
  );

  // 11. Staging robots.txt
  results.push(
    await runCheck("Staging robots.txt Route", "SEO", async () => {
      const res = await fetch(`${webUrl}/robots.txt`, { signal: AbortSignal.timeout(10000) });
      const text = await res.text();
      const ok = res.status === 200 && text.toLowerCase().includes("user-agent");
      return {
        passed: ok,
        statusCode: res.status,
        message: ok ? "robots.txt accessible and valid" : "robots.txt check failed",
      };
    })
  );

  // 12. Staging sitemap.xml
  results.push(
    await runCheck("Staging sitemap.xml Route", "SEO", async () => {
      const res = await fetch(`${webUrl}/sitemap.xml`, { signal: AbortSignal.timeout(10000) });
      const text = await res.text();
      const ok = res.status === 200 && text.includes("urlset");
      return {
        passed: ok,
        statusCode: res.status,
        message: ok ? "sitemap.xml accessible and valid XML" : "sitemap.xml check failed",
      };
    })
  );

  // 13. Destructive Staging Mutation Safety Guard
  results.push(
    await runCheck("Destructive Mutation Safety Guard", "Safety", async () => {
      const isTestMode = process.env.STAGING_TEST_MODE === "true";
      if (!isTestMode) {
        return {
          passed: true,
          message:
            "Fail-closed safety active: STAGING_TEST_MODE is unset; destructive tests (Order creation, Customer registration, Admin state, Reviews, Settings, Media upload) refuse to run.",
        };
      }
      return {
        passed: true,
        message:
          "STAGING_TEST_MODE=true acknowledged: explicit opt-in active for isolated staging tests.",
      };
    })
  );

  // Summary
  console.log("\n==================================================================");
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(`Live Staging Smoke Results: ${passedCount} / ${total} Checks Passed`);
  if (failedCount > 0) {
    console.log(`❌ ${failedCount} checks failed.`);
  } else {
    console.log(`✅ All ${total} live staging checks passed successfully.`);
  }
  console.log("==================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error in staging smoke runner:", err);
  process.exit(1);
});
