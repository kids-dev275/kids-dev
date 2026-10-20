# Kids Wear — Work Unit 22: Security Review & Hardening Report

## Executive Summary

Work Unit 22 conducted a comprehensive application-security review and hardening process across the Kids Wear monorepo (`apps/web`, `apps/api`, `packages/shared`). The review systematically assessed threat models, trust boundaries, authentication, session lifecycle, CSRF and CORS controls, authorization matrices, IDOR/BOLA protections, input validation, injection resistance, media upload trust boundaries, rate limiting, error handling, secret leakage, and supply-chain vulnerabilities.

A dedicated automated security regression suite (`pnpm test:security`) consisting of **59 tests** was developed and verified, executing alongside the existing 1,254 application unit/integration tests, 20 database smoke tests, and 27 browser end-to-end tests, bringing total automated verifications to **1,360**.

---

## 1. Threat Model & Trust Boundaries

### 1.1 Architecture & Trust Levels

```text
Untrusted Client (Browser)
       │
       ▼ [HTTPS / User-Agent / Cookies]
Next.js Web (Vercel) — Untrusted Presentation Boundary
       │
       ▼ [HTTPS REST /api/v1 — Strict Origin & CORS Allowlist]
Fastify API (Belmo) — Authoritative Business & Security Core
       │
       ├─────────────────────────┬─────────────────────────┐
       ▼                         ▼                         ▼
PostgreSQL (Supabase)       Cloudinary CDN            Resend API
(State Authority)          (Object Storage)       (Transactional Email)
```

1. **Untrusted Client**: Browsers, guest shoppers, authenticated customers, and prospective attackers. All incoming HTTP data (headers, bodies, queries, cookies, IP headers) is treated as untrusted.
2. **Next.js Web (`apps/web` on Vercel)**: Presentation tier. Never authoritative for prices, stock status, delivery fees, or order totals. Implements defense-in-depth security headers (CSP, Frameguard, Referrer-Policy).
3. **Fastify API (`apps/api` on Belmo)**: Sole business logic and security authority. Enforces role guards, session verification, CSRF validation, database transactions, rate limiting, and parameter schemas.
4. **PostgreSQL (Supabase)**: Authoritative data store. Protected behind connection pooling, parameterized Prisma queries, row locks, composite foreign keys, and relational check constraints.
5. **Third-Party Services (Cloudinary & Resend)**: External providers accessed only via server-side signed requests or server-held API credentials. Real API secrets are strictly kept on the server and never returned in API payloads or client configurations.

---

## 2. Security Findings & Hardening Measures by Domain

### Domain 1: Threat Modeling & Architectural Boundaries

- **Findings**: The architecture cleanly separates presentation (`apps/web`) from the authoritative core (`apps/api`). No business-critical calculations or stock validations were delegated to the frontend.
- **Hardening Applied**:
  - Validated that `apps/web` re-validates all order and pricing calculations with `apps/api`.
  - Confirmed strict V1 feature boundaries (no wishlist, no online payment gateway, no courier API tracking, no numeric inventory counting, single-admin model).

### Domain 2: Authentication & Session Management

- **Findings**: Separate session tables (`AdminSession` and `CustomerSession`) exist in PostgreSQL. Passwords are hash-protected with Argon2id.
- **Hardening Applied**:
  - Verified Argon2id profile adheres to OWASP recommendations: memory cost 64 MiB (`m=65536`), time cost 3 iterations (`t=3`), parallelism 4 lanes (`p=4`).
  - Constant-time dummy hash verification executed on non-existent accounts to eliminate timing-based user enumeration.
  - Session tokens are generated as 256-bit cryptographically secure random bytes (`crypto.randomBytes(32)`).
  - Only the SHA-256 hash (`tokenHash`) is persisted in PostgreSQL; raw bearer tokens are never stored, logged, or returned in JSON responses.
  - Expired sessions are rejected server-side (HTTP 401) and deleted from the database.
  - Server-side logout immediately revokes the session in PostgreSQL, preventing session reuse.

### Domain 3: CSRF & CORS Controls

- **Findings**: State-changing requests across both Admin and Customer account boundaries require protection against cross-site request forgery.
- **Hardening Applied**:
  - Implemented session-bound HMAC-SHA256 CSRF tokens with cryptographic domain separation:
    - Admin domain: `admin-csrf:<rawToken>`
    - Customer domain: `customer-csrf:<rawToken>`
  - Verified cross-domain token substitution is strictly rejected (e.g. customer CSRF token cannot authorize an admin mutation).
  - Safe HTTP methods (`GET`, `HEAD`, `OPTIONS`) automatically bypass CSRF validation; all mutations (`POST`, `PUT`, `PATCH`, `DELETE`) enforce `x-csrf-token`.
  - CORS policy in `@fastify/cors` configured with `credentials: true`. Allowed origin strictly driven by `env.FRONTEND_URL` (never wildcard `*` with credentials). Arbitrary or spoofed origins are rejected.

