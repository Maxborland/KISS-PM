# Backend Auto-Solver Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five architecture review findings for the backend planning/auto-solver slice without changing frontend surfaces.

**Architecture:** Keep existing public API contracts stable. Deepen backend Modules behind focused seams: persisted proposal codec, governed planning apply, planning repository internal modules, real bounded solver search state, and test fixtures.

**Tech Stack:** TypeScript, Hono route handlers, pnpm, Vitest, Drizzle/Postgres persistence, KISS PM domain planning engine.

---

## Product Intent
- User / role: project manager, resource manager, control/action engine consuming auto-solver proposals.
- Customer need: solver proposals must be real, persisted, permissioned, auditable, and reliable enough to plan around resource constraints without hidden preview/apply drift.
- Value: reduces planning conflicts and keeps ManagementAction/AuditEvent trust intact.
- Non-goals: no frontend changes, no new UI, no import/export, no minute-slot calendar rewrite.

## Acceptance Criteria
- AC1: Auto-solver search Interface is no longer misleading; `beamWidth` controls actual bounded candidate-state search.
- AC2: Direct command, PlanningScenario apply, and auto-solver apply share a governed planning apply Module for preview/precondition/apply/increment/audit mechanics.
- AC3: Scenario/solver persisted proposals use one codec Module for validation, stable hash, and safe parsing.
- AC4: PlanningRepository keeps the same external Interface but moves WBS ordering and proposal run storage to internal focused Modules.
- AC5: Planning DB/API tests use a focused test fixture Module for repeated tenant/project/task setup.
- AC6: `pnpm typecheck`, `pnpm test`, targeted API DB and persistence DB tests pass.

## Files
- Create: `apps/api/src/planningProposalCodec.ts`
- Create: `apps/api/src/governedPlanningApply.ts`
- Create: `apps/api/src/planningTestFixture.ts`
- Create: `packages/persistence/src/planningWbs.ts`
- Create: `packages/persistence/src/planningProposalRuns.ts`
- Modify: `apps/api/src/planningRoutes.ts`
- Modify: `apps/api/src/planningRoutes.db.test.ts`
- Modify: `packages/domain/src/planning/autoSolver.ts`
- Modify: `packages/domain/src/planning/autoSolver.test.ts`
- Modify: `packages/persistence/src/planningRepository.ts`
- Modify: `packages/persistence/src/planningRepository.db.test.ts`
- Modify: `docs/31_PHASE_7_8_AUTO_SOLVER_BACKEND.md`

## Tasks
- [ ] Task 1: Add planning DB test fixture Module and migrate repeated API DB setup.
- [ ] Task 2: Add persisted proposal codec Module and use it for scenario/solver proposal parsing and hashing.
- [ ] Task 3: Extract governed planning apply Module used by direct command, scenario apply, and auto-solver apply.
- [ ] Task 4: Extract persistence internal Modules for WBS ordering and proposal run storage.
- [ ] Task 5: Replace greedy solver core with bounded beam-state search and add ranking tests proving `beamWidth` behavior.
- [ ] Task 6: Update contract doc and run verification.
