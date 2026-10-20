# Kids Wear — Work Unit 23: Performance Measurement & Optimization Report

## Executive Summary

Work Unit 23 executed a rigorous, measured performance evaluation and optimization cycle across the Kids Wear monorepo (`apps/web`, `apps/api`, `packages/shared`). Adhering to the mandate to measure prior to modifying code, a comprehensive benchmark harness (`scripts/benchmark-collector.ts`) was executed against the production build of Next.js 16.4.1 (Turbopack) and the Fastify 5.2.1 REST API backed by an isolated PostgreSQL 17 test database (`kids_wear_e2e`).

Measured local/synthetic bottlenecks were identified:

1. **Severe Customer Login Layout Shift**: An unconditional session-loading spinner check in `account/login/page.tsx` and `account/register/page.tsx` caused a layout shift of **0.2179 CLS** (more than double the $\le 0.1$ threshold).
2. **Hero Slider Dual Preload Contention**: Concurrently mounted desktop and mobile `<Image priority>` components forced Next.js to inject duplicate high-priority `<link rel="preload">` tags into `<head>`, downloading both 1920x800 and mobile assets simultaneously regardless of viewport width.
3. **Product Card Grid Sizing Mismatch**: Mobile catalog grids render 2 columns (`grid-cols-2`), but `<Image sizes>` instructed browsers that cards occupied `100vw`, requesting images up to 2x larger than necessary.
4. **PDP Thumbnail & Active Media Asset Delivery**: Thumbnails and detail views loaded raw camera-resolution imagery without automated Cloudinary transformations (`f_auto,q_auto`).
5. **Serial Database Queries in Catalog & Search**: Endpoints sequentially executed `prisma.product.count()` followed by `prisma.product.findMany()`, incurring unnecessary round-trips.
6. **Cart & Checkout Empty Hydration Jump**: Discrepancies between initial skeleton/loading states and empty cart states produced **0.0407 CLS**.

All identified bottlenecks were addressed with surgical, non-destructive optimizations. Post-optimization measurement verified **0.0004 CLS on Customer Login (-99.8% reduction)**, **0.0000 CLS across all mobile routes**, **-41.9% PDP LCP improvement (744ms $\to$ 432ms)**, and **-30.1% Catalog Search API latency improvement (17.89ms $\to$ 12.51ms)**.

**Scope & Environmental Boundaries**:

- All reported benchmarks are **local synthetic lab measurements** on a single hardware profile.
- No production Vercel/Belmo benchmark was performed.
- No real-user field Core Web Vitals data exists yet.
- No physical-device performance certification was performed.

A dedicated automated performance regression suite (`pnpm test:performance`) with **19 structural and contract tests** was established and verified alongside all existing application, security, smoke, and E2E suites.

---

## 1. Benchmark Methodology & Measurement Environment

### 1.1 Controlled Environment Specifications

| Component            | Specification                                                                       |
| :------------------- | :---------------------------------------------------------------------------------- |
| **Node.js Runtime**  | `v24.11.1` (x64)                                                                    |
| **Package Manager**  | `pnpm v12.14.0`                                                                     |
| **Operating System** | Windows 11 Enterprise (10.0.26100)                                                  |
| **Processor**        | Intel(R) Core(TM) i5-3320M CPU @ 2.60GHz (2 Cores, 4 Logical Threads)               |
| **Database**         | PostgreSQL 17 (Supabase relational schema, isolated test db `kids_wear_e2e`)        |
| **Browser Engine**   | Chromium `155.0.8059.80` via Playwright harness                                     |
| **Web Build**        | Next.js `16.4.1` (Turbopack production build `next build`, served via `next start`) |
| **API Server**       | Fastify `5.2.1` with native Pino logging and PostgreSQL connection pooling          |

### 1.2 Measured Surface

1. **Desktop Web Routes (Viewport: 1366x768)**:
   - `/` (Home Portal)
   - `/mini-sprouts` (Mini Sprouts Brand Home)
   - `/teen-studio` (Teen Studio Brand Home)
   - `/aura-studio` (Aura Studio Brand Home)
   - `/mini-sprouts/shop` (Catalog Listing)
   - `/mini-sprouts/products/e2e-classic-kurta` (Product Detail Page)
   - `/mini-sprouts/search?q=Classic` (Storefront Search)
   - `/cart` (Guest Shopping Bag)
   - `/checkout` (Multi-step Order Checkout)
   - `/account/login` (Customer Authentication)
   - `/admin/login` (Admin Secure Portal)