### Domain 4: Authorization & IDOR / BOLA Prevention

- **Findings**: Both customer accounts and an administrative portal exist within the application. Route access must enforce strict authorization barriers.
- **Hardening Applied**:
  - Anonymous callers cannot access Admin or Customer account endpoints (HTTP 401).
  - Customer sessions cannot access Admin endpoints (HTTP 401).
  - Admin sessions cannot access Customer Account endpoints (HTTP 401).
  - Customer order detail endpoint (`GET /api/v1/account/orders/:orderNumber`) strictly scopes queries to `customerId === session.customerId`. Queries for non-existent orders or orders belonging to another customer return a uniform, ownership-safe HTTP 404 (`ORDER_NOT_FOUND`) without leaking order existence, buyer name, or shipping address.
  - No public guest order lookup endpoint exists in V1.

### Domain 5: Input Validation, Injection & Parameter Tampering

- **Findings**: Inputs must be rigorously constrained to prevent mass assignment, SQL injection, NoSQL injection, and XSS.
- **Hardening Applied**:
  - All Fastify route inputs (body, query, params) validated using strict Zod schemas with `.strict()`, rejecting unapproved, extraneous, or mass-assignment fields.
  - Parameterized database operations through Prisma ORM prevent SQL injection attacks. Search queries are treated strictly as data literals and do not evaluate SQL expressions.
  - Review text, customer names, and addresses are stored as plain text without HTML interpretation. Next.js renders content via standard React JSX escaping, preventing persistent XSS.
  - Safe redirect helper `getSafeNextUrl` strictly rejects protocol-relative (`//evil.com`), absolute (`https://evil.com`), backslash (`/\evil.com`), and `javascript:` URLs.
  - Announcement bar and CTA links strictly validated to reject dangerous URL schemes (`javascript:`, `data:`, `vbscript:`).

### Domain 6: Uploads & Third-Party Integrations

- **Findings**: Media uploads handle product imagery and customer review photos via Cloudinary.
- **Hardening Applied**:
  - Direct uploads use server-signed Cloudinary signatures with server-controlled public IDs and folder namespaces:
    - Products: `kids-wear/products/<productId>/<fileId>`
    - Reviews: `kids-wear/reviews/<submissionId>/<imageId>`
  - Client attempts to supply foreign or arbitrary public IDs/folders are rejected.
  - Upon registration, the API verifies asset metadata directly with Cloudinary (format, resource type, dimensions, exact namespace matching).
  - Reviews allow at most 3 images (JPEG, PNG, WebP only; video rejected). Products allow at most 8 images and 1 video. Videos are strictly forbidden from Main or Hover display roles.
  - Cloudinary API secret and Resend API keys are strictly kept server-side and never exposed in client payloads, public settings, or logs.

### Domain 7: Rate Limiting & Denial-of-Service Defense

- **Findings**: Public endpoints (logins, registrations, orders, reviews) are susceptible to brute-force attacks and abuse. Reverse proxies can inadvertently spoof client IPs if misconfigured.
- **Hardening Applied**:
  - In-process rate limiting (`@fastify/rate-limit`) configured across critical routes:
    - Admin login: 5 requests / 15 minutes.
    - Customer login: 5 requests / 15 minutes.
    - Customer registration: 5 requests / 15 minutes.
    - Review submission: 5 requests / 15 minutes.
    - Order creation: 10 requests / 15 minutes.
    - Global baseline: 100 requests / minute.
  - Added `TRUST_PROXY` environment setting in `apps/api/src/config/env.ts` defaulting to `false`. When disabled, Fastify uses the direct socket IP, preventing attackers from bypassing rate limits by spoofing `X-Forwarded-For` headers.
  - Order creation rate-limit bypass strictly guarded by `env.NODE_ENV !== "production" && process.env.E2E_TEST === "true" && isLoopbackAddress(req.ip)`, guaranteeing that normal development servers, normal test servers, and all production servers have ZERO localhost bypass.
  - Global request payload limit enforced via Fastify `bodyLimit: 1048576` (1 MiB), preventing memory exhaustion attacks.

### Domain 8: Error Handling, Logging & Secret Leakage

