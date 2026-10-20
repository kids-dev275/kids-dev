# Kids Wear — E-Commerce Monorepo

Kids Wear is a production-oriented B2C apparel e-commerce platform in Pakistan supporting three storefronts:

- **Mini Sprouts**: 0–10 Years
- **Teen Studio**: 11–16 Years
- **Aura Studio**: 17+ Years

All three storefronts share one frontend application, one modular-monolith backend API, one PostgreSQL database, one Admin system, and a unified cart/checkout/order engine.

---

## Prerequisites

- **Node.js**: `v20+` (Tested on `v24.x`)
- **pnpm**: `v9+` / `v10+` / `v12+`
- **PostgreSQL**: Supabase PostgreSQL instance (or local PostgreSQL)

---

## Project Structure

```text
kids-wear/
├── apps/
│   ├── web/               # Next.js App Router frontend application
│   └── api/               # Fastify REST API backend application
│
├── packages/
│   └── shared/            # Shared TypeScript types, primitives, and constants
│
├── docs/                  # Project specifications & architecture documentation
│   ├── project-context.md
│   └── architecture.md
│
├── AGENTS.md              # AI agent guidelines and operational mandates
├── README.md              # Root documentation and commands
├── package.json           # Workspace root package configuration
├── pnpm-workspace.yaml    # pnpm workspace definition
├── .gitignore             # Root git ignore rules
└── .prettierrc            # Code formatting rules
```

---

## Environment Setup

1. Copy `.env.example` in `apps/api`:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
2. Copy `.env.example` in `apps/web`:
   ```bash
   cp apps/web/.env.example apps/web/.env
   ```
3. Update environment variables in `apps/api/.env` with your development database URLs and secrets. (Default values allow local health-check and foundation execution without a live database).

---

## Installation

Install all workspace dependencies:

```bash
pnpm install
```

---

## Development Commands

Run both the frontend and backend in parallel:

```bash
pnpm dev
```

Run individually:

```bash
pnpm dev:web    # Runs Next.js at http://localhost:3000
pnpm dev:api    # Runs Fastify API at http://localhost:4000
```

---

## Database & Prisma Commands

Prisma is configured in `apps/api/prisma/schema.prisma`.

```bash
pnpm db:validate  # Validate the Prisma schema definition
pnpm db:generate  # Generate the Prisma Client
pnpm db:migrate   # Run development migrations (requires DIRECT_URL)
```

---

## Verification & Code Quality

```bash
pnpm build         # Build shared package, API, and Web application
pnpm typecheck     # Run TypeScript strict type-checking across all packages
pnpm lint          # Run linting across all packages
pnpm format:check  # Check formatting with Prettier
pnpm format        # Auto-format files with Prettier
```

---

## Foundation Verification

- **API Health Endpoint**: `GET http://localhost:4000/api/v1/health`
- **Web Landing Screen**: `http://localhost:3000`
