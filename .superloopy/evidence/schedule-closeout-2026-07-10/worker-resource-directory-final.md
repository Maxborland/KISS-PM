# Franky: Schedule resource directory contract

- Timestamp: 2026-07-10 18:08:13 +07:00
- Role: franky executor
- Implementation status: complete
- Gate verdict: PASS
- Scope discipline: no TSV/import, commits, API docs, Saved Views, or matrix files were edited by this worker.

## Result

Schedule no longer reads the nonexistent PlanningReadModel.authored.resources. ProjectSchedule now resolves resource names and selector data through useResourceDirectory().

An empty resource override is treated as absent. During live startup Schedule omits the empty optional prop, so selectors retain the live client path. A non-empty override remains authoritative for mock/test usage. The unchanged live client implementation calls GET /api/workspace/users.

## Files touched by this worker

- apps/web/src/delivery/schedule/schedule-surface.tsx
  - removed PlanningAuthoredWithResources, EMPTY_PLANNING_RESOURCES, and planningResourcesOf;
  - added the ProjectSchedule -> useResourceDirectory call;
  - omitted an empty live selector override;
  - retained static RESOURCES only in the pure mock optimistic-label fallback.
- apps/web/src/delivery/lib/use-resource-directory.ts
  - normalized override: [] to no override;
  - retained non-empty override semantics;
  - retained live createDeliveryPlanningClient(...).getResourceDirectory() loading.
- apps/web/src/delivery/lib/use-resource-directory.test.tsx
  - added live empty-override regression coverage.
- apps/web/src/delivery/lib/use-resource-directory-override.test.tsx
  - made the override contract explicitly mock-runtime coverage.
- apps/web/src/delivery/schedule/schedule-batch-integrity.test.tsx
  - narrow adjustment in a pre-existing untracked test: mocked the directory hook and removed the invalid authored.resources fixture.
- .superloopy/evidence/schedule-closeout-2026-07-10/worker-resource-directory-final.md

The workspace already contained a large dirty diff in schedule-surface.tsx and the untracked batch test. Those unrelated edits were preserved.

## Fresh verification

1. PASS: targeted tests

   pnpm vitest run apps/web/src/delivery/lib/use-resource-directory.test.tsx apps/web/src/delivery/lib/use-resource-directory-override.test.tsx apps/web/src/delivery/schedule/schedule-batch-integrity.test.tsx

   Result: 3 test files passed, 13 tests passed, exit 0.

2. PASS: contract assertion

   PowerShell assertion checked:
   - no authored.resources, PlanningAuthoredWithResources, or planningResourcesOf remains in Schedule;
   - Schedule calls useResourceDirectory();
   - live client still targets /api/workspace/users.

   Result: exit 0.

3. PASS: scoped diff hygiene

   git diff --check -- <five scoped source/test files>

   Result: exit 0. Only existing CRLF-to-LF warnings were printed.

4. PASS: CodeGraph synchronization

   codegraph sync

   Result: exit 0, index already up to date after watcher sync.

5. PASS: required full web typecheck

   pnpm --filter @kiss-pm/web typecheck

   Final fresh result: exit 0. Next route type generation and TypeScript compilation both passed. An earlier run was transiently blocked by concurrent out-of-scope commits-test edits; their owner completed that work before the final rerun. This worker did not edit the commits file.



## CodeGraph change index

Before:
- PlanningAuthoredWithResources existed as a type node at schedule-surface.tsx:57.
- ProjectSchedule did not call the shared directory hook in the current workspace source.
- useResourceDirectory treated any array, including [], as an authoritative override.
- Impact query for useResourceDirectory: 15 affected symbols across the hook, assignments, resources, overview, and Schedule editors.

After:
- search for PlanningAuthoredWithResources: 0 nodes.
- ProjectSchedule source contains useResourceDirectory() and the live empty-override guard.
- useResourceDirectory keeps its public symbol/signature and existing usePlanningRuntime / createDeliveryPlanningClient call edges; only empty-override behavior changed.
- Impact remains 15 symbols, so no shared API expansion was introduced.
- Index totals: 2,237 files, 25,070 nodes, 53,317 edges.

## Risks


- If a selector opens before the parent live directory request resolves, the nested editor may issue its own live directory request. This is bounded and preserves correctness; after the parent list resolves, its non-empty override is reused.
- No browser smoke was run; requested targeted tests cover hook lifecycle, empty live override, mock override, and Schedule integration.

## Editing fallback

Manual apply_patch was attempted first and failed before file access because the Windows restricted-token sandbox could not prepare the writable-root wrapper. The same narrow edits were then applied with checked exact/regex replacements through PowerShell, followed by git diff --check, tests, and typecheck.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/schedule-closeout-2026-07-10/worker-resource-directory-final.md
