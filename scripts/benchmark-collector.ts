import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { chromium, Browser, Page } from "@playwright/test";

interface RouteMeasurement {
  route: string;
  viewport: "desktop" | "mobile";
  ttfb: number;
  fcp: number;
  lcp: number;
  lcpElement: string;
  lcpUrl: string;
  cls: number;
  tbt: number;
  domContentLoaded: number;
  loadDuration: number;
  totalRequests: number;
  totalBytes: number;
  jsBytes: number;
  cssBytes: number;
  imageBytes: number;
}

interface ApiLatencyMeasurement {
  name: string;
  endpoint: string;
  method: string;
  status: number;
  runs: number[];
  min: number;
  median: number;
  mean: number;
  max: number;
  payloadBytes: number;
}

interface BenchmarkReport {
  timestamp: string;
  phase: "before" | "after";
  environment: {
    nodeVersion: string;
    chromeVersion: string;
    os: string;
    cpu: string;
    database: string;
    buildMode: string;
  };
  desktopRoutes: RouteMeasurement[];
  mobileRoutes: RouteMeasurement[];
  apiLatencies: ApiLatencyMeasurement[];
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url: string, timeoutMs: number = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404 || res.status === 200) {
        return;
      }
    } catch {
      // not ready yet
    }
    await wait(500);
  }
  throw new Error(`Timeout waiting for URL: ${url}`);
}

async function startServers(): Promise<{ apiProcess: ChildProcess; webProcess: ChildProcess }> {
  console.log("🚀 Starting Fastify API in E2E mode (port 4000)...");
  const apiProcess = spawn("pnpm", ["--filter", "api", "start:e2e"], {
    shell: true,
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: "pipe",
  });

  apiProcess.stderr?.on("data", (d) => {
    const msg = d.toString();
    if (!msg.includes("ExperimentalWarning") && !msg.includes("DeprecationWarning")) {
      process.stderr.write(`[API stderr] ${msg}`);
    }
  });

  await waitForUrl("http://127.0.0.1:4000/api/v1/e2e/health");
  console.log("✅ API Server is live at http://127.0.0.1:4000");

  console.log("🚀 Starting Next.js Web in production mode (port 3000)...");
  const webProcess = spawn("pnpm", ["--filter", "web", "start"], {
    shell: true,
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "3000",
      INTERNAL_API_URL: "http://localhost:4000/api/v1",
      NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
    },
    stdio: "pipe",
  });

  webProcess.stderr?.on("data", (d) => {
    const msg = d.toString();
    if (!msg.includes("ExperimentalWarning")) {
      process.stderr.write(`[Web stderr] ${msg}`);
    }
  });

  await waitForUrl("http://localhost:3000");
  console.log("✅ Web Production Server is live at http://localhost:3000");

  return { apiProcess, webProcess };
}

function stopProcess(proc: ChildProcess) {
  if (proc.pid) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", proc.pid.toString(), "/f", "/t"]);
      } else {
        proc.kill("SIGTERM");
      }
    } catch {}
  }
}

