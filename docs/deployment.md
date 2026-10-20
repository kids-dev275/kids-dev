# Kids Wear — Deployment Guide (Work Unit 25)

## Overview

This document provides the deployment specification for **Kids Wear**, covering the multi-platform target architecture across Vercel (Frontend), Belmo (Backend API), Supabase (PostgreSQL Database), Cloudinary (Media/CDN), and Resend (Transactional Email).

> [!IMPORTANT]
> **Staging Environment Status: NOT DEPLOYED**.
> External staging infrastructure (Vercel project, Belmo service, dedicated staging Supabase database, verified Cloudinary staging folder, and Resend sender verification) has not yet been provisioned. All deployment configurations and verification harnesses documented here are pre-deployment assets; live environment behavior must be verified upon actual cloud provisioning.

---

## 1. Architecture & Platform Target Matrix

| Layer                   | Platform / Provider | Workspace Target | Runtime / Framework                               | Deployment Status                                     |
| :---------------------- | :------------------ | :--------------- | :------------------------------------------------ | :---------------------------------------------------- |
| **Frontend**            | Vercel              | `apps/web`       | Next.js 16.4.1 (App Router), React 19, TypeScript | **Pending Provisioning**                              |
| **Backend API**         | Belmo               | `apps/api`       | Fastify 5.2.1, Node.js 20+, TypeScript            | **Pending Provisioning**                              |
| **Database**            | Supabase            | Managed Cloud    | PostgreSQL 16+ (Prisma ORM 7.10.1)                | **Pending Provisioning**                              |
| **Media / CDN**         | Cloudinary          | SaaS CDN         | Direct signed client uploads & CDN delivery       | **Local Arch Verified; Staging Namespace Unverified** |
| **Transactional Email** | Resend              | Cloud REST API   | Asynchronous email dispatch                       | **Configuration-Ready; Delivery Unverified**          |

---

## 2. Staging Environment Isolation Mandates

1. **Dedicated Database Project**: Staging must connect strictly to a dedicated staging Supabase PostgreSQL project. Staging must **never** connect to, seed, or migrate any future production database.
2. **Dedicated Media Namespace**: Staging media assets should be organized within a dedicated namespace/folder if supported by provider configuration, ensuring staging uploads remain distinct from future production assets.
3. **No Indexing by Search Engines**: Staging frontend deployments must emit `X-Robots-Tag: noindex, nofollow` on all HTTP responses and disallow all crawling in `robots.txt` when `APP_ENV=staging`, `NEXT_PUBLIC_APP_ENV=staging`, or `VERCEL_ENV=preview`.
4. **E2E Bypass Invariant**: `E2E_TEST` must remain **unset or false** in all deployed staging environments. No rate-limit exemptions or test bypasses may be enabled on staging.
5. **No Committed Secrets**: Secrets (`DATABASE_URL`, `SESSION_SECRET`, `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`) must never be committed to source control or logged in runtime stdout.

---

## 3. Database Deployment (Supabase PostgreSQL)

### 3.1 Connection String Setup

Supabase connection strings must be configured based on the actual provisioned staging project:

- `DATABASE_URL`: Provider-issued pooled/application connection string if applicable.
- `DIRECT_URL`: Provider-issued direct/migration connection string if architecture uses it.

> [!IMPORTANT]
> Exact host, port, and connection pooling mode must be verified directly from the staging Supabase project dashboard at provisioning time. Do not hardcode a pooler port (such as 6543) or direct port (such as 5432) as a universal project rule.

### 3.2 Migration Workflow

To apply pending relational migrations safely without interactive prompts or schema resets:

```bash
# In CI/CD or staging deployment terminal:
pnpm --filter api db:migrate:deploy
# or from root:
pnpm db:migrate:deploy
```

> [!CAUTION]
> Never execute `prisma migrate dev`, `prisma db push`, or schema reset operations against staging or production databases. Always use `prisma migrate deploy`.

### 3.3 Schema Validation & Client Generation

```bash
# Validate schema integrity against Prisma schema
pnpm db:validate

# Generate Prisma client artifacts
pnpm db:generate
```