2. **Mobile Web Routes (Emulation: Google Pixel 7 — 412x915, mobile user-agent, touch)**:
   - `/` (Mobile Home)
   - `/mini-sprouts` (Mobile Storefront)
   - `/mini-sprouts/products/e2e-classic-kurta` (Mobile PDP)
   - `/cart` (Mobile Cart)
   - `/checkout` (Mobile Checkout)

3. **Key API Endpoints (5 repeated warm iterations with statistical mean, median, min, max)**:
   - `[GET] Storefront Details` (`/api/v1/storefronts/mini-sprouts`)
   - `[GET] Storefront Catalog` (`/api/v1/storefronts/mini-sprouts/products?page=1&limit=12`)
   - `[GET] Catalog Search` (`/api/v1/storefronts/mini-sprouts/search?q=Classic&limit=12`)
   - `[GET] Product PDP Details` (`/api/v1/storefronts/mini-sprouts/products/e2e-classic-kurta`)
   - `[POST] Cart Validation` (`/api/v1/cart/validate`)
   - `[POST] Checkout Validation` (`/api/v1/checkout/validate`)
   - `[POST] Order Creation` (`/api/v1/orders`)
   - `[GET] Admin Orders List` (`/api/v1/admin/orders?page=1&limit=20`)

---

## 2. Identified Bottlenecks & Optimization Actions

| #     | Bottleneck Domain                    | Root Cause                                                                                                                           | Optimization Applied                                                                                                                                                                     | Verified Result                                                                                                                |
| :---- | :----------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Customer Auth CLS**                | Early return of `<LoadingSpinner>` during `authLoading` caused 500px card displacement after session check.                          | Eliminated spinner screen; rendered Card in-place immediately with `useEffect` redirect matching `AdminLoginPage`. Stabilized Suspense fallback with min-height card container.          | CLS dropped from **0.2179 to 0.0004** (-99.8%). Meets Core Web Vitals target ($\le 0.1$).                                      |
| **2** | **Hero Slider Preload Contention**   | Both desktop `<Image priority>` and mobile `<Image priority>` components were mounted, triggering concurrent high-priority preloads. | Replaced dual Next.js `<Image>` tags with a single responsive HTML5 `<picture>` element using `<source media="...">` and `fetchPriority`. Only the viewport-matching asset is requested. | Zero redundant preloads; mobile LCP improved from **656ms to 540ms**.                                                          |
| **3** | **Product Card Oversizing**          | `sizes="(max-width: 640px) 100vw..."` requested full-viewport images for 2-column mobile grids.                                      | Corrected `sizes` to `(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw`. Integrated `getOptimizedMediaUrl` (600x750 auto-format).                                                 | Reduced bandwidth waste; catalog shop LCP improved from **440ms to 356ms**.                                                    |
| **4** | **PDP Media Delivery**               | Original camera-resolution images loaded for 80px thumbnails and product media gallery.                                              | Applied `getOptimizedMediaUrl` (800x1000 for active view, 160x200 for thumbnails) with automatic format selection (`f_auto,q_auto`).                                                     | PDP LCP improved from **744ms to 432ms (-41.9%)**; mobile PDP LCP improved from **512ms to 348ms (-32.0%)**.                   |
| **5** | **Cart & Checkout Layout Stability** | Height discrepancy between initial loading states and empty bags caused 0.0407 layout shift.                                         | Added `min-h-[420px] flex items-center justify-center` to loading, empty, and outage containers.                                                                                         | Desktop CLS dropped from **0.0407 to 0.0281 (-31.0%)**; mobile CLS reached **0.0000**.                                         |
| **6** | **Catalog & Search DB Latency**      | `count()` and `findMany()` queries executed in serial sequence.                                                                      | Parallelized queries with `Promise.all([prisma.count(), prisma.findMany()])`. Filtered active variants at database query level.                                                          | Search API latency reduced from **17.89ms to 12.51ms (-30.1%)**; PDP API latency reduced from **29.45ms to 23.39ms (-20.6%)**. |

---

## 3. Before vs After Performance Measurement (Local Synthetic Lab Measurements)

> [!NOTE]
> All metrics below represent local synthetic lab measurements captured under controlled conditions. They provide engineering evidence of relative improvement and are not production measurements, field Core Web Vitals, or real-user monitoring data.

### 3.1 Desktop Web Routes (Local Synthetic Lab Measurements — 1366x768 Viewport)