async function measureRoute(
  page: Page,
  url: string,
  viewport: "desktop" | "mobile"
): Promise<RouteMeasurement> {
  // Inject client-side performance observers before navigation
  await page.addInitScript(() => {
    (window as any).__perfMetrics = {
      cls: 0,
      lcp: 0,
      lcpElement: "",
      lcpUrl: "",
      fcp: 0,
      longTasks: [] as Array<{ startTime: number; duration: number }>,
      tbt: 0,
    };

    try {
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            (window as any).__perfMetrics.cls += entry.value;
          }
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
    } catch {}

    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries() as any[];
        if (entries.length > 0) {
          const last = entries[entries.length - 1];
          (window as any).__perfMetrics.lcp = last.startTime;
          (window as any).__perfMetrics.lcpElement = last.element
            ? last.element.tagName +
              (last.element.className ? "." + String(last.element.className).slice(0, 30) : "")
            : "";
          (window as any).__perfMetrics.lcpUrl = last.url || "";
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}

    try {
      const paintObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            (window as any).__perfMetrics.fcp = entry.startTime;
          }
        }
      });
      paintObserver.observe({ type: "paint", buffered: true });
    } catch {}

    try {
      const longTaskObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries() as any[]) {
          (window as any).__perfMetrics.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
          if (entry.duration > 50) {
            (window as any).__perfMetrics.tbt += entry.duration - 50;
          }
        }
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
    } catch {}
  });

  const response = await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600); // Allow late layout shifts or LCP stabilization

  const data = await page.evaluate(() => {
    const perf: any = (window as any).__perfMetrics || {};
    const navEntries = performance.getEntriesByType("navigation") as any[];
    const nav = navEntries.length > 0 ? navEntries[0] : null;

    const resources = performance.getEntriesByType("resource") as any[];

    let totalBytes = nav?.transferSize || 0;
    let jsBytes = 0;
    let cssBytes = 0;
    let imageBytes = 0;

    for (const r of resources) {
      const bytes = r.transferSize || 0;
      totalBytes += bytes;
      const name = r.name.toLowerCase();
      const initiator = r.initiatorType;

      if (initiator === "script" || name.endsWith(".js") || name.includes(".js?")) {
        jsBytes += bytes;
      } else if (initiator === "css" || name.endsWith(".css") || name.includes(".css?")) {
        cssBytes += bytes;
      } else if (
        initiator === "img" ||
        name.endsWith(".jpg") ||
        name.endsWith(".png") ||
        name.endsWith(".webp") ||
        name.endsWith(".svg") ||
        name.includes("/_next/image") ||
        name.includes("cloudinary.com")
      ) {
        imageBytes += bytes;
      }
    }

    const ttfb = nav ? Math.round(nav.responseStart - nav.requestStart) : 0;
    const domContentLoaded = nav ? Math.round(nav.domContentLoadedEventEnd - nav.requestStart) : 0;
    const loadDuration = nav ? Math.round(nav.loadEventEnd - nav.requestStart) : 0;

    return {
      ttfb: Math.max(0, ttfb),
      fcp: Math.round(perf.fcp || 0),
      lcp: Math.round(perf.lcp || 0),
      lcpElement: String(perf.lcpElement || ""),
      lcpUrl: String(perf.lcpUrl || ""),
      cls: Number((perf.cls || 0).toFixed(4)),
      tbt: Math.round(perf.tbt || 0),
      domContentLoaded,
      loadDuration,
      totalRequests: resources.length + 1,
      totalBytes,
      jsBytes,
      cssBytes,
      imageBytes,
    };
  });

  const parsedUrl = new URL(url);
  const routePath = parsedUrl.pathname + parsedUrl.search;

  return {
    route: routePath,
    viewport,
    ...data,
  };
}

async function measureApi(
  name: string,
  url: string,
  method: "GET" | "POST",
  body?: any,
  headers: Record<string, string> = {}
): Promise<ApiLatencyMeasurement> {
  const runs: number[] = [];
  let status = 0;
  let payloadBytes = 0;

  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const t1 = performance.now();
    status = res.status;
    const txt = await res.text();
    payloadBytes = Buffer.byteLength(txt, "utf-8");
    runs.push(Number((t1 - t0).toFixed(2)));
    await wait(50);
  }

  const sorted = [...runs].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = Number((runs.reduce((a, b) => a + b, 0) / runs.length).toFixed(2));

  return {
    name,
    endpoint: url.replace("http://127.0.0.1:4000", ""),
    method,
    status,
    runs,
    min,
    median,
    mean,
    max,
    payloadBytes,
  };
}

