# Background Jobs Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PostgreSQL-backed background jobs foundation for scheduled jobs, retries, storage cleanup, notification dispatch, connector sync, search projection rebuild and capacity cache warmup.

**Architecture:** Domain defines safe job kinds and retry rules. Persistence stores schedules, runs and events. API exposes permissioned operator read/enqueue endpoints. The API runtime can optionally start an in-process worker that claims jobs and dispatches to a handler registry.

**Tech Stack:** TypeScript, Hono, Drizzle/PostgreSQL, Vitest, existing StorageProvider and capacity service.

---

### Task 1: Domain Contract

**Files:**
- Create: `packages/domain/src/backgroundJobs.ts`
- Create: `packages/domain/src/backgroundJobs.test.ts`
- Modify: `packages/domain/src/index.ts`

- [x] Add `BackgroundJobKind`, `BackgroundJobStatus`, `BackgroundJobEventType`, run/schedule/event types, payload normalization and retry calculation.
- [x] Cover kind validation, bounded controls and deterministic retry/dead transitions.

### Task 2: Persistence Contract

**Files:**
- Modify: `packages/persistence/src/schema.ts`
- Create: `packages/persistence/migrations/0038_phase_8_background_jobs_infrastructure.sql`
- Create: `packages/persistence/src/backgroundJobRepository.ts`
- Modify: `packages/persistence/src/repositories.ts`
- Modify: `packages/persistence/src/index.ts`
- Modify: `packages/persistence/src/schema.test.ts`
- Modify: `packages/persistence/src/migration.test.ts`

- [x] Add `background_job_schedules`, `background_job_runs`, `background_job_events`.
- [x] Add `file_assets.purged_at`.
- [x] Add repository methods for enqueue, claim, complete, fail, schedules, events and asset purge.
- [x] Prove table inventory, tenant ownership and migration content.

### Task 3: Worker And Handlers

**Files:**
- Create: `apps/api/src/backgroundJobs/backgroundJobWorker.ts`
- Create: `apps/api/src/backgroundJobs/jobHandlers.ts`
- Create: `apps/api/src/backgroundJobs/backgroundJobWorker.test.ts`
- Modify: `apps/api/src/capacity/registerCapacityRoutes.ts`

- [x] Add schedule enqueue tick and claim/run/fail worker tick.
- [x] Add default handlers for storage cleanup, notification dispatch, connector sync, search projection rebuild and capacity cache warmup.
- [x] Prove success, failure and schedule enqueue behavior.

### Task 4: API, Permissions And Runtime

**Files:**
- Modify: `packages/access-control/src/index.ts`
- Modify: `apps/api/src/tenantAdminProfile.ts`
- Modify: `apps/api/src/apiTypes.ts`
- Create: `apps/api/src/backgroundJobRoutes.ts`
- Create: `apps/api/src/backgroundJobRoutes.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/serverConfig.ts`
- Modify: `apps/api/src/serverReadiness.ts`
- Modify: `apps/api/src/serverReadiness.test.ts`

- [x] Add `tenant.background_jobs.read/manage`.
- [x] Add operator endpoints for list/events/enqueue.
- [x] Add env-gated worker startup.
- [x] Update readiness migration tag.
- [x] Prove permission, validation and runtime config behavior.

### Task 5: Docs And Verification

**Files:**
- Create: `docs/45_PHASE_12_BACKGROUND_JOBS_INFRASTRUCTURE.md`
- Modify: `docs/README.md`
- Modify: `docs/12_ФАЗОВЫЙ_ПЛАН.md`

- [x] Persist phase contract and implementation plan.
- [x] Run targeted tests.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Run `pnpm test:db`.
- [x] Run review loop and fix findings.