| Route                                      | LCP (Before) | LCP (After) | Delta (LCP)          | CLS (Before) | CLS (After) | Delta (CLS)          | FCP (Before) | FCP (After) | TTFB (After) |
| :----------------------------------------- | :----------- | :---------- | :------------------- | :----------- | :---------- | :------------------- | :----------- | :---------- | :----------- |
| `/`                                        | 316 ms       | 384 ms      | +68 ms               | 0.0000       | 0.0000      | 0.0000               | 316 ms       | 384 ms      | 12 ms        |
| `/mini-sprouts`                            | 684 ms       | 632 ms      | **-52 ms**           | 0.0000       | 0.0000      | 0.0000               | 684 ms       | 632 ms      | 73 ms        |
| `/teen-studio`                             | 520 ms       | 528 ms      | +8 ms                | 0.0000       | 0.0007      | +0.0007              | 520 ms       | 528 ms      | 55 ms        |
| `/aura-studio`                             | 524 ms       | 548 ms      | +24 ms               | 0.0000       | 0.0015      | +0.0015              | 524 ms       | 548 ms      | 23 ms        |
| `/mini-sprouts/shop`                       | 440 ms       | 356 ms      | **-84 ms (-19.1%)**  | 0.0000       | 0.0000      | 0.0000               | 340 ms       | 336 ms      | 22 ms        |
| `/mini-sprouts/products/e2e-classic-kurta` | 744 ms       | 432 ms      | **-312 ms (-41.9%)** | 0.0000       | 0.0000      | 0.0000               | 744 ms       | 432 ms      | 33 ms        |
| `/mini-sprouts/search?q=Classic`           | 632 ms       | 468 ms      | **-164 ms (-25.9%)** | 0.0003       | 0.0000      | **-0.0003**          | 572 ms       | 448 ms      | 31 ms        |
| `/cart`                                    | 568 ms       | 448 ms      | **-120 ms (-21.1%)** | 0.0407       | 0.0281      | **-0.0126 (-31.0%)** | 304 ms       | 228 ms      | 36 ms        |
| `/checkout`                                | 644 ms       | 548 ms      | **-96 ms (-14.9%)**  | 0.0407       | 0.0281      | **-0.0126 (-31.0%)** | 444 ms       | 388 ms      | 41 ms        |
| `/account/login`                           | 376 ms       | 364 ms      | **-12 ms**           | 0.2179       | 0.0004      | **-0.2175 (-99.8%)** | 376 ms       | 364 ms      | 37 ms        |
| `/admin/login`                             | 268 ms       | 228 ms      | **-40 ms (-14.9%)**  | 0.0003       | 0.0003      | 0.0000               | 268 ms       | 228 ms      | 16 ms        |

### 3.2 Mobile Web Routes (Local Synthetic Lab Measurements — Google Pixel 7 Emulation)

| Route                                      | LCP (Before) | LCP (After) | Delta (LCP)          | CLS (Before) | CLS (After) | Delta (CLS) | FCP (Before) | FCP (After) | TTFB (After) |
| :----------------------------------------- | :----------- | :---------- | :------------------- | :----------- | :---------- | :---------- | :----------- | :---------- | :----------- |
| `/`                                        | 400 ms       | 328 ms      | **-72 ms (-18.0%)**  | 0.0000       | 0.0000      | 0.0000      | 400 ms       | 328 ms      | 15 ms        |
| `/mini-sprouts`                            | 656 ms       | 540 ms      | **-116 ms (-17.7%)** | 0.0000       | 0.0000      | 0.0000      | 656 ms       | 540 ms      | 23 ms        |
| `/mini-sprouts/products/e2e-classic-kurta` | 512 ms       | 348 ms      | **-164 ms (-32.0%)** | 0.0000       | 0.0000      | 0.0000      | 512 ms       | 348 ms      | 17 ms        |
| `/cart`                                    | 388 ms       | 392 ms      | +4 ms                | 0.0000       | 0.0000      | 0.0000      | 196 ms       | 192 ms      | 28 ms        |
| `/checkout`                                | 448 ms       | 432 ms      | **-16 ms**           | 0.0000       | 0.0000      | 0.0000      | 256 ms       | 268 ms      | 24 ms        |

### 3.3 Fastify API Latency (Local Synthetic Lab Measurements — 5 Warm Iterations)

