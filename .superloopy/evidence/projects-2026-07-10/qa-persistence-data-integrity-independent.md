# Planning persistence/data-integrity independent audit

Date: 2026-07-10
Verdict: **APPROVE**

This final recheck supersedes the earlier REJECT. The previously blocking OpenAPI mismatch has been corrected in the current diff.

## Scope

Read-only review of the current uncommitted changes for:

- immutable and atomic baseline capture;
- immutable first acceptance and validation of accepted overload IDs;
- auto-solver overload ID production;
- OpenAPI fields against the actual planning read model.

Reviewed primary files:

- `packages/persistence/src/planningRepository.ts`
- `packages/persistence/src/planningRepository.db.test.ts`
- `packages/domain/src/planning/autoSolver.ts`
- `packages/domain/src/planning/autoSolver.test.ts`
- `apps/api/src/planning/planningRouteHelpers.ts`
- `apps/api/src/planning/planningRouteHelpers.test.ts`
- `apps/api/src/apiDocs/schemas/planning.ts`
- `apps/api/src/app.test.ts`

Related contract paths inspected: `packages/domain/src/planning/resourcePlanning.ts`, `packages/domain/src/planning/planningReadModel.ts`, `packages/domain/src/planning/scenarioPlanning.ts`, `apps/api/src/planning/planningReadModel.ts`, `apps/api/src/planning/planningCommandCore.ts`, `apps/api/src/planning/applyPlanningCommandHandler.ts`, `apps/api/src/planning/planningAutoSolverRoutes.ts`, `apps/api/src/planning/registerPlanningRoutes.ts`, and `apps/web/src/delivery/resources/resources-surface.tsx`.

No product or test file was modified. DB tests were not run, as required.

## Findings

No blocking finding remains in the reviewed persistence/data-integrity diff.

The prior OpenAPI mismatch is resolved:

- `PlanningResourceLoadBucket` and `PlanningResourceOverload` share one explicit required/property definition (`apps/api/src/apiDocs/schemas/planning.ts:20-62`, `756-776`). The overload schema expands every bucket property, requires and documents `overloadMinutes`, `accepted`, and `reasons`, and closes the object with `additionalProperties: false`; the invalid `allOf` composition is gone.
- This matches the runtime `ResourceLoadBucket` and `ResourceOverload` shapes (`packages/domain/src/planning/resourcePlanning.ts:31-71`), including the emitted `accepted` boolean (`packages/domain/src/planning/resourcePlanning.ts:126-130`).
- The canonical `resourceId:YYYY-MM-DD` schema is declared once (`apps/api/src/apiDocs/schemas/planning.ts:64-68`) and reused for command `overloadId` (`apps/api/src/apiDocs/schemas/planning.ts:645`) and read-model `acceptedOverloads` (`apps/api/src/apiDocs/schemas/planning.ts:780-785`).
- OpenAPI assertions cover the accepted-overload array pattern, required/runtime `accepted` field, and closed overload object (`apps/api/src/app.test.ts:126-148`).

## Verified behavior

### Baseline capture

- `captureBaseline` wraps the header and snapshot-row writes in one DB transaction (`packages/persistence/src/planningRepository.ts:1431-1499`). A thrown snapshot/read/calculation/child-insert error rolls back the new header and child rows.
- The header insert uses the baseline composite primary key with `onConflictDoNothing` and returns when the ID already exists (`packages/persistence/src/planningRepository.ts:1434-1444`). Duplicate and racing captures cannot update label, timestamp, task rows, or assignment rows.
- Calculated task dates are derived inside the same transaction before baseline task insertion (`packages/persistence/src/planningRepository.ts:1446-1484`).

Criterion verdict: satisfied.

### Accepted overload persistence and validation

