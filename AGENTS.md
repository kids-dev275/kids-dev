# AGENTS.md — Repository Instructions for AI Agents

Welcome to **Kids Wear**. All AI coding agents operating on this codebase must adhere strictly to these rules and guidelines.

---

## 12 Operational Mandates

1. **Inspect Instructions First**: Always review `AGENTS.md`, `README.md`, and module-specific instructions before modifying code.
2. **Search Before Reading**: Use targeted searches rather than reading large, unrelated parts of the repository.
3. **Read Only Relevant Dependencies**: Inspect only the files and dependencies directly related to the current task.
4. **Preserve Existing Architecture**: Maintain the modular-monolith architecture across `apps/web`, `apps/api`, and `packages/shared`.
5. **Avoid Unrelated Refactors**: Keep changes strictly scoped to the active requirement. Do not reformat or rewrite adjacent code.
6. **Avoid Unnecessary Dependencies**: Do not introduce libraries, frameworks, or microservices without explicit technical necessity.
7. **Never Expose Secrets**: Do not log, expose, or commit secrets, credentials, tokens, or environment files.
8. **Never Run Destructive Database Operations**: Never drop tables, reset schemas, or delete production data without explicit user approval.
9. **Run Targeted Verification**: Execute relevant typechecks, linter checks, and tests after every change.
10. **Truthful Verification Reporting**: Always report verification status honestly as `PASS`, `FAIL`, `NOT RUN`, or `UNAVAILABLE`.
11. **Review Final Diff**: Carefully review all changed files before finalizing your turn to eliminate debug logs, dead code, or unintended edits.
12. **Do Not Introduce Excluded V1 Features**: Never silently introduce features explicitly excluded from V1.

---

## V1 Scope Exclusions (Strictly Enforced)

Do **NOT** implement or introduce any of the following features in V1:

- **No Wishlist**
- **No Online Payment Gateway** (Payments are Cash on Delivery & Manual Bank Transfer only)
- **No Courier API or Live Courier Tracking**
- **No Loyalty or Rewards System**
- **No Mobile Application**
- **No ERP / POS Integration**
- **No AI Features**
- **No Multiple Admin Accounts** (Single Admin account in V1)
- **No Numeric Inventory Counting** (Variant availability is Boolean: available or out of stock; made-to-order model)

---

## Technical Baseline

- **Monorepo**: pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`).
- **Frontend**: Next.js App Router, Tailwind CSS, TypeScript (strict), Zod, React Hook Form, Zustand.
- **Backend**: Fastify, TypeScript (strict), Prisma, Zod, PostgreSQL (Supabase).
- **API Prefix**: All backend routes must be mounted under `/api/v1`.
- **API Response Envelope**:
  - Success: `{ "success": true, "data": <payload> }`
  - Error: `{ "success": false, "error": { "code": "<CODE>", "message": "<Safe Message>" } }`