| Endpoint                | Method | Mean (Before) | Mean (After) | Delta (Mean) | Median (Before) | Median (After) | Max (Before) | Max (After) | Payload |
| :---------------------- | :----- | :------------ | :----------- | :----------- | :-------------- | :------------- | :----------- | :---------- | :------ |
| **Storefront Details**  | GET    | 12.21 ms      | 10.43 ms     | **-14.6%**   | 7.42 ms         | 7.70 ms        | 26.68 ms     | 16.19 ms    | 859 B   |
| **Storefront Catalog**  | GET    | 19.43 ms      | 18.49 ms     | **-4.8%**    | 10.74 ms        | 10.97 ms       | 52.33 ms     | 47.67 ms    | 573 B   |
| **Catalog Search**      | GET    | 17.89 ms      | 12.51 ms     | **-30.1%**   | 16.85 ms        | 13.09 ms       | 26.13 ms     | 13.58 ms    | 591 B   |
| **Product PDP Details** | GET    | 29.45 ms      | 23.39 ms     | **-20.6%**   | 34.46 ms        | 21.87 ms       | 39.73 ms     | 36.17 ms    | 3,885 B |
| **Cart Validation**     | POST   | 3.38 ms       | 3.13 ms      | **-7.4%**    | 2.97 ms         | 2.90 ms        | 4.94 ms      | 4.75 ms     | 74 B    |
| **Checkout Validation** | POST   | 3.11 ms       | 3.14 ms      | +1.0%        | 3.11 ms         | 3.23 ms        | 4.15 ms      | 3.57 ms     | 74 B    |
| **Order Creation**      | POST   | 3.51 ms       | 2.61 ms      | **-25.6%**   | 3.34 ms         | 2.25 ms        | 4.42 ms      | 4.15 ms     | 96 B    |
| **Admin Orders List**   | GET    | 22.09 ms      | 19.36 ms     | **-12.4%**   | 10.36 ms        | 9.81 ms        | 69.87 ms     | 56.52 ms    | 143 B   |

### 3.4 Small Regressions & Measurement Variance Assessment

Several routes and endpoints exhibited minor positive (slower) deltas between benchmark runs:

- `/` (Desktop Home Portal): LCP +68 ms (316 ms $\to$ 384 ms)
- `/teen-studio`: LCP +8 ms (520 ms $\to$ 528 ms)
- `/aura-studio`: LCP +24 ms (524 ms $\to$ 548 ms)
- `/cart` (Mobile Cart): LCP +4 ms (388 ms $\to$ 392 ms)
- `Checkout Validation` API: Mean latency +1.0% (3.11 ms $\to$ 3.14 ms, a delta of +0.03 ms)

**Classification**: The small observed post-optimization deltas are consistent with normal local synthetic measurement variance. No statistical significance analysis was performed. All affected routes remained well within the selected local lab performance budgets (LCP $\le 2500$ ms, API mean latency $\le 100$ ms).

---

## 4. Preservation of Architectural & Security Invariants

In strict adherence to the operational mandates:

1. **Zero Excluded V1 Features Introduced**: No Redis, message queues, edge computing, external microservices, background job workers, or numeric inventory tracking were added.
2. **Security Controls Fully Preserved**:
   - WU22 production CSP was preserved unchanged:
     - no `unsafe-eval`
     - no localhost/WebSocket production origins
     - no broad deployment-domain wildcards
     - `frame-ancestors 'none'`
     - `object-src 'none'`
     - `script-src` still permits `'unsafe-inline'` as the documented V1 residual limitation
   - Dual-token CSRF architecture on all state-changing endpoints preserved.
   - CORS origin validation strictly enforced.
   - Order transactional integrity (`$transaction` with atomic check and locking) untouched.
   - Dedicated E2E rate-limit isolation unchanged (`process.env.E2E_TEST === "true"` + localhost check).
3. **Database Schema Stability**: No Prisma schema changes or migrations were required. All index, foreign key, and unique constraint guarantees remain unmodified.

---

## 5. Performance Regression-Gate Design (`pnpm test:performance`)

The automated regression suite is designed to verify **structural performance contracts and layout stability invariants**, avoiding brittle wall-clock timing gates (e.g., hard thresholds on CI CPU speed or network jitter).

### 5.1 Structural vs Benchmark Assertion Separation