- Persistence parses and validates the ID before insert (`packages/persistence/src/planningRepository.ts:1151-1156`, `1794-1813`). Invalid dates and malformed separators throw before any accepted-overload row is written.
- The primary-key conflict path is `onConflictDoNothing`, so the first reason, actor, and timestamp remain immutable (`packages/persistence/src/planningRepository.ts:1162-1173`; PK at `packages/persistence/src/schema/planning.ts:140-143`).
- API precondition validation emits a blocking `planning_command_invalid` issue for malformed IDs before command application (`apps/api/src/planning/planningRouteHelpers.ts:160-175`). Single-command, batch, scenario, and auto-solver apply paths run validation before `applyPlanningCommand` (`apps/api/src/planning/applyPlanningCommandHandler.ts:173-196`, `apps/api/src/planning/planningCommandCore.ts:45-54`, `apps/api/src/planning/registerPlanningRoutes.ts:831-861`, `apps/api/src/planning/planningAutoSolverRoutes.ts:470-506`).

Criterion verdict: satisfied.

### Producer format

Production producers found by literal audit emit `resourceId:YYYY-MM-DD`:

- auto-solver: `packages/domain/src/planning/autoSolver.ts:477-487`;
- scenario planning: `packages/domain/src/planning/scenarioPlanning.ts:45-48`;
- resource matrix UI: `apps/web/src/delivery/resources/resources-surface.tsx:124`.

The auto-solver overload allocation is appended on the computed overload date (`packages/domain/src/planning/autoSolver.ts:329-342`), and the command uses that allocation's resource/date (`packages/domain/src/planning/autoSolver.ts:477-487`). The unit assertion covers `resource-alpha:2026-06-01` (`packages/domain/src/planning/autoSolver.test.ts:344-354`).

Criterion verdict: satisfied.

## Checks run

1. `codegraph_status` for `E:\KISS-PM`
   - Final recheck PASS: 2,217 indexed files, 24,667 nodes, 52,719 edges.
   - `codegraph sync` was intentionally not run because it writes `.codegraph/`, while this assignment permits updating only this evidence file.

2. Current scoped `git diff` review
   - PASS: confirmed explicit overload schema expansion, `accepted`, canonical regex reuse, and focused assertions.

3. Producer inventory with `rg` over `risk.accept_overload` and `overloadId`
   - PASS: no production producer using the old `resourceId:taskId` form was found.

4. `.\node_modules\.bin\vitest.CMD run packages/domain/src/planning/autoSolver.test.ts apps/api/src/planning/planningRouteHelpers.test.ts apps/api/src/app.test.ts`
   - PASS, exit 0; 3 files, 70 tests passed (8 auto-solver, 5 route-helper, 57 API/OpenAPI shell tests).

5. `.\node_modules\.bin\tsc.CMD -p apps/api/tsconfig.json --pretty false --noEmit --tsBuildInfoFile NUL`
   - PASS, exit 0; API typecheck completed without emitting workspace build output.

6. `git diff --check -- <eight reviewed files>`
   - PASS, exit 0; no whitespace errors. Git emitted only the existing CRLF-to-LF warning for `apps/api/src/apiDocs/schemas/planning.ts`.

Not run: `planningRepository.db.test.ts`, any other DB test, browser/E2E tests, or full workspace typecheck.

## Residual risks

1. DB tests were not executed. Transaction rollback and PostgreSQL conflict behavior are supported by the implementation but have no fresh runtime evidence in this audit.

2. The DB tests commit the first acceptance/baseline before starting `Promise.all` replays (`packages/persistence/src/planningRepository.db.test.ts:386-412`, `557-598`); they do not race conflicting initial writers. The baseline suite also does not inject a failure after header insertion to prove rollback.

3. Accepted-overload parsing is duplicated between API and persistence (`apps/api/src/planning/planningRouteHelpers.ts:232-251`, `packages/persistence/src/planningRepository.ts:1794-1813`). It is consistent now, but later drift remains possible.

4. The OpenAPI regex treats `resourceId` as a non-colon segment, while persistence splits on the last colon. Current producers and persisted IDs use the canonical non-colon form; allowing colons inside resource IDs later would require a deliberate contract decision.

5. `apps/api/src/planning/planningRouteHelpers.test.ts` is untracked. It must be included in the eventual change set or malformed-ID pre-persistence coverage will be lost.

## Change index

Reviewer-authored changes: this Markdown evidence file only. Product/test symbol delta from the reviewer is 0 nodes and 0 edges. No CodeGraph post-write sync was performed because that would violate the one-file write boundary.

SUPERLOOPY_AUDIT: .superloopy/evidence/projects-2026-07-10/qa-persistence-data-integrity-independent.md