### 3.4 Initial Operations Admin Provisioning

V1 supports exactly one Admin account (`sk.fabrica@gmail.com`). Public admin registration does not exist. Initial admin credentials are provisioned via:

```bash
# Executed via server operational shell with staging env:
ADMIN_EMAIL="sk.fabrica@gmail.com" ADMIN_PASSWORD="<STRONG_STAGING_PASSWORD>" pnpm admin:provision
```

---

## 4. Backend API Deployment (Belmo)

### 4.1 Build & Start Settings

- **Root Directory**: `.` (monorepo root) or `apps/api`
- **Build Command**:
  ```bash
  pnpm --filter @kids-wear/shared build && pnpm --filter api build
  ```
- **Start Command**:
  ```bash
  node apps/api/dist/server.js
  # Or if Belmo working directory is apps/api:
  node dist/server.js
  ```
- **Port / Host**: Fastify binds to `HOST=0.0.0.0` and `PORT=4000` (or `process.env.PORT` assigned by Belmo).

### 4.2 Belmo Environment Variables

| Variable                       | Required in Prod/Staging | Default / Format                         | Purpose                                                            |
| :----------------------------- | :----------------------- | :--------------------------------------- | :----------------------------------------------------------------- |
| `NODE_ENV`                     | Yes                      | `production`                             | Enables production optimizations and strict security checks.       |
| `HOST`                         | No                       | `0.0.0.0`                                | Server bind host.                                                  |
| `PORT`                         | No                       | `4000`                                   | Server listen port.                                                |
| `DATABASE_URL`                 | Yes                      | `postgresql://...`                       | Provider-issued pooled connection string.                          |
| `DIRECT_URL`                   | Yes                      | `postgresql://...`                       | Provider-issued direct connection string for migrations.           |
| `FRONTEND_URL`                 | Yes                      | `https://<authoritative-staging-origin>` | Exact staging frontend origin for CORS allowlisting.               |
| `SESSION_SECRET`               | Yes                      | 32+ character high-entropy secret        | Signs session cookies and derives HMAC CSRF tokens.                |
| `ADMIN_SESSION_COOKIE_NAME`    | No                       | `kw_admin_session`                       | Name of the Admin session cookie.                                  |
| `CUSTOMER_SESSION_COOKIE_NAME` | No                       | `kw_customer_session`                    | Name of the Customer session cookie.                               |
| `COOKIE_SECURE`                | Yes                      | `true`                                   | Requires HTTPS for session cookies (must be true in prod/staging). |
| `COOKIE_SAME_SITE`             | Yes                      | `none` (cross-site) or `lax` (same-site) | SameSite cookie policy based on deployed origin topology.          |
| `TRUST_PROXY`                  | Yes                      | `false`                                  | Reverse proxy trust configuration.                                 |
| `CLOUDINARY_CLOUD_NAME`        | Yes                      | String                                   | Cloudinary cloud identifier.                                       |
| `CLOUDINARY_API_KEY`           | Yes                      | String                                   | Cloudinary public API key.                                         |
| `CLOUDINARY_API_SECRET`        | Yes                      | String                                   | Cloudinary server-only secret for signature generation.            |
| `RESEND_API_KEY`               | Optional                 | `re_...`                                 | Resend API key for transactional email notifications.              |
| `RESEND_FROM_EMAIL`            | Optional                 | `Kids Wear <notifications@example.com>`  | Verified sender address in Resend.                                 |

### 4.3 Proxy Trust (`TRUST_PROXY`)

`TRUST_PROXY=false` prevents trusting spoofed forwarding headers, but live staging must determine whether `request.ip` then resolves to a shared proxy IP. If so, the exact trusted-proxy topology must be configured before production. Do not blindly use `TRUST_PROXY=1`.

### 4.4 Rate Limiting Configuration

Authoritative runtime configuration:

- **Global API Fallback**: 100 requests / 1 minute / IP ([apps/api/src/plugins/security.ts](file:///d:/Web%20Dev%20Projects/Kids%20Wear/apps/api/src/plugins/security.ts))
- **Admin Login**: 5 attempts / 15 minutes / IP ([apps/api/src/modules/admin-auth/routes.ts](file:///d:/Web%20Dev%20Projects/Kids%20Wear/apps/api/src/modules/admin-auth/routes.ts))
- **Customer Login**: 5 attempts / 15 minutes / IP ([apps/api/src/modules/customer-auth/routes.ts](file:///d:/Web%20Dev%20Projects/Kids%20Wear/apps/api/src/modules/customer-auth/routes.ts))
- **Customer Registration**: 5 attempts / 15 minutes / IP ([apps/api/src/modules/customer-auth/routes.ts](file:///d:/Web%20Dev%20Projects/Kids%20Wear/apps/api/src/modules/customer-auth/routes.ts))
- **Review Submission**: 5 submissions / 15 minutes / IP ([apps/api/src/modules/review/routes.ts](file:///d:/Web%20Dev%20Projects/Kids%20Wear/apps/api/src/modules/review/routes.ts))
- **Order Creation**: 10 orders / 15 minutes / IP ([apps/api/src/modules/order/routes.ts](file:///d:/Web%20Dev%20Projects/Kids%20Wear/apps/api/src/modules/order/routes.ts))

---

## 5. Frontend Deployment (Vercel)

### 5.1 Project & Monorepo Settings

- **Framework Preset**: Next.js
- **Root Directory**: `apps/web` (or monorepo root with `apps/web` build target)
- **Install Command**: `pnpm install`
- **Build Command**:
  ```bash
  pnpm --filter @kids-wear/shared build && pnpm --filter web build
  ```
- **Output Directory**: `.next`

### 5.2 Vercel Environment Variables

| Variable               | Environment    | Format                                       | Description                                                          |
| :--------------------- | :------------- | :------------------------------------------- | :------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | Staging / Prod | `https://<authoritative-staging-api>/api/v1` | Public backend API base URL for client-side fetches.                 |
| `INTERNAL_API_URL`     | Staging / Prod | `https://<authoritative-staging-api>/api/v1` | Optional direct backend URL for server-side Next.js fetches.         |
| `NEXT_PUBLIC_SITE_URL` | Staging / Prod | `https://<authoritative-staging-origin>`     | Authoritative frontend origin used for canonical URLs and sitemaps.  |
| `APP_ENV`              | Staging        | `staging`                                    | Triggers `X-Robots-Tag: noindex, nofollow` and staging robots rules. |

---

## 6. Origin Topology, CORS & Cookie Architecture

### 6.1 Cross-Site Topology (Provider Default)

When the frontend is deployed at `https://<staging-frontend>.vercel.app` and the API at `https://<staging-api>.belmo.app`:

- **CORS**: Belmo must set `FRONTEND_URL="https://<staging-frontend>.vercel.app"`. Fastify allows this origin with `credentials: true`.
- **Cookies**: Because `.vercel.app` and `.belmo.app` are different registrable domains, cookies sent in cross-origin fetch requests are cross-site.
  - Expected candidate configuration:
    - `COOKIE_SAME_SITE="none"`
    - `COOKIE_SECURE="true"`
    - Client `fetch` options: `credentials: "include"`
  - **Staging Verification Requirement**:
    > [!IMPORTANT]
    > This configuration must be verified in real browsers during live staging. `SameSite=None` does not by itself prove compatibility with browser third-party-cookie restrictions. Do not claim session topology is staging-verified until Customer and Admin login/mutations work on the actual deployed origins.
- **CSRF Protection**:
  - The frontend fetches a session-bound HMAC-SHA256 CSRF token via `GET /api/v1/admin/auth/csrf` (Admin) or `GET /api/v1/auth/csrf` (Customer).
  - All state-changing mutations transmit the token in the `X-CSRF-Token` header.
  - Cross-site cookie topology is protected against CSRF attacks by this mechanism.

### 6.2 Same-Site Topology (Custom Subdomains)

If custom subdomains sharing a single root domain are provisioned in the future:

- Both origins share the same registrable domain.
- `COOKIE_SAME_SITE="lax"` can be used.
- Browser cross-site cookie restrictions are avoided.

---

## 7. Cloudinary & Media Workflow

1. **Current Status**:
   - **Local Architecture / Integration**: Verified. Fastify generates signed upload signatures, browser uploads directly to Cloudinary, metadata persisted in PostgreSQL.
   - **Remote Staging Namespace / Upload**: **NOT VERIFIED** (Pending live cloud staging).
2. **CSP Configuration**:
   - `connect-src` includes `https://api.cloudinary.com`
   - `img-src` includes `https://res.cloudinary.com`
   - `media-src` includes `https://res.cloudinary.com`

---

## 8. Resend Email Integration

1. **Current Status**:
   - **Configuration-Ready**: Email dispatch architecture is implemented with graceful degradation.
   - **Delivery**: **NOT VERIFIED** (Pending remote staging deployment and sender domain verification).
2. **Resilience & Fault Tolerance**:
   - Email dispatch is executed asynchronously after the database order transaction commits.
   - If Resend API credentials are unset, unverified, or return an error, the order creation **never rolls back**. The order succeeds with status `ORDER_RECEIVED` (COD) or `AWAITING_PAYMENT` (Bank Transfer).

---

## 9. Order Number Format

- **Authoritative Runtime Format**: `KW-1001`, `KW-1002`, `KW-1003`, ...
- **Implementation**: Derived directly from PostgreSQL sequence `order_number_seq` ([apps/api/src/modules/order/routes.ts](file:///d:/Web%20Dev%20Projects/Kids%20Wear/apps/api/src/modules/order/routes.ts)):
  ```typescript
  const [{ nextval: nextVal }] = await tx.$queryRaw<Array<{ nextval: bigint }>>(
    Prisma.sql`SELECT nextval('order_number_seq') AS nextval`
  );
  const orderNumber = `KW-${nextVal.toString()}`;
  ```
- **Constraint**: Formats such as `KW-YYYYMMDD-XXXX` do not exist in the codebase and must not be documented.

---

## 10. Rollback & Redeployment Procedures

### 10.1 Frontend Rollback (Vercel)

1. Navigate to the Vercel Dashboard → Project → Deployments.
2. Identify the previous stable deployment.
3. Click `...` → **Instant Rollback** (or **Promote to Production / Staging**).
4. Traffic instantly routes to the previous build artifacts without rebuilding.

### 10.2 API Rollback (Belmo)

1. Navigate to the Belmo Dashboard → Service → Deployment History.
2. Select the prior verified container build/revision.
3. Click **Redeploy Revision**.
4. Traffic routes to the previous container image upon passing health check (`GET /api/v1/health`).

### 10.3 Database Migration Policy (Forward-Only)

- Database schema migrations are strictly forward-compatible.
- Rollbacks are executed by deploying a new forward migration (`pnpm db:migrate:deploy`), never by running manual DROP statements or uncoordinated downgrades.

---

## 11. Staging Smoke Verification Harness

The repository includes a dedicated staging smoke test runner ([scripts/staging-smoke.ts](file:///d:/Web%20Dev%20Projects/Kids%20Wear/scripts/staging-smoke.ts)) with production safety guards:

```bash
# Non-destructive public health & SEO checks:
STAGING_WEB_URL="https://<authoritative-staging-origin>" \
STAGING_API_URL="https://<authoritative-staging-api>/api/v1" \
pnpm test:staging

# Destructive/transactional staging checks (requires explicit opt-in):
STAGING_WEB_URL="https://<authoritative-staging-origin>" \
STAGING_API_URL="https://<authoritative-staging-api>/api/v1" \
STAGING_TEST_MODE="true" \
pnpm test:staging
```

### Safety Guard Validations:

- Fails closed if either `STAGING_WEB_URL` or `STAGING_API_URL` is missing.
- Fails closed if URLs are identical or point to recognized production origins.
- Fails closed on any destructive checks (Order creation, Customer registration, Admin state, Reviews, Settings, Media upload) unless `STAGING_TEST_MODE=true` is explicitly provided.