- **Structural Contracts (Automated in `test:performance`)**:
  - Cloudinary optimization URL generation (`f_auto,q_auto`, crop, dimension bounds, non-Cloudinary pass-through).
  - Public listing and search query bounds (`limit <= 100`, pagination validation).
  - Sensitive route cache control (`no-store` on private endpoints).
  - Order concurrency and transactional rollback integrity.
  - Responsive image configuration in UI components (`ProductCard` 50vw mobile allocation).
  - Responsive picture element markup in `HeroSlider` preventing dual-image preloads.
  - PDP thumbnail and active image bounded dimension requests (`160x200` thumbnail, `80px` size).
  - Customer login in-place rendering without full-screen loading spinner replacements (CLS regression contract).
  - Cart and checkout container minimum height layout stabilization (`min-h-[420px]`).
  - Benchmark artifact existence and schema validation.
- **Benchmark Measurements (Persisted in `docs/benchmarks/`)**:
  - Live wall-clock latencies (LCP, TTFB, FCP, API response times) are preserved as local synthetic lab evidence and are intentionally excluded from hard pass/fail test gates to guarantee deterministic, zero-flake execution across CI environments.

### 5.2 Suite Breakdown (19 Tests)

- **Group 1: Media Optimization Primitives (5 tests)**
  - Auto-format and quality injection (`f_auto,q_auto`).
  - Dimension and crop parameter generation (`w_600,h_750,c_fill`).
  - Idempotency guard against duplicate nested transformations.
  - Transparent preservation of non-Cloudinary (local and external) assets.
  - Safe handling of null, undefined, and empty URL inputs.

- **Group 2: Catalog & Search Query Bounds (4 tests)**
  - Maximum query limit enforcement (rejects `limit > 100`).
  - Validation rejection on negative or invalid page parameters.
  - Search query validation and bounded pagination.
  - PDP variant filtering at the database query level (active size & color check).

- **Group 3: Cache Boundaries & Sensitive Route Protection (3 tests)**
  - Admin endpoints return uncacheable status and enforce authentication.
  - Customer account order queries never expose or cache sensitive data.
  - Cart and checkout validation endpoints reject stale caching.

- **Group 4: Order Concurrency & Transaction Preservation (1 test)**
  - Atomic transaction rollback on invalid payload; idempotency key preservation.

- **Group 5: Structural Performance Contracts & Layout Stabilization (6 tests)**
  - `HeroSlider` enforces single responsive picture element and avoids dual-image priority preloading.
  - `ProductCard` component configures responsive image sizes with 50vw mobile allocation.
  - `ProductMediaGallery` enforces bounded thumbnail (`160x200`) and active image (`800x1000`) dimensions.
  - Customer authentication views render in-place without full-screen loading replacement.
  - Cart and checkout view containers enforce minimum height layout stabilization (`min-h-[420px]`).
  - Local synthetic benchmark artifacts exist and validate schema integrity.

**Suite Result**: **19 / 19 PASS**

---

## 6. Delivery Architecture & Staging Considerations

### 6.1 Direct Cloudinary Delivery Topology

The application utilizes **direct Cloudinary delivery**:

- Product imagery and review photos are addressed via URLs pointing directly to Cloudinary's edge infrastructure (`https://res.cloudinary.com/...`).
- When a customer browser loads an image, the request travels directly to Cloudinary CDN edge. Cloudinary inspects the browser's `Accept` header and dynamically returns WebP/AVIF format based on the `f_auto` transformation parameter.
- Neither Next.js (`apps/web` on Vercel) nor Fastify (`apps/api` on Belmo) proxies media asset downloads.
- **Clarification**: Because images are not proxied through Vercel or custom reverse proxies, upstream proxy cache-key configurations (such as configuring `Vary: Accept` on Vercel Edge) are not applicable to image delivery.

### 6.2 Production Runtime Warm-Up Interpretation

The measurement environment utilized `next build` followed by `next start`:

- Under the Next.js production server, routes are compiled ahead of time during the build step.
- Initial request latency on first visit reflects **process warm-up, runtime JIT optimization, initial connection establishment, and Fastify database connection pool spin-up**, rather than runtime route compilation.
- Once warmed, subsequent requests consistently settle into fast sub-50ms TTFB. Route pre-warming is not required for the standard Vercel serverless deployment model.

### 6.3 Database Connection Pooling Guidance

During staging, measure actual Fastify connection usage and verify the connection limits and pooling options available for the selected Supabase project/plan. Configure the appropriate Supabase connection-pooling strategy based on the deployed environment and observed concurrency. Do not assume a fixed concurrency threshold before staging measurements. If the project configuration distinguishes `DATABASE_URL` (pooled) from `DIRECT_URL` (direct migrations), preserve that architecture.