- **Findings**: Internal stack traces or database errors could leak sensitive schema or infrastructure information.
- **Hardening Applied**:
  - Global error handler converts unhandled exceptions into safe standard envelopes:
    `{ "success": false, "error": { "code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred" } }`.
  - Prisma query details, database connection strings, stack traces, and filesystem paths are never returned in HTTP responses.
  - Public settings endpoint (`GET /api/v1/public/settings`) exposes strictly public metadata (announcement bar, flat shipping rate). Bank transfer deposit coordinates (`bankName`, `accountTitle`, `accountOrIban`, `branchCode`, `branchLocation`, `instructions`) are exposed to customers via `GET /api/v1/checkout/config` strictly as public business payment details to allow manual bank deposits; these are rigorously distinguished from system secrets and private credentials (`SESSION_SECRET`, `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`) and internal administrative configurations (`newOrderNotificationRecipient`, database keys), which are never exposed.

---

## 3. HTTP Security Headers & Content Security Policy (CSP)

### 3.1 Next.js (`apps/web/next.config.mjs`)

The frontend separates production CSP from development CSP and enforces strict modern HTTP security headers across all responses:

- **Production Content-Security-Policy (CSP)**:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline'` (strictly **no `'unsafe-eval'`**)
  - `style-src 'self' 'unsafe-inline'`
  - `img-src 'self' data: blob: https://res.cloudinary.com` (strictly **no `images.unsplash.com`**)
  - `media-src 'self' blob: https://res.cloudinary.com`
  - `connect-src 'self' <derived from NEXT_PUBLIC_API_URL> https://api.cloudinary.com` (strictly **no localhost**, **no WebSockets `ws:`**, **no wildcards `*.thekidswear.com` or `*.belmo.app`**)
  - `font-src 'self' data:`
  - `object-src 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
  - `frame-ancestors 'none'`
- **Residual Risk & CSP Limitation Disclosure**:
  Because Next.js statically renders public pages and injects hydration scripts inline, the production CSP currently employs `script-src 'self' 'unsafe-inline'`. It is not a nonce-based or hash-based CSP. While `'unsafe-eval'` is strictly eliminated in production, inline script execution remains permitted for Next.js runtime bootstrapping. Future enhancement: introduce dynamic Next.js middleware with per-request cryptographic nonces when Next.js static generation architecture supports zero-overhead nonce injection.
- **Development Content-Security-Policy (CSP)**:
  - Selectively permits `'unsafe-eval'` (required for Next.js Turbopack dev server / HMR), localhost and WebSocket origins (`http://localhost:*`, `ws://localhost:*`, `http://127.0.0.1:*`, `ws://127.0.0.1:*`), and `images.unsplash.com` for local dev and E2E test fixtures.
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `DENY`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: `camera=(), microphone=(), geolocation=(), payment=()`

### 3.2 Fastify API (`apps/api/src/plugins/security.ts`)

The backend leverages `@fastify/helmet`:

- **Frameguard**: `{ action: "deny" }`
- **Referrer-Policy**: `{ policy: "strict-origin-when-cross-origin" }`
- **X-Content-Type-Options**: `nosniff`

---

## 4. Dependency Vulnerability Audit (`pnpm audit`)

Execution of `pnpm audit` across the workspace produced the following findings:

```text
pnpm audit output:
2 vulnerabilities found
Severity: 1 moderate | 1 high
```

### Detailed Vulnerability Analysis

1. **High: `braces` (via `micromatch` in dev / build toolchains)**:
   - **Advisory**: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) — _braces vulnerable to stack-exhaustion denial of service through deeply nested patterns_.
   - **Vulnerable Versions**: `<=3.0.3` (Installed: `3.0.3`).
   - **Patched Versions**: `None` (no patched version currently exists upstream for the v3 release line).
   - **Dependency Paths**:
     - `apps/web > tailwindcss > fast-glob > micromatch > braces`
     - `apps/web > tailwindcss > micromatch > braces`
     - `apps/web > tailwindcss > chokidar > braces`
     - `apps/web > eslint > @typescript-eslint/parser > micromatch > braces`
   - **Runtime Reachability**: **None**. These dependencies belong strictly to build-time CSS compilation (`tailwindcss`) and static linter analysis (`eslint`). Neither `braces` nor `micromatch` is bundled into Next.js client/server runtime bundles, nor is either invoked in response to client HTTP traffic.
   - **Remediation & Disposition**: **Deferred Build-Time Tooling Risk**. Because upstream maintains no patched version (`Patched versions: None`), a safe in-place lockfile resolution is currently impossible without introducing breaking toolchain alterations. Monitored for future upstream releases.

2. **Moderate: `postcss-selector-parser` (via `tailwindcss`)**:
   - **Advisory**: [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) — _PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion_.
   - **Vulnerable Versions**: `<7.1.6` (Installed: `6.0.10`).
   - **Patched Versions**: `>=7.1.6`.
   - **Dependency Paths**:
     - `apps/web > tailwindcss > postcss-selector-parser`
     - `apps/web > tailwindcss > postcss-nested > postcss-selector-parser`
   - **Runtime Reachability**: **None**. Tailwind CSS compiles CSS ahead of time during `next build`. The selector parser is executed strictly during build artifact generation and never processes runtime untrusted input.
   - **Remediation & Disposition**: **Deferred Build-Time Tooling Risk**. Tailwind CSS v3 pins its internal PostCSS dependencies. Forcing a major version override (to v7) creates breaking compilation errors in Tailwind v3. Monitored for Tailwind v3 upstream maintenance releases.

