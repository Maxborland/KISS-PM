# Phase 1 Node + pnpm Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the first clean Node + pnpm monorepo skeleton for KISS PM with a tested tenant/access vertical slice.

**Architecture:** The first implementation slice separates pure domain types, permission evaluation, shared fixtures, API integration, and web shell. Persistence remains in-memory for Phase 1.1 only; PostgreSQL and migrations are an explicit next decision.

**Tech Stack:** Node.js, pnpm, TypeScript, Hono, React, Vite, Vitest.

---

### Task 1: Workspace foundation

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`

- [ ] Add pnpm workspace scripts for `test`, `typecheck`, `dev:api`, and `dev:web`.
- [ ] Configure TypeScript strict mode and workspace package references.
- [ ] Configure Vitest to discover `*.test.ts` and `*.test.tsx`.
- [ ] Run `pnpm install`.

### Task 2: Domain and access tests first

**Files:**
- Create: `packages/domain/src/tenant.test.ts`
- Create: `packages/access-control/src/policy.test.ts`

- [ ] Write failing tests for tenant creation, tenant user membership, same-tenant access, and cross-tenant denial.
- [ ] Run the tests and verify they fail because implementation files are missing.

### Task 3: Minimal domain/access implementation

**Files:**
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/index.ts`
- Create: `packages/access-control/package.json`
- Create: `packages/access-control/tsconfig.json`
- Create: `packages/access-control/src/index.ts`

- [ ] Implement minimal `Tenant`, `TenantUser`, `AccessProfile`, and policy evaluation.
- [ ] Run package tests and verify they pass.

### Task 4: Shared fixtures and API test first

**Files:**
- Create: `packages/test-fixtures/src/index.ts`
- Create: `apps/api/src/app.test.ts`

- [ ] Write API integration tests for `/health`, dev login, current tenant, and cross-tenant denial.
- [ ] Run API tests and verify they fail before API implementation.

### Task 5: API implementation

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`

- [ ] Implement Hono app with deterministic demo tenants.
- [ ] Use `x-user-id` header for Phase 1.1 dev session only.
- [ ] Return `403` for cross-tenant reads.
- [ ] Run API tests and verify they pass.

### Task 6: Web shell

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`

- [ ] Implement a minimal Russian app shell explaining Phase 1 state.
- [ ] Keep UI free from domain calculations and permission rules.

### Task 7: Final verification

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run the markdown/root structure verifier if needed.
- [ ] Report exact command outcomes and unresolved risks.