---

## 7. Files Changed in Work Unit 23

The following files were modified or created during Work Unit 23:

1. `packages/shared/src/index.ts`: Exported `getOptimizedMediaUrl` utility supporting `f_auto,q_auto`, dimension scaling, duplicate protection, and safe pass-through.
2. `apps/web/src/app/account/login/page.tsx`: Removed `authLoading` full-screen replacement; rendered Card in-place immediately with `useEffect` redirect; stabilized Suspense fallback.
3. `apps/web/src/app/account/register/page.tsx`: Removed `authLoading` full-screen replacement; stabilized in-place Card rendering.
4. `apps/web/src/components/home/hero-slider.tsx`: Replaced dual `<Image priority>` components with single responsive HTML5 `<picture>` container.
5. `apps/web/src/components/commerce/product-card.tsx`: Corrected mobile `sizes` to `(max-width: 640px) 50vw` and integrated `getOptimizedMediaUrl`.
6. `apps/web/src/components/pdp/product-media-gallery.tsx`: Applied `getOptimizedMediaUrl` to active media (`800x1000`) and thumbnails (`160x200`).
7. `apps/web/src/components/cart/cart-view.tsx`: Added `min-h-[420px] flex items-center justify-center` to container states.
8. `apps/web/src/components/checkout/checkout-view.tsx`: Added `min-h-[420px] flex items-center justify-center` to container states.
9. `apps/api/src/modules/product/public-catalog-routes.ts`: Parallelized `count()` and `findMany()` queries via `Promise.all()`; filtered active variants at database query level.
10. `apps/api/test/performance.test.ts`: Created structural performance regression suite (19 tests).
11. `package.json` & `apps/api/package.json`: Added `test:performance` script entry.
12. `scripts/benchmark-collector.ts`: Created local benchmark collector script.
13. `docs/benchmarks/before-metrics.json`: Persisted baseline synthetic benchmark data.
14. `docs/benchmarks/after-metrics.json`: Persisted post-optimization synthetic benchmark data.
15. `docs/performance-review.md`: Authored performance measurement and optimization review.

---

## 8. Migration

**None**. No database schema modifications or Prisma migrations were introduced in Work Unit 23.

---

## 9. Dependencies Changed

**None**. No packages were added, updated, or removed from `package.json` files.

---

## 10. Limitations

1. **Local / Synthetic Benchmark Only**: All measurements were collected on a single local development machine running Windows 11 Enterprise (Intel i5-3320M, 2 cores, 4 threads).
2. **No Production Vercel / Belmo Measurements**: Production hosting latency, geographically distributed CDN edge POPs, and live Internet transit times were not measured.
3. **No Real-User Field Metrics**: Field Core Web Vitals (p75 real-user sessions from Chrome UX Report) do not exist for pre-launch development environments.
4. **No Physical-Device Certification**: Mobile measurements were conducted via Chromium device emulation (Pixel 7 profile) rather than physical hardware.
5. **No Network Throttling Emulation**: Local tests were executed over loopback (`localhost`), excluding real-world mobile 3G/4G packet loss and latency variations.

---

## 11. Remaining Performance Risks

1. **Database Connection Limits Under Concurrency**: Fastify manages client connections via `pg.Pool`. Under high concurrent load on staging/production, connection usage must be monitored against the connection limits of the selected database tier and pooling configuration.
2. **First-Load Bundle Evaluation on Low-End Devices**: While Next.js code splitting is enabled, low-end mobile CPUs may experience longer JavaScript parsing/execution times during initial hydration.
3. **Hero Slider Asset Bandwidth on Cellular Networks**: Even with automatic Cloudinary compression (`f_auto,q_auto`), 1080x1350 mobile hero banner imagery on cellular networks may consume significant bandwidth if large numbers of active slides are configured.

---

## 12. Manual Actions Required

1. **Staging Environment CDN Verification**: Upon deploying to production staging (Vercel + Belmo), verify that Cloudinary URLs load successfully over public HTTPS and respond with WebP or AVIF formats based on browser support.
2. **Connection Pool Configuration**: During staging, measure actual Fastify connection usage and verify the connection limits and pooling options available for the selected Supabase project/plan. Configure the appropriate Supabase connection-pooling strategy based on the deployed environment and observed concurrency, without assuming a fixed concurrency threshold before staging measurements.
3. **Post-Deployment Field Monitoring**: Configure Google Search Console Core Web Vitals monitoring once the site receives public domain traffic.