**Conclusion**: Zero critical runtime vulnerabilities. All flagged packages are dev/build-time tools with zero attack surface in the production runtime environment.

---

## 5. Secret Scanning Audit

A systematic scan was conducted across all repository directories for hardcoded credentials, API secrets, database passwords, and private tokens:

- **Patterns Scanned**: `sk_live`, `resend_`, `CLOUDINARY_API_SECRET`, `SESSION_SECRET`, `DATABASE_URL` with real passwords, private keys (`BEGIN PRIVATE KEY`).
- **Scan Result**: **CLEAN / ZERO LEAKS**.
  - All secrets are loaded via environment variables (`process.env`).
  - Example environment templates (`.env.example`) contain neutral dummy values (`your-secret-here`, `sk_test_...`).
  - Local gitignore rules strictly exclude `.env`, `.env.local`, `.env.production`.

---

## 6. Automated Security Test Suite (`pnpm test:security`)

A dedicated automated security regression test file (`apps/api/test/security.test.ts`) was implemented, comprising **59 comprehensive security tests** across 8 sections:

| Section       | Focus Area                                                  | Test Count |      Result      |
| :------------ | :---------------------------------------------------------- | :--------: | :--------------: |
| **Section 1** | Authorization & IDOR / BOLA Controls                        |     12     | **PASS (12/12)** |
| **Section 2** | Authentication & Session Lifecycle                          |     9      |  **PASS (9/9)**  |
| **Section 3** | Input Validation, Injection & Tampering                     |     9      |  **PASS (9/9)**  |
| **Section 4** | CORS & Security Headers                                     |     6      |  **PASS (6/6)**  |
| **Section 5** | Media Upload Trust Boundaries                               |     6      |  **PASS (6/6)**  |
| **Section 6** | Rate Limiting, Proxy Security & E2E Isolation (Tests 45–50) |     8      |  **PASS (8/8)**  |
| **Section 7** | Error & Secret Leakage Prevention                           |     4      |  **PASS (4/4)**  |
| **Section 8** | Commerce & Moderation Integrity                             |     5      |  **PASS (5/5)**  |
| **Total**     | **Comprehensive Security Suite**                            |   **59**   | **PASS (59/59)** |

---

## 7. Operational Hardening & Production Deployment Checklist (Belmo / Vercel)

Before deploying to the production staging environment, operations must ensure the following configurations:

1. **Fastify Reverse Proxy Trust (`TRUST_PROXY`)**:
   - On **Belmo**, verify whether Fastify sits behind a single reverse proxy layer. If so, configure `TRUST_PROXY=1` (or the specific proxy CIDR). If direct, retain `TRUST_PROXY=false`.
2. **Cookie Security (`COOKIE_SECURE`)**:
   - In production (`NODE_ENV=production`), ensure `COOKIE_SECURE=true` is set so that `kw_admin_session` and `kw_customer_session` cookies are transmitted strictly over HTTPS.
3. **Cookie SameSite Configuration (`COOKIE_SAME_SITE`)**:
   - If frontend (Vercel) and backend (Belmo) share a parent domain (e.g. `thekidswear.com` and `api.thekidswear.com`), set `COOKIE_SAME_SITE=lax`.
   - If deployed on distinct top-level domains, set `COOKIE_SAME_SITE=none` in conjunction with `COOKIE_SECURE=true`.
4. **CORS Allowlist (`FRONTEND_URL`)**:
   - Set `FRONTEND_URL` on the Belmo backend strictly to the verified production frontend URL (e.g. `https://thekidswear.com`).
5. **API Secrets**:
   - Inject cryptographically random, high-entropy secrets for `SESSION_SECRET` (at least 32 characters).
   - Ensure live Cloudinary and Resend API keys are provided via environment variables and never committed to version control.

---

## 8. Residual Risks & Staging Verification Requirements

The following items cannot be fully verified in local development and require explicit validation upon deployment to the live staging environment:

1. **Live Cross-Origin HTTPS Cookie Transmission**: Real-browser verification of cookie delivery between Vercel (`apps/web`) and Belmo (`apps/api`) across HTTPS origins.
2. **Live Cloudinary Uploads & Webhook Delivery**: End-to-end media upload verification with live Cloudinary credentials.
3. **Live Resend Email Delivery**: Receipt verification of transactional order notifications through the live Resend service.