async function main() {
  const phase = (process.argv[2] as "before" | "after") || "before";
  console.log(`\n======================================================`);
  console.log(`🚀 Starting Performance Benchmark Collector [Phase: ${phase.toUpperCase()}]`);
  console.log(`======================================================\n`);

  const { apiProcess, webProcess } = await startServers();

  try {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    const chromeVersion = browser.version();
    console.log(`🌐 Chromium Browser Launched: v${chromeVersion}`);

    const desktopRoutesToMeasure = [
      "http://localhost:3000/",
      "http://localhost:3000/mini-sprouts",
      "http://localhost:3000/teen-studio",
      "http://localhost:3000/aura-studio",
      "http://localhost:3000/mini-sprouts/shop",
      "http://localhost:3000/mini-sprouts/products/e2e-classic-kurta",
      "http://localhost:3000/mini-sprouts/search?q=Classic",
      "http://localhost:3000/cart",
      "http://localhost:3000/checkout",
      "http://localhost:3000/account/login",
      "http://localhost:3000/admin/login",
    ];

    const mobileRoutesToMeasure = [
      "http://localhost:3000/",
      "http://localhost:3000/mini-sprouts",
      "http://localhost:3000/mini-sprouts/products/e2e-classic-kurta",
      "http://localhost:3000/cart",
      "http://localhost:3000/checkout",
    ];

    console.log("\n📊 Measuring Desktop Routes (Viewport: 1366x768)...");
    const desktopResults: RouteMeasurement[] = [];
    const desktopContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
    });

    for (const url of desktopRoutesToMeasure) {
      console.log(`  -> Profiling: ${url}`);
      // Run 2 warmups, then take the median measurement
      const samples: RouteMeasurement[] = [];
      for (let run = 0; run < 3; run++) {
        const page = await desktopContext.newPage();
        const m = await measureRoute(page, url, "desktop");
        samples.push(m);
        await page.close();
      }
      samples.sort((a, b) => a.lcp - b.lcp);
      const medianSample = samples[1];
      desktopResults.push(medianSample);
      console.log(
        `     LCP: ${medianSample.lcp}ms, CLS: ${medianSample.cls}, FCP: ${medianSample.fcp}ms, TTFB: ${medianSample.ttfb}ms, JS: ${(medianSample.jsBytes / 1024).toFixed(1)}KB`
      );
    }
    await desktopContext.close();

    console.log("\n📱 Measuring Mobile Routes (Viewport: Pixel 7 - 412x915)...");
    const mobileResults: RouteMeasurement[] = [];
    const mobileContext = await browser.newContext({
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
    });

    for (const url of mobileRoutesToMeasure) {
      console.log(`  -> Profiling Mobile: ${url}`);
      const samples: RouteMeasurement[] = [];
      for (let run = 0; run < 3; run++) {
        const page = await mobileContext.newPage();
        const m = await measureRoute(page, url, "mobile");
        samples.push(m);
        await page.close();
      }
      samples.sort((a, b) => a.lcp - b.lcp);
      const medianSample = samples[1];
      mobileResults.push(medianSample);
      console.log(
        `     LCP: ${medianSample.lcp}ms, CLS: ${medianSample.cls}, FCP: ${medianSample.fcp}ms, TTFB: ${medianSample.ttfb}ms, JS: ${(medianSample.jsBytes / 1024).toFixed(1)}KB`
      );
    }
    await mobileContext.close();

    console.log("\n⚡ Measuring API Latency across Key Endpoints...");
    // 1. Admin login to obtain cookie for admin order list
    const adminLoginRes = await fetch("http://127.0.0.1:4000/api/v1/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "e2e-admin@thekidswear.com",
        password: "E2EAdminPassword123!",
      }),
    });
    const adminCookie = adminLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

    // 2. Fetch product details to obtain variantId for cart/checkout validate
    const productRes = await fetch(
      "http://127.0.0.1:4000/api/v1/storefronts/mini-sprouts/products/e2e-classic-kurta"
    );
    const productJson = await productRes.json();
    const product = productJson.data?.product || productJson.data;
    const variantId = product?.variants?.[0]?.id || "";

    const apiMeasurements: ApiLatencyMeasurement[] = [];

    apiMeasurements.push(
      await measureApi(
        "Storefront Details",
        "http://127.0.0.1:4000/api/v1/storefronts/mini-sprouts",
        "GET"
      )
    );
    apiMeasurements.push(
      await measureApi(
        "Storefront Catalog",
        "http://127.0.0.1:4000/api/v1/storefronts/mini-sprouts/products?page=1&limit=12",
        "GET"
      )
    );
    apiMeasurements.push(
      await measureApi(
        "Catalog Search",
        "http://127.0.0.1:4000/api/v1/storefronts/mini-sprouts/search?q=Classic&page=1&limit=12",
        "GET"
      )
    );
    apiMeasurements.push(
      await measureApi(
        "Product PDP Details",
        "http://127.0.0.1:4000/api/v1/storefronts/mini-sprouts/products/e2e-classic-kurta",
        "GET"
      )
    );

    apiMeasurements.push(
      await measureApi("Cart Validation", "http://127.0.0.1:4000/api/v1/cart/validate", "POST", {
        items: [{ variantId, quantity: 1 }],
      })
    );

    apiMeasurements.push(
      await measureApi(
        "Checkout Validation",
        "http://127.0.0.1:4000/api/v1/checkout/validate",
        "POST",
        {
          items: [{ variantId, quantity: 1 }],
          paymentMethod: "CASH_ON_DELIVERY",
        }
      )
    );

    apiMeasurements.push(
      await measureApi("Order Creation", "http://127.0.0.1:4000/api/v1/orders", "POST", {
        idempotencyKey: `bench-order-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        paymentMethod: "CASH_ON_DELIVERY",
        customer: {
          fullName: "Benchmark Customer",
          phone: "03001234567",
          email: "benchmark@example.com",
          address: "123 Benchmark Road",
          city: "Lahore",
          province: "Punjab",
          postalCode: "54000",
          orderNotes: "Benchmark run",
        },
        items: [
          {
            productId: product.id,
            variantId: variantId,
            quantity: 1,
            unitPrice: Number(product.regularPrice),
          },
        ],
      })
    );

    apiMeasurements.push(
      await measureApi(
        "Admin Orders List",
        "http://127.0.0.1:4000/api/v1/admin/orders?page=1&limit=20",
        "GET",
        undefined,
        adminCookie ? { Cookie: adminCookie } : {}
      )
    );

    for (const api of apiMeasurements) {
      console.log(
        `  -> [${api.method}] ${api.name}: Mean ${api.mean}ms (Median: ${api.median}ms, Min: ${api.min}ms, Max: ${api.max}ms) [${api.payloadBytes} bytes]`
      );
    }

    await browser.close();

    const report: BenchmarkReport = {
      timestamp: new Date().toISOString(),
      phase,
      environment: {
        nodeVersion: process.version,
        chromeVersion,
        os: "Windows 11",
        cpu: "Intel(R) Core(TM) i5-3320M CPU @ 2.60GHz (2 Cores, 4 Threads)",
        database: "PostgreSQL 17 (Supabase schema, localhost test db: kids_wear_e2e)",
        buildMode: "Next.js 16.4.1 (Turbopack production build) + Fastify 5.2.1",
      },
      desktopRoutes: desktopResults,
      mobileRoutes: mobileResults,
      apiLatencies: apiMeasurements,
    };

    const outDir = path.resolve(__dirname, "../docs/benchmarks");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const filePath = path.join(outDir, `${phase}-metrics.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8");
    console.log(`\n🎉 Benchmark metrics successfully written to: ${filePath}\n`);
  } finally {
    console.log("🛑 Stopping server processes...");
    stopProcess(apiProcess);
    stopProcess(webProcess);
  }
}

main().catch((err) => {
  console.error("FATAL Benchmark execution error:", err);
  process.exit(1);
});
